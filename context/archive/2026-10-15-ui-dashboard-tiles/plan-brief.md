# Dashboard tiles on the rhythm roles and shared facts — Plan Brief

> Full plan: `context/changes/ui-dashboard-tiles/plan.md`
> Research: `context/changes/ui-dashboard-tiles/research.md`
> Plan review: `context/changes/ui-dashboard-tiles/reviews/plan-review.md` (F1-F10 applied, owner answers 2026-10-15)

## What & Why

The `/tonight` dashboard is the screen users see first, and it is now the densest Tonight screen.

- Its tiles sit 32 px apart on a phone, while the focused pages' rows are 40 px apart since ui-fact-rhythm.
- Each tile places its content 12, 16 or 20 px under its heading.
- The verdict's sky-event line ("Tonight: Orionids peak") reads as the end of the reason.

This is change 3 of the ui-refine split. It applies ui-fact-rhythm's roles and `Fact` to the dashboard, with no icons on tile headings (owner decision 2B).

## Starting Point

On main 42ce808 the dashboard has no literal colours and no rhythm roles: every vertical step in the tiles, the verdict and the skeleton is numeric (research: 0 role utilities in 11 files).

- The skeleton hand-copies those steps.
- The rhythm guard does not cover any dashboard file.
- `Fact` takes only fact kinds. The event-kind icons sit in a second map in the same module.

## Desired End State

- **The tiles**: every tile is a `py-item` row, so tiles are 40 px apart. Each heading sits 8 px over its content, and explanatory captions are their own group. The Planets reason carries its Info icon, as on the Planets page.
- **The Events tile's line** leads with the next event's kind icon. This is the one exception to text-led tiles; headings still carry no icon.
- **The verdict**: on an event night the event line is its own fact with the event's icon, solar eclipse included. Only the "Next clear night" advice moves a group down; the forecast line stays in the answer group.
- **What does not move**: the phone first screen is unchanged (headline 149, Site 701, Telescope title 746 px against the TabBar at 779 px at 390×844), and the skeleton matches every tile.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Tile rhythm (D1) | Row `py-item`; heading → content `line`; explanatory caption `group`; Planets reason `line` as a `why` Fact | The focused pages' roles, applied to tiles as list rows | Research / ui-fact-rhythm |
| Targets list (D2) | `space-y-line` (8 px, was 12) | Three rows of one group | Owner |
| First tile gap (D3) | `TILES_GAP_CLASS` = `pt-line` | Same first-heading position on a phone; 28 px under the cards at every width | Experiment |
| Verdict event icon (D4) | The kind's icon, muted, solar eclipse included (`Eclipse`); no amber icon, no contrast row | "Eclipse glasses only" stays in the words | Owner |
| Events tile line (D5) | Leads with the next event's kind icon (`Fact` at body size); the none and unavailable lines stay plain | A deliberate exception; headings stay icon-free (2B) | Owner |
| Verdict's lower lines (D6) | Forecast line `mt-line` (answer group); only the weather no-go advice `mt-group`; no-darkness lines `mt-line`; re-measure (expect `sm:min-h-58`) | The phone first screen must not get worse (review F1) | Owner |
| Event facts (D7, F2, F9) | `Fact` kind = `FactKind \| SkyEventKind` with `size`; pure `factIcon` (tested); one `{ line, kind }` value from `eventsVerdict` / `eventsTile` (tested) | One map; the text and the icon can't name two events | Plan / review |
| Out of the change | Tile heading icons, the area below the tiles, the gear row, `sky-band` geometry | Decision 2B; not tile content; first-screen geometry | Audit / research |

## Scope

**In scope:**
- `tile.ts`, `TonightTiles`, `EventsTile`, `TILES_GAP_CLASS`.
- `VerdictCard`, `TonightContent`, `eventsVerdict` / `eventsTile`, `Fact` (kind and size) and `factIcon`.
- `TonightSkeleton`, `VERDICT_MIN_HEIGHT_CLASS`.
- The guard (with exact counts), the `/design` specimens, two e2e specs.
- CLAUDE.md, the evidence, the landing image.

**Out of scope:**
- Tile heading icons, and icons on the Plan or Moon lines; an amber eclipse icon.
- The sky-check card and the prompts, the gear row and its cards.
- The focused pages, the navigation (change 4), and /log and /gear (change 5).
- New tokens or copy.

## Architecture / Approach

The tiles and the skeleton share one new `TILE_CONTENT_CLASS` (`mt-line`) and the row class (`py-item`).

The verdict and the Events tile each get one `{ line, kind }` value (`eventsVerdict` reads the same `events.tonight[0]` that `eventsVerdictLine` words; `eventsTile` reads `events.next`). They render it as a `Fact` whose icon comes from the pure `factIcon`, so every event, solar eclipse included, shows its own kind's icon.

The guard grows with each phase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. The contract and the tiles (helpers Sonnet high; UI Opus high; capture Sonnet medium) | `eventsVerdict` / `eventsTile`, `factIcon`, `Fact` kind and size, tiles with the Events icon, skeleton rows, `/design`, guard with exact counts | Skeleton/real drift in PL wraps (pre-existing at 320 px) |
| 2. The verdict (Opus high; capture Sonnet medium) | Event line as a `Fact` with its icon; the advice at `group`; min-height re-measured at 360/640 on page and skeleton; `/design` | A misread min-height (measure with `min-height: 0`, no event line) |
| 3. Rules, gate, landing, suite (main; docs and capture Sonnet medium) | Break check (incl. an unused allowance), CLAUDE.md, after matrix, landing height in the spec and `Welcome`, whole e2e plus smoke | Flaky whole-suite run (fix, never retry) |

**Prerequisites:**
- Local Supabase with main's schema (session_plans applied).
- The preview on 4331 and the fixture on 4401.
- The seed user (`evidence/scripts/seed.mjs`) granted the full plan, keys inline.

**Estimated effort:** about one session across 3 small phases.

## Open Risks & Assumptions

- The verdict line appears only on event nights, so its e2e branch runs only then. The pure helpers and `factIcon` are unit-tested every run, and the Events tile's icon is checked whenever an event is next (the Orionids today).
- The min-height expectation (`sm:min-h-58`) is arithmetic (the forecast line 4 px closer). The 640 px measurement decides.
- A weather no-go night grows by 12 px on a phone from the advice (owner D6); it already sits past the fold, a known limit.
- The landing image's height is re-measured to end on the first tile's rule (about 1105 px) and set in the spec and `Welcome`.

## Success Criteria (Summary)

- The dashboard's tiles read as one family, with clear gaps between tiles and tight headings, in every theme and both languages.
- On an event night, the event under the verdict is its own line with its kind's icon; the Events tile's line leads with the next event's icon.
- No first-screen, skeleton or e2e regression; the whole suite and smoke are green.
