<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Test rollout Phase 5: quality-gates wiring

- **Plan**: context/changes/testing-quality-gates-wiring/plan.md
- **Scope**: Full plan, Phases 1-4 (Phase 5 runs after the merge)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-09
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 7 warnings, 3 observations
- **Triage**: all 10 fixed (F1 and F5 via Fix A), 2026-10-09

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Evidence

- **Plan drift** (Opus agent): every Phase 1-3 contract bullet is implemented. The branch-protection drop is recorded in the plan (Not Doing, decision note, Progress 2.4/2.6), the brief, CLAUDE.md and the test plan, but stale text remains (F6). The deny rules CLAUDE.md cites exist in `~/projects/.claude/settings.json` (`gh pr merge`, `gh api *merge*`).
- **Safety probes** (Opus agent): the hook scripts were copied into throwaway repos under the scratchpad (p1-p20) with stub and real ESLint; they never ran against the repo. Re-checked in the main session:
  - F2: BSD `xargs -I` with a 270-byte argument fails with "command line cannot be assembled, too long".
  - F3: real ESLint with a changed file named `-c.js` exits 0 without `--`; with `--` it reports `no-console` and exits 1.
- **Automated criteria re-run on cb1a36f:**
  - `npm test`: 90 files, 1483 passed;
  - `npm run lint`: rc 0;
  - `astro check`: 0 errors;
  - 1.6: rc 0 with the flag;
  - 1.7: `check-ignore -q` gives 1 for `settings.json`, 0 for worktrees;
  - 3.3: OK;
  - 4.1/4.2 greps: 0 / 1 / 0.
- **CI:** `ci` and `smoke` are green on 595ddf7 and cb1a36f; `agent-hooks.test.ts` runs 16 tests on ubuntu in 1.7 s. Break checks are recorded from implementation.
- **Manual:**
  - 1.8 and 4.3 were ticked by the agent with evidence: the break-check output, and a read-back of §6.5 and §5.
  - 2.6 was dropped.
  - 3.6 and 3.7 are pending; they need a session started in the repo or a worktree.

## Findings

