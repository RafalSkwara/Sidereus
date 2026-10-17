# Test-Suite Diet: implementation notes

## Phase 0: Two Vitest projects and a lighter hook (2026-10-17)

Rebased onto origin/main 7b059a9 first: #195 (star-source review) is merged, so Phase 5 is unblocked. Baseline re-measured there: 156 files / 3,056 tests (3,046 pass, 4 skipped, 6 todo); the plan's 3,054 was one commit older.

| Run | Files | Tests | Cold time (local) |
| --- | --- | --- | --- |
| `npm test` before | 156 | 3,056 | 11.3 s |
| `npm test` after (both projects) | 156 | 3,056 | 10.2 s |
| `npm run test:reference` | 151 | 2,868 | 9.2 s |
| `npm run test:guards` | 5 | 188 | 6.9 s |

`reference` + `guards` = 3,056, so nothing was lost and no scripts/ test left the run. The guards project is exactly `no-console-guard`, `agent-hooks`, `runner-zone-guard`, `no-hardcoded-colors`, `rhythm-roles`.

Hook (manual 0.7, observed by the implementer, left for the owner to tick): one real run of `end-of-turn.sh` in this worktree with six changed files printed `end-of-turn.sh: clean: eslint 2 file(s); vitest reference;` and took 13.2 s wall (before: 25-45 s).

`npm run lint` and `npx astro check` are green. Ledger rows of this phase: none (no test deleted).

Docs updated: `CLAUDE.md` (Commands block, Agent hooks tripwire), `context/foundation/test-plan.md` §4 unit row, §5 unit and end-of-turn rows (the colour, rhythm and runner-zone guards now report in CI only; Prettier re-aligned the table).

Docs grep: `grep -rn 'vitest run\|whole unit suite' CLAUDE.md context/foundation context/deployment` names no other place that states what the hook runs.
