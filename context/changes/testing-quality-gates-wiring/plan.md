# Test rollout Phase 5: quality-gates wiring — Implementation Plan

## Overview

Test rollout Phase 5 (`context/foundation/test-plan.md` §3, cross-cutting). It locks in what Phases 1-4 added so that it cannot quietly stop protecting anything. It covers four areas:

- **Lint coverage:** client `<script>` blocks in `.astro` files get linted, closing impl review F3 of `testing-access-and-entitlement-boundary`. Warnings fail lint.
- **CI gates:**
  - a flaky e2e test turns CI red;
  - Vitest's `forks` pool is pinned;
  - `ci` and `smoke` become required checks on `main`.
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
- `main` requires the `ci` and `smoke` checks before a merge (admins can override knowingly).
- In a Claude Code session that edits Sidereus, the end of every turn with code changes runs the whole unit suite and ESLint (`--max-warnings 0`) on the changed files. On failure the agent is sent back once with the output. This holds for sessions started in `~/projects` or inside the repo or a worktree. A committed test proves the hook's behaviour.
- `.claude/` is ignored except `settings.json` and `hooks/`, so `eslint .` no longer walks `.claude/worktrees/`.
- The test-plan §3 Phase 5 row reads complete. §5's flake, hook and lint rows are active. §6.5 is the e2e recipe. §6.4 no longer lists the `.astro` gap. CLAUDE.md describes the gates.

Verify with `npm test`, `npm run lint`, `npx astro check`, the break checks below (each reverted), `gh api` for the protection, and a live turn in a restarted session.

### Key Discoveries:

- `failOnFlakyTests: !!process.env.CI` keeps the retry, so the first failure's trace is retained (`trace: "retain-on-failure"`, `playwright.config.ts:13`), and it fails the job, so the existing `if: failure()` upload fires. No workflow edit is needed.
- `includeIgnoreFile(gitignorePath)` (`eslint.config.js`, first export entry) applies `.gitignore` to ESLint. Ignoring `.claude/*` therefore also ends the lint OOM caused by `.claude/worktrees/` (project memory `sidereus-ui-sky-light-change`).
- ESLint resolves virtual files under `files: ["src/**"]` (`noConsoleConfig`), so the existing `no-console` error applies to scripts once they parse.
- Claude Code hook protocol (`references/anthropic.md:43-64`):
  - `Stop` with exit 2 and stderr keeps the agent working;
  - `stop_hook_active` marks the retry;
  - `PostToolUse` `Write|Edit` gets an absolute `tool_input.file_path`;
  - timeouts are in seconds;
  - hooks from different settings levels merge.

## What We're NOT Doing

- **Per-edit test or lint hooks.** The owner chose Stop only (2026-10-09). The per-edit hook below only records which checkout was edited.
- **`astro check` in the hook.** At ~22 s it was declined. It stays in CI `ci`, and lint-staged keeps per-file lint at commit.
- **Turning off e2e retries, raising timeouts, or a flake dashboard.** The retry is kept for its trace.
- **Type-aware linting of `.astro` scripts** (depth-limited `allowDefaultProject`). Its default-project limit of 8 silently drops scripts, and `define:vars` names give false positives (research §3).
- **New git hooks** (pre-push) and new CI jobs.
- **Path filters or `concurrency` groups in CI**, and review requirements in branch protection.
- **Fixing the date-dependent e2e skips** (`moon-as-target`, `tonight-targets`, `tonight-sky`, `planets-on-tonight`, `moon-card`). They are recorded in §6.5 as a known limit.

## Implementation Approach

The cheapest, widest gates go first: lint scope, then the CI settings. The hook comes after them because it reuses the finished lint configuration (warnings as errors, `.astro` scripts) and the `.gitignore` re-include. Docs come last. Each phase proves its gate with a break check that turns red before the fix or when the gate is removed.

## Critical Implementation Details

