<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Test rollout Phase 4: access and entitlement boundary

- **Plan**: context/changes/testing-access-and-entitlement-boundary/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3
- **Date**: 2026-10-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 6 observations
- **Triage**: all 10 fixed (F3 via Fix B, documented + follow-up)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Evidence

- Plan drift (Opus agent): every planned item is implemented and every contract bullet holds (structural suite incl. plan-review F3 `has_function_privilege('public', …)`, anon insert as A's row and as a row without a user pinned on `error.code`, guard file set / ignored list / allowlist counts / rule-less disables / self-exclusion / non-vacuity, smoke `absent`, §6.4). Benign extras: "listed as both kinds" and policy-count checks, `countDisables` self-tests, §5 lint row and §6.3 wording updates. No "What We're NOT Doing" item violated.
- Re-run on 0679fc2: `npm run test:db` 176 passed; `npm test` 1464 passed; `npm run db:types` no drift; CI `ci` and `smoke` green on #147 (run 37977915560). Lint, `astro check` and smoke ran green in the implement session (8db290a).
- F1–F3 were reproduced in the main session with `ESLint#lintText` (in memory, nothing written).
- Manual rows 1.7, 2.7, 3.2 were ticked by the agent with evidence (break-check output, §6.4 read-through), per the owner's deferred-manual-check preference.

## Findings

### F1 — A `---` reason hides a no-console disable from the guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/no-console-guard.test.ts:67
- **Detail**: ESLint splits a directive's reason on `/\s-{2,}\s/u` (`@eslint/plugin-kit`); the guard splits on `/\s--\s|\s--$/`. `// eslint-disable-next-line no-console --- reason` suppresses `no-console` in ESLint (verified: 1 suppressed message) while the guard counts 0, so an unlisted disable passes in any file.
- **Fix**: Split on `/\s-{2,}(?:\s|$)/u` like ESLint, and add the `---` / `----` inputs to the `countDisables` unit test.
- **Decision**: FIXED — reason split on ESLint's `/\s-{2,}(?:\s|$)/u`; `---`/`----` cases in the unit test; break check (`--- x` disable in compass.ts) turned the guard red, reverted.

### F2 — An inline config comment turns no-console off unseen

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/no-console-guard.test.ts:54-75
- **Detail**: `/* eslint no-console: "off" */` (or `0`, `["off"]`) switches the rule off for the whole file: ESLint reports 0 messages and 0 suppressed (verified), `calculateConfigForFile` ignores file comments, and the guard only counts `eslint-disable`. `linterOptions.noInlineConfig` is not an option, since it would also disable the allowlisted disables.
- **Fix**: Also count `/* eslint … no-console: … */` config comments and fail on any hit (no allowlist), with a unit-test input.
- **Decision**: FIXED — `countDisables` counts inline `/* eslint … no-console: … */` comments and the guard fails any; unit cases added; break check in compass.ts turned red, reverted.

### F3 — Client `<script>` blocks in .astro files are never linted

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: eslint.config.js:16-30, 86-89; src/lib/no-console-guard.test.ts:122-135
- **Detail**: eslint-plugin-astro lints each client `<script>` as a virtual `X.astro/1.ts`, which inherits `projectService: true`; the project service cannot find it, the parse fails, and the plugin's postprocess drops the error, so no rule runs at all (verified: a `console.log` in Notice.astro's script gives 0 messages; frontmatter and `.tsx` do report `no-console`). `calculateConfigForFile` still says error, so the guard passes. Pre-existing, but this change now claims "no source file under src may log" and that the guard proves it. 8 .astro files have scripts (Layout, GearCard, Notice, ToastRegion, design, offline, tonight/targets, tonight/planets); none logs today.
- **Fix A ⭐ Recommended**: Lint the virtual script files: a config for `**/*.astro/*.{ts,js}` extending `tseslint.configs.disableTypeChecked` with `projectService: false`, plus an end-to-end guard case that lints an in-memory `.astro` with `<script>console.log(1)</script>` and expects one `no-console` error.
  - Strength: Closes the hole for every rule, not just no-console; the end-to-end case catches any future silent skip of this kind.
  - Tradeoff: Turning on lint for 8 scripts may surface existing (non-type-checked) lint findings that need fixing in this change.
  - Confidence: MED — the safety agent verified the override makes `no-console` fire; how many other findings appear is unknown.
  - Blind spot: Type-aware rules stay off for scripts; not checked whether prettier/astro plugin rules then double-report.
- **Fix B**: Record it as a blind spot (§6.4, CLAUDE.md, guard header) and open a follow-up change.
  - Strength: No product-file churn in a test-rollout change.
  - Tradeoff: The guard's "every file" claim stays partly false until the follow-up lands.
  - Confidence: HIGH — documentation only.
  - Blind spot: A script that logs before the follow-up would merge.
