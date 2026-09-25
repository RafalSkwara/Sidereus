---
project: sidereus
researched_at: 2026-09-21
recommended_platform: Cloudflare Workers (Static Assets)
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7.3 (SSR, React 19 islands)
  runtime: Cloudflare workerd via @astrojs/cloudflare 14.3 (wrangler 4.131, Node 24 tooling)
  database: Supabase (Postgres + Auth, external, HTTPS via @supabase/ssr)
plan_decision: Workers Free first; upgrade to Workers Paid ($5/mo) on defined trigger (see Risk Register)
---

## Recommendation

**Deploy on Cloudflare Workers with Static Assets, starting on the Free plan.**

Cloudflare is the only candidate that scored Pass on all five agent-friendly
criteria with every relevant feature GA, and the only one that renders SSR at
the edge worldwide, which the interview flagged as a priority (global reach:
yes). The stack is already pinned to it: `@astrojs/cloudflare` 14.3.1 and
`wrangler` 4.131.1 are installed and `wrangler.jsonc` is already in the Workers
shape, so no adapter swap is needed. Persistent connections are not required,
the data layer is external (Supabase), and cost vs DX was weighted equally, so
nothing pulled toward a container PaaS. The user chose to start on the Free
plan because this is primarily a course project; the upgrade trigger to Paid is
recorded below.

**Correction to `tech-stack.md`:** its `deployment_target: cloudflare-pages` is
stale. Adapter v13+ dropped Cloudflare Pages entirely and Cloudflare itself
steers new projects to Workers. The target is **Cloudflare Workers**; update
the hint to `cloudflare-workers`. `wrangler pages deploy` and `wrangler deploy`
are different commands and are not interchangeable; this project uses
`wrangler deploy`.

## Platform Comparison

Hard filters: none dropped. Interview Q1 = No persistent connections, so
Netlify and Vercel stay in. All six run Astro 7 SSR (Cloudflare via the pinned
adapter; Vercel and Netlify via `@astrojs/vercel` 11 / `@astrojs/netlify` 8;
Fly.io, Railway and Render via `@astrojs/node` standalone).

| Platform | CLI-first | Managed / Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass (GA) | 5 |
| Vercel | Pass | Pass | Pass | Pass | Partial (beta) | 4.5 |
| Netlify | Partial | Pass | Pass | Pass | Pass (GA) | 4.5 |
| Railway | Pass | Partial | Pass | Pass | Pass | 4.5 |
| Render | Partial | Pass | Pass | Pass | Pass (GA) | 4.5 |
| Fly.io | Pass | Partial | Pass | Pass | Partial | ~4 (not web-verified this run) |

Soft weights from the interview: global reach favoured edge-native SSR
(Cloudflare only; every other platform runs SSR in a single US region by
default, and region choice is a paid-plan feature on all of them). Cost vs DX
neutral. No familiarity tie-break. Co-location earned nothing (Supabase is
external).

**Cloudflare Workers.** Every routine op has a documented `wrangler` command
with `--json` / `-y` / stdin forms. Fully managed isolates plus Static Assets.
Root and per-product `llms.txt`, per-page `index.md`, MDX source on GitHub.
Versions and deployments model GA with 100-version rollback and `--dry-run`.
17 official remote MCP servers (docs, bindings, observability), OAuth or scoped
token, no beta label as of 2026-09-21. Free: 100k req/day, 10 ms CPU per
request, unlimited static assets. Paid $5/mo: 10M req + 30M CPU-ms, 30 s CPU
limit. KV, D1, R2, Queues, Durable Objects, Hyperdrive, Workers Logs all GA.
Secrets Store: beta. Preview aliases: launched beta 2025-07, docs carry no beta
label today. Pages: supported but de-emphasised, not for new projects.

