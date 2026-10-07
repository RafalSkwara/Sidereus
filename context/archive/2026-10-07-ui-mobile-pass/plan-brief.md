# Phone-first UI pass of the Tonight dashboard — Plan Brief

> Full plan: `context/changes/ui-mobile-pass/plan.md`
> Research: `context/changes/ui-mobile-pass/research.md`

## What & Why

On a phone, `/tonight` spends its whole first screen on sky. The first tile starts at y = 916 px against a 603–780 px fold, so "what do I point at" is never visible without scrolling. This is roadmap M-3 S-01 (MS-01, #122): the user finds the dashboard crowded, and the PRD asks for the verdict and the first tiles on the first screen at 360–390 px.

## Starting Point

Nightfall is healthy at the token level: 0 literal colours or arbitrary values in the dashboard. The problems are rhythm (no phone step for titles or padding), a sky stack whose heights were each set desktop-first (`sky-band.ts`), a verdict that says itself three ways, gear and save notices buried at the bottom, and five hand-copied tiles with the Moon's "9%" as the loudest thing on the page.

## Desired End State

At 390×844 the screen reads, top to bottom:

1. the verdict: date, dark window and zone on separate lines, a smaller word, and one "● Clear · reason" line;
2. the **unchanged** panorama, with a one-row slider;
3. the gear row (site · telescope and the switchers);
4. "Point here first" with its targets.

All of it is above the TabBar. The other tiles are short summaries. Every view gets shorter headers and tighter bands through the shared parts. A committed e2e spec pins the first screen, and CLAUDE.md tells the next agent the rules.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope | One view (`/tonight`) plus global rhythm through shared parts | `/10x-ui` rule: one view plus global tokens; the other views are follow-ups | Research |
| Panorama | Untouched (strip, overlap, projection, silhouette) | User: "it's sensitive to changes" | Plan (user) |
| Phone sky | Shrink the rest: the verdict to its content height, the slider in one row on phones | Gets the first tile on screen at 390×844 without touching the panorama | Plan (user) |
| Info above the word | Date, dark window and zone, each on its own line, at every width | User: separate lines, not one flow | Plan (user) |
| Verdict word | Kept; one tier smaller from `sm`, two tiers on phones (Go about 60 px) | User: "only a bit smaller"; the extra phone step was the user's pick in plan review F1, so the first target fits at 390×844 | Plan (user) / review |
| Headline + reason | One flowing "● Clear · <reason>" line (headline at title size, reason at body size), existing copy, no em dash | Answer option 1 adapted to the user's line rule; body size saves a line (review F1) | Plan |
| Forecast-age line | Hidden on phones only when fresh | Stale and missing still need to stand out | Plan |
| Gear placement | A row right under the sky, above the tiles | User: gear and sites disappear at the bottom | Plan (user) |
| Save notice | Moved under the sky, before the gear row | It is invisible below the fold today | Plan (delegated) |
| Sky check | Stays after the tiles | User: "the rest is mostly fine" | Plan (user) |
| Tiles | Shared `ui/Tile.astro`; "Point here first" keeps its list; Plan, Moon and Planets as heading plus summary; shorter night bars on phones | Fixes the inverted hierarchy and the 5× copies | Plan (user) |
| Rhythm | Global: fluid `--text-display`, `Band`/`GearShell`/`PageHeader` phone padding | Fixes "every view feels crowded" at the root | Plan (user) |
| Visual gate | Geometric Playwright spec (bounding boxes), no pixel baselines | No screenshot tooling exists, and boxes survive data and time changes | Plan |
| Gate size | 390×844 EN only; 360×780 and 375×667 are known limits (the first tile at about 715–743 px) | Follows from keeping the panorama (review F1) | Plan review |
| Shell rhythm | GearShell, AuthShell and Welcome take the same phone paddings; the shared sky container trim lands in Phase 1 | Avoids a Topbar jump between landing/auth and the app (review F3) | Plan review |

## Scope

**In scope:**
- the type token `--text-display`;
- `Band`, `band.tsx`, `PageHeader`, `GearShell`, `AuthShell`, `Welcome` and `TonightPageSky` phone padding;
- the new `Tile` component;
- `TonightTiles`, `VerdictCard` and the `sky-band.ts` phone heights;
- the phone layout of the slider row;
- the `TonightContent` order;
- the `TonightSkeleton` parity, including a gear-row placeholder;
- EN/PL keys;
- the `/design` states;
- the e2e gate;
- the landing recapture at a re-measured height;
- the CLAUDE.md rule.

**Out of scope:**
- the panorama;
- replacing the verdict word;
- new reason copy;
- moving the sky check;
- a Topbar site switcher;
- D1–D5 (the focused target cards, a shared list row, `/log/sky` and onboarding, NightStrip and nowrap, the silent sky-view catch).

## Architecture / Approach

1. Fix the contract before the pixels. A fluid display role and phone padding in the shared parts give every view the rhythm.
2. One `Tile` component replaces the five copies.
3. The dashboard then changes only through the verdict card, `sky-band.ts` (the one source of the sky's heights, read by the island, the static sky and the skeleton) and the island's block order.

The panorama code is not edited. The compass row already measures the verdict's text, so the verdict can shrink as long as it keeps its bottom padding.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Phone rhythm in the shared parts | Shorter headers and bands on every view, desktop unchanged | The fluid display value inside `@theme inline` must not change desktop sizes |
| 2. Shared Tile and compact tiles | One Tile; the tile stack drops from ~905 to about 560 px | Specs keyed to tile ids; keep ids and `aria-labelledby` |
| 3. The dashboard's first screen | Verdict lines and smaller word, one-row slider, gear row and notice under the sky | Skeleton/island height parity; compass row versus verdict text |
| 4. States, visual gate and guard | `tonight-phone.spec.ts`, 7-state matrix, landing recapture, CLAUDE.md rule | The full e2e suite needs locator updates without weakening assertions |

**Prerequisites:** Roadmap PR #130 (S-01's entry) merges first or alongside. Local Supabase and the forecast fixture are needed for the preview and e2e.
**Estimated effort:** about 2 sessions across 4 phases.

## Open Risks & Assumptions

- On phones the word drops two tiers (Go 144 → about 60 px), on desktop one (192 → 144 px). The user eyeballs it at the Phase 4 gate, and S-02 can tune it.
- The 390×844 fit is arithmetic: about 40–50 px saved against a 16–44 px shortfall. Phase 3 measures it on the preview. A 3-line PL answer can still push the first row under the fold, and the gate runs EN on the all-clear fixture.
- The verdict min-height is measured at 360 px. A taller verdict (narrower than that, PL, explanations, multi-site pills) still grows the page after the skeleton swap.
- Offline copies stored before the deploy show the old layout for up to 36 h.

## Success Criteria (Summary)

- At 390×844 (EN) the verdict, the gear row and the first target are visible without scrolling, pinned by `tests/e2e/tonight-phone.spec.ts`.
- No sideways scroll at 320 or 375 px on 8 pages in EN and PL, and the panorama is unchanged.
- The user approves the after-screenshots, and S-02 starts from them.
