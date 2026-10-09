---
date: 2026-10-09T19:55:00Z
researcher: Claude (Opus 5.5) with three read-only Sonnet workers (CI gates and flakes; .astro script lint; agent hook)
git_commit: d8b6f05
branch: feat/testing-quality-gates-wiring
repository: Sidereus
topic: "Ground rollout Phase 5 of context/foundation/test-plan.md: quality-gates wiring (flake visibility, Phase 1-4 checks in CI and the agent loop, .astro script lint from impl review F3)"
tags: [research, testing, ci, playwright, eslint, eslint-plugin-astro, hooks, quality-gates]
status: complete
last_updated: 2026-10-09
last_updated_by: Claude (Opus 5.5)
---

# Research: quality-gates wiring (test rollout Phase 5)

**Date**: 2026-10-09T19:55:00Z
**Researcher**: Claude (Opus 5.5) with three read-only Sonnet workers. Decisive claims were re-checked in the main session: the `.astro` override probe (below) and the clean tree after the F3 worker's scratch files.
**Git Commit**: d8b6f05 (`main` af3fab2 after #148, plus the change folder)
**Branch**: feat/testing-quality-gates-wiring
**Repository**: Sidereus

## Research Question

Ground Phase 5 of `context/foundation/test-plan.md` ("Quality-gates wiring", cross-cutting; gates + hook). Verify, not accept:

1. **Flake visibility:** an e2e test that fails, then passes on retry, must be reported, not silently green. Challenge "`retries: 1` is harmless".
2. **Phase 1-4 checks in CI and the agent loop:** which suites run where, as required checks or not, and what a post-edit agent hook should be.
3. **Impl review F3** of `testing-access-and-entitlement-boundary`: client `<script>` blocks in `.astro` files are not linted. Check the fix proposed in `context/archive/2026-10-09-testing-access-and-entitlement-boundary/follow-ups/review-fixes.md`, and challenge "`calculateConfigForFile` proves a rule runs".

Also: what each change would mean for the S-05 branch (`feat/observing-progress`, worktree `.claude/worktrees/observing-progress`).

## Summary

- **Flakes are invisible today, and none has been recorded.**
  - Under CI, `retries: 1` is set (`playwright.config.ts:9`) and `failOnFlakyTests` is not (`playwright.config.ts:6-16`), so a test that passes on retry leaves the run green.
  - The HTML report is uploaded only `if: failure()` (`.github/workflows/ci.yml:76-81`), so a green flaky run keeps nothing but log lines.
  - Playwright 1.55.0 supports `failOnFlakyTests` (`node_modules/playwright/types/test.d.ts:1203`; the doc example at `:1198` is `failOnFlakyTests: !!process.env.CI`).
  - In the 57 successful CI runs from 2026-10-06 08:35Z to 2026-10-09 19:45Z, a grep of the full logs for `flaky|retry #` found 0 hits. Turning the flag on therefore starts from a clean history.
- **Every Phase 1-4 suite runs in CI, but nothing makes CI required.**
  - Unit suites, including the forecast-degrade, night-boundary, runner-zone, invariant, calibration and no-console guards, run in job `ci` at `ci.yml:22`.
  - `tests/db/*`, smoke and e2e run in job `smoke` at `ci.yml:45-48, 64-68, 72-75`.
  - `main` has no branch protection and no rulesets: `gh api …/branches/main/protection` returns 404 "Branch not protected", and `…/rulesets` returns `[]`. A merge with red checks is possible. Only `migrate`/`deploy` (`needs:`) wait for green, and they run after the merge.
- **Smaller gate gaps, inspected paths only:**
  - `npm run lint` has no `--max-warnings` (`package.json:11`). The current warning count is 0 per the latest CI lint log (run 37981972930).
  - Vitest's `forks` pool, which the runner-zone tests need, is the default but is not pinned (`vitest.config.ts:10-20`). Only a comment records the requirement (`src/lib/engine/fixtures/runner-zones.ts:13-14`).
  - Pre-commit runs `lint-staged` only (`.husky/pre-commit:1`, `package.json:84-91`): no tests, no type check.
- **F3 is confirmed, and the proposed fix works with one addition.**
  - There are 9 client `<script>` blocks in 8 `.astro` files. All of them, `is:inline`/`define:vars` included, become virtual `X.astro/N.ts` files (`node_modules/eslint-plugin-astro/lib/index.mjs:3969-3992, 3946`). Today no rule runs on any of them.
  - The proposed `disableTypeChecked` + `projectService: false` override lints all 9 and finds 0 issues today.
  - The override **must also turn `prettier/prettier` off**. `eslintPluginPrettier` is last in `eslint.config.js` and re-enables it over the plugin's own "off", which yields 9 bogus prettier errors on the virtual files.
  - Type-aware linting of the scripts is possible but fragile, so it is not recommended:
    - `**` globs are refused by `allowDefaultProject`;
    - the default limit of 8 default-project files silently drops the 9th script;
    - `define:vars` names give false positives.
  - `calculateConfigForFile` reports `no-console` at error for the virtual files even though no rule runs. An end-to-end `lintText` case is needed.
- **The agent hook: a Stop (end-of-turn) hook gives the most signal per cost.**
  - The whole unit suite takes ~3.6 s (89 files, 1466 tests), so the project's hook skill rule "≈30 s or less → run all of it at end of turn" applies (`/Users/rafalskwara/projects/.claude/skills/10x-configure-hook/SKILL.md:64`).
  - A per-edit `vitest related` hook costs 2.2-3.5 s per edit for engine/tonight/forecast files, plus ~3.3 s if it also lints. It also misses the guards that read files instead of importing them.
  - `.claude/` is untracked wholesale and not ignored, so committing hooks needs a decision on what else in `.claude/` to ignore.

## Detailed Findings

### 1. Flake visibility

- `playwright.config.ts:8-10`:
  - `forbidOnly: !!process.env.CI`;
  - `retries: process.env.CI ? 1 : 0`;
  - reporters `list` + `html` (never opened) on CI;
  - traces `retain-on-failure` (`:13`).
- With one retry and no `failOnFlakyTests`, Playwright marks a fail-then-pass test "flaky" and exits 0 (worker report; the exact list-reporter wording was not observed because no flaky run exists).
- `ci.yml:76-81` uploads `playwright-report/` only `if: failure()`, 7-day retention. A flaky-but-green run uploads nothing.
- **History:**
  - 60 CI runs listed: 57 success, 1 cancelled, 2 in progress; 0 failed.
  - All 57 successful logs grepped for `flaky|retry #`: 0 hits.
  - The latest runs: "Running 47 tests using 2 workers", 3 skipped, 44 passed, 1.4–2.0 min (e.g. run 37981972930: 44 passed, 1.9 m).
- **The three skips seen on recent runs:**
  - `tests/e2e/landing-screenshot.spec.ts:39`: runs only with `CAPTURE_LANDING=1`.
  - `tests/e2e/moon-as-target.spec.ts:38`: skips when the Moon is not a target in Madrid tonight.
  - `tests/e2e/tonight-targets.spec.ts:112`: skips when the Moon washes out no object.
  - Other date- or ephemeris-dependent skips: `tonight-sky.spec.ts:158, 170`, `planets-on-tonight.spec.ts:38`, `moon-card.spec.ts:36`. Their coverage depends on the night CI runs.
- **Challenge "`retries: 1` is harmless":**
  - It is harmless for the run's colour, but it hides the signal. `parallel-e2e-flakes` (GitHub #45) was found only because a review noticed a 2-minute hang that "CI's retry hides" (`context/archive/2026-09-28-parallel-e2e-flakes/change.md` Notes).
  - That change fixed the hydration race and explicitly left "Changing CI's `retries: 1` or worker count" out of scope (`context/archive/2026-09-28-parallel-e2e-flakes/plan.md:26`).
- **Cheapest fix that reports a flake:** `failOnFlakyTests: !!process.env.CI`.
  - It keeps the retry, so the first failure's trace is retained, and the job fails, so `if: failure()` uploads the report.
  - Turning retries off would lose the trace-on-first-failure and gives no extra signal.

### 2. Phase 1-4 suites: where they run

| Suite | Where | Anchor |
|---|---|---|
| `src/lib/forecast/degraded-forecast.test.ts`, `src/lib/tonight/forecast-honesty.test.ts` (Phase 1) | CI `ci` | `ci.yml:22`, glob `vitest.config.ts:17` |
| `src/lib/engine/night-boundaries.test.ts`, `src/lib/tonight/night-boundaries.test.ts`, `src/lib/runner-zone-guard.test.ts` (Phase 2) | CI `ci` | same |
| `src/lib/engine/visibility-invariants.test.ts`, `ranking-invariants.test.ts`, `calibration.test.ts` (Phase 3) | CI `ci` | same |
| `src/lib/no-console-guard.test.ts` (Phase 4) | CI `ci` | same |
| `tests/db/*.test.ts` (7 files, 177 tests after the Phase 4 review fixes) | CI `smoke` only | `ci.yml:45-48` |
| `scripts/smoke.mjs` (exact redirect keys) | CI `smoke` | `ci.yml:64-68` |
| `tests/e2e/*.spec.ts` (23 spec files, 47 tests) | CI `smoke` | `ci.yml:72-75` |

- Neither job has a path filter or `continue-on-error`. The only `||` in the workflow is the deploy credentials check (`ci.yml:128`).
- **Required checks:** none. `gh api repos/RafalSkwara/Sidereus/branches/main/protection` → `{"message":"Branch not protected",…,"status":"404"}`; `gh api repos/RafalSkwara/Sidereus/rulesets` → `[]`. The repository is public.
  - Not inspected: org-level rules.
  - Making `ci` and `smoke` required is a GitHub repository setting, an outward change the owner must approve.
- **Pool:** `vitest.config.ts` sets no `pool`. The runner-zone suites switch `process.env.TZ` in-process (`src/lib/engine/fixtures/runner-zones.ts:38-49`) and need `forks` (comment `:13-14`). Each block begins with `expectRunnerZoneActive(zone)` (test-plan §6.2), so a pool change would fail loudly, not pass vacuously. Pinning `pool: "forks"` makes the requirement explicit.
- **Relaxed or opt-in assertions:**
  - `src/lib/engine/determinism.test.ts:89-92, 156-159` assert the timing budget only when `CI` is unset.
  - `src/lib/engine/calibration.test.ts:53` is print-only and skipped unless `CALIBRATION_SNAPSHOT=1`.
  - 6 `todo` fixtures: `objects.test.ts:122`, `moon.test.ts:129`, `sun.test.ts:108`.
  - All of these are by design and recorded in §6.2 and §6.3.
- **Lint warnings:**
  - `eslint.config.js` has warn-level rules: `no-console` (base, `:25`, overridden to error for `src/**`), `astro/no-unused-css-selector` (`:68`) and `astro/prefer-class-list-directive` (`:69`).
  - The latest CI lint log shows no problem lines.
  - Phase 4's owner decision kept `--max-warnings 0` out of scope ("owner chose `no-console` only, 2026-10-09"; `context/archive/2026-10-09-testing-access-and-entitlement-boundary/plan.md`, What We're NOT Doing).
