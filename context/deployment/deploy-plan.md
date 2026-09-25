---
project: sidereus
platform: Cloudflare Workers (Static Assets)
approved_at: 2026-09-21
status: deployed
source: Plan Mode deploy, based on context/foundation/infrastructure.md and tech-stack.md
---

# First deployment of Sidereus to Cloudflare Workers

## Context

`context/foundation/infrastructure.md` (written today) records the platform decision: **Cloudflare Workers with Static Assets, Free plan**, runner-up Vercel. `tech-stack.md` pins Astro 7.3.2 SSR + React 19, `@astrojs/cloudflare` 14.3.1, `wrangler` 4.131.1, Node 24, Supabase for Postgres + Auth. The scaffold is the untouched starter plus `context/`; `wrangler.jsonc` is already in the Workers shape (`main: "@astrojs/cloudflare/entrypoints/server"`, `assets.directory: ./dist`, `nodejs_compat`, observability on) and the Worker was renamed to `sidereus` earlier today.

Goal of this plan: get the scaffold live on a `*.workers.dev` URL with Supabase auth working end to end, and persist the approved plan at `context/deployment/deploy-plan.md` as the audit trail for later milestone planning. Not in scope: custom domain, KV forecast cache (no code uses it yet), CI auto-deploy job (PRD schedules it for the final week), Docker, multi-region.

**Deploy command is `npx wrangler deploy`.** Never `wrangler pages deploy`: the adapter dropped Pages at v13.

## Current state (verified read-only)

| Item | State |
|---|---|
| Cloudflare auth | Not logged in (`wrangler whoami` says unauthenticated) |
| Supabase | Local `supabase/config.toml` only; no hosted project linked; no `.env` / `.dev.vars` |
| Env access in code | `src/lib/supabase.ts` and `src/lib/config-status.ts` read `SUPABASE_URL` / `SUPABASE_KEY` from `astro:env/server` (schema in `astro.config.mjs`, `access: "secret"`, optional). Missing values → `createClient` returns null, auth disabled, banner shown. Workers Secrets with the same names satisfy this at runtime. |
| Git | `origin` = github.com/RafalSkwara/Sidereus, branch `main`, clean apart from today's edits |
| CI | `.github/workflows/ci.yml` triggers on `master` but the branch is `main` → CI has never run (flagged, optional fix below) |
| Smoke test | `scripts/smoke.mjs` walks signup → signin → dashboard → signout over HTTP against `BASE_URL`; requires Supabase email confirmation OFF to pass |
| Build output | No `dist/` yet |

## Plan

Legend: **[HUMAN]** = manual gate the agent cannot do or must not do unattended. **[AGENT]** = the agent runs it. Every agent step is non-interactive and idempotent.

### Step 0 — Persist this plan [AGENT]
Write the approved plan to `context/deployment/deploy-plan.md` (create `context/deployment/`). Update it at the end with the live URL and what was actually wired.

