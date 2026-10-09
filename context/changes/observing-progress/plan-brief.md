# Observing progress (M-3 S-05) — Plan Brief

> Full plan: `context/changes/observing-progress/plan.md`
> Research: `context/changes/observing-progress/research.md`

## What & Why

A beginner needs a reason to come back: how far they are through the Messier and Caldwell lists, and which of tonight's targets they have never seen (PRD FR-039, FR-040, US-06). This slice adds a private progress page and a "not seen yet" mark on Tonight's targets. Both are filled only from log entries rated 3 or above.

## Starting Point

The ranking already decides "seen" in one pure function, `seenSummaries` (rated ≥ 3, distinct nights). It shows the result as a "seen N times" tag on every ranked object, planet and the Moon.

The log read behind it is capped by PostgREST at 1,000 rows. There is no progress page and no unseen mark.

## Desired End State

**On `/log/progress`** (an action link in `/log`'s header):

- **Firsts:** the planets and the Moon with the date each was first seen.
- **Messier, "x / 110":** a grid of numbered chips, with the seen ones filled and checked, and a list of the seen objects with their first nights.
- **Caldwell, "x / 61":** the same, with a note that the list covers the objects visible from mid-northern latitudes.

**On Tonight:** every target never logged at a rating of 3 or above shows a Sparkles icon next to its name.

- On the cards (Targets, Planets, Moon), the icon opens a legend tooltip on hover, tap or keyboard focus.
- In the dashboard's "Point here first" tile and in the collapsed "show the other N" rows, the icon is static, and a one-line legend explains it.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Seen rule | Reuse `seenSummaries` + `LOG_PENALTY_MIN_RATING` | One rule keeps ranking and progress in step (roadmap risk). | Research |
| Caldwell count | "x / 61" plus a note on the mid-northern subset | Completable and honest about the 109. | Plan (user) |
| Checklist layout | Chip grid + list of seen objects with dates | Whole list at a glance on a phone, with names for what's been seen. | Plan (user) |
| Firsts | Date of the first night rated ≥ 3, or "not yet" | A "first" is a moment; also feeds S-06. | Plan (user) |
| Entry point | Action link in `/log`'s header (like Sky checks) | No navigation or dashboard change; phone-fold spec untouched. | Plan (user) |
| Mark surfaces | Targets cards and rows, Planets, Moon, the "Point here first" tile | Visible from the dashboard too; not on the Session plan. | Plan (user) |
| Mark style | Sparkles icon by the name; tooltip legend (hover, tap, keyboard) | Light on the cards, explained on demand. | Plan (user) |
| No button allowed (tile `<a>`, `<summary>`) | Static icon + `sr-only` text + one legend line | Valid HTML/a11y, with the meaning always on screen. | Plan (user) |
| Exact counts | Page the seen read (1,000 per page, total order with `id`) instead of an SQL aggregate | No migration or RPC, and the same rows feed ranking and progress. | Plan (delegated) |
| Read name | `listForRanking` → `listSeenEntries` | It now serves progress too. | Plan (delegated) |
| Progress model | Pure `observingProgress` in `src/lib/progress/` | Testable with hand-written fixtures; S-06 derives milestones from it. | Plan (delegated) |
| First night | `SeenSummary.firstNight`; the cut-off becomes optional | Firsts and seen-list dates without a sentinel date. | Plan (delegated) |

## Scope

**In scope:**

- the paged seen read and `firstNight`;
- the pure progress model;
- the `notSeenYet` flag and `NotSeenMark` (tip and static variants);
- marks on five surfaces, plus the legend lines;
- `/log/progress` with the firsts and two checklists, and the `/log` header link;
- EN and PL copy;
- `/design` specimens;
- unit, db and e2e tests;
- a CLAUDE.md note.

**Out of scope:**

- milestones and the celebration at save (S-06);
- any migration, table or RPC;
- a navigation tab or a dashboard progress tile;
- a mark on the Session plan, the live sky or the washed-out list;
- type grouping or chip links;
- offline storage of `/log/progress`;
- a landing screenshot recapture.

## Architecture / Approach

The log flows into the page and onto Tonight along two paths:

- **The page:** `observations` (RLS) → `listSeenEntries` (rating ≥ 3, paged) → `seenSummaries` (distinct nights, first and last night). Then `observingProgress` adds the catalogue and produces the checklists and firsts for `/log/progress`.
- **Tonight:** `seenSummaries(log, rankedNight)` → the engine's `entry.seen` → `notSeenYet` → `NotSeenMark`.

Everything is computed on read, so re-rating or deleting an entry updates the counts and marks on the next load.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Exact seen data and the progress model | Paged read, `firstNight`, pure `observingProgress` (test-first) | The paging order must be total, or rows are skipped. |
| 2. "Not seen yet" on Tonight | `notSeenYet`, `NotSeenMark`, marks + legends on five surfaces, e2e | The tooltip has to behave for hover, tap and keyboard and stay on screen at 320 px. |
| 3. The progress page | `/log/progress`, `ChecklistGrid`, `SeenList`, `/log` link, e2e, docs | A 110-chip grid in PL at 320 px; seen vs unseen must be told apart in red mode. |

**Prerequisites:**

- `.env` / `.dev.vars` from the orchestrator for previews and the e2e runs.
- The shared local Supabase must be up (no reset, no migrations).
- Port 4329 is never used.
- If PR #147 merges first, rebase. This slice adds no table, so nothing joins `TABLES`.

**Estimated effort:** about 2-3 sessions across 3 phases.

## Open Risks & Assumptions

- Paging assumes `max_rows` = 1000 (local config and Supabase's hosted default). A lower hosted value would end the loop early. This is documented in the store.
- On a fresh account every target carries the mark. It is intended (FR-040), but dense; the screenshots will show whether that's acceptable.
- Stored offline Tonight copies keep the mark they were rendered with, up to 36 h, like today's seen tag.

## Success Criteria (Summary)

- An object rated 1-2 never ticks a checklist or clears its mark. A rating of 3 or above does, and re-rating or deleting the entry undoes it.
- `/log/progress` shows exact counts out of 110 and 61, the dated firsts, and a readable grid on a 320 px phone in EN and PL, in all three themes.
- Every Tonight surface the user chose shows the mark, and its meaning is reachable by hover, tap, keyboard or the legend line.