- **Pre-commit:** `npx lint-staged` → `eslint --fix` on staged `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}` (`package.json:84-91`). There is no pre-push hook. A broken Phase 1-4 test passes pre-commit and is caught only by CI, or at end of turn if an agent hook runs the suite (section 4).

### 3. F3: client `<script>` blocks in `.astro` files

- **Scripts** (9 blocks in 8 files):

  | File:line | Kind |
  |---|---|
  | `src/components/ui/Notice.astro:105` | plain |
  | `src/components/ui/ToastRegion.astro:13` | plain |
  | `src/components/tonight/GearCard.astro:82` | plain |
  | `src/layouts/Layout.astro:36` | `is:inline define:vars` |
  | `src/layouts/Layout.astro:84` | plain |
  | `src/pages/offline.astro:44` | plain |
  | `src/pages/design.astro:2010` | plain |
  | `src/pages/tonight/targets.astro:75` | plain |
  | `src/pages/tonight/planets.astro:60` | plain |

  - There is no `type="module"`, JSON-LD or `application/json` script under `src`, and no `eslint-disable` in any `.astro` file.
- **What the plugin extracts:**
  - `preprocess()` (`node_modules/eslint-plugin-astro/lib/index.mjs:3969-3992`) extracts every `<script>` with children whose `type` does not match `/json$|importmap/i`, so `is:inline` and `define:vars` scripts are included.
  - Virtual name `${id}${ext}` (`:3946`), `.ts` when the TypeScript parser is present (`:45`, processor `astro/client-side-ts`, `:4047`).
  - `define:vars` names arrive as a `/* global … -- define:vars */` comment (`:3743-3755`).
