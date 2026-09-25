<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Sites and Gear Management

- **Plan**: `context/changes/sites-and-gear-management/plan.md`
- **Phases**: 4
- **Date**: 2026-09-24
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 2 observations
- **Triage**: completed 2026-09-24 — Fixed: F1, F2, F3, F4, F5, F6 (6); Skipped: 0

## Verdicts

| Dimension        | Verdict |
| ---------------- | ------- |
| Claim Accuracy   | WARNING |
| Substance        | PASS    |
| Feasibility      | PASS    |
| Sequencing       | WARNING |
| Architecture Fit | WARNING |
| Scope Discipline | PASS    |
| Verifiability    | WARNING |
| Coverage         | WARNING |

Verified and holding: every create target is absent and every modify target exists. The only importers of the form primitives are `SignInForm`/`SignUpForm`. `createServerClient<Database>` exists in `@supabase/ssr` 0.12.7. CLI 2.117 supports `gen types --local`, `db push --password`, and reading `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD` from the environment. `status -o env` still emits `API_URL`/`ANON_KEY`. tz-lookup 11.7 returns `Europe/Warsaw` and `Europe/Oslo` for the plan's test points (run in a scratch install). `z.coerce` works in zod 4.6. Astro's `checkOrigin` is on by default. The signup rate limit (30 per 5 min) is ample for the test suite. Numeric columns come back as `number` in both the generated types and at runtime.

## Findings

### F1 — Phase 1 gate forces a production merge before Phase 2 can start

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, obvious fix
- **Dimension**: Sequencing
- **Location**: plan.md Phase 1 › Manual Verification (1.6, 1.7) + Implementation Note
- **Detail**: 1.6 (add GitHub secrets) and 1.7 (the `migrate` job succeeds after merge to `main`) sit under Phase 1's pause-before-next-phase gate. Phases 2–4 depend only on local Supabase, so the gate would block all remaining work on a real merge and a production CI run in the middle of a feature branch.
- **Fix**: Mark 1.6/1.7 as required before the change ships (before `/10x-archive`), not before Phase 2. Phase 1's gate is 1.8 plus the automated rows.
- **Decision**: FIXED

### F2 — Client islands would pull astronomy-engine and tz-lookup into the browser bundle

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — worth pausing; non-trivial edit
- **Dimension**: Architecture Fit
- **Location**: plan.md Phase 2 §1–3, Phase 3 §4 (`SiteForm`)
- **Detail**: `SiteForm` uses `DEFAULT_MIN_ALTITUDE_DEG` and `siteInputSchema`. CLAUDE.md says to import the engine through the barrel `@/lib/engine`, and `src/lib/engine/index.ts:6-13` re-exports `night`/`sun`/`moon`/`objects`, which import `astronomy-engine`. The schema's manual-zone check uses `isValidTimeZone`, which the plan puts in `timezone.ts` next to the tz-lookup import. Tree-shaking might drop both, but nothing in the plan checks the size of the browser bundles (2.3 measures only the Worker).
- **Fix**: Anything imported by an island must stay free of engine code and tz-lookup. Import the constant from `@/lib/engine/parameters` (a standalone file with no imports), not the barrel. Move `isValidTimeZone` into a tz-lookup-free `src/lib/gear/zones.ts`, and keep `timezone.ts` (with tz-lookup) server-only, imported by routes. Record the parameters-import exception in the Phase 4 CLAUDE.md update.
  - Strength: The island bundle stays small without relying on tree-shaking; the rule is easy to check by grep.
  - Tradeoff: One more small module and a documented exception to the barrel convention.
  - Confidence: HIGH — the import chain was verified in `index.ts`, `sun.ts:1`, `objects.ts:1` and `moon.ts`.
  - Blind spot: How much Vite's tree-shaking would have dropped on its own is unmeasured.
- **Decision**: FIXED

### F3 — Edit pages don't handle a missing database client

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, obvious fix
- **Dimension**: Coverage
- **Location**: plan.md Phase 3 §4, Phase 4 §1–2
- **Detail**: The hub and the routes handle `locals.supabase === null`, but `[id].astro` calls `store.get(client, id)`, whose contract takes a non-null `TypedSupabaseClient`. Written as specified, this either fails `astro check` or crashes when env is unset (CLAUDE.md tripwire).
- **Fix**: Every page that reads `locals.supabase` (the hub and each entity's `[id].astro`) renders the same config-missing state when it is `null`.
- **Decision**: FIXED

### F4 — "Returns a 404 page" has no mechanism: there is no 404 page

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, obvious fix
- **Dimension**: Coverage
- **Location**: plan.md Phase 3 §4; criteria 3.8
- **Detail**: `ls src/pages` shows no `404.astro`. A dynamic route always matches, so "returns a 404 page" has to be built inline.
- **Fix**: `[id].astro` sets `Astro.response.status = 404` and renders an inline "Not found" state with a link back to `/gear`. Apply the same pattern to all three entities.
- **Decision**: FIXED

### F5 — Two automated criteria are one-off manual checks

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, obvious fix
- **Dimension**: Verifiability
- **Location**: plan.md Phase 2 › Automated 2.2, 2.3
- **Detail**: 2.2 ("add a `console.log`, see lint fail, remove it") is a manual proof. 2.3's `wrangler deploy --dry-run` depends on a local `wrangler login` (it exists on this machine per deploy-plan.md) and never runs in CI.
- **Fix**: Replace 2.2 with the repeatable `npx eslint --print-config src/lib/gear/store.ts | grep -A1 '"no-console"'` showing level 2 (error), and state the `wrangler login` assumption in 2.3.
- **Decision**: FIXED

### F6 — Minor anchor and wording inaccuracies

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, obvious fix
- **Dimension**: Claim Accuracy
- **Location**: plan.md Current State Analysis, Key Discoveries, Performance Considerations, Phase 4 §5
- **Detail**:
  - `ci.yml:26-45` should be `28-56` (the smoke job), and `ci.yml:38-41` should be `40-43` (Start local Supabase).
  - `config.toml:62-70` should be `60-65` (`[db.seed]`).
  - The "3 MiB compressed Free plan limit" is a real Cloudflare limit but has no source in this repo.
  - "`README.md` (commands, if it lists them)": it does (README.md:52-58).
- **Fix**: Correct the anchors, add the Cloudflare limits URL, and make the README update definite.
- **Decision**: FIXED
