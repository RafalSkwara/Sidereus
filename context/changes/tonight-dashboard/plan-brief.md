# Tonight as a dashboard of focused pages: plan brief

> Full plan: `context/changes/tonight-dashboard/plan.md`

## What & Why

After the Nightfall redesign `/tonight` is still cluttered. Its summary bands link to detail bands further down the same page (`#ranking`, `#moon`, `#planets`, `#nights`), which the user finds unclear and bad UX. This change makes `/tonight` a dashboard whose tiles each open a focused page of their own (roadmap S-11, GitHub #87).

## Starting Point

One `GearShell skyFlow` page with one server island, `TonightContent`. It holds:

- the sky with the giant verdict
- four summary bands with chevrons to in-page anchors
- the sky check and the gear pickers
- every detail band: Moon, planets, top-5 ranking and the 7-night strip

A separate pre-Nightfall `/tonight/all` lists every cleared object.

## Desired End State

**`/tonight`** shows the sky verdict, then four ruled tile rows with a → arrow: Point here first, The Moon, Planets, Next 7 nights. Each opens a page:

- `/tonight/targets`: the full ranked list with sort; it takes over `/tonight/all`
- `/tonight/moon`
- `/tonight/planets`
- `/tonight/nights`

Each page has a slim sky with "‹ Tonight", its title and a context line: verdict dot · date · site · telescope. The sky check (while one is open) and the site/telescope pickers stay on the dashboard. "Mark observed" returns to the page it came from.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| How a summary leads to detail | Separate pages, back link to Tonight | One idea per screen, real URLs, a home for S-05/S-06 | User |
| Tile set | Targets, Moon, Planets, Next 7 nights; sky check inline only while open | Same content as today, reorganised, nothing lost | User |
| Tile layout | Ruled full-width rows with a → arrow | Stays within Nightfall's bands-not-boxes rule and fits Polish | User |
| Addresses | Dashboard stays `/tonight`; pages under `/tonight/*`; `/tonight/all` → 301 `/tonight/targets` | Every existing link, tab and redirect keeps working; one targets page | User |
| Focused page header | Slim sky + back link + context line; pickers only on the dashboard | Clearly "part of tonight" without repeating the verdict | User |
| Data per page | Own island, `loadTonight` unchanged; only the dashboard reads sky checks and records the verdict | Dashboard and Moon need the ranking anyway; forecast is cached | Plan (delegated) |
| Log return | `from` = targets/moon/planets → back to that page, carried link → form → POST; none → `/tonight` | Logging shouldn't throw you back to the dashboard | Plan (delegated); plan review F1 |
| Targets tile with no ranking | Still opens Targets, which explains why and links to Next 7 nights | A tile always opens its own page | Plan (delegated) |
| Page without site/telescope | One line + link to Tonight | The dashboard owns setup prompts | Plan (delegated) |

## Scope

**In scope:**

- The dashboard tiles and a slimmed `TonightContent`.
- Four new pages and islands.
- The shared `TonightPageSky` and its skeleton.
- An island-loading helper.
- Log return-to-page.
- `/tonight/all` → Targets, in Nightfall style.
- EN/PL copy.
- 8 e2e specs moved, plus one new dashboard spec.
- `/design` specimens, the screenshot gate, and updates to CLAUDE.md, the roadmap and the handoff.

**Out of scope:**

- The interactive sky slider (a follow-up S-11 change).
- The S-05 timeline and S-06 offline.
- `loadTonight` skip flags.
- Pickers on focused pages.
- A verdict page.
- Log/Gear shortcut tiles.
- No-JS fallbacks.
- Restyling other views.

## Architecture / Approach

Every page is a `GearShell skyFlow` shell that reads `requestedGear` and the notice, then renders its own `server:defer` island. The island loads through a shared helper (`loadTonight` + KV forecast + `waitUntil`) and draws `TonightPageSky` followed by today's detail components:

- `MoonCard`
- `SolarSystemSection`
- `NightStrip`
- a restyled `ObjectRow` list

The pages land first, while the dashboard still has its detail. Then the dashboard drops the detail and repoints its tiles, so nothing is lost mid-change.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Groundwork | Page sky + skeleton, island helper, log return-to-page, copy | `from` handling leaking a non-enum value into a redirect |
| 2. Moon, Planets, Nights pages | Three focused pages; 4 e2e specs moved | Moon slider inside a new island; empty planet/forecast states |
| 3. Targets page | `/tonight/targets` replaces `/tonight/all` (Nightfall rows, sort, washed-out); 301 | Fragment `#washed-out` across the redirect and streamed island |
| 4. Dashboard | Tiles open pages; detail bands removed; remaining specs + new dashboard spec | e2e churn; edge states (no-go, no Moon, no setup) |
| 5. States, gate, rule | `/design` specimens, approved screenshot gate, CLAUDE.md rule, roadmap/handoff | User-visible polish found only at the gate |

**Prerequisites:** `main` at the archived tonight-nightfall (done); local Supabase + forecast fixture for e2e (handoff recipe).
**Estimated effort:** about 1–2 long sessions across 5 phases.

## Open Risks & Assumptions

- **Page load:** each focused page reruns the full `loadTonight` (five reads, a cached forecast, the ranking). This is assumed fine on Workers Paid; skip flags are the fallback if it is measurably slow.
- **Dashboard height:** the tiles must fit about two phone screens with the sky. Phase 4 may tighten row padding.
- **Colour-only dot:** the context line's verdict dot carries no meaning on its own; the headline rides in screen-reader text. Confirmed at the screenshot gate in red mode.

## Success Criteria (Summary)

- `/tonight` is a short dashboard. Every tile opens its own page, and nothing on Tonight jumps to another spot on the same page.
- Everything Tonight showed before is still one tap away, for the chosen site and telescope, in EN/PL and all three themes.
- The full e2e suite passes, and the user approves the screenshot gate.