- **Why nothing runs:**
  - The plugin's `**/*.astro/*.ts` config sets `parserOptions: { project: null }` and `prettier/prettier: off` (`:4050-4062`), but `projectService: true` from `baseConfig` (`eslint.config.js:16-30`) stays.
  - The project service cannot find the virtual file and the parse fails ("…/offline.astro/0_1.ts was not found by the project service").
  - The plugin's postprocess drops that parse error (`remapMessages`, `:3855-3857`).
  - Re-checked in the main session: `lintText` of `<div />\n<script>\n  console.log(1);\n</script>` at the existing path `src/pages/offline.astro` gives `[]` today.
- **Proposed fix, verified:**
  - Add a block for `**/*.astro/*.{ts,js}` that extends `tseslint.configs.disableTypeChecked`, with `parserOptions: { projectService: false, project: null }` **and** `"prettier/prettier": "off"`.
  - Re-checked in the main session: the same sample gives `[["no-console", 3]]`.
  - Over the 8 real files, the override lints all 9 blocks (counted with a `no-restricted-syntax: Program` probe) and reports 0 findings (prettier excluded), ~4.5 s.
  - Without the prettier rule-off it reports 9 bogus `prettier/prettier` errors ("Parsing error: Expected '}'…"). `eslintPluginPrettier` is the last entry of the config array and overrides the plugin's "off". The new block must either sit after it or set the rule off itself.