### F1 — Hook state is per session, not per agent: subagents are judged on others' edits, and others' edits can escape

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Architecture
- **Location**: .claude/hooks/end-of-turn.sh:41-49, 128; .claude/hooks/turn-start.sh:16-18; .claude/hooks/register-checkout.sh:25
- **Detail**: `<session>.roots` and `<session>.start` are shared by the parent and every subagent (SubagentStop carries the parent's `session_id`). Probes:
  - **p17:** a read-only Explore subagent's SubagentStop gives exit 2 for the parent's half-done `src/a.ts`.
  - **p6:** subagent B, clean, is blocked for subagent A's broken worktree.
  - **p8:** B goes green and clears the registry; A then breaks its worktree through Bash, and both A's SubagentStop and the parent's Stop exit 0.
  - **p7:** a user prompt truncates the registry and re-fingerprints while a background subagent's broken edits are pending, and nothing ever checks them.
  
  This contradicts the scripts' own claim ("never sends the agent back for … another agent's edits"), and Phase 5 would spread it to every `~/projects` session.
- **Fix A ⭐ Recommended**: Key the state by agent.
  - Use `<session>.<agent_id|main>.roots`, with a start fingerprint per agent (a `SubagentStart` hook for subagents; `UserPromptSubmit` for the main thread, touching only `main` files).
  - SubagentStop sweeps only the roots that agent registered, or changed since its start.
  - A green run clears only that agent's files.
  - Proof cases for p6, p7, p8 and p17.
  - Strength: Each agent is held to its own work; nothing escapes through another agent's green.
  - Tradeoff: One more hook event (`SubagentStart`) and about 6 more proof cases; slightly more state files.
  - Confidence: MED. `agent_id` is documented on subagent tool events and SubagentStop; `SubagentStart`'s payload must be checked in the live doc.
  - Blind spot: Behaviour of agents launched by the orchestrator in other panes (separate sessions, so already separate).
- **Fix B**: Minimal. SubagentStop sweeps only the roots registered under its `agent_id` (no cwd sweep, no fingerprint); `turn-start` truncates only the main thread's files. Document that the parent's Stop may still see a running background subagent's state.
  - Strength: Small change; removes the spurious blocks (p17, p6) and the truncation race (p7).
  - Tradeoff: A subagent that edits only through Bash is not swept at its own stop.
  - Confidence: HIGH — narrow edit.
  - Blind spot: p8-style escapes through the parent sweep remain possible.
- **Decision**: FIXED via Fix A — state keyed by session and agent (`<session>.<agent_id|main>`), `turn-start.sh` also on SubagentStart, prompts reset only `main`, green clears only its own agent; three proof cases (parent WIP vs subagent, two subagents, prompt during a background subagent).

### F2 — The fingerprint fails silently on macOS for long paths, and is slow and unbounded on large trees

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .claude/hooks/lib.sh:31-32
- **Detail**: `xargs -0 -I{}` (BSD) refuses an argument over 255 bytes. Re-checked: "command line cannot be assembled, too long".
  - The untracked part of the fingerprint then becomes empty, so a later change to untracked files goes unnoticed. Probe p3: a broken `src/zz.ts` after turn-start gives exit 0, with no checks run.
  - One `sh` per file: 2000 untracked files take 11.8 s, over turn-start's 10 s timeout.
  - Symlinks are followed: `ln -s /dev/zero` hangs until the timeout.
- **Fix**: Hash the NUL-separated name list, then each file with `git hash-object -- <file>` in a bash `while read -r -d ''` loop (no `xargs -I`, no per-file `sh`), and hash a symlink by its `readlink` text. Add a proof case with a 270-byte path.
- **Decision**: FIXED — fingerprint from NUL-separated names, symlink targets and one batched `git hash-object --stdin-paths`; proof cases for a >255-byte path and a `/dev/zero` symlink.

### F3 — ESLint receives changed paths without `--`: a file named `-c.js` turns the lint into a false green

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .claude/hooks/end-of-turn.sh:93
- **Detail**: Re-checked with real ESLint 10.10: `eslint --max-warnings 0 --no-warn-ignored -c.js ok.js` exits 0 (`-c` takes `.js` as a config) on a file with a `no-console` error. With `--` it reports the error and exits 1. A file named `--fix.js` makes ESLint lint `.` instead (whole type-aware repo; timeout and OOM risk).
- **Fix**: `eslint --max-warnings 0 --no-warn-ignored -- "$@"`, plus a proof case (stub asserting `--` precedes the paths).
- **Decision**: FIXED — `eslint … -- "$@"`; the stub requires `--`; proof case with a root-level `-c.ts`. Break check: without `--` four cases fail.

### F4 — The proof test does not pin the fingerprint definition

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/agent-hooks.test.ts:274-285 (case 11)
- **Detail**: Probe p14: removing `git diff HEAD --binary` from `fingerprint` leaves case 11 green, but under that mutant a turn that only edits a tracked file exits 0 (p15). That is a full gate bypass the suite would not catch. A mutant that drops the untracked-content part also survives.
- **Fix**: Add 11b (turn-start, then edit tracked `src/a.ts` → exit 2) and 11c (an untracked file present at turn start whose content changes during the turn → exit 2).
- **Decision**: FIXED — cases for a tracked edit and an untracked file changed during the turn. Break check: dropping the diff from the fingerprint fails the tracked-edit case.

### F5 — The hook proof test made every agent turn ~10 s slower locally

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: src/lib/agent-hooks.test.ts (sandbox setup); plan.md Performance Considerations and S-05 impact table
- **Detail**:
  - Locally the file takes ~12 s (CI ubuntu: 1.7 s), so `vitest run` went from ~3.6 s to ~13 s, and the Stop hook from the planned ~8 s to ~16-18 s per code-changing turn.
  - Cause (probe): macOS scans each freshly written executable on its first run (~0.5 s). The test writes two new stubs per case.
  - The plan budgeted ~5 s for the file, and its numbers given to the S-05 coder are now stale.
- **Fix A ⭐ Recommended**: Write the stubs once per file into a shared dir under the sandbox and symlink each case's `node_modules/.bin/{eslint,vitest}` to them; update the plan's numbers.
  - Strength: Removes the per-case first-run scan; keeps every case.
  - Tradeoff: Shared stubs need the log path from the environment (they already use `STUB_LOG`).
  - Confidence: MED — the probe showed 0.51 s on a stub's first run against 0.01 s on its second.
  - Blind spot: Whether symlinked executables also trigger the scan.
- **Fix B**: Exclude `agent-hooks.test.ts` from the Stop hook's suite run (it still runs in `npm test` and CI).
  - Strength: The hook drops to ~5.5 s immediately.
  - Tradeoff: Editing a hook script no longer runs its proof at end of turn (plan review F6 asked for that).
  - Confidence: HIGH.
  - Blind spot: none.
- **Decision**: FIXED via Fix A — stubs written once and symlinked; proof file 12 s → 8.5 s locally (24 cases); plan numbers updated in the addendum (~13-15 s per code-changing Stop).

### F6 — Stale branch-protection wording in the plan, the brief and PR #150

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md:51, 179, 202-215, 231, 510; plan-brief.md:16-18; PR #150 body; test-plan §5 Required? column; reviews/plan-review.md F10
- **Detail**: The drop is recorded, but some text still describes required checks as planned:
  - the Phase 2 overview ("`main` requires `ci` and `smoke`");
  - the verify line;
  - manual step 3;
  - the change #3 body (not struck through);
  - the brief's "closes those four gaps", one of which was "a PR can merge with red CI".
  
  PR #150's body still promises required checks. In test-plan §5, "required" now means policy, not a GitHub required check, and the table does not say so.
- **Fix**: Strike through or annotate the stale plan lines and change #3. Reword the brief's gap list. Add a one-line note under §5 ("required = enforced by CI and policy; no GitHub required checks, only a human merges"). Annotate plan-review F10. Update the PR #150 body.
- **Decision**: FIXED — stale plan lines struck through, brief now says three of four gaps, §5 note on "required", plan-review F10 annotated; PR #150 body updated at push.

### F7 — CLAUDE.md's agent-hooks bullet overclaims the fingerprint and lacks the `~/projects` snippet

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: CLAUDE.md:30; .claude/hooks/turn-start.sh:2-3; end-of-turn.sh header
- **Detail**: "so earlier work in progress never triggers it" is too strong. Once a turn changes anything in a checkout, all of its uncommitted work is linted and tested (probe p10: earlier broken `src/a.ts` plus a README-only edit gives exit 2). Registry roots have no fingerprint at all. The bullet also says "the whole unit suite" without the docs-only exception. The plan's Phase 4 contract asked for the exact `~/projects` snippet, which the bullet omits.
- **Fix**: Reword the bullet and both script headers to "a turn that changes nothing in a checkout is not swept; a turn that changes anything is held to all of its uncommitted work", mention the docs-only exception, and add the `~/projects` snippet (with the self-guard), or state explicitly that Phase 5 adds it.
- **Decision**: FIXED — CLAUDE.md bullet rewritten (per-agent state, docs-only exception, held to all uncommitted work, the `~/projects` registration with its self-guard), script headers reworded.

### F8 — The new lesson's rule is not yet followed by the guard it cites

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: context/foundation/lessons.md (last entry); src/lib/no-console-guard.test.ts:206-221
- **Detail**: The lesson asks for one end-to-end `lintText` sample per file kind the guard covers (a TS file, `.astro` frontmatter, an `.astro` client script). The guard has samples only for client scripts. TS files and frontmatter still rest on `calculateConfigForFile` alone.
- **Fix**: Add a TS sample and an `.astro` frontmatter sample to the guard's end-to-end case, each expecting one `no-console`.
- **Decision**: FIXED — the guard also lints an `.astro` frontmatter and a TypeScript sample end to end.

### F9 — Robustness nits in the hooks and the proof test

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: end-of-turn.sh:65, 69-80; lib.sh:7; agent-hooks.test.ts:78-86, case numbering
- **Detail**:
  - `git diff --name-only` / `ls-files` C-quote non-ASCII names, so such files are silently not linted (none today).
  - `${TMPDIR:-/tmp}/claude-hooks` is created with the default umask; on a shared Linux `/tmp` another user could plant a root (macOS per-user `TMPDIR` mitigates).
  - Sourcing nvm inherits the previous root's `$@`.
  - "Tools missing" doesn't say which tool.
  - The proof test's `git()` ignores exit codes (a global `commit.gpgsign` or hooks path would yield a HEAD-less sandbox) and drops only three `GIT_*` variables, while its header says all.
  - Case numbers run 1-12, 15, 13, 14.
- **Fix**:
  - `git -c core.quotePath=false`;
  - `mkdir -m 700` plus an owner check;
  - `set --` before sourcing nvm;
  - name the missing tool;
  - `-c commit.gpgsign=false -c core.hooksPath=/dev/null` and assert `code === 0` in `git()`;
  - filter every `GIT_*` variable;
  - renumber or drop the case numbers.
- **Decision**: FIXED — `core.quotePath=false`, state dir `mkdir -m 700` + owner check, `set --` before nvm, missing tool named, proof `git()` asserts exit 0 with gpgsign/hooksPath off and drops every `GIT_*`, cases unnumbered.

### F10 — Undocumented behaviours: lib.sh, registry reset per prompt, tool check before the docs-only rule

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: .claude/hooks/lib.sh (not in plan); turn-start.sh:16-18; end-of-turn.sh:75 vs 100
- **Detail**:
  - `lib.sh` (shared helpers) was an ADAPT that the plan does not mention.
  - `turn-start.sh` empties the registry on every prompt, so the `end-of-turn.sh` comment "a red turn keeps them" holds only until the next prompt.
  - A checkout without `node_modules` sends back even a docs-only turn with the `npm ci` hint.
  
  All of this is acceptable, but unrecorded.
- **Fix**: A plan addendum line for `lib.sh` and the per-prompt reset, the comment corrected, and the `npm ci` behaviour stated in CLAUDE.md, or the tool check moved after the docs-only decision.
- **Decision**: FIXED — plan addendum (lib.sh, per-agent state, timings); docs-only changes now run nothing even without tools (proof case).