- **Config order:** the `.astro` script block goes **last** in the `eslint.config.js` export (after `eslintPluginPrettier`), or it sets `prettier/prettier: "off"` itself. Otherwise prettier re-enables on the virtual files and reports parse errors. A block earlier in the array loses to `baseConfig`'s `projectService: true` unless it sets `projectService: false` explicitly.
- **Hook registration:** sessions start in `~/projects` (not a git repo), so the hook is registered both in the committed `sidereus/.claude/settings.json` (sessions started in the repo or a worktree) and in the local `~/projects/.claude/settings.json` (absolute script path). The script sweeps only checkouts that contain `.claude/hooks/end-of-turn.sh`. This skips other repositories under `~/projects` and checkouts on branches without the hook, such as S-05 until it rebases.

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
- The non-vacuity case asserts that the sample path exists.
- The header's "Known gap" sentence about `.astro` scripts is replaced by one naming this case.
- Behavior asserted: a log in an `.astro` client script is an error. Regression caught: a config change that silently stops script linting again. Edge cases: `is:inline`, and a JSON script that is not extracted. Anti-pattern avoided: trusting `calculateConfigForFile`.

#### 3. Warnings fail lint

**File**: `package.json`

**Intent**: Stop warn-level debt (`astro/no-unused-css-selector`, base `no-console` outside `src`, …) from merging silently. It costs nothing today, with 0 warnings.

**Contract**:
- `"lint": "eslint . --max-warnings 0"`.
- The lint-staged `*.{ts,tsx,astro}` command becomes `eslint --fix --max-warnings 0`.

#### 4. Ignore local `.claude/` content

**File**: `.gitignore`

**Intent**: Keep worktrees, local settings and stale skill copies out of git and out of `eslint .`, and keep the hook config committable.

**Contract**: append `.claude/*`, `!.claude/settings.json` and `!.claude/hooks/`, with a comment. `git check-ignore -v .claude/settings.json` must print nothing, and `git check-ignore .claude/worktrees` must match.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including the new guard case
- `npm run lint` passes with `--max-warnings 0`, and `npx astro check` passes
- Break check: without the new config block, the guard's `.astro` case fails; restored
- Break check: a `console.log` in `src/components/ui/Notice.astro`'s `<script>` fails `npm run lint`; reverted
- Break check: a warn-level finding (`console.log` in a `tests/db/*.ts` file) fails `npm run lint`; reverted
- `git status --porcelain` no longer lists `.claude/`, and `git check-ignore -v .claude/settings.json` prints nothing

#### Manual Verification:

- The guard's failure output for the first break check names the `.astro` sample and the missing `no-console`