- **Decision**: FIXED via Fix B — documented as a known gap in the guard header, CLAUDE.md and test-plan §6.4; follow-up queued in follow-ups/review-fixes.md.

### F4 — Views, materialized views and foreign tables escape the structural suite

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/db/structure.test.ts:68-73, 81-88
- **Detail**: Only `relkind in ('r','p')` is read. PostgREST exposes views too, and a view without `security_invoker` runs as its owner and bypasses RLS; the suite would not notice. None exist today.
- **Fix**: Read `v`, `m` and `f` too: fail on any materialized or foreign table in `public` and on any view without `security_invoker=true` in `reloptions`.
- **Decision**: FIXED — structure suite reads relkind v/m/f, fails on a view without security_invoker=true and on any materialized view or foreign table; break check (plain view on sites) turned red, dropped.

### F5 — Docs require a `-- <reason>` the guard does not enforce

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: CLAUDE.md:21, context/foundation/lessons.md (last entry), test-plan.md §6.4; src/lib/tonight/build.ts:1216
- **Detail**: All three say a deliberate log "needs `// eslint-disable-next-line no-console -- <reason>`"; the guard counts line and block forms alike and ignores the reason, and build.ts:1216 has none (its reason is in the comment above).
- **Fix**: Give build.ts:1216 a `-- reason` and make the guard require a non-empty `--` reason on every no-console disable.
- **Decision**: FIXED — build.ts:1216 gives a `-- reason`; the guard fails any no-console disable without one.

### F6 — Stale or understated doc lines

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/foundation/test-plan.md §4 (~:100), §2 Risk #5 (~:69); CLAUDE.md:20
- **Detail**: §4 still says "no-console on coordinate paths is the privacy guard" (now all of src). §2 says F-01 "does not exist in code yet" (it landed; §2 is frozen by the plan). CLAUDE.md:20 says functions fail when "executable by `anon`", while the suite also checks PUBLIC.
- **Fix**: Update the §4 row and the CLAUDE.md wording; leave frozen §2 for the next `/10x-test-plan --refresh`.
- **Decision**: FIXED — test-plan §4 row and CLAUDE.md:20 updated (PUBLIC, views); frozen §2 left for /10x-test-plan --refresh.

### F7 — Structural checks looser than they read

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/db/structure.test.ts:81-88, 113-115; tests/db/tables.ts:79
- **Detail**: `keyedOnOwner` is a substring test (accepts `user_id <> auth.uid()`; the isolation suite is the real check). `has_table_privilege` ignores column grants (`grant update (plan)` would pass here; account-plans.test.ts would still fail it), and REFERENCES/TRIGGER are not listed. `SERVER_OWNED` is `readonly string[]`, so a typo is caught only at runtime.
- **Fix**: Add `has_any_column_privilege` for INSERT/UPDATE plus REFERENCES/TRIGGER, and type `SERVER_OWNED` as `readonly (keyof Database["public"]["Tables"])[]`.
- **Decision**: FIXED — has_any_column_privilege for SELECT/INSERT/UPDATE/REFERENCES plus TRIGGER; SERVER_OWNED typed from the table keys; break check (`grant update (plan)` on account_plans) turned red, revoked.

### F8 — No connection timeouts in the structural suite

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/db/structure.test.ts:28, 105-107
- **Detail**: postgres.js's default `connect_timeout` (30 s) equals the hook timeout, and `sql.end()` has none, so an unreachable DB fails slowly.
- **Fix**: `connect_timeout: 5` and `sql.end({ timeout: 5 })`.
- **Decision**: FIXED — connect_timeout: 5 and sql.end({ timeout: 5 }).

### F9 — Anon update/delete cases pin Supabase's default grants

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: tests/db/isolation.test.ts:188-207
- **Detail**: They assert `error === null`, so revoking anon's table grants later (a tightening) would fail them although the row stays safe.
- **Fix**: Accept `null` or `42501`; keep the "row unchanged as A" assertion as the real check.
- **Decision**: FIXED — anon update/delete accept a null error or 42501; the row read back as A decides; isolation header updated.

### F10 — Guard file set has edges

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/no-console-guard.test.ts:24, 112-114, 140
- **Detail**: `.jsx`, `.cjs`, `.mts`, `.cts` are linted by the config but not scanned (none exist in src); the guard skips its own file entirely; the 30 s `beforeAll` timeout does nothing (ESLint 10 loads config lazily inside `calculateConfigForFile`, whose `it` has its own 30 s).
- **Fix**: Fail on any `.jsx/.cjs/.mts/.cts` file under src (or scan them), and move the timeout comment to the rule-check `it`.
- **Decision**: FIXED — .mts/.cts/.jsx/.cjs scanned too; the 30 s timeout sits on the rule-check `it` with a comment (ESLint loads config lazily); self-exclusion kept as planned.