**Vercel.** `vercel` CLI covers deploy, list, inspect, logs, rollback, promote,
env with `--token` and `--non-interactive`. Fluid Compute GA and default; Node
24 GA. Every docs page serves markdown; `llms.txt` and `llms-full.txt`. Hobby
tier is free and covers 1M invocations/month (non-commercial use only, which a
course project satisfies). Weaknesses: functions run in one region (`iad1`) and
Hobby cannot add regions; MCP server is beta with no rollback/env tools; Hobby
rollback only to the previous production deploy. Adapter swap is
`npx astro add vercel`.

**Netlify.** Adapter 8.x current within a week of research; Node 24 GA and
default; `netlify deploy` is draft by default with `--prod` explicit. Official
MCP (remote OAuth and local) GA. `docs.netlify.com/llms.txt` plus `.md` for
every page. Weaknesses: no dedicated CLI rollback (UI or raw
`netlify api restoreSiteDeploy`); single US-East function region, changing it
is Pro ($20/mo); credit-based Free plan charges 15 credits per production
deploy, which caps a solo dev at roughly 20 production deploys a month before
the $9 Personal plan becomes the realistic floor. Blobs still beta.

**Railway.** Railpack builds Astro SSR with no Dockerfile; CLI covers up,
redeploy, logs, variables, domains with `--json`; remote MCP via `railway mcp`
with no beta label. Docs as `.md` and `llms-full.txt`, MIT source. Weaknesses:
container PaaS, not FaaS (Partial on managed); no CLI rollback and rollback
window is 72 h on Hobby; Config-as-Code deprecated with a 2026-12-01 cutoff in
favour of TypeScript IaC; single region per replica. About $5/mo flat with app
sleeping. Closest miss; the fallback if the app ever needs a persistent process.

**Render.** Native Node 24 runtime, no Dockerfile; CLI GA with `deploys create
--wait` and `logs --tail`; official hosted MCP GA since 2025-08-21; `llms.txt`
and `.md` on every docs and API page. Weaknesses: rollback, env vars and custom
domains are REST or dashboard only (Partial CLI); API keys are workspace-wide;
Free tier spins down after 15 min with about a one-minute cold start, otherwise
$7/mo Starter; Hobby workspace caps egress at 5 GB; single immutable region.

**Fly.io.** Research agent was stopped mid-run at the user's request; scored
from stable facts, not re-verified on 2026-09-21. `flyctl` covers deploy,
releases, logs, secrets and scale-to-zero; Dockerfile required (auto-generated
by `fly launch`); machines are managed VMs, not serverless; single region per
machine with multi-region as multiplied cost; no free allowance for new
organisations. Would not have reached the shortlist under the global-reach and
managed weights.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Won on all five criteria, on edge SSR for the global-reach answer, on zero
migration cost (the adapter and wrangler are already pinned and configured),
and on KV being an exact fit for the PRD's hourly per-site forecast cache.
Every needed feature is GA. Cost is $0 at MVP traffic on Free, $5/mo if the
CPU cap forces the upgrade.

#### 2. Vercel

Second on a single soft criterion: MCP is beta and lacks rollback and env
tools. Otherwise a Pass on the four heavy criteria with the most polished CLI
of the group. The gap versus Cloudflare is regional: SSR runs in US-East only
on Hobby, so a global audience gets a US origin for every rendered page. Swap
cost is one `astro add` plus deleting the Cloudflare adapter and wrangler
config.

#### 3. Netlify

Third because CLI-first is Partial (no rollback command) and the credit-based
Free plan meters production deploys, both of which bite a solo dev iterating
nightly. Strengths: GA MCP, free PR deploy previews, adapter kept current with
Astro 7 within days. Same single-US-region limitation as Vercel.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Free-plan CPU cap of 10 ms per request.** The PRD budgets up to one second
   to rank the Messier catalogue and expects sun, moon and altitude maths for
   seven nights. React 19 SSR plus that scoring on every Tonight request may
   exceed 10 ms of CPU and fail with error 1102. Waiting on Supabase or the
   forecast API does not count; rendering and computing do. Paid lifts the cap
   to 30 s.