**Implementation Note**: commit the phase and continue (owner's multi-phase preference). Manual rows are verified by the agent where evidence allows, otherwise left for the joint check after the last phase.

---

## Phase 2: CI gates

### Overview

A flaky e2e test fails CI, Vitest's pool is pinned, and `main` requires `ci` and `smoke`.

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

#### 3. Required checks on `main`

**Where**: GitHub repository settings via `gh api` (outward change). Ask the owner (push notification) right before running it.

**Intent**: Turn the `ci` and `smoke` jobs into merge gates.

**Contract**:
- `PUT repos/RafalSkwara/Sidereus/branches/main/protection` with:
  - `required_status_checks: { strict: false, contexts: ["ci", "smoke"] }`;
  - `enforce_admins: false` (the owner can still bypass knowingly);
  - `required_pull_request_reviews: null`;
  - `restrictions: null`.
- Record the response in the phase notes.

### Success Criteria:

#### Automated Verification:

- `npm test` passes with the pinned pool
- Break check: `npx vitest run --pool threads src/lib/engine/night-boundaries.test.ts` fails (the pin protects something); no file changed
- Break check: a scratch spec `tests/e2e/zz-flaky-probe.spec.ts` that fails when `testInfo.retry === 0` makes `CI=1 npx playwright test tests/e2e/zz-flaky-probe.spec.ts` exit 1 and report 1 flaky. The same probe exits 0 without the config line. The spec uses no `page`, so no preview, port or Supabase is needed. Deleted afterwards
- `gh api repos/RafalSkwara/Sidereus/branches/main/protection` lists `ci` and `smoke` as required contexts
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- This change's PR shows `ci` and `smoke` as required on GitHub

**Implementation Note**: as Phase 1. The branch-protection step waits for the owner's explicit OK.

---

## Phase 3: End-of-turn agent hook

### Overview

At the end of a turn that changed code, a Claude Code Stop hook runs the unit suite and lints the changed files, then sends the agent back once with the failures. A tiny per-edit hook only records which checkout was edited, so the sweep finds it wherever the session runs. A committed test proves both scripts.

### Changes Required:

#### 1. End-of-turn script

**File**: `.claude/hooks/end-of-turn.sh` (new, executable)

**Intent**: Make the gates that already exist (lint, the unit suite with the Phase 1-4 guards) reach the agent before it finishes a turn, including edits made through Bash.

**Contract**: follows the skill's `end-of-turn.sh` (`references/anthropic.md:180-283`) with these adaptations.
- **Input:**
  - Stop payload on stdin.
  - Needs `jq`; without it, exit 2 with a message.
  - If `stop_hook_active` is true or `loop_count` > 0, exit 0 (one retry).
- **Roots:**
  - the git top-level of the payload `cwd`, plus the session registry `${TMPDIR}/claude-hooks/<session_id>.roots`;
  - keep only roots that contain `.claude/hooks/end-of-turn.sh`;
  - if none remain, exit 0 silently (another repository, or a non-repo `~/projects` session with no Sidereus edits).
- **Node:**
  - when `$NVM_DIR/nvm.sh` exists and the root has `.nvmrc`, source it and `nvm use --silent` in the root;
  - then require `node_modules/.bin/eslint` and `node_modules/.bin/vitest` to be executable in the root, otherwise exit 2 naming the missing tool (no silent success);
  - call these local bins directly, not `npx`.
- **Per root:**
  - Changed files are `git diff --name-only HEAD` plus untracked, non-ignored files; with none, skip the root.
  - **Lint** the existing changed `*.ts|*.tsx|*.astro|*.js|*.mjs|*.cjs` with `eslint --max-warnings 0` (no `--fix`).
  - **Test:** run the whole `vitest run` when any changed path is under `src/`, or is `package.json`, `vitest.config.ts`, `eslint.config.js` or `tsconfig.json`. Docs-only turns run nothing.
- **Output:**
  - `NO_COLOR=1 FORCE_COLOR=0`;
  - all failures in one stderr message naming the root, then exit 2;
  - when green, clear the registry and exit 0.

#### 2. Checkout registry

**File**: `.claude/hooks/register-checkout.sh` (new, executable)

**Intent**: Let the Stop hook sweep the checkout the agent actually edited, such as a worktree, when the session `cwd` is `~/projects` or another checkout.

**Contract**:
- `PostToolUse` `Write|Edit` payload:
  - resolve `tool_input.file_path` (relative against `cwd`) to its git top-level;
  - append it to the session registry;
  - always exit 0, since it checks nothing.
- Exit 0 with no output when the path is missing, the file is outside a repository, or `jq` is missing; the Stop hook reports a missing `jq`.

#### 3. Hook registration

**File**: `.claude/settings.json` (new, committed); `~/projects/.claude/settings.json` (local, outside git, merged into its existing `permissions`)

**Intent**: Load the hooks in every session that edits Sidereus.

**Contract**:
- Repo file:
  - `PostToolUse` matcher `Write|Edit` → `register-checkout.sh`, timeout 10;
  - `Stop` → `end-of-turn.sh`, timeout 120;
  - commands resolve the script through `git rev-parse --show-toplevel`, falling back to `$CLAUDE_PROJECT_DIR`, as in the reference.
- `~/projects/.claude/settings.json`: the same two hooks with the absolute script paths `$HOME/projects/sidereus/.claude/hooks/…`.
- Show the owner the diff of the local file before writing it.

#### 4. Proof test

**File**: `src/lib/agent-hooks.test.ts` (new; next to the repo's other repository guards, inside the Vitest include)

**Intent**: Keep the hook proven as it changes (skill Step 7), in the unit suite CI already runs.

**Contract**:
- Each case builds a throwaway git repo in the OS temp dir. The repo holds copies of both scripts and stub `node_modules/.bin/eslint` and `vitest` shell scripts that fail when a changed file contains a `BROKEN` marker and log their calls.
- `NVM_DIR` points at an empty dir; `git`, `jq` and `bash` are real.
- Cases, asserting exit code and stderr:
  1. **Broken `.ts` change:** exit 2, and stderr names the file.
  2. **Clean change:** exit 0, empty stderr.
  3. **Docs-only change:** exit 0, and neither stub is called.
  4. **No change:** exit 0, and no stub is called.
  5. **Payloads:** `{}` and `not json` behave as for the process cwd.
  6. **Retry:** `stop_hook_active: true` with a broken change gives exit 0.
  7. **Write bypassing per-edit hooks:** a broken file written to disk with no `PostToolUse` call gives exit 2.
  8. **Checkout resolution:**
     - `CLAUDE_PROJECT_DIR` pointing at a broken repo leaves the cwd's clean repo green;
     - a broken sibling `git worktree` that is registered through `register-checkout.sh` gives exit 2;
     - a registered repo without the hook script is skipped;
     - a relative `file_path` resolves against `cwd`.
  9. **Missing tool:** with the `eslint` stub removed, exit 2 naming it; with `jq` off `PATH`, exit 2.
- Each `command` in `.claude/settings.json`, run from a worktree with `CLAUDE_PROJECT_DIR` set to a nonexistent path, reaches an executable script.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including `agent-hooks.test.ts`
- Break check: with the `stop_hook_active` guard removed from `end-of-turn.sh`, case 6 fails; restored
- `bash -n` on both scripts, and `jq empty .claude/settings.json`, pass
- The Stop script on the untouched tree (payload `{"cwd": "<repo>"}`) exits 0 (green baseline)
- `npm run lint` and `npx astro check` pass

#### Manual Verification:

- In a session restarted from `~/projects`, `/hooks` lists the Stop and `PostToolUse` hooks once, and no hook is listed twice
- A live turn that writes a failing assertion is sent back by the Stop hook with the Vitest output, and the next turn ends normally after the fix

**Implementation Note**: as Phase 1. Writing `~/projects/.claude/settings.json` waits for the owner's OK on the shown diff. The live-turn row needs a restarted session, so it is left for the joint check.

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
  - required checks named in the Where column.
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
  - a short "Agent hooks" bullet in Tripwires covers what the Stop hook runs, the `~/projects` registration, and that `.claude/` is ignored except `settings.json` and `hooks/`.
- `lessons.md` appends one entry: "Resolving a rule's config is not proof the rule runs: pair a config guard with one end-to-end lint of a known violation per file kind".

### Success Criteria:

#### Automated Verification:

- `grep -c "TBD — see §3 Phase 5" context/foundation/test-plan.md` prints 0, and the §3 Phase 5 row reads complete
- `grep -c "not linted yet" CLAUDE.md` prints 0

#### Manual Verification:

- §6.5 reads as a complete e2e recipe, and §5 matches what is wired

**Implementation Note**: as Phase 1.

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
| Required checks `ci` + `smoke` on `main` | immediately, for every PR | S-05's PR cannot merge until both are green. |
| `.claude/settings.json` + `.claude/hooks/` | after rebase, and a restart of a session started in the worktree | ~4 s Stop-hook run on turns that change code; one send-back on red tests or lint. |
| `~/projects/.claude/settings.json` registration | at the next restart of any session started in `~/projects` | The hook skips the S-05 worktree until it contains `.claude/hooks/end-of-turn.sh`. After the rebase, the same send-back applies. |

## Testing Strategy

### Unit Tests:

- `src/lib/no-console-guard.test.ts`: end-to-end lint of `.astro` script samples (plain, `is:inline`, JSON).
- `src/lib/agent-hooks.test.ts`: the hook scripts against throwaway repos, cases 1-9 plus the command resolution check.

### Integration Tests:

- None new. The flake gate is proven by a scratch spec and the pool pin by a `--pool threads` run, both temporary.

### Manual Testing Steps:

1. Restart a session from `~/projects` and check `/hooks`.
2. In that session, make a turn that breaks a unit test, and watch the Stop hook send it back.
3. Open this change's PR and check that `ci` and `smoke` are marked required.

## Performance Considerations

- The Stop hook adds about 4 s (unit suite) plus about 3-5 s (ESLint on the changed files) to turns that change code, within the 120 s timeout. Docs-only and Q&A turns add a few milliseconds.
- `agent-hooks.test.ts` spawns bash per case. Keep it under about 5 s with stubbed tools. Removing the `.claude/worktrees` walk speeds up `eslint .`.

## Migration Notes

- Branch protection can be removed with `gh api -X DELETE repos/RafalSkwara/Sidereus/branches/main/protection`.
- The hooks can be removed by deleting their entries from both settings files.

## References

- Research: `context/changes/testing-quality-gates-wiring/research.md`
- Hook rules: `/Users/rafalskwara/projects/.claude/skills/10x-configure-hook/SKILL.md`, `references/anthropic.md`
- F3: `context/archive/2026-10-09-testing-access-and-entitlement-boundary/follow-ups/review-fixes.md`
- Flake history: `context/archive/2026-09-28-parallel-e2e-flakes/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Lint coverage

#### Automated

- [ ] 1.1 `npm test` passes, including the new guard case
- [ ] 1.2 `npm run lint` passes with `--max-warnings 0`, and `npx astro check` passes
- [ ] 1.3 Break check: without the new config block, the guard's `.astro` case fails; restored
- [ ] 1.4 Break check: `console.log` in Notice.astro's script fails `npm run lint`; reverted
- [ ] 1.5 Break check: a warn-level finding in `tests/db` fails `npm run lint`; reverted
- [ ] 1.6 `git status` no longer lists `.claude/`, and `.claude/settings.json` is not ignored

#### Manual

- [ ] 1.7 The guard's failure output names the `.astro` sample and the missing `no-console`

### Phase 2: CI gates

#### Automated

- [ ] 2.1 `npm test` passes with the pinned pool
- [ ] 2.2 Break check: `--pool threads` fails the night-boundaries suite
- [ ] 2.3 Break check: the flaky probe exits 1 under `CI=1` with the config, 0 without; probe deleted
- [ ] 2.4 `gh api …/branches/main/protection` lists `ci` and `smoke` as required
- [ ] 2.5 `npm run lint` and `npx astro check` pass

#### Manual

- [ ] 2.6 This change's PR shows `ci` and `smoke` as required

### Phase 3: End-of-turn agent hook

#### Automated

- [ ] 3.1 `npm test` passes, including `agent-hooks.test.ts`
- [ ] 3.2 Break check: without the `stop_hook_active` guard, case 6 fails; restored
- [ ] 3.3 `bash -n` on both scripts and `jq empty .claude/settings.json` pass
- [ ] 3.4 The Stop script exits 0 on the untouched tree
- [ ] 3.5 `npm run lint` and `npx astro check` pass

#### Manual

- [ ] 3.6 `/hooks` in a session restarted from `~/projects` lists each hook once
- [ ] 3.7 A live turn with a failing assertion is sent back once, then ends normally after the fix

### Phase 4: Docs and cookbook

#### Automated

- [ ] 4.1 No "TBD — see §3 Phase 5" left in test-plan.md, §3 Phase 5 row complete
- [ ] 4.2 No "not linted yet" left in CLAUDE.md

#### Manual

- [ ] 4.3 §6.5 is a complete e2e recipe and §5 matches what is wired