### Step 1 — Config touch-ups [AGENT]
Files: `wrangler.jsonc`, `context/foundation/tech-stack.md` (already done), `.github/workflows/ci.yml` (optional).
1. Add `"global_fetch_strictly_public"` to `compatibility_flags` in `wrangler.jsonc` (Astro's Cloudflare deploy guide recommendation; listed in the risk register).
2. **Optional, flagged:** change `branches: [master]` → `branches: [main]` in both triggers of `ci.yml` so CI actually runs. Strike this line if you want CI left untouched for now.
3. Sanity: `npm run lint`, `npx astro check`, `npm run build` must pass locally. `dist/` is gitignored.

### Step 2 — Cloudflare account and login [HUMAN]
1. Have a Cloudflare account (free). 
2. Run in this session: `! npx wrangler login` (opens browser, OAuth). Then the agent verifies with `npx wrangler whoami`. If the account has more than one membership, the agent adds `"account_id": "<id>"` to `wrangler.jsonc`.

### Step 3 — First deploy, no secrets yet [AGENT]
Purpose: prove the platform path before any Supabase dependency.
```
npm run build
npx wrangler deploy --dry-run        # bundle + config validation, uploads nothing
npx wrangler deploy                  # creates Worker "sidereus", uploads dist/ as static assets
npx wrangler deployments status
```
Expected: URL `https://sidereus.<subdomain>.workers.dev`. Verify `curl -sI <url>/` → 200; `curl -sI <url>/dashboard` → 302 to `/auth/signin`; page shows the "Supabase not configured" banner. Record the URL in `deploy-plan.md`.

### Step 4 — Hosted Supabase project [HUMAN]
1. Create a project at supabase.com. Recommended region **eu-central-1 (Frankfurt)**, closest to the author; name `sidereus`. Choose and store the DB password (not needed by the app).
2. In **Authentication → Providers → Email**: turn **Confirm email OFF** (PRD dropped verification; smoke test depends on it). Keep minimum password length ≥ 6 to match local config.
3. In **Authentication → URL Configuration**: Site URL = the workers.dev URL from Step 3; add it to Redirect URLs as well.
4. Copy **Project URL** and the **anon / publishable key** from Project Settings → API. Do not share the service-role key with the agent; the app only needs anon.
5. Optional for local dev: create `.dev.vars` and `.env` (both gitignored) with the two values so `npm run dev` runs against the hosted project. The agent may write these files if you paste the values; they never leave the machine.

### Step 5 — Wire secrets into the Worker [AGENT, values supplied by HUMAN]
`wrangler secret put` reads stdin non-interactively and triggers an immediate new deployment each time, so set both in one bulk call:
```
# secrets.json is written to the scratchpad dir, never the repo, and deleted after
npx wrangler secret bulk /path/to/scratchpad/secrets.json
npx wrangler secret list           # expect SUPABASE_URL, SUPABASE_KEY (names only)
```
Then redeploy once so the build embeds nothing and the runtime reads the secrets:
```
npm run build && npx wrangler deploy
```

### Step 6 — Verify end to end [AGENT]
1. `curl -sI <url>/` → 200 and no config banner text in `curl -s <url>/ | grep -c "nie jest skonfigurowany"` (expect 0).
2. `BASE_URL=<url> npm run smoke` → all 8 steps PASS (creates one throwaway `smoke-<ts>@example.com` user in the hosted project; acceptable, or delete it in the Supabase dashboard afterwards).
3. `npx wrangler tail sidereus --format json --status error` for 60 s while running the smoke test → no error events.
4. `npx wrangler deployments list` → two or three deployments visible; note the current version id in `deploy-plan.md` as the rollback target.

### Step 7 — Close out [AGENT]
1. Update `context/deployment/deploy-plan.md`: live URL, current version id, which secrets are wired (names only), Supabase project ref and region, what was skipped (KV, custom domain, CI deploy job), and the rollback command `npx wrangler rollback <version-id> -m "reason" -y`.
2. Update `README.md` Deployment section only if a command there is now wrong (currently correct).
3. Do **not** commit or push unless asked.

## Rollback
`npx wrangler deployments list --json` → pick previous version → `npx wrangler rollback <version-id> -m "<reason>" -y`. Seconds. Secrets are per-Worker and survive rollback. Nothing in Supabase is touched by a rollback.

## Approval boundary (from infrastructure.md)
Human-only: `wrangler login`, plan upgrade to Paid, deleting the Worker, creating the Supabase project, revealing keys. Agent unattended: build, `--dry-run`, `deploy`, `secret bulk` with human-supplied values, `tail`, `deployments list`, smoke test.

## Verification summary
- Worker responds 200 on `/` and 302 on `/dashboard` before secrets (Step 3).
- Banner disappears and `npm run smoke` passes 8/8 against the live URL after secrets (Step 6).
- `wrangler tail` shows no error invocations during the smoke run.
- `deploy-plan.md` exists with URL, version id and wired-secret names.


## Execution log

_(filled in as steps complete)_

- 2026-09-21 Step 0 done: plan persisted here.
- 2026-09-21 Step 1 done: added `global_fetch_strictly_public` to `wrangler.jsonc`; fixed `ci.yml` triggers `master` → `main`; `npm run lint`, `npx astro check` (0 errors), `npm run build` all pass. `npx wrangler deploy --dry-run` passes: 28 modules, 2.06 MiB upload (456 KiB gzip), 11 static assets.
- Finding: the adapter auto-declares two bindings not present in `wrangler.jsonc`: `SESSION` (KV namespace, no id → wrangler will auto-provision one on first real deploy, Free plan) and `IMAGES` (Images binding, no resource created). Astro sessions are on by default; the app uses Supabase cookies instead. Left as-is for the first deploy; can be disabled later with `session: false` in `astro.config.mjs`.
- Step 2 pending: waiting for human `wrangler login`.
- 2026-09-21 Step 2 done: `wrangler login` (OAuth) by human; `whoami` shows a single account (id `1c6afca33ec620a5ef59c2bd47d968fa`), so no `account_id` needed in config.
- 2026-09-21 Step 3 done: first `npx wrangler deploy`. Worker `sidereus` created; wrangler auto-provisioned KV namespace `sidereus-session` (id `900a075e638143d2a33976ab9c903b48`) for the adapter's `SESSION` binding. Live URL: **https://sidereus.sidereus.workers.dev**. Version `02f42e8e-dad1-45e2-9e4a-48c2155bbe07` (rollback target for the no-secrets state). Startup 18 ms. Verified: `/` 200 in ~0.3 s with "Supabase not configured" banner; `/dashboard` 302 → `/auth/signin`; `/auth/signin` 200; `/favicon.png` 200 image/png; unknown path 404. DNS for the new workers.dev subdomain took ~1 min to propagate.
- Step 4 pending: waiting for human to create the hosted Supabase project and supply Project URL + anon key.
- Decision: keep account subdomain `sidereus.workers.dev` (so the Worker URL is `sidereus.sidereus.workers.dev`); a custom domain will be added later via a `routes` entry in `wrangler.jsonc`. Not in this deploy's scope.
- 2026-09-21 Step 4 done (human): hosted Supabase project created, ref `kzdovsrpyxhfduusaqlu` (URL `https://kzdovsrpyxhfduusaqlu.supabase.co`), email confirmation off, Site URL + redirect set to the workers.dev URL. Region as chosen by the user (not verified by the agent).
- 2026-09-21 Step 5 done: `wrangler secret bulk` set `SUPABASE_URL` and `SUPABASE_KEY` (publishable key `sb_publishable_…`, not the legacy anon JWT) → auto-deployed version `ad8e46c4-39e2-484c-8470-ab045258590d`; then `wrangler deploy` → **current version `48254699-c18b-4ad0-9e1f-0fe1d237a7cc`**. `wrangler secret list` shows exactly those two names. Local `.env` / `.dev.vars` were NOT created (write denied by a permission rule); the human creates them by hand with the same two lines.
- 2026-09-21 Step 6 done: `/` 200 with no config banner; `/dashboard` 302 for anonymous. `BASE_URL=https://sidereus.sidereus.workers.dev npm run smoke` → **8/8 PASS** (created throwaway user `smoke-<timestamp>@example.com` in the hosted project; safe to delete in Supabase → Authentication → Users). `wrangler tail --format json` during the run: 18 events, all `outcome: ok`, 0 exceptions. CPU time: `/` warm 1–3 ms; auth POSTs 6–13 ms; two cold-isolate requests 12 and 15 ms (over the nominal 10 ms Free cap yet still `ok`; Cloudflare enforces the cap on a rolling basis, not per request).
- Trigger refinement (feeds infrastructure.md risk register): the original "p95 cpuTime > 7 ms" trigger is too naive because cold starts alone exceed it. Refined trigger: (a) any event with `outcome: exceededCpu` or HTTP 1102 → upgrade to Workers Paid immediately; (b) warm-request p95 (excluding first request after idle) above 8 ms on the Tonight view once product code exists → upgrade proactively.

## Final state

| Item | Value |
|---|---|
| Live URL | https://sidereus.sidereus.workers.dev |
| Worker name / account | `sidereus` / account id `1c6afca33ec620a5ef59c2bd47d968fa` (Free plan) |
| Current version | `48254699-c18b-4ad0-9e1f-0fe1d237a7cc` |
| Previous versions | `ad8e46c4-…` (secrets added), `02f42e8e-…` (first deploy, no secrets) |
| Secrets wired (names only) | `SUPABASE_URL`, `SUPABASE_KEY` |
| Auto-provisioned resources | KV namespace `sidereus-session` (`900a075e638143d2a33976ab9c903b48`) for the adapter's `SESSION` binding; `IMAGES` binding (no resource) |
| Supabase | project ref `kzdovsrpyxhfduusaqlu`, publishable key in use, email confirmation off |
| Rollback | `npx wrangler rollback <version-id> -m "<reason>" -y` (secrets and KV untouched) |
| Skipped (out of scope) | custom domain (user will add later), KV forecast cache (no code yet), CI deploy job (PRD final week; `ci.yml` branch trigger fixed to `main` so the existing lint/check/build/smoke jobs now run), local `.env`/`.dev.vars` (human) |

## Database migrations

Added with change `sites-and-gear-management` (the first schema). Migrations live in `supabase/migrations/` and reach the hosted project `kzdovsrpyxhfduusaqlu` through CI; the app deploy (`npx wrangler deploy`) stays manual until F-02.

**GitHub environment secrets** **[HUMAN]**: create the environment `production` (Settings → Environments → New environment), set Deployment branches to `main` only (optionally add yourself as a required reviewer, which makes each migration wait for an approval click), and add both secrets under its Environment secrets. The `migrate` job declares `environment: production`, so no other job or branch can read them. CLI alternative: `gh secret set <NAME> --env production`.

| Secret | Where to get it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase dashboard → Account → Access Tokens → generate a personal access token. It is account-wide (every project), so revoke it there if CI access should end |
| `SUPABASE_DB_PASSWORD` | The database password chosen when the project was created (Step 4); reset it under Project Settings → Database if lost |

**`migrate` job gating** (`.github/workflows/ci.yml`): `needs: [ci, smoke]`, `environment: production`, runs only when `github.event_name == 'push' && github.ref == 'refs/heads/main'`, `concurrency: migrate` so two pushes never migrate at once. Steps: checkout → `supabase/setup-cli@v1` → `supabase link --project-ref kzdovsrpyxhfduusaqlu` → `supabase db push`. Pull requests never touch the hosted database; the `smoke` job applies migrations to a throwaway local Supabase, runs `npm run test:db` (RLS isolation suite) and checks `src/lib/database.types.ts` for drift.

**Manual fallback** (if the job fails or secrets are missing), from the repo root with the same two values in the environment:
```
npx supabase link --project-ref kzdovsrpyxhfduusaqlu
npx supabase db push
```
`db push` applies only migrations not yet recorded in the remote `supabase_migrations.schema_migrations` table and prints them first.

**Rules**:
- Forward-only. Never edit or delete a migration that has been pushed; fix mistakes with a new migration.
- Additive until F-02. Because `migrate` runs on merge while the Worker deploy is manual and may lag, the live app can run against a newer schema. That is safe only while migrations add (tables, nullable or defaulted columns, policies) and never drop, rename or tighten what the deployed code uses. `20260924120000_sites_and_gear.sql` is additive (three new tables). A breaking migration needs a coordinated deploy, and F-02's CI deploy job should then run the app deploy in the same pipeline.

### Migration log

_(one dated line per production push; none has run yet)_
