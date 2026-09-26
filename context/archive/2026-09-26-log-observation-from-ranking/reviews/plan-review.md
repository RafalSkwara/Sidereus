<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Log an Observation from the Ranking

- **Plan**: context/changes/log-observation-from-ranking/plan.md
- **Mode**: Deep (claims verified inline, no sub-agent)
- **Date**: 2026-09-26
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding
8/8 paths ✓, 5/5 symbols ✓ (plural, translateKey, NOT_CONFIGURED, issueKey, observingNightDateFor), brief↔plan ✓. Blast radius of the RankedEntry/RankInput change: build.ts, format.ts, ranking.test.ts, determinism.test.ts. The new fields are additive, so nothing breaks. Progress↔Phase: 4/4 phases, 25/25 criteria mapped, no checkboxes outside Progress.

## Findings

### F1 — "Seen N times" is undefined for repeat entries on the same night

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — Log summaries (`seenSummaries` contract); Phase 1 — migration
- **Detail**: `seenSummaries` "counts qualifying entries". Nothing stops two rows for the same object and night: a double submit, the browser back button and resubmitting, or logging again after misclicking the rating. Each of these makes the tag read "Seen 2 times" after one night at the eyepiece. The plan never says whether N counts rows or nights, so the answer would be whatever the implementation happens to do.
- **Fix A ⭐ Recommended**: N counts distinct qualifying nights; duplicate rows are allowed.
  - Strength: A resubmit can never inflate the tag, and nothing is added to the schema or the form. S-07 can delete the duplicate row later.
  - Tradeoff: The duplicate row still sits in the log until S-07 makes it visible.
  - Confidence: HIGH — a pure change inside `seenSummaries` plus one test case.
  - Blind spot: None significant.
- **Fix B**: Add a unique constraint on (user_id, messier, night) and an "already logged for that night" error.
  - Strength: The log itself stays clean.
  - Tradeoff: Changing a rating means editing the entry, which is S-07. Until then the user is stuck with the first rating, and the form needs a new error path.
  - Confidence: MED — it makes the S-06/S-07 boundary awkward.
  - Blind spot: Two sites observed on the same night would collide.
- **Decision**: FIXED (Fix A)

### F2 — Phase 1 leaves two choices open with "may" and "if"

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Store (#4), Isolation tests (#5)
- **Detail**: "Phase 1 may define [LogEntry] in the engine's new log.ts" and "if the static valid row cannot carry per-user gear ids, extend the harness". `site_id` and `telescope_id` are nullable, so a static `TABLES` row with null gear ids and name snapshots is valid. The harness needs no change, and only the separate foreign-gear and set-null tests create gear.
- **Fix**: State that Phase 1 creates `src/lib/engine/log.ts` with the `LogEntry` type only (Phase 2 adds `SeenSummary` and `seenSummaries`), and that the `TABLES` entry uses null gear ids.
- **Decision**: FIXED

### F3 — The client-side max night follows the prefilled site, but the site can change

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Page (#2), Form island (#3)
- **Detail**: `maxNight` comes from the prefilled site's time zone. If the user switches to a site whose time zone is a day ahead, `<input max>` blocks a date the server would accept.
- **Fix**: Pass `maxNight` as the latest current observing night across the user's sites. The server check against the chosen site stays the authority.
- **Decision**: FIXED

### F4 — The smoke criterion omits its prerequisites

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 — Automated Verification (4.4)
- **Detail**: `npm run smoke` and `npm run test:e2e` need a running build (`npm run build && npm run preview`), the forecast fixture server and local Supabase, with `BASE_URL` set, as CI's smoke job does. The criterion reads as if it runs standalone.
- **Fix**: Add a one-line prerequisite note under Phase 4's Automated Verification. The Progress title stays unchanged.
- **Decision**: FIXED