2. **Documentation drift between Cloudflare and Astro.** Adapter v13 dropped
   Pages; v14 changed the `main` entrypoint and removed `platformProxy`,
   `cloudflareModules` and `Astro.locals.runtime`. Cloudflare's own Astro
   framework guide still shows the old `dist/_worker.js` entry and
   `Astro.locals`. An agent following Cloudflare's docs writes code that does
   not compile against 14.3.1. Trust Astro's adapter docs.
3. **Preview versions share production secrets.** Secrets are per-Worker, not
   per-version. Preview URLs are public by default and have no log tail. A
   preview of an auth-enabled app talks to the production Supabase project
   unless a separate wrangler environment with its own secrets is used and
   previews are gated behind Cloudflare Access.
4. **"Global edge" is partly illusory for this app.** Every SSR page round-trips
   to a single-region Supabase for the session refresh and data. A user far
   from the Supabase region gets a local edge render that waits on a distant
   Postgres. Caching in KV and Smart Placement reduce it; they do not remove it.
5. **Rollback is code-only.** `wrangler rollback` reverts the Worker in seconds
   but leaves KV entries and Supabase migrations untouched, and refuses when a
   referenced KV/R2/queue binding has been deleted.

### Pre-Mortem — How This Could Fail

The team shipped Sidereus on Cloudflare Workers Free in October, delighted that
the starter deployed on the first try. The Tonight view worked in dev, where
`astro dev` on workerd imposes no CPU cap. In production, busy evenings produced
intermittent 1102 errors: the ranking for two-telescope users crossed 10 ms of
CPU and the free plan killed the isolate. Assuming a bug, the developer spent
two after-hours weeks profiling before finding the limit. Meanwhile an agent
following Cloudflare's docs "fixed" env access using `Astro.locals.runtime`,
which the pinned adapter no longer exposes, breaking the build twice. A preview
URL shared for feedback was public and pointed at the production Supabase
project, so a tester's junk accounts landed in real data. When a forecast-cache
change went wrong, the code rollback was instant but the poisoned KV entries
survived for an hour, so "marginal" nights displayed as "go". The deadline
slipped past 4 November with the core feature still flaky. The platform choice
was right; the free tier and the stale docs were never treated as risks.

### Unknown Unknowns

- `wrangler deploy` deletes plain `vars` that are absent from the config file
  unless `--keep-vars` is passed. Secrets set via `wrangler secret put` survive,
  but each `secret put` immediately triggers a new deployment.
- The Worker is still named `10x-astro-starter` in `wrangler.jsonc` and
  `package.json`. The first deploy creates a Worker and a
  `10x-astro-starter.<subdomain>.workers.dev` URL under that name. Rename to
  `sidereus` before deploying.
- Astro's Cloudflare deploy guide recommends the `global_fetch_strictly_public`
  compatibility flag; the scaffold does not set it. It matters as soon as the
  Worker fetches its own origin.
- Enabling Astro sessions auto-wires a KV session driver expecting a binding
  named `SESSION`; the build fails until that namespace exists. Supabase cookie
  auth means sessions probably stay off, but the failure looks unrelated.
- The default `imageService: 'cloudflare-binding'` auto-provisions a Cloudflare
  Images binding with 5,000 free transforms per month. It appears in the
  account without being created explicitly.
- Workers Logs retain 3 days on Free and `wrangler tail` samples under load, so
  a bug reported after a weekend may leave no trace.
- Version-driven workflow differences: with adapter 14.x, `astro dev` and
  `astro preview` already run on real workerd through `@cloudflare/vite-plugin`,
  so `wrangler dev` is redundant; runtime env is read via `astro:env` or
  `import { env } from "cloudflare:workers"`, not `Astro.locals.runtime.env`.
- wrangler 4.131 exposes `wrangler preview` as private beta and
  `--install-skills` (installs Cloudflare skills for detected AI coding agents);
  neither is relied on here.

