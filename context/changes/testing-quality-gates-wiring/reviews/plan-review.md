<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Test rollout Phase 5: quality-gates wiring

- **Plan**: context/changes/testing-quality-gates-wiring/plan.md
- **Phases**: 4
- **Date**: 2026-10-09
- **Verdict**: REJECTED by the rubric (one critical FAIL). Triage is recommended over re-planning, because F1 is a one-flag patch and the plan's premise holds.
- **Findings**: 1 critical, 7 warnings, 2 observations
- **Triage**: all 10 fixed in the plan (F2 and F4 via Fix A); post-triage verdict SOUND, ready for /10x-implement

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Claim Accuracy | WARNING |
| Substance | PASS |
| Feasibility | FAIL |
| Sequencing | WARNING |
| Architecture Fit | WARNING |
| Scope Discipline | PASS |
| Verifiability | WARNING |
| Coverage | WARNING |

## Grounding

- **Claims:** two Opus reviewers checked them, with in-memory ESLint probes and read-only `gh`.
- **Confirmed:**
  - export order and `projectService` in `eslint.config.js`;
  - the proposed last `.astro` block gives 1/1/0 `no-console` for plain, `is:inline` and JSON scripts at `src/pages/offline.astro`, against 0/0/0 today;
  - `.gitignore` → ESLint ignores `.claude/worktrees/**` but keeps `.claude/hooks`;
  - `failOnFlakyTests` makes a flaky run exit 1 (`playwright/lib/runner/failureTracker.js:61`, `program.js:190`);
  - `--pool threads` fails 4/130 night-boundary tests at `expectRunnerZoneActive`;
  - no file collisions;
  - check-run names are `ci` and `smoke` (PR #148);
  - the `gh` token has admin and `repo` scope.
- **Commands:** all automated lines resolve (`npm test`, `npm run lint`, `vitest --pool`, `playwright test`, `gh api`, `jq`, `bash`).
- **Not verified:** whether Claude Code reads `.claude/settings.json` from parent directories, and the subagent payload fields (`agent_id`).

## Findings

### F1 — `--max-warnings 0` fails on explicitly passed ESLint-ignored files

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Feasibility
- **Location**: plan.md Phase 1 › Changes #3 (lint-staged); Phase 3 › Changes #1 (hook lint)
- **Detail**:
  - ESLint 10 warns "File ignored because of a matching ignore pattern" for an ignored file passed by name (`node_modules/eslint/lib/eslint/eslint-helpers.js:672-715`).
  - Re-checked: `eslint --max-warnings 0 src/lib/database.types.ts` → "too many warnings", rc=1; with `--no-warn-ignored`, rc=0.
  - `database.types.ts` (5 commits in two weeks, one per migration) and `worker-configuration.d.ts` match lint-staged's `*.{ts,tsx,astro}` and the hook's `*.ts`.
  - After Phase 1, every migration commit fails pre-commit, and the Stop hook sends the agent back over a generated file it must not edit.
- **Fix**: Add `--no-warn-ignored` to the lint-staged command and to the hook's ESLint call. Add a break check (a changed `database.types.ts` passes lint-staged) and a hook-test case (changed ignored file → exit 0).
- **Decision**: FIXED — `--no-warn-ignored` in lint-staged and the hook; criterion 1.6 and hook case 10 added.

### F2 — The Stop hook judges the checkout's dirty state, not this turn's edits

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture Fit
- **Location**: plan.md Phase 3 › Changes #1 (Per root); Performance Considerations
- **Detail**:
  - The cwd root is swept with `git diff HEAD` plus untracked files on every Stop. In a session started in the repo or a worktree (coder's, for example), every turn re-runs the suite and lint (~8 s) while uncommitted code exists, Q&A turns included.
  - It sends the agent back for red state it did not cause: the owner's WIP, another agent's edit, a test left red on purpose.
  - The plan's "Q&A turns add a few milliseconds" holds only on a clean tree.
- **Fix A ⭐ Recommended**: Fingerprint each root at turn start (`UserPromptSubmit`: hash of `git diff HEAD` plus the untracked list, stored per session) and sweep at Stop only roots whose fingerprint changed, or that the registry added this turn.
  - Strength: The gate reacts to this turn's work only; WIP and other agents' edits stop triggering send-backs.
  - Tradeoff: A third tiny hook script and two more proof-test cases.
  - Confidence: MED — `UserPromptSubmit` and its `session_id` are documented; per-turn timing is standard.
  - Blind spot: A turn that edits and then reverts to the same diff is skipped (harmless).
- **Fix B**: Keep the dirty-tree sweep, document it in CLAUDE.md, and correct the performance note.
  - Strength: No extra script.
  - Tradeoff: Send-backs for state the agent didn't create; it learns to ignore the hook (the anti-pattern this phase names).
  - Confidence: HIGH — only documentation.
  - Blind spot: How often WIP sits uncommitted in the coder's worktree.
- **Decision**: FIXED via Fix A — `turn-start.sh` (UserPromptSubmit) fingerprints the cwd checkout; Stop skips unchanged roots; case 11.

### F3 — The local registration runs the main checkout's script, and double registration has no remedy

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Sequencing
- **Location**: plan.md Phase 3 › Changes #3; Critical Implementation Details; Progress 3.6
- **Detail**:
  - `~/projects/.claude/settings.json` points at `$HOME/projects/sidereus/.claude/hooks/…`. Whenever that checkout is on a branch without the scripts (any branch cut from `main` before this PR merges, archive branches, old branches), every `Write`/`Edit` and every Stop in every `~/projects` session (both accounts, `loadmap` too) shows "hook error". Writing it during Phase 3, before the merge, guarantees this.
  - If a repo- or worktree-started session also loads the `~/projects` file (unverified), two Stop hooks run with different command strings, with no dedup and a race on clearing the registry. The plan only checks for this (3.6); it has no remedy.
- **Fix**: Make the local command self-guarding:
  - skip with exit 0 when `$CLAUDE_PROJECT_DIR` is a checkout that has its own `.claude/hooks/end-of-turn.sh` (the repo registration covers it);
  - otherwise, when the script file is missing, print one line to stderr and exit 1, so the user sees "hook error" and the agent is not blocked.
  
  Write the local file as a post-merge step (after this PR lands on `main`), and add the repo- and worktree-started `/hooks` check to 3.6.
  - Strength: One runner however Claude Code loads settings; no error storm before the merge.
  - Tradeoff: The local registration's manual check moves after the merge.
  - Confidence: MED — the guard logic is simple; parent-dir loading is still unverified, but the guard makes it irrelevant.
  - Blind spot: A main checkout later sitting on an old branch still shows the one-line error until it switches.
- **Decision**: FIXED — local registration moved to a new post-merge Phase 5 with self-guarding commands (skip when the repo registration applies, visible error when the script is missing); 3.6 now covers repo- and worktree-started sessions, 5.4 the double-registration check.

### F4 — Subagents are not gated, and their edits are swept by the parent's Stop

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture Fit
- **Location**: plan.md Desired End State; Phase 3
- **Detail**:
  - Subagents end with `SubagentStop`, not `Stop`. Much code here is written by delegated Sonnet subagents (memory `subagent-model-default`), and they would never hear the gate.
  - Their `PostToolUse` edits likely register under the parent's `session_id`, so the parent's Stop can sweep a checkout a background subagent is still editing, and send the parent back to "fix" its files.
- **Fix A ⭐ Recommended**: Register `end-of-turn.sh` on `SubagentStop` too (same script, one retry), so a delegated phase is checked before it hands back. Document that a parent's Stop during a running background subagent may see its intermediate state.
  - Strength: The gate reaches the agents that write most of the code.
  - Tradeoff: Each subagent finish adds ~8 s on code-changing work.
  - Confidence: MED — `SubagentStop` is a documented event, but its retry flag is assumed to be the same `stop_hook_active`; verify in the live doc when implementing.
  - Blind spot: Payload fields (`agent_id`) not verified.
- **Fix B**: Scope subagents out explicitly (Not Doing plus CLAUDE.md) and rely on the parent's gates (Stop, impl-review).
  - Strength: Simpler.
  - Tradeoff: Delegated phases come back red more often.
  - Confidence: HIGH.
  - Blind spot: none.
- **Decision**: FIXED via Fix A — `end-of-turn.sh` also on SubagentStop; payload and retry flag to be checked against the live doc; case 12.

### F5 — Bash-only edits in `~/projects` sessions are never swept

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md Phase 3 › Changes #1 Intent ("including edits made through Bash")
- **Detail**: With cwd `~/projects` (not a repo), roots come only from the `Write|Edit` registry. A turn that changes Sidereus only through `sed -i` or `cat >` is invisible. Case 7 tests only cwd = repo.
- **Fix**: State the limit in the Desired End State and in CLAUDE.md's hook bullet (Bash rewrites are swept only when the session cwd is a Sidereus checkout), and add a proof case for it.
- **Decision**: FIXED — limit stated in Desired End State and CLAUDE.md contract; case 15.

### F6 — The full-suite trigger list misses files the suite reads

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md Phase 3 › Changes #1 (Test)
- **Detail**: The trigger list misses the following, each of which some unit test depends on:
  - `.claude/hooks/**` and `.claude/settings.json` (`agent-hooks.test.ts` reads them, so editing the hook never runs its own proof);
  - `.gitignore` (the no-console guard depends on it through `includeIgnoreFile`);
  - `package-lock.json` and `.nvmrc`.
- **Fix**: Invert the rule: run the whole suite unless every changed path is documentation (`*.md`, `context/**`).
- **Decision**: FIXED — full suite runs unless every changed path is docs (`*.md`, `context/**`).

### F7 — The proof test needs CI and macOS hardening

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md Phase 3 › Changes #4
- **Detail**:
  - `ubuntu-latest` has no global git identity, so every throwaway `git commit` fails "Author identity unknown" in CI (it passes locally).
  - Linux leaves `TMPDIR` unset (the plan writes `${TMPDIR}`; the reference uses `${TMPDIR:-/tmp}`).
  - macOS `os.tmpdir()` is a `/var` → `/private/var` symlink.
  - Local `/usr/bin/env bash` is bash 3.2, while CI has bash 5.
  - `jq` shares `/usr/bin` with git, so "jq off PATH" can't just drop that dir.
  - An inherited `CLAUDE_PROJECT_DIR` or `GIT_*` leaks into cases.
- **Fix**: In the proof test:
  - pass `-c user.name/-c user.email` (or `GIT_AUTHOR_*` / `GIT_COMMITTER_*`) and scrub `GIT_DIR`, `GIT_INDEX_FILE` and `GIT_WORK_TREE`;
  - give each case its own `TMPDIR`, and use `${TMPDIR:-/tmp}` in the scripts;
  - compare `realpath`s;
  - unset `CLAUDE_PROJECT_DIR` except in case 8;
  - spawn `/bin/bash` by absolute path, with an empty `PATH` for the jq case;
  - keep the scripts bash-3.2-safe (no `mapfile`, no `set -u` with empty arrays);
  - add a permanent `bash -n` case.
- **Decision**: FIXED — proof-test environment hardened (git identity, per-case TMPDIR, realpath, scrubbed GIT_*, absolute /bin/bash, empty PATH for jq, bash 3.2, bash -n case).

### F8 — Four success criteria cannot fail, or check the wrong thing

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Verifiability
- **Location**: Progress 1.6, 3.3, 3.4, 4.1
- **Detail**:
  - **1.6:** `git check-ignore -v .claude/settings.json` prints the matching negation and exits 0 (probed), so "prints nothing" is wrong. `-q` with exit 1 is the right check.
  - **3.4:** on an untouched tree the script exits 0 without running anything (same as case 4), so the real integration (nvm, real bins, timing) is never exercised automatically.
  - **4.1:** "row reads complete" is not a command.
  - **3.3:** checks only the repo settings file, while the local `~/projects/.claude/settings.json` also holds both accounts' `permissions`, outside git.
- **Fix**:
  - 1.6: `git check-ignore -q .claude/settings.json` exits 1 and `git check-ignore -q .claude/worktrees` exits 0.
  - 3.4: run the real script on the repo while the Phase 3 files are still uncommitted, and assert exit 0, that ESLint and Vitest ran, and the wall time.
  - 4.1: `grep -E '^\| 5 \|.*\| complete \|' context/foundation/test-plan.md`.
  - Local settings: back the file up before writing, then `jq empty` it and compare `.permissions` before and after.
- **Decision**: FIXED — 1.7 uses `check-ignore -q`; 3.4 is a real run with uncommitted Phase 3 files; 4.1 is a grep; local settings checks in Phase 5 (backup, jq empty, permissions compare).

### F9 — Wording slips in Critical Implementation Details and the guard samples

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Claim Accuracy
- **Location**: plan.md Critical Implementation Details; Phase 1 › Changes #2 and order of changes
- **Detail**:
  - "goes last … **or** sets `prettier/prettier: off`": both are needed (probed: last without the rule-off → 9 errors; just before prettier with it off → still resolves `[2]`).
  - "an earlier block loses unless it sets `projectService: false`": placed before `baseConfig` it loses even then.
  - "Exactly one message" in the guard case holds only for a prettier-clean sample.
  - Run `npm run lint` only after the `.gitignore` change: locally `eslint .` still walks the 2.9 GB `.claude/worktrees` (the OOM).
  - The reference line citations are slightly off (end-of-turn script `:182-279`; merge at `:29`; timeouts at `:68`).
- **Fix**: Reword the CID to "last **and** with `prettier/prettier: off`". Require formatted guard samples, or filter messages by `ruleId`. Order Phase 1's `.gitignore` before the lint run. Correct the citations.
- **Decision**: FIXED — CID reworded (last AND prettier off; generated-file and UserPromptSubmit gotchas added), prettier-clean guard samples, `.gitignore` first in Phase 1, citations corrected.

### F10 — Operational details: hook output, fresh worktrees, check names, memory

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md Phase 3, Phase 2 › Changes #3, Phase 4
- **Detail**:
  - Vitest and ESLint output is not truncated before stderr.
  - On the retry pass a still-red tree ends the turn silently (lint-staged runs no tests).
  - A fresh worktree without `node_modules` makes every turn exit 2, and one without `.astro/` can give bogus type-aware lint.
  - Renaming a CI job id would leave PRs "Expected — waiting" forever once it is a required check.
  - The lint OOM workaround lives in memory (`sidereus-ui-sky-light-change`), and becomes obsolete after Phase 1.
- **Fix**:
  - Truncate the hook output (`tail -n 200`), and emit a `systemMessage` when the retry pass is still red.
  - Run `astro sync` in the hook when `.astro/` is missing, and name missing `node_modules` with an `npm ci` hint.
  - Add a `ci.yml` comment that `ci` and `smoke` are required-check names.
  - Update the OOM memory after Phase 1.
- **Decision**: FIXED — output truncated to 200 lines, systemMessage when the retry pass is still red, `astro sync` when `.astro/` is missing, `npm ci` hint, ci.yml comment on required-check names (later dropped with branch protection, 2026-10-09), memory OOM note update after Phase 1.
