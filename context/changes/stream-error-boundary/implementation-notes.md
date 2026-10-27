# Stream error boundary: implementation notes

## Phase 2

### Criterion 2.5: probe before/after (evidence only, nothing committed)

Run by the `probe` agent in the audit worktree `.claude/worktrees/agent-a95868590404aece4` against commit `1fcdba0`. Before = the earlier run (`probe/before/`); after = `probe/results.json`, `probe/preview.log`, `probe/suite.out`. The change's `src/middleware.ts`, `log-failure.ts` and `stream-guard.ts` were checked out uncommitted into the worktree; the P5 `probeThrow(context.request, "p5")` line and its import were re-added at the top of `onRequest` (before the session read). Full rebuild; nothing committed or pushed.

Format: status / bytes / `sidereus: request.*` lines in the console log (Astro `[ERROR]` lines noted separately).

| probe | shape | before | after | verdict |
|---|---|---|---|---|
| P0 | control, `/` signed out, no probe | 200 / 28674 / 0 lines | 200 / 28674 / 0 lines | as expected: no `request.` line, status and bytes equal |
| P10b-baseline | island URL, no probe | 200 / 119843 / 0 | 200 / 119843 / 0 | unchanged (only the usual `forecast.fetch failed`) |
| P1 | throw in page frontmatter (`/`) | 500 / 0 / 0 (Astro `[ERROR]`) | 500 / 0 / 1 `request.uncaught` | as expected |
| P3 | throw in API endpoint (`POST /api/probe`) | 500 / 0 / 0 (`[ERROR]`) | 500 / 0 / 1 `request.uncaught` | as expected |
| P5 | throw in middleware (before `next()`) | 500 / 0 / 0 (`[ERROR]`) | 500 / 0 / 0 (`[ERROR]` only) | as expected: unchanged |
| P10a | throw in child component frontmatter (`/`) | 200 / 0 / 0 | 200 / 0 / 1 `request.stream` | as expected |
| P10c | throw mid-template in child after output (`/`) | 200 / 0 / 0 | 200 / 0 / 1 `request.stream` | as expected |
| P10b | throw in island component frontmatter | 500 / 0 / 0 (`[ERROR]`) | 500 / 0 / 1 `request.uncaught` | as expected |
| P10a-island | throw in child of the island component | 200 / 0 / 0 | 200 / 0 / 1 `request.stream` | as expected |
| P10c-island | throw mid-template in child of the island | 200 / 0 / 0 | 200 / 0 / 1 `request.stream` | as expected |
| P6a (23502) | gear create fails | 302 / 0 / 0 | 302 / 0 / 0 | unchanged |
| P6b (42501) | gear create fails | 302 / 0 / 0 (`save.gear noted`) | same | unchanged |
| P6c (08006) | gear create fails | 302 / 0 / 0 (`save.gear failed`) | same | unchanged |
| P6d-log | `/log` read fails 42501 | 200 / 36923 / 0 (`read.log noted`) | 200 / 36924 / 0 (same line) | unchanged (1 byte difference, see notes) |
| P6d-progress | `/log/progress` seen read fails | 200 / 35003 / 0 (`progress.seen failed`) | 200 / 35004 / 0 (same line) | unchanged (1 byte difference, see notes) |

### Every `sidereus: request.*` line of the after run, with its fields

| probe | line | fields |
|---|---|---|
| P1 | `request.uncaught failed` | step `request.uncaught`, name `Error`, route `/` |
| P3 | `request.uncaught failed` | step `request.uncaught`, name `Error`, route `/api/probe` |
| P10a | `request.stream failed` | step `request.stream`, name `Error`, route `/` |
| P10c | `request.stream failed` | step `request.stream`, name `Error`, route `/` |
| P10b | `request.uncaught failed` | step `request.uncaught`, name `Error`, route `/_server-islands/TonightContent` |
| P10a-island | `request.stream failed` | step `request.stream`, name `Error`, route `/_server-islands/TonightContent` |
| P10c-island | `request.stream failed` | step `request.stream`, name `Error`, route `/_server-islands/TonightContent` |

No `status` field appears on any line (it exists only for the resolved-5xx safety net with an undefined error, which did not fire). No value or path with data: `route` is the template, `name` is `Error`.

Differences from expectation: none. All rows match.

### Notes from the probe run

- Exactly 7 `sidereus: request.*` lines in the whole after-run log, one per row above; no duplicates (P1, P3 and P10b each have exactly one `request.uncaught`; the 500 pages did not log a second line through the `/500` re-render).
- A client cancel is **not** exercised by this run: the suite reads every body to the end. That a cancel logs nothing is covered only by the unit test of `guardStream` (`stream-guard.test.ts`, risk c).
- P10a / P10c on `/` return 200 with 0 bytes and no read error on the client, both before and after: the stream failure reaches the client only as an empty body here, not as a reject. Same as before; only the server line is new.
- The +1 byte on `/log` (36923 → 36924) and `/log/progress` (35003 → 35004) is per-run session data: each run signs up a new probe user, and the 200 pages carry per-request values. The probes and their log lines are identical; P0 and the island baseline are byte-identical.
- Astro's `[ERROR]` lines still appear for P1, P3, P5 and P10b, and for P1, P3 and P10b they now follow the `request.uncaught` line.

### Decisions and adaptations

- No mismatches with the plan in Phase 2; nothing adapted.
- Runbook: §1 gains a bullet for `route`, §3 gains rows for `request.stream` and `request.uncaught`; the step table was re-aligned by Prettier, so the diff of that file is larger than the new text.