- **Type-aware alternative, rejected:**
  - `allowDefaultProject: ["src/**/*.astro/*.ts"]` is refused ("contains a disallowed '**'").
  - `project: "./tsconfig.json"` does not include the virtual files.
  - Depth-limited globs (`src/*/*.astro/*.ts`, `src/*/*/*.astro/*.ts`) work, but:
    - the default-project match limit of 8 silently drops the 9th script; the option is `maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING`, `node_modules/@typescript-eslint/project-service/dist/createProjectService.js:132`;
    - it reports `define:vars` false positives in `Layout.astro:37-44` (`no-unsafe-call`, `no-unsafe-member-access`, `restrict-plus-operands`);
    - it would need a guard for the silent drop.
  - It found two real strictness hits (`offline.astro:59` `no-unsafe-assignment` on `JSON.parse`, and `no-confusing-void-expression` at `Notice.astro:112`, `offline.astro:97`), which are not worth the fragility.
- **The challenge is confirmed:** `calculateConfigForFile('src/pages/offline.astro/1.ts')` returns `no-console [2]`, while no rule runs. Config resolution is not proof of linting.
- **End-to-end guard:**
  - In `src/lib/no-console-guard.test.ts`, `lintText` an in-memory `.astro` sample with an existing `filePath`; a non-existent path fails the main file's parse with "parserOptions.programs …".
  - Expect exactly one `no-console` (severity 2) in a plain `<script>` and one in an `is:inline` script.
  - Measured outside Vitest: cold ~2.1-3.8 s, warm ~60 ms. Give it a 30 s timeout like the existing rule-check case.
- **Pickup:** `npm run lint` (`eslint .`, `package.json:11`, CI `ci.yml:20`) and lint-staged (`eslint --fix` on `*.astro`) both load `eslint.config.js`, so the block applies everywhere without other edits. `supportsAutofix: true` means `--fix` also fixes script issues.
- **Already linted today, re-checked:** frontmatter and template expressions in `.astro` (`no-console` reported at frontmatter `3:1` and template `5:21`) and `.tsx`.

### 4. Agent hook

- **Project skill** (`/Users/rafalskwara/projects/.claude/skills/10x-configure-hook/SKILL.md`, references `references/anthropic.md`, "Verified on: 2026-09-25"):
  - Moments by cost: per edit for seconds-long checks of the edited file; end of turn for whole-project checks; commit, push and CI for minutes (`:70-80`).
  - Whole suite ≤ ≈30 s → the end-of-turn script runs all of it (`:64`).
  - Bash rewrites bypass per-edit hooks, so end of turn re-checks `git diff` plus untracked files (`:82`).
  - Never `cd "$CLAUDE_PROJECT_DIR"`; resolve the checkout from the edited file or the payload `cwd` (`:118`).
  - No silent success (`:119`); check `git check-ignore` (`:120`).
  - Proof is a committed `agent-hooks.test.*` run by the repo's runner, with a fixed case list, including a deliberate break of the retry guard (`:125-146`); no CI job (`:144`).
