# All Tonight's Objects — Plan Brief

> Full plan: `context/changes/tonight-all-objects/plan.md`

## What & Why

Tonight says how many objects cleared the bar (often 15–25) but shows only the top 5. Observers who have seen those, or want a longer session, need the rest. The user chose a separate page, since a night can clear 50.

## Starting Point

The engine already scores every Messier object and counts the cleared ones; it builds eyepiece pairs and reason lines only for the first 5. Tonight's server island loads gear, log and forecast and renders 5 cards.

## Desired End State

Tonight has a "See all →" link in the ranking heading and a "See all 18 objects →" button under the cards (only when more than 5 cleared). `/tonight/all` shows every cleared object for the same night, site and telescope as compact rows that expand into full details with "Mark observed". A switch orders them by rank or by best time, so the list doubles as a plan for the night.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Where | Separate page `/tonight/all` | A night can clear 50 objects | User |
| Layout | Compact rows that expand | 50 objects stay scannable; details one tap away | User |
| Order | Rank by default, switch to best time | Turns the list into a session plan | User |
| Entry points | Heading link and button under the top 5 | Found from either end of the list | User |
| Engine | Opt-in `limit` on `rankObjects`, default 5 | Tonight stays byte-identical | Delegated |
| Time sort | New `bestAt` instant on entries | `HH:mm` strings can't be sorted across midnight | Delegated |
| Data loading | Shared `loadTonight` for both islands | One way to load gear, log and forecast | Delegated |
| Reasons | Compared across all listed objects on the page | "What sets it apart tonight" among everything shown | Delegated |
| Expand | Native `<details>` | Accessible without extra script | Delegated |

## Scope

**In scope:** engine limit, `bestAt`, sort helper, shared loader; the page with rows, sort switch, empty state; Tonight's two links; EN/PL copy; e2e spec; lint scope for `src/pages/tonight/**`.

**Out of scope:** filters and search, pagination, changes to Tonight's cards or the ranking, a no-JS path, remembering the sort.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data | Full ranked list with `bestAt`, sort helper, shared loader | The loader refactor must not change Tonight |
| 2. Page | `/tonight/all` with rows, sort, empty state | Layout at 390 px with long Polish names |
| 3. Links + verification | Tonight's links, e2e, screenshot and red audits | — |

**Prerequisites:** none. **Estimated effort:** one session.

## Open Risks & Assumptions

- The page re-runs the ranking on its own request; Free-plan CPU is watched in #22.
- The top 5 on the page may give a different reason line than on Tonight (different comparison set).

## Success Criteria (Summary)

- From Tonight, one tap shows every object that cleared, in rank or time order, for the same setup.
- Any row expands to what's needed to observe it, including "Mark observed".
