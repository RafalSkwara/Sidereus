# Test rollout Phase 5: quality-gates wiring — Implementation Plan

## Overview

Test rollout Phase 5 (`context/foundation/test-plan.md` §3, cross-cutting). It locks in what Phases 1-4 added so that it cannot quietly stop protecting anything. It covers four areas:

- **Lint coverage:** client `<script>` blocks in `.astro` files get linted, closing impl review F3 of `testing-access-and-entitlement-boundary`. Warnings fail lint.
- **CI gates:**
  - a flaky e2e test turns CI red;
  - Vitest's `forks` pool is pinned;
  - ~~`ci` and `smoke` become required checks on `main`~~ (dropped by the owner at implementation; only a human merges PRs).
- **Agent loop:** a Claude Code end-of-turn (Stop) hook runs the unit suite and lints the changed files, so an agent hears a regression before it finishes a turn.
- **Docs:** test-plan §3/§5/§6 and CLAUDE.md, plus what the S-05 branch must adapt to.

## Current State Analysis

Research: `context/changes/testing-quality-gates-wiring/research.md` (complete, d8b6f05 / 81a0911).

- **Flakes are invisible.** CI sets `retries: 1` and no `failOnFlakyTests` (`playwright.config.ts:8-13`), so a test that passes on retry leaves the run green. The report uploads only `if: failure()` (`.github/workflows/ci.yml:76-81`).
  - Playwright 1.55.0 has `failOnFlakyTests` (`node_modules/playwright/types/test.d.ts:1198-1203`).
  - In the 57 successful runs from 2026-10-06 to 2026-10-09, there were 0 flaky reports.
  - The one recorded flake (GitHub #45, `parallel-e2e-flakes`) was hidden by the retry, and that change left retries alone on purpose (`context/archive/2026-09-28-parallel-e2e-flakes/plan.md:25-26`).
- **CI runs every Phase 1-4 suite, but nothing requires it.**
  - Unit suites run at `ci.yml:22`; `tests/db`, smoke and e2e run in `smoke` (`ci.yml:45-48, 64-68, 72-75`).
  - `main` has no branch protection (`gh api …/branches/main/protection` → 404) and no rulesets (`[]`).
  - `npm run lint` has no `--max-warnings` (`package.json:11`); warnings are 0 today.
  - The runner-zone suites need Vitest's default `forks` pool, which no config pins (`vitest.config.ts:10-20`; requirement only in a comment, `src/lib/engine/fixtures/runner-zones.ts:13-14`).
- **`.astro` client scripts are not linted.** 9 blocks in 8 files become virtual `X.astro/N.ts` files (`node_modules/eslint-plugin-astro/lib/index.mjs:3946, 3969-3992`).
  - They inherit `projectService: true` (`eslint.config.js:16-30`), fail to parse, and the plugin drops the error (`:3855-3857`).
  - `calculateConfigForFile` still reports `no-console` at error, so `src/lib/no-console-guard.test.ts` passes.
  - The proposed override (`disableTypeChecked`, `projectService: false`, `project: null`) lints all 9 blocks with 0 findings today.
  - It also needs `prettier/prettier` off: `eslintPluginPrettier` is last in the export and otherwise yields 9 bogus parse errors.
- **The agent loop has no hooks.**
  - `sidereus/.claude/` is untracked and not ignored. It holds `settings.local.json`, stale 10x skill copies, `prompts/` and `worktrees/` (6 worktrees, including the S-05 `observing-progress`).
  - Both Claude Code accounts start sessions in `~/projects`, which is not a git repo (memory `two-account-setup`), so a hook registered only in `sidereus/.claude/settings.json` never loads there.
  - Measured: whole unit suite 3.6 s (89 files, 1466 tests); `eslint` on one file 3.1-4.6 s; `astro check` 21.6 s.
  - The project skill `/Users/rafalskwara/projects/.claude/skills/10x-configure-hook/SKILL.md` and its `references/anthropic.md` set the hook rules.

## Desired End State

- `npm run lint` lints every client `<script>` in `.astro` files and fails on any warning. lint-staged does the same at commit.
- `no-console-guard.test.ts` proves end to end that a `console.log` in a plain and an `is:inline` `.astro` script is reported, so the guard no longer trusts config resolution alone.
- In CI, a test that fails then passes on retry fails the `smoke` job, and the HTML report is uploaded. Locally nothing changes (no retries).
- `vitest.config.ts` pins `pool: "forks"`.
- ~~`main` requires the `ci` and `smoke` checks~~ (dropped, 2026-10-09). Only a human merges PRs, never an agent (deny rules in `~/projects/.claude/settings.json`), and CLAUDE.md says so.
- In a Claude Code session that edits Sidereus, the end of every turn (and every subagent run) that changed a checkout runs the whole unit suite and ESLint (`--max-warnings 0 --no-warn-ignored`) on the changed files. Only checkouts this turn changed are swept, compared against a fingerprint taken when the turn started. On failure the agent is sent back once with the output. This holds for sessions started in `~/projects` (registered locally after the merge) and inside the repo or a worktree. A committed test proves the hook's behaviour.
- Known limit: in a `~/projects` session (cwd not a git repo), a Sidereus file changed only through Bash is not swept. Only `Write`/`Edit` register a checkout there. Bash rewrites are swept when the session cwd is a Sidereus checkout.
- `.claude/` is ignored except `settings.json` and `hooks/`, so `eslint .` no longer walks `.claude/worktrees/`.
- The test-plan §3 Phase 5 row reads complete. §5's flake, hook and lint rows are active. §6.5 is the e2e recipe. §6.4 no longer lists the `.astro` gap. CLAUDE.md describes the gates.

Verify with `npm test`, `npm run lint`, `npx astro check`, the break checks below (each reverted), and a live turn in a restarted session. (Branch protection was dropped at implementation.)

### Key Discoveries:

- `failOnFlakyTests: !!process.env.CI` keeps the retry, so the first failure's trace is retained (`trace: "retain-on-failure"`, `playwright.config.ts:13`), and it fails the job, so the existing `if: failure()` upload fires. No workflow edit is needed.
- `includeIgnoreFile(gitignorePath)` (`eslint.config.js`, first export entry) applies `.gitignore` to ESLint. Ignoring `.claude/*` therefore also ends the lint OOM caused by `.claude/worktrees/` (project memory `sidereus-ui-sky-light-change`).
- ESLint resolves virtual files under `files: ["src/**"]` (`noConsoleConfig`), so the existing `no-console` error applies to scripts once they parse.
- Claude Code hook protocol (`references/anthropic.md:29, 43-68`):
  - `Stop` with exit 2 and stderr keeps the agent working;
  - `stop_hook_active` marks the retry;
  - `PostToolUse` `Write|Edit` gets an absolute `tool_input.file_path`;
  - timeouts are in seconds;
  - hooks from different settings levels merge.

## What We're NOT Doing

- **Per-edit test or lint hooks.** The owner chose Stop only (2026-10-09). The per-edit hook below only records which checkout was edited, and the turn-start hook only fingerprints the cwd checkout.
- **`astro check` in the hook.** At ~22 s it was declined. It stays in CI `ci`, and lint-staged keeps per-file lint at commit.
- **Turning off e2e retries, raising timeouts, or a flake dashboard.** The retry is kept for its trace.
- **Type-aware linting of `.astro` scripts** (depth-limited `allowDefaultProject`). Its default-project limit of 8 silently drops scripts, and `define:vars` names give false positives (research §3).
- **New git hooks** (pre-push) and new CI jobs.
- **Path filters or `concurrency` groups in CI.**
- **Branch protection / required checks on `main`.** Dropped by the owner on 2026-10-09, during Phase 2: required checks would slow them down. The owner's actual rule is that only a human merges PRs, never an LLM through `gh` or the GitHub API. The orchestrator enforces this with Claude Code deny rules in `~/projects/.claude/settings.json`, not with GitHub settings. Phase 4 records the rule in CLAUDE.md.
- **Fixing the date-dependent e2e skips** (`moon-as-target`, `tonight-targets`, `tonight-sky`, `planets-on-tonight`, `moon-card`). They are recorded in §6.5 as a known limit.

## Implementation Approach

The cheapest, widest gates go first: lint scope, then the CI settings. The hook comes after them because it reuses the finished lint configuration (warnings as errors, `.astro` scripts) and the `.gitignore` re-include. Docs come last. Each phase proves its gate with a break check that turns red before the fix or when the gate is removed.

## Critical Implementation Details

- **Config order:** the `.astro` script block goes **last** in the `eslint.config.js` export (after `eslintPluginPrettier`) **and** sets `prettier/prettier: "off"`. Both are needed:
  - placed last without the rule-off, real files get 9 prettier errors;
  - placed just before `eslintPluginPrettier` with it off, the rule still resolves to error;
  - placed before `baseConfig`, it loses `projectService: false`.
- **Generated files:** an ESLint-ignored file passed by name (`src/lib/database.types.ts`, `worker-configuration.d.ts`) is a warning ("File ignored …"). Every `--max-warnings 0` invocation that receives explicit paths (lint-staged, the hook) also passes `--no-warn-ignored`; `eslint .` does not need it.
- **UserPromptSubmit stdout:** on exit 0, this hook's stdout is added to the prompt as context. `turn-start.sh` must print nothing to stdout.
- **Hook registration:** sessions start in `~/projects` (not a git repo), so the hook is registered in two places:
  - the committed `sidereus/.claude/settings.json`, for sessions started in the repo or a worktree (Phase 3);
  - the local `~/projects/.claude/settings.json`, with absolute script paths, written only after this PR merges (Phase 5).
  
  The local commands guard themselves:
  - they exit 0 without running when `$CLAUDE_PROJECT_DIR` is a checkout that has its own `.claude/hooks/end-of-turn.sh`, since the repo registration covers it; this avoids a double run if parent settings also load;
  - they print one line to stderr and exit 1 when the script file is missing (the main checkout is on a branch without it), so the user sees "hook error" and the agent is not blocked.
  
  The scripts sweep only checkouts that contain `.claude/hooks/end-of-turn.sh`. This skips other repositories under `~/projects` and checkouts on branches without the hook, such as S-05 until it rebases.

## Phase 1: Lint coverage

### Overview

`.astro` client scripts get linted. The no-console guard proves this end to end. Warnings fail lint. `.claude/` is ignored except the hook files.

### Changes Required:

#### 1. Lint `.astro` client scripts

**File**: `eslint.config.js`

**Intent**: Give the plugin's virtual script files a parser setup that works, so every rule (including the repo-wide `no-console` error) runs on them.

**Contract**:
- A new config for `**/*.astro/*.ts` and `**/*.astro/*.js`:
  - extends `tseslint.configs.disableTypeChecked`;
  - `languageOptions.parserOptions: { projectService: false, project: null }`;
  - `rules: { "prettier/prettier": "off" }`.
- It goes last in the default export.
- Its comment explains the dropped parse error (impl review F3) and names the guard case.

#### 2. End-to-end guard case

**File**: `src/lib/no-console-guard.test.ts`

**Intent**: Prove that a rule actually runs on `.astro` scripts. Config resolution alone was shown to be untrustworthy.

**Contract**:
- A new `it` (30 s timeout) calls `eslint.lintText` on in-memory `.astro` sources. Each `filePath` is the existing `src/pages/offline.astro`; a path that does not exist fails the main file's parse.
- Expectations:
  - `<script>` containing `console.log(1)` → exactly one message, `ruleId: "no-console"`, severity 2, on the script's line;
  - the same in `<script is:inline>` → one;
  - a `<script type="application/ld+json">` → none.
- Samples are prettier-clean (blank line after the frontmatter, indented script body), or the assertion filters messages by `ruleId`.
- The non-vacuity case asserts that the sample path exists.
- The header's "Known gap" sentence about `.astro` scripts is replaced by one naming this case.
- Behavior asserted: a log in an `.astro` client script is an error. Regression caught: a config change that silently stops script linting again. Edge cases: `is:inline`, and a JSON script that is not extracted. Anti-pattern avoided: trusting `calculateConfigForFile`.

#### 3. Warnings fail lint

**File**: `package.json`

**Intent**: Stop warn-level debt (`astro/no-unused-css-selector`, base `no-console` outside `src`, …) from merging silently. It costs nothing today, with 0 warnings.

**Contract**:
- `"lint": "eslint . --max-warnings 0"`.
- The lint-staged `*.{ts,tsx,astro}` command becomes `eslint --fix --max-warnings 0 --no-warn-ignored`, so a regenerated `database.types.ts` (eslint-ignored, committed with every migration) still commits.

#### 4. Ignore local `.claude/` content

**File**: `.gitignore`

**Intent**: Keep worktrees, local settings and stale skill copies out of git and out of `eslint .`, and keep the hook config committable.

**Contract**: append `.claude/*`, `!.claude/settings.json` and `!.claude/hooks/`, with a comment. Apply this change first in the phase, before any `npm run lint`: until then, `eslint .` walks `.claude/worktrees` (the known OOM).

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the new guard case
- `npm run lint` passes with `--max-warnings 0`, and `npx astro check` passes
- Break check: without the new config block, the guard's `.astro` case fails; restored
- Break check: a `console.log` in `src/components/ui/Notice.astro`'s `<script>` fails `npm run lint`; reverted
- Break check: a warn-level finding (`console.log` in a `tests/db/*.ts` file) fails `npm run lint`; reverted
- The lint-staged form `npx eslint --max-warnings 0 --no-warn-ignored src/lib/database.types.ts` exits 0, while without `--no-warn-ignored` it exits 1
- `git status --porcelain` no longer lists `.claude/`; `git check-ignore -q .claude/settings.json` exits 1 and `git check-ignore -q .claude/worktrees` exits 0

#### Manual Verification:

- The guard's failure output for the first break check names the `.astro` sample and the missing `no-console`

**Implementation Note**: commit the phase and continue (owner's multi-phase preference). Manual rows are verified by the agent where evidence allows, otherwise left for the joint check after the last phase. After this phase, update the lint-OOM workaround in memory (`sidereus-ui-sky-light-change`): it is obsolete once `.claude/*` is ignored.

---

## Phase 2: CI gates

### Overview

A flaky e2e test fails CI, Vitest's pool is pinned. ~~`main` requires `ci` and `smoke`~~ (dropped by the owner at implementation).

### Changes Required:

#### 1. Flaky tests fail CI

**File**: `playwright.config.ts`

**Intent**: A test that passes only on retry is a defect to fix, not a green run. The retry stays for its trace.

**Contract**:
- `failOnFlakyTests: !!process.env.CI`.
- A comment names `parallel-e2e-flakes` (#45) and test-plan §6.5.
- Behavior asserted: fail-then-pass exits non-zero under `CI`. Regression caught: a flaky spec merging green. Edge case: no change locally (`retries: 0`). Anti-pattern avoided: `retries: 0`, which would lose the first-failure trace.

#### 2. Pin the Vitest pool

**File**: `vitest.config.ts`

**Intent**: The runner-zone suites switch `process.env.TZ` in-process, which works only in `forks`. Make that a config fact rather than a default.

**Contract**: `test.pool: "forks"`, with a comment pointing at `src/lib/engine/fixtures/runner-zones.ts`.

#### 3. ~~Required checks on `main`~~ (dropped by the owner at implementation; see the decision note below)

**Where**: GitHub repository settings via `gh api` (outward change). Ask the owner (push notification) right before running it.

**Intent**: Turn the `ci` and `smoke` jobs into merge gates.

**Contract**:
- `PUT repos/RafalSkwara/Sidereus/branches/main/protection` with:
  - `required_status_checks: { strict: false, contexts: ["ci", "smoke"] }`;
  - `enforce_admins: false` (the owner can still bypass knowingly);
  - `required_pull_request_reviews: null`;
  - `restrictions: null`.
- Record the response in the phase notes.
- `.github/workflows/ci.yml`: a comment above the `ci` and `smoke` jobs says their ids are required-check names on `main`. Renaming either would leave every PR "Expected — waiting".

### Success Criteria:

#### Automated Verification:

- `npm test` passes with the pinned pool
- Break check: `npx vitest run --pool threads src/lib/engine/night-boundaries.test.ts` fails (the pin protects something); no file changed
- Break check: a scratch spec `tests/e2e/zz-flaky-probe.spec.ts` that fails when `testInfo.retry === 0` makes `CI=1 npx playwright test tests/e2e/zz-flaky-probe.spec.ts` exit 1 and report 1 flaky. The same probe exits 0 without the config line. The spec uses no `page`, so no preview, port or Supabase is needed. Deleted afterwards
- `gh api repos/RafalSkwara/Sidereus/branches/main/protection` lists `ci` and `smoke` as required contexts
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- This change's PR shows `ci` and `smoke` as required on GitHub

**Implementation Note**: as Phase 1. ~~The branch-protection step waits for the owner's explicit OK.~~

**Owner decision (2026-10-09, at implementation):** change #3 (required checks) and its `ci.yml` comment are dropped; rows 2.4 and 2.6 are marked dropped in Progress. See What We're NOT Doing.

---

## Phase 3: End-of-turn agent hook

### Overview

At the end of a turn (`Stop`) or subagent run (`SubagentStop`) that changed a checkout, a Claude Code hook runs the unit suite and lints the changed files, then sends the agent back once with the failures. Two tiny helper hooks support it:
- a per-edit hook records which checkout was edited, so the sweep finds it wherever the session runs;
- a turn-start hook fingerprints the cwd checkout, so earlier WIP and other agents' edits do not trigger a sweep.

A committed test proves all three scripts. This phase registers the hooks in the repo only; the local `~/projects` registration is Phase 5.

### Changes Required:

#### 1. End-of-turn script

**File**: `.claude/hooks/end-of-turn.sh` (new, executable)

**Intent**: Make the gates that already exist (lint, the unit suite with the Phase 1-4 guards) reach the agent before it finishes a turn, including edits made through Bash.

**Contract**: follows the skill's `end-of-turn.sh` (`references/anthropic.md:182-279`) with these adaptations.
- **Input:**
  - Stop payload on stdin.
  - Needs `jq`; without it, exit 2 with a message.
  - Handles `Stop` and `SubagentStop` alike; confirm the `SubagentStop` payload fields and its retry flag against the live hooks doc when implementing, and record any difference in the script header.
  - If `stop_hook_active` is true or `loop_count` > 0, this is the retry pass. Run the checks again; if still red, print a `systemMessage` JSON on stdout naming the root, so the user sees that the turn ended red, then exit 0.
- **Roots:**
  - the git top-level of the payload `cwd`, plus the session registry `${TMPDIR:-/tmp}/claude-hooks/<session_id>.roots`;
  - keep only roots that contain `.claude/hooks/end-of-turn.sh`;
  - skip a root whose current fingerprint equals the one `turn-start.sh` stored for this session at turn start (nothing changed this turn);
  - if none remain, exit 0 silently (another repository, an unchanged checkout, or a non-repo `~/projects` session with no Sidereus edits).
- **Fingerprint:** a hash of `git diff HEAD --binary` plus the untracked, non-ignored files' names and contents.
- **Node:**
  - when `$NVM_DIR/nvm.sh` exists and the root has `.nvmrc`, source it and `nvm use --silent` in the root;
  - then require `node_modules/.bin/eslint` and `node_modules/.bin/vitest` to be executable in the root, otherwise exit 2 naming the missing tool with an `npm ci` hint (no silent success);
  - when `.astro/` is missing, run `node_modules/.bin/astro sync` first;
  - call these local bins directly, not `npx`.
- **Shell:** bash 3.2-safe (macOS `/bin/bash`): no `mapfile`, and no `set -u` with empty arrays.
- **Per root:**
  - Changed files are `git diff --name-only HEAD` plus untracked, non-ignored files; with none, skip the root.
  - **Lint** the existing changed `*.ts|*.tsx|*.astro|*.js|*.mjs|*.cjs` with `eslint --max-warnings 0 --no-warn-ignored` (no `--fix`).
  - **Test:** run the whole `vitest run` unless every changed path is documentation (`*.md` or under `context/`). This includes `.claude/hooks/**`, `.gitignore` and lockfile changes, which tests read.
- **Output:**
  - `NO_COLOR=1 FORCE_COLOR=0`;
  - each tool's output is cut to its last 200 lines;
  - all failures in one stderr message naming the root, then exit 2;
  - when green, print a one-line summary on stdout naming what ran (debug log only; it lets the baseline check see that ESLint and Vitest ran), clear the registry, and exit 0.

#### 2. Turn-start fingerprint

**File**: `.claude/hooks/turn-start.sh` (new, executable)

**Intent**: Record what the cwd checkout looked like when the turn began, so the Stop sweep reacts only to this turn's changes (plan review F2).

**Contract**:
- `UserPromptSubmit` payload. If the git top-level of `cwd` contains `.claude/hooks/end-of-turn.sh`, write its fingerprint (same definition as in `end-of-turn.sh`) to `${TMPDIR:-/tmp}/claude-hooks/<session_id>.start`.
- Prints nothing to stdout, since on exit 0 stdout becomes prompt context.
- Always exits 0.
- Missing `jq`, or a non-repo `cwd`, means no fingerprint, so the Stop hook sweeps as without this hook.

#### 3. Checkout registry

**File**: `.claude/hooks/register-checkout.sh` (new, executable)

**Intent**: Let the Stop hook sweep the checkout the agent actually edited, such as a worktree, when the session `cwd` is `~/projects` or another checkout.

**Contract**:
- `PostToolUse` `Write|Edit` payload:
  - resolve `tool_input.file_path` (relative against `cwd`) to its git top-level;
  - append it to the session registry;
  - always exit 0, since it checks nothing.
- Exit 0 with no output when the path is missing, the file is outside a repository, or `jq` is missing; the Stop hook reports a missing `jq`.

#### 4. Hook registration in the repo

**File**: `.claude/settings.json` (new, committed)

**Intent**: Load the hooks in sessions started in the repo or a worktree.

**Contract**:
- `UserPromptSubmit` → `turn-start.sh`, timeout 10.
- `PostToolUse` matcher `Write|Edit` → `register-checkout.sh`, timeout 10.
- `Stop` and `SubagentStop` → `end-of-turn.sh`, timeout 120.
- Commands resolve the script through `git rev-parse --show-toplevel`, falling back to `$CLAUDE_PROJECT_DIR`, as in the reference.

#### 5. Proof test

**File**: `src/lib/agent-hooks.test.ts` (new; next to the repo's other repository guards, inside the Vitest include)

**Intent**: Keep the hook proven as it changes (skill Step 7), in the unit suite CI already runs.

**Contract**:
- Each case builds a throwaway git repo in the OS temp dir (compared via `realpath`). The repo holds copies of the three scripts and stub `node_modules/.bin/eslint` and `vitest` shell scripts that fail when a changed file contains a `BROKEN` marker and log their calls.
- Environment per case:
  - its own `TMPDIR`;
  - `NVM_DIR` pointing at an empty dir;
  - `CLAUDE_PROJECT_DIR` unset (except in case 8);
  - `GIT_DIR`, `GIT_INDEX_FILE` and `GIT_WORK_TREE` removed;
  - commits made with `-c user.name=… -c user.email=…`, because CI runners have no git identity.
- Scripts are spawned through `/bin/bash` by absolute path; `git` and `jq` are real.
- Embedded stub text never contains the string `eslint-disable`, which the no-console guard counts.
- Cases, asserting exit code and stderr:
  1. **Broken `.ts` change:** exit 2, and stderr names the file.
  2. **Clean change:** exit 0, empty stderr.
  3. **Docs-only change:** exit 0, and neither stub is called.
  4. **No change:** exit 0, and no stub is called.
  5. **Payloads:** `{}` and `not json` behave as for the process cwd.
  6. **Retry:** `stop_hook_active: true` with a broken change gives exit 0 and a `systemMessage` on stdout naming the root.
  7. **Write bypassing per-edit hooks:** a broken file written to disk with no `PostToolUse` call gives exit 2.
  8. **Checkout resolution:**
     - `CLAUDE_PROJECT_DIR` pointing at a broken repo leaves the cwd's clean repo green;
     - a broken sibling `git worktree` that is registered through `register-checkout.sh` gives exit 2;
     - a registered repo without the hook script is skipped;
     - a relative `file_path` resolves against `cwd`.
  9. **Missing tool:** with the `eslint` stub removed, exit 2 naming it with the `npm ci` hint; with an empty `PATH` (no `jq`), exit 2.
  10. **Ignored generated file:** a changed file the stub treats as ignored is passed with `--no-warn-ignored` (the stub asserts the flag), and the result is exit 0.
  11. **Turn fingerprint:**
      - a broken change made before `turn-start.sh` ran, untouched during the turn, is skipped (exit 0, no stub called);
      - a further change after it is swept (exit 2).
  12. **`SubagentStop` payload:** a broken change gives exit 2, as for `Stop`.
  13. **`turn-start.sh`:** prints nothing on stdout, exits 0 on `{}`, `not json` and a non-repo `cwd`.
  14. **`bash -n`** passes on all three scripts.
  15. **Bash-limit documentation case:** cwd not a repo, empty registry, a broken change in a Sidereus-like repo → exit 0 (the documented limit).
- Each `command` in `.claude/settings.json`, run from a worktree with `CLAUDE_PROJECT_DIR` set to a nonexistent path, reaches an executable script.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including `agent-hooks.test.ts`
- Break check: with the `stop_hook_active` guard removed from `end-of-turn.sh`, case 6 fails; restored
- `bash -n` on the three scripts, and `jq empty .claude/settings.json`, pass
- Real-run baseline: with the Phase 3 files still uncommitted, the real `end-of-turn.sh` run on this repo (payload `{"cwd": "<repo>", "session_id": "baseline"}`, no start fingerprint) exits 0, its stdout summary shows that ESLint and Vitest ran, and it finishes well under 120 s
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- In a session started in the repo (and one in a worktree that contains the hooks), `/hooks` lists each of the four hooks once
- A live turn in such a session that writes a failing assertion is sent back by the Stop hook with the Vitest output, and the next turn ends normally after the fix

**Implementation Note**: as Phase 1. The manual rows need a restarted session, so they are left for the joint check.

---

## Phase 4: Docs and cookbook

### Overview

Close Phase 5 in the test plan, write the e2e recipe, and record the gates where agents read them.

### Changes Required:

#### 1. Test plan

**File**: `context/foundation/test-plan.md`

**Intent**: The rollout's last phase is done; the gates table and cookbook describe what is wired.

**Contract**:
- §3 Phase 5 status `complete`.
- §5 rows:
  - lint (`--max-warnings 0`, `.astro` scripts);
  - e2e flake visibility: active, `failOnFlakyTests` in CI;
  - "post-edit agent hook" becomes the end-of-turn Stop hook (active, whole unit suite plus lint of changed files);
  - the Where column names CI `ci` and `smoke` (not required checks; only a human merges).
- §6.4 Blind spots: drop the `.astro` script sentence.
- §6.5 replaces its TBD with the e2e recipe:
  - when a journey needs the browser;
  - `waitForHydration`;
  - local Supabase only;
  - a flake fails CI, so reproduce with `--repeat-each 4 --workers 5` and fix the cause, never add retries or timeouts;
  - the offline lesson;
  - date-dependent skips as a known limit.
- §6.6: a Phase 5 note with the break checks that turned red.
- §1-§2 stay frozen.

#### 2. CLAUDE.md and lessons

**File**: `CLAUDE.md`, `context/foundation/lessons.md`

**Intent**: Agents and the owner see the new gates where they already look.

**Contract**:
- CLAUDE.md:
  - the coordinates tripwire drops the "not linted yet" sentence and states that `.astro` scripts are linted (non-type-aware);
  - the Commands block notes `--max-warnings 0` and that a flaky e2e test fails CI;
  - a short "Agent hooks" bullet in Tripwires covers:
    - what the Stop and SubagentStop hook runs, and the turn fingerprint;
    - the `~/projects` registration and its exact snippet;
    - the Bash-only limit in `~/projects` sessions;
    - a fresh worktree needs `npm ci` before the hook can pass;
    - `.claude/` is ignored except `settings.json` and `hooks/`;
    - only a human merges PRs: an agent never merges through `gh pr merge` or the GitHub API (owner rule, enforced by deny rules in `~/projects/.claude/settings.json`).
- `lessons.md` appends one entry: "Resolving a rule's config is not proof the rule runs: pair a config guard with one end-to-end lint of a known violation per file kind".

### Success Criteria:

#### Automated Verification:

- `grep -c "TBD — see §3 Phase 5" context/foundation/test-plan.md` prints 0, and `grep -E '^\| 5 \|.*\| complete \|' context/foundation/test-plan.md` matches the §3 row
- `grep -c "not linted yet" CLAUDE.md` prints 0

#### Manual Verification:

- §6.5 reads as a complete e2e recipe, and §5 matches what is wired

**Implementation Note**: as Phase 1.

---

## Phase 5: Local registration (after the merge)

### Overview

After this change's PR has merged into `main`, register the hooks for sessions started in `~/projects`. The scripts then exist on `main` and on every branch cut from it.

### Changes Required:

#### 1. Local settings

**File**: `~/projects/.claude/settings.json` (outside git; holds both accounts' shared `permissions`)

**Intent**: Make the hooks fire in the owner's usual sessions, which start in `~/projects`.

**Contract**:
- Back the file up to the scratchpad first.
- Merge a `hooks` key next to `permissions`, with the same four hooks as the repo file. Each command uses the absolute path `$HOME/projects/sidereus/.claude/hooks/<script>` and the self-guard from Critical Implementation Details:
  - exit 0 when `$CLAUDE_PROJECT_DIR` is a checkout with its own hook;
  - one stderr line and exit 1 when the script is missing.
- Show the owner the diff and wait for an explicit OK before writing.

### Success Criteria:

#### Automated Verification:

- `jq empty ~/projects/.claude/settings.json` passes, and `jq -S .permissions` equals the backup's
- Each local command, run with `CLAUDE_PROJECT_DIR=$HOME/projects` and a `{}` payload, reaches its script and exits 0; run with `CLAUDE_PROJECT_DIR` set to the repo, it exits 0 without running the script

#### Manual Verification:

- In a session restarted from `~/projects`, `/hooks` lists each hook once, and a turn that breaks a unit test in Sidereus through `Edit` is sent back
- In a session started in the repo, `/hooks` still lists each hook once (no double registration)

**Implementation Note**: run after the PR merges; the archive waits for this phase.

---

## Impact on the S-05 branch (`feat/observing-progress`, worktree `.claude/worktrees/observing-progress`)

| Change | Reaches it | What coder must adapt to |
|---|---|---|
| `eslint.config.js` `.astro` script block | after rebasing onto `main` | Any `<script>` S-05 adds to an `.astro` file is linted (strict non-type-aware rules plus `no-console`); fix what `npm run lint` reports. |
| `--max-warnings 0` (lint and lint-staged) | after rebase | Any warning in S-05 code fails lint and the commit hook; clear warnings before committing. |
| `.gitignore` `.claude/*` | after rebase | None functional. The worktree's `git status` stops showing `.claude/`. |
| `no-console-guard.test.ts` `.astro` case | after rebase | Keep `src/pages/offline.astro` (the sample path), or update the guard if S-05 moves it. |
| `playwright.config.ts` `failOnFlakyTests` | after rebase | A spec that passes only on retry fails CI. Fix the cause (`waitForHydration`, isolation) rather than retrying. |
| `vitest.config.ts` `pool: "forks"` | after rebase | None (already the default). |
| `.claude/settings.json` + `.claude/hooks/` (UserPromptSubmit, PostToolUse, Stop, SubagentStop) | after rebase, and a restart of a session started in the worktree | ~13-15 s at the end of turns and subagent runs that changed the worktree; one send-back on red tests or lint (earlier WIP does not trigger it). The worktree needs `node_modules` (`npm ci`). |
| `~/projects/.claude/settings.json` registration (Phase 5, after merge) | at the next restart of any session started in `~/projects` | The hook skips the S-05 worktree until it contains `.claude/hooks/end-of-turn.sh`. After the rebase, the same send-back applies. |

## Testing Strategy

### Unit Tests:

- `src/lib/no-console-guard.test.ts`: end-to-end lint of `.astro` script samples (plain, `is:inline`, JSON).
- `src/lib/agent-hooks.test.ts`: the three hook scripts against throwaway repos, cases 1-15 plus the command resolution check.

### Integration Tests:

- None new. The flake gate is proven by a scratch spec and the pool pin by a `--pool threads` run, both temporary.

### Manual Testing Steps:

1. After Phase 3, restart a session in the repo and check `/hooks`. After Phase 5, do the same from `~/projects`.
2. In that session, make a turn that breaks a unit test, and watch the Stop hook send it back.
3. ~~Open this change's PR and check that `ci` and `smoke` are marked required.~~ (dropped)

## Performance Considerations

- The Stop hook adds about 4 s (unit suite) plus about 3-5 s (ESLint on the changed files) to turns that change a checkout, within the 120 s timeout. Turns that change nothing (fingerprint unchanged) and docs-only turns add a few milliseconds, plus about 0.1 s for the turn-start fingerprint.
- `agent-hooks.test.ts` spawns bash per case. Keep it under about 5 s with stubbed tools. Removing the `.claude/worktrees` walk speeds up `eslint .`.

## Migration Notes

- The hooks can be removed by deleting their entries from both settings files.

## References

- Research: `context/changes/testing-quality-gates-wiring/research.md`
- Hook rules: `/Users/rafalskwara/projects/.claude/skills/10x-configure-hook/SKILL.md`, `references/anthropic.md`
- F3: `context/archive/2026-10-09-testing-access-and-entitlement-boundary/follow-ups/review-fixes.md`
- Flake history: `context/archive/2026-09-28-parallel-e2e-flakes/plan.md`

## Addendum (implementation and impl review, 2026-10-09)

- `.claude/hooks/lib.sh` (sourced) holds the helpers the three scripts share, so the fingerprint has one definition (an implementation ADAPT).
- Impl review F1: all hook state is keyed by session **and agent** (`<session>.<agent_id|main>`).
  - `turn-start.sh` also runs on `SubagentStart`, so each subagent gets its own start fingerprint.
  - A new prompt resets only the main thread's files.
  - A green run clears only its own agent's registry.
  - A subagent is never judged on the parent's work in progress.
- Impl review F2: the fingerprint hashes names, symlink targets (never followed) and blob hashes in one batched `git hash-object --stdin-paths`. No `xargs -I` (its 255-byte limit on macOS), no shell per file.
- Impl review F3: ESLint gets `--` before the paths. Impl review F10: a documentation-only change runs nothing, even where the tools are not installed.
- Impl review F5: the proof test shares symlinked stubs. Measured locally: hook proof ~8.5 s, whole unit suite ~10 s, so a code-changing Stop costs ~13-15 s with lint (the earlier ~8 s estimate was optimistic).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Lint coverage

#### Automated

- [x] 1.1 `npm test` passes, including the new guard case — 7aa8446
- [x] 1.2 `npm run lint` passes with `--max-warnings 0`, and `npx astro check` passes — 7aa8446
- [x] 1.3 Break check: without the new config block, the guard's `.astro` case fails; restored — 7aa8446
- [x] 1.4 Break check: `console.log` in Notice.astro's script fails `npm run lint`; reverted — 7aa8446
- [x] 1.5 Break check: a warn-level finding in `tests/db` fails `npm run lint`; reverted — 7aa8446
- [x] 1.6 `--no-warn-ignored` lets the lint-staged form pass on `database.types.ts`, failing without it — 7aa8446
- [x] 1.7 `.claude/` gone from `git status`; `check-ignore -q` exits 1 for settings.json, 0 for worktrees — 7aa8446

#### Manual

- [x] 1.8 The guard's failure output names the `.astro` sample and the missing `no-console` — 7aa8446

### Phase 2: CI gates

#### Automated

- [x] 2.1 `npm test` passes with the pinned pool — 52f96c3
- [x] 2.2 Break check: `--pool threads` fails the night-boundaries suite — 52f96c3
- [x] 2.3 Break check: the flaky probe exits 1 under `CI=1` with the config, 0 without; probe deleted — 52f96c3
- [x] 2.4 `gh api …/branches/main/protection` lists `ci` and `smoke` as required — dropped (owner, 2026-10-09)
- [x] 2.5 `npm run lint` and `npx astro check` pass — 52f96c3

#### Manual

- [x] 2.6 This change's PR shows `ci` and `smoke` as required — dropped (owner, 2026-10-09)

### Phase 3: End-of-turn agent hook

#### Automated

- [x] 3.1 `npm test` passes, including `agent-hooks.test.ts` — 595ddf7
- [x] 3.2 Break check: without the `stop_hook_active` guard, case 6 fails; restored — 595ddf7
- [x] 3.3 `bash -n` on the three scripts and `jq empty .claude/settings.json` pass — 595ddf7
- [x] 3.4 Real-run baseline exits 0, shows ESLint and Vitest ran, well under 120 s — 595ddf7
- [x] 3.5 `npm run lint` and `npx astro check` pass — 595ddf7

#### Manual

- [ ] 3.6 `/hooks` in a repo- and a worktree-started session lists each hook once
- [ ] 3.7 A live turn with a failing assertion is sent back once, then ends normally after the fix

### Phase 4: Docs and cookbook

#### Automated

- [x] 4.1 No "TBD — see §3 Phase 5" left in test-plan.md, and the §3 Phase 5 row matches `complete` — d53a120
- [x] 4.2 No "not linted yet" left in CLAUDE.md — d53a120

#### Manual

- [x] 4.3 §6.5 is a complete e2e recipe and §5 matches what is wired — d53a120

### Phase 5: Local registration (after the merge)

#### Automated

- [ ] 5.1 `jq empty` on the local settings passes, and `.permissions` equals the backup's
- [ ] 5.2 Local commands run their script from `~/projects` and skip themselves for the repo

#### Manual

- [ ] 5.3 `/hooks` in a `~/projects` session lists each hook once, and a broken unit test is sent back
- [ ] 5.4 A repo-started session still lists each hook once