- **Claude Code signal protocol** (`anthropic.md:43-64`, partly re-confirmed against the live hooks page):
  - PostToolUse matcher `Write|Edit` (no `MultiEdit` tool); `tool_input.file_path` absolute.
  - Exit 2 shows stderr to Claude; for Stop it keeps the agent working. Any other non-zero exit shows Claude nothing.
  - Stop payload has `stop_hook_active`; the block cap is 8.
  - Timeouts in seconds, default 600.
- **Current state:**
  - `sidereus/.claude/` is untracked (`git ls-files .claude` empty) and not ignored: it holds `prompts/`, `settings.local.json` (permissions only), `skills/` (22 skill directories dated 2026-09-30) and `worktrees/` (6 worktrees, including `observing-progress`).
  - No hooks exist at project or `~/projects/.claude` level.
  - `~/.claude/settings.json` (work account) has an iTerm2 status hook on every event and a herdr SessionStart hook; a project hook would merge with them, not replace them. `~/.claude-personal/settings.json` has no hooks.
- **Measured** (Node 24.21.0, warm):

  | Command | Wall | Tests |
  |---|---|---|
  | `npx vitest run` (whole suite) | 3.6 s | 89 files, 1466 tests |
  | `vitest run src/lib/engine` | 2.2 s | |
  | `vitest run src/lib/tonight` | 2.75 s | |
  | `vitest related src/lib/engine/score.ts --run` | 3.5 s | 16 files |
  | `vitest related src/lib/tonight/build.ts --run` | 2.7 s | 5 files |
  | `vitest related src/lib/engine/parameters.ts --run` | 3.1 s | 37 files |
  | `eslint --quiet` on one file | 3.1–4.6 s | |
  | `astro check` | not timed | |

  - The slowest unit files are `no-console-guard.test.ts` (2.2 s), `tonight/build.test.ts` (1.6 s) and `engine/outlook.test.ts` (1.2 s); everything else is under 0.25 s.
- **`vitest related` blind spots:** guards that read files rather than import them. `global.css` gets 0 related tests, though `contrast`, `red-theme` and `no-hardcoded-colors` read it. The same applies to the no-console, runner-zone and purity guards and to `.astro`/`.css`/`eslint.config.js` edits. Only the full suite at end of turn covers them.
- **Design implication:**
  - A Stop hook that runs the full suite plus `eslint --quiet` on changed files gives the most signal per cost (~4 s for tests, plus lint), catches Bash rewrites, and gets one retry via `stop_hook_active`.
  - A per-edit hook adds ~3 s per engine/tonight/forecast edit and is red mid-refactor. It is optional on top.
  - `astro check` must be timed before it goes into the Stop hook; the project memory records lint OOM with `.claude/worktrees/`.
  - The proof test must live under `src/**` (the Vitest include is `src/**/*.test.ts`, `vitest.config.ts:17`), or the include must widen.

### 5. Impact on the S-05 branch (`feat/observing-progress`, worktree `.claude/worktrees/observing-progress`)

| Change | Reaches coder's branch | What coder must adapt to |
|---|---|---|
| `eslint.config.js` `.astro` script block | after rebase or merge onto `main` | Any `<script>` S-05 adds to an `.astro` file gets linted (strict non-type-aware rules + `no-console`); `npm run lint` may surface findings in new scripts. |
| `no-console-guard.test.ts` end-to-end case | after rebase | None unless S-05 changes `offline.astro`'s path (the guard uses an existing `.astro` path). |
| `playwright.config.ts` `failOnFlakyTests` | after rebase | A flaky S-05 e2e spec fails CI instead of passing on retry. |
| `vitest.config.ts` `pool: "forks"` | after rebase | None expected (forks is already the default). |
| `.claude/settings.json` + `.claude/hooks/*` (tracked) | only once the branch contains the commit, and only after that session restarts | ~4 s Stop-hook run each turn, and an exit-2 block on red tests or lint. An untracked settings file in the main checkout never reaches the worktree. Unverified: whether Claude Code reads a `.claude/settings.json` from a parent directory of the worktree; check with `/hooks` there. |
| `.gitignore` for `.claude/worktrees/`, `skills/`, `settings.local.json` | after rebase | None functional; it removes untracked noise. |
| Branch protection (required `ci`, `smoke`) | immediately, for every PR | S-05's PR cannot merge until both checks are green. |

