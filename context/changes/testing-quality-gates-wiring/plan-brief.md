# Test rollout Phase 5: quality-gates wiring — Plan Brief

> Full plan: `context/changes/testing-quality-gates-wiring/plan.md`
> Research: `context/changes/testing-quality-gates-wiring/research.md`

## What & Why

Phases 1-4 of the test rollout added the suites that protect Risks #1-#6. Phase 5 makes sure they keep protecting. Today:

- a flaky e2e test can merge green;
- a PR can merge with red CI;
- client `<script>` blocks in `.astro` files are not linted at all (impl review F3);
- an agent hears about a broken test only from CI.

This change closes those four gaps.

## Starting Point

- CI runs every Phase 1-4 suite (`ci`: lint, check, unit, build; `smoke`: tests/db, smoke, e2e). But:
  - `main` has no branch protection;
  - e2e runs with `retries: 1` and no `failOnFlakyTests`;
  - lint ignores warnings.
- eslint-plugin-astro's virtual script files fail the type-aware parser, and the plugin drops that error.
- There are no agent hooks, and sessions start in `~/projects`, which is not a git repo.

## Desired End State

- **Lint:** it covers `.astro` scripts and fails on warnings. The no-console guard proves the script lint end to end.
- **CI:**
  - a fail-then-pass e2e test turns the run red, with its report uploaded;
  - Vitest's `forks` pool is pinned;
  - `main` requires `ci` and `smoke`.
- **Agent loop:** every Claude Code turn or subagent run that changed a Sidereus checkout ends with the unit suite and a lint of the changed files. Changes are compared against a fingerprint taken when the turn started. A failure sends the agent back once. A committed test proves the hooks.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Flake handling | `failOnFlakyTests: !!CI`, retry kept | A flake becomes red while the first-failure trace is kept; 0 flakes in 57 runs, so nothing breaks today | Research |
| `.astro` script lint | `disableTypeChecked`, `projectService: false`, `prettier/prettier` off, last in config | Lints all 9 blocks with 0 findings; type-aware variant silently drops files past 8 | Research |
| Guard proof | `lintText` of in-memory `.astro` samples at an existing path | `calculateConfigForFile` says "error" even when no rule runs | Research |
| Branch protection | Require `ci` + `smoke`, no reviews, admins can override | The only thing that makes CI a gate; solo owner | Plan (owner) |
| Lint warnings | `--max-warnings 0` in `lint` and lint-staged; `--no-warn-ignored` wherever explicit paths are passed | Warnings are 0 today; without `--no-warn-ignored`, a regenerated, eslint-ignored `database.types.ts` would fail every migration commit | Plan (owner) + plan review F1 |
| Agent hook scope | Stop and SubagentStop: whole unit suite (~4 s) + ESLint on changed files, one retry; per-edit and `astro check` (~22 s) declined | Catches file-reading guards and Bash rewrites; subagents write much of the code | Plan (owner) + plan review F4 |
| What a sweep covers | Only checkouts whose fingerprint (diff plus untracked files) changed since turn start | Earlier WIP and other agents' edits must not send the agent back | Plan review F2 |
| Hook registration | Committed `sidereus/.claude/settings.json` now; local `~/projects/.claude/settings.json` after the merge, with self-guarding commands (skip when the repo registration applies; a visible hook error when the script is missing) | Sessions start in `~/projects`; no double runs, and no error storm on branches without the scripts | Plan + plan review F3 |
| `.claude/` in git | Ignore `.claude/*`, re-include `settings.json` and `hooks/` | Commits the hooks, and stops `eslint .` walking `.claude/worktrees` (the lint OOM) | Plan |
| Hook proof | `src/lib/agent-hooks.test.ts`, throwaway repos, stubbed eslint/vitest | Skill Step 7; runs in the unit suite CI already has | Plan |

## Scope

**In scope:**

- `eslint.config.js`, `no-console-guard.test.ts`, `package.json` (lint, lint-staged), `.gitignore`;
- `playwright.config.ts`, `vitest.config.ts`, branch protection via `gh api`;
- `.claude/hooks/end-of-turn.sh`, `turn-start.sh`, `register-checkout.sh`, `.claude/settings.json`, `src/lib/agent-hooks.test.ts`;
- after the merge, `~/projects/.claude/settings.json`;
- test-plan §3/§5/§6.4/§6.5/§6.6, CLAUDE.md, lessons.md.

**Out of scope:**

- per-edit test or lint hooks, and `astro check` in the hook;
- turning off retries, or new CI jobs, path filters or a pre-push hook;
- type-aware `.astro` script linting;
- fixing the date-dependent e2e skips (recorded as a limit in §6.5).

## Architecture / Approach

Cheapest gates first:
- Phase 1 is lint scope.
- Phase 2 is CI settings.
- Phase 3 is the hooks, which reuse Phase 1's lint config.
  - The Stop and SubagentStop script sweeps the payload `cwd`'s checkout and the checkouts a per-edit registry script recorded.
  - It skips those unchanged since a turn-start fingerprint.
  - It runs the local `eslint` and `vitest` bins and reports through exit 2 on stderr.
- Phase 4 is the docs.
- Phase 5, after the merge, registers the hooks for `~/projects` sessions.

Each gate gets a break check that turns red.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Lint coverage | `.astro` scripts linted, end-to-end guard case, `--max-warnings 0`, `.claude/*` ignored | The new block placed before `eslintPluginPrettier` brings bogus prettier errors back |
| 2. CI gates | `failOnFlakyTests`, pinned `forks` pool, required `ci` + `smoke` on `main` | Outward GitHub change; needs the owner's OK at that step |
| 3. End-of-turn hook | Stop/SubagentStop, turn-start and registry scripts, repo registration, hardened proof test | `SubagentStop` payload differs from the reference; checked against the live doc |
| 4. Docs | Test-plan §3/§5/§6 complete, CLAUDE.md, lesson | — |
| 5. Local registration (after merge) | Self-guarding hooks in `~/projects/.claude/settings.json` | A JSON slip there drops both accounts' permissions; backup plus `jq` check |

**Prerequisites:** #148 merged (done; branch rebased onto `main` af3fab2); `jq` installed (yes); owner OK for branch protection and for the local settings diff.
**Estimated effort:** ~1 session for Phases 1-4, plus a short post-merge Phase 5.

## Open Risks & Assumptions

- Whether Claude Code also loads parent-directory settings is unverified; the local commands' self-guard makes that irrelevant, and 5.4 checks it.
- In `~/projects` sessions, a Sidereus file changed only through Bash is not swept (documented limit).
- Turns that change a checkout take about 8 s longer. Lint failures in touched files the agent did not author send it back once.
- The S-05 branch (coder) must adapt after rebasing: `.astro` script lint, `--max-warnings 0`, `failOnFlakyTests`, the hooks, and required checks on its PR (full table in the plan).

## Success Criteria (Summary)

- A `console.log` in an `.astro` script, a lint warning, or a flaky e2e test each turns its gate red.
- A PR cannot merge into `main` without green `ci` and `smoke`, unless the owner overrides it.
- An agent that breaks a unit test is sent back with the failure before its turn ends.
