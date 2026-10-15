# Dashboard tiles on the rhythm roles and shared facts — Plan Brief

> Full plan: `context/changes/ui-dashboard-tiles/plan.md`
> Research: `context/changes/ui-dashboard-tiles/research.md`

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
- **The verdict**: on an event night the event line is its own fact with the event's icon. The advice and forecast lines sit a group under the reason.
- **What does not move**: the phone first screen is unchanged (headline 149, Site 701, Telescope title 746 px against the TabBar at 779 px at 390×844), and the skeleton matches every tile.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Tile rhythm (D1) | Row `py-item`; heading → content `line`; explanatory caption `group`; Planets reason `line` as a `why` Fact | The focused pages' roles, applied to tiles as list rows | Research / ui-fact-rhythm |
| Targets list (D2, owner question) | `space-y-line` (8 px, was 12) | Three rows of one group | Plan (agent default) |
| First tile gap (D3) | `TILES_GAP_CLASS` = `pt-line` | Same first-heading position on a phone; 28 px under the cards at every width | Experiment |
| Verdict event icon (D4, owner question) | The kind's icon, muted; a solar eclipse gets the amber safety triangle | `Eclipse` reads as a clock at 16 px beside "Tomorrow, 11:22" | Experiment |
| Events tile line (D5, owner question) | No icon | Keeps the dashboard text-led (2B); Events, Plan and Moon summaries look alike | Plan (agent default) |
| Verdict's lower lines (D6) | Advice and forecast at `group`; re-measure `VERDICT_MIN_HEIGHT_CLASS` (expect `sm:min-h-62`) | Separates the answer from the advice; a phone go night keeps its height | Research C4 |
| Event facts (D7) | `Fact` kind = `FactKind \| SkyEventKind`, one `factIcon` resolver | One map, one concept per icon | Plan |
| Out of the change | Tile heading icons, the area below the tiles, the gear row, `sky-band` geometry | Decision 2B; not tile content; first-screen geometry | Audit / research |

## Scope

**In scope:**
- `tile.ts`, `TonightTiles`, `EventsTile`, `TILES_GAP_CLASS`.
- `VerdictCard`, `TonightContent` (the kind), `eventsVerdictKind`, `Fact` and `fact-icons`.
- `TonightSkeleton`, `VERDICT_MIN_HEIGHT_CLASS`.
- The guard and contrast rows, the `/design` specimens, two e2e specs.
- CLAUDE.md, the evidence, the landing image.

**Out of scope:**
- Tile heading icons, and icons on the events, plan or moon summary lines.
- The sky-check card and the prompts, the gear row and its cards.
- The focused pages, the navigation (change 4), and /log and /gear (change 5).
- New tokens or copy.

## Architecture / Approach

The tiles and the skeleton share one new `TILE_CONTENT_CLASS` (`mt-line`) and the row class (`py-item`).

The verdict gets its event's kind from `eventsVerdictKind`, which reads the same `events.tonight[0]` that `eventsVerdictLine` words. It renders the line as a muted `Fact` whose icon comes from `factIcon`, and the solar eclipse is mapped to the `safety` concept.

The guard grows with each phase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. The tiles on the roles (Opus high; capture Sonnet medium) | Tiles, skeleton rows, `/design` tiles, guard entries | Skeleton/real drift in PL wraps (pre-existing at 320 px) |
| 2. The verdict (helper Sonnet high; UI Opus high; capture Sonnet medium) | Event line as a `Fact` with its icon; lower lines at `group`; min-height; contrast pin; `/design` | The amber row failing on the red or dusk stops (stop and report, never adjust a token) |
| 3. Rules, gate, landing, suite (main; docs and capture Sonnet medium) | Break check, CLAUDE.md, after matrix, landing image, whole e2e plus smoke | Flaky whole-suite run (fix, never retry) |

**Prerequisites:**
- Local Supabase with main's schema (session_plans applied).
- The preview on 4331 and the fixture on 4401.
- The seed user (`evidence/scripts/seed.mjs`) granted the full plan, keys inline.

**Estimated effort:** about one session across 3 small phases.

## Open Risks & Assumptions

- The event line appears only on event nights. The fixture night (2026-10-15) has none, so the e2e check of `data-fact` and the svg runs only on such a night. `/design` carries the visual proof.
- The min-height expectation (`sm:min-h-62`) comes from the experiment's +12 px at 1280 px. The 640 px measurement decides.
- The landing image changes, because the desktop verdict grows by 12 px and the tiles' gap shrinks.

## Success Criteria (Summary)

- The dashboard's tiles read as one family, with clear gaps between tiles and tight headings, in every theme and both languages.
- On an event night, the event under the verdict is its own line with its icon, and a solar eclipse shows the amber warning.
- No first-screen, skeleton or e2e regression; the whole suite and smoke are green.