## Operational Story

- **Preview deploys**: `npx wrangler versions upload --preview-alias <branch>`
  produces `<alias>-sidereus.<subdomain>.workers.dev` without touching
  production traffic. Previews are public by default and emit no logs; gate
  them with Cloudflare Access and run them under a separate wrangler
  environment (`--env staging`, its own Worker and secrets) pointing at a
  non-production Supabase project. Fork PRs cannot deploy because
  `CLOUDFLARE_API_TOKEN` is not exposed to them in GitHub Actions.
- **Secrets**: `SUPABASE_URL` and `SUPABASE_KEY` live as Workers Secrets
  (`echo "$VAL" | npx wrangler secret put SUPABASE_KEY`), readable only by the
  Worker at runtime and listable by name via `wrangler secret list`. Local dev
  reads `.dev.vars` (git-ignored); CI holds `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets. Rotation: rotate the key in
  Supabase, run `wrangler secret put` again (this deploys), verify, then revoke
  the old key.
- **Rollback**: `npx wrangler deployments list --json` to find the previous
  version, then `npx wrangler rollback <version-id> --message "reason" -y`.
  Takes seconds and works across the last 100 versions. KV cache entries and
  Supabase migrations are not rolled back; purge stale KV keys with
  `wrangler kv key delete` and roll migrations forward, never back.
- **Approval**: human-only: first production deploy, plan upgrade (Free to
  Paid), deleting the Worker or a KV namespace, rotating the Supabase primary
  key, changing the API token scope. Agent may perform unattended: version
  uploads to preview aliases, `wrangler deploy --dry-run`, `wrangler tail`,
  `deployments list`, `secret list`, KV key reads and deletes of cache entries,
  and production `wrangler deploy` once CI has passed on the default branch.
- **Logs**: runtime: `npx wrangler tail sidereus --format json --status error`
  for live errors, and Workers Logs in the observability dashboard or the
  Cloudflare observability MCP server for the last 3 days (7 on Paid). Pipeline:
  `gh run list` / `gh run view <id> --log` for GitHub Actions. API token for
  the agent should be scoped to Workers Scripts edit and Workers KV on this
  account only, no DNS, no billing.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Tonight view SSR + ranking exceeds 10 ms CPU on Free, causing 1102 errors | Devil's advocate | M | H | Start on Free per user decision. Cache forecast JSON in KV so requests do no repeated fetch work. Watch `cpuTime` in Workers Logs once real pages exist. First-deploy measurement (2026-09-21, scaffold only): warm `/` 1–3 ms, auth POSTs 6–13 ms, cold isolates 12–15 ms yet still `ok` (the cap is enforced on a rolling basis, not per request). **Upgrade trigger:** any `outcome: exceededCpu` / HTTP 1102, or warm-request p95 above 8 ms on the Tonight view; then flip to Workers Paid ($5/mo) in the dashboard. No redeploy needed. |
| Agent follows Cloudflare's stale Astro guide and writes v12-era code | Devil's advocate | H | M | Pin in CLAUDE.md: use Astro's adapter docs, not Cloudflare's framework guide; env via `astro:env` or `cloudflare:workers`; never `Astro.locals.runtime`. |
| Preview URL exposes auth app pointed at production Supabase | Devil's advocate | M | H | Separate wrangler environment with its own secrets and a non-prod Supabase project; Cloudflare Access on preview hostnames. |
| Edge render waits on single-region Supabase, eroding the global latency win | Devil's advocate | H | L | KV cache for forecast data; keep Supabase queries per page minimal; consider Smart Placement if p95 disappoints. Accept for MVP. |
| Code rollback leaves poisoned KV cache or applied migrations in place | Devil's advocate | M | M | Include KV key version prefix in cache keys so a code rollback naturally misses new entries; treat migrations as forward-only. |
| Worker deployed under starter name `10x-astro-starter` | Unknown unknowns | H | L | Rename `name` in `wrangler.jsonc` and `package.json` to `sidereus` before first deploy. |
| `wrangler deploy` wipes plain `vars` not in config | Unknown unknowns | L | M | Keep all config in `wrangler.jsonc`; secrets via `secret put`; never set vars in the dashboard only. |
| Enabling Astro sessions breaks build for lack of `SESSION` KV binding | Unknown unknowns | L | L | Leave sessions off (Supabase cookies); if enabled, create the namespace first with `wrangler kv namespace create SESSION --update-config`. |
| Missing `global_fetch_strictly_public` flag when fetching own origin | Unknown unknowns | L | M | Add the flag to `compatibility_flags` before any self-fetch code lands. |
| 3-day log retention on Free loses evidence of weekend bugs | Unknown unknowns | M | L | Structured `console.error` with request ids; upgrade to Paid extends to 7 days if needed. |
| `tech-stack.md` still says `cloudflare-pages`, misleading downstream skills | Research finding | H | M | Update `deployment_target` to `cloudflare-workers` before running Plan Mode deploy. |
| Secrets Store is beta; wrangler `preview` is private beta | Research finding | L | L | Use classic Workers Secrets and `versions upload --preview-alias`; do not depend on beta surfaces. |

## Getting Started

Validated against the pinned versions (`astro` 7.3.2, `@astrojs/cloudflare`
14.3.1, `wrangler` 4.131.1, Node 24.21). All commands run from the project
root.

1. **Rename the Worker and fix the stack contract.** Set `"name": "sidereus"`
   in `wrangler.jsonc` and `package.json`; change `deployment_target` to
   `cloudflare-workers` in `context/foundation/tech-stack.md`. Optionally add
   `"global_fetch_strictly_public"` to `compatibility_flags`.
2. **Authenticate once (human step).** `npx wrangler login`, then
   `npx wrangler whoami` to confirm the account. For CI, create an API token
   scoped to Workers Scripts edit and Workers KV on this account only and store
   it as `CLOUDFLARE_API_TOKEN` plus `CLOUDFLARE_ACCOUNT_ID` in GitHub Secrets.
3. **Local dev needs no wrangler command.** `npm run dev` already runs on
   workerd through the adapter's Vite plugin; `.dev.vars` supplies
   `SUPABASE_URL` and `SUPABASE_KEY` locally. Do not add `wrangler dev`.
4. **Create the forecast cache namespace.**
   `npx wrangler kv namespace create FORECAST_CACHE --update-config` writes the
   binding into `wrangler.jsonc`; read it in code via
   `import { env } from "cloudflare:workers"`.
   **Done 2026-09-25 (S-02):** namespace id `61441b2363ea41fca5731cfbc735b006`,
   committed in `wrangler.jsonc`; binding types come from `npm run cf:types`.
   First deploy with it: version `499fddc8-1627-4d7c-96eb-8b2ea9abe7fc`.
5. **Set production secrets and deploy.**
   `echo "$SUPABASE_URL" | npx wrangler secret put SUPABASE_URL`,
   `echo "$SUPABASE_KEY" | npx wrangler secret put SUPABASE_KEY`, then
   `npm run build && npx wrangler deploy --dry-run` to validate, then
   `npx wrangler deploy`. Verify with `npx wrangler deployments status` and
   `curl -sI https://sidereus.<subdomain>.workers.dev/`.
6. **Wire CI (later, per PRD final-week plan).** Add a deploy job to
   `.github/workflows/ci.yml` using `cloudflare/wrangler-action@v4` with the
   two secrets, gated on the existing `ci` and `smoke` jobs passing on
   `master`. Use `versions upload --preview-alias` for PRs, `deploy` for merges.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (only the hand-off shape is noted above)
- Production-scale architecture (multi-region, HA, DR)
- Fly.io live verification (agent stopped at user request; scored from stable
  facts)