## Code References

- `playwright.config.ts:8-13`: `forbidOnly`, `retries: CI ? 1 : 0`, reporters, traces; no `failOnFlakyTests`
- `node_modules/playwright/types/test.d.ts:1198-1203`: `failOnFlakyTests` option and its CI example
- `.github/workflows/ci.yml:20-23, 45-48, 64-68, 72-81`: lint/check/test/build, test:db, smoke, e2e, report upload on failure
- `vitest.config.ts:10-20`: include glob, node env, no pool
- `src/lib/engine/fixtures/runner-zones.ts:13-14, 38-49`: forks-pool requirement and the TZ switch
- `eslint.config.js:16-30, 76-89`: `baseConfig` with `projectService`, scripts config, `noConsoleConfig`; `eslintPluginPrettier` last in the export
- `node_modules/eslint-plugin-astro/lib/index.mjs:3743-3755, 3855-3857, 3946, 3969-3992, 4047-4062`: define:vars globals, dropped parse error, virtual name, extraction filter, client-side processor and config
- `node_modules/@typescript-eslint/project-service/dist/createProjectService.js:132`: default-project file-count limit
- `src/lib/no-console-guard.test.ts`: header documents the `.astro` gap (Phase 4 impl review F3)
- `package.json:11, 17, 84-91`; `.husky/pre-commit:1`

## Architecture Insights

- Gates are layered by cost: lint-staged at commit, `ci` (lint, check, unit, build) and `smoke` (db, smoke, e2e) in CI, with `migrate` and `deploy` after the merge. The missing pieces are enforcement (required checks), visibility (flakes) and the agent loop (no hooks), not new test layers.
- Config resolution and actual linting can diverge silently when a processor drops parse errors. A guard that resolves config must be paired with one end-to-end lint of a known violation per file kind.

## Historical Context (from prior changes)

- `context/archive/2026-09-28-parallel-e2e-flakes/`: the only recorded e2e flake (GitHub #45), hidden by the CI retry. Root cause was the hydration race, fixed by `waitForHydration`. Retries and workers were left unchanged on purpose (`plan.md:25-26`). Supported: retries hid a real flake once.
- `context/archive/2026-10-09-testing-access-and-entitlement-boundary/`:
  - Phase 4 made `no-console` an error in all of `src` with the per-file guard.
  - Its impl review F3 found the `.astro` script gap; the owner chose Fix B (document now, separate change), and the follow-up plan is `follow-ups/review-fixes.md`.
  - Phase 4 kept `--max-warnings 0` out of scope (owner, 2026-10-09).
- `context/foundation/test-plan.md` §5 rows "e2e flake visibility (a retried pass is reported)" and "post-edit agent hook (engine/tonight tests)". The §4 row "21 specs" is stale (23 spec files, 47 tests); §4 is frozen until `--refresh`.

## Related Research

- `context/archive/2026-10-09-testing-access-and-entitlement-boundary/research.md`: Risk #6 sweep, `no-console` scope.
- `context/archive/2026-09-28-parallel-e2e-flakes/plan.md`: the flake investigation and repro commands.

## Open Questions (owner decisions for /10x-plan)

1. **Branch protection:** make `ci` and `smoke` required on `main`? This is a GitHub setting, an outward change. Recommended: yes; it is the only thing that turns the CI gates into gates.
2. **`--max-warnings 0`:** revisit Phase 4's "`no-console` only" decision now that warnings are 0? This is cheap today and prevents new warn-level debt.
3. **Hook scope:** Stop-only (recommended by cost × signal), or Stop plus a per-edit `vitest related` hook for engine/tonight/forecast?
4. **Committing the hook:** track `.claude/settings.json` and `.claude/hooks/`, and ignore `.claude/worktrees/`, `.claude/skills/` and `.claude/settings.local.json`? (`sidereus/.claude/skills/` holds 22 directories of 10x skills dated 2026-09-30, several empty: stale local copies of the shared `~/projects/.claude/skills`, never tracked.)
5. **`astro check` in the Stop hook:** time it first. Not measured.
