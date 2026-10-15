# Tonight sub-nav and Progress as a destination — Plan Brief

> Full plan: `context/changes/ui-tonight-nav/plan.md`
> Research: `context/changes/ui-tonight-nav/research.md`

## What & Why

M-4 S-02 (#170), change 4 of the ui-refine umbrella, owner decision 4 ("4A plus 4B"). Moving between Tonight's
focused pages costs back, scroll and tile, at the telescope, in gloves. Progress, the app's motivational view, sits
behind a link in the Log header. This change gives the focused pages a one-tap sub-nav and makes Progress a fourth
destination.

## Starting Point

Each focused page has one `BackLink` to `/tonight`, drawn by the skeleton and again by the island. `NAV_ITEMS` has
three destinations, and `isCurrentPage`'s prefix match would mark Log and Progress both current on `/log/progress`.
The nav uses `text-sm` / `text-xs`, off the type roles. The scan found 0 literal colours.

## Desired End State

On the six focused pages, a chip row (Tonight · Targets · Events · Plan · Moon · Planets · Nights) sits under the
Topbar, with the current chip filled and scrolled into view and a fade on the side with more chips. There is no back
link there. The dashboard is unchanged, and the finder keeps its back link to its origin. The TabBar and the Topbar
show Tonight · Log · Progress · My gear, with exactly one current item. The Log header and the progress page lose
their Progress / back links.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Navigation shape | 4A sub-nav plus 4B four destinations | The owner's decision 4 | Audit |
| Where the sub-nav lives | GearShell's sky-flow strip (named slot), not the island's sky | Rendered once, never swapped, so no skeleton duplication and no scroll reset on the swap | Research (C1) |
| Sub-nav order | The dashboard's tile order (Events second), held to `TONIGHT_PAGES` as a set | Follows what the user sees; `TONIGHT_PAGES`' order serves the offline list | Plan (agent default, owner to confirm) |
| Sub-nav labels | Short labels (Plan, Moon, Nights, Events / Plan, Księżyc, Noce, Zjawiska) | Fits from `sm`, less scrolling on a phone | Research (C2), agent default |
| Phone overflow cue | Edge fade (alpha mask) plus the current chip scrolled into view | No colour in the mask (red-safe), no extra controls | Research (C2), agent default |
| Progress URL | Stays `/log/progress`; `currentDestination` picks the longest match | No URL moves for the celebration, smoke and specs | Research (C3, C4) |
| Pill at `md` | `text-label`, icons only from `lg` | Polish leaves about 5 px at 768 px with icons (measured) | Research (C5), agent default |
| Finder | No sub-nav; keeps its back link to its origin | Roadmap S-02 outcome; it is a leaf, not a sibling | Roadmap |
| Back link on `/log/progress` | Removed | Progress is a destination now | Plan |

## Scope

**In scope:** `navigation.ts` (Progress, `currentDestination`, `TONIGHT_NAV`), `NavIcon` progress glyph, Topbar and
TabBar (four items, type roles), `TonightSubNav` and its scroll helper, GearShell slot, the six focused pages,
`TonightPageSky` / `TonightPageSkeleton` back link only for the finder, Log header and progress page links, i18n,
`/design` specimens, a type-roles guard, CLAUDE.md rules, e2e.

**Out of scope:** the dashboard and `tonight-phone.spec.ts`; `TONIGHT_PAGES` and the worker; the Log header's Sky
checks link and the progress page redesign (S-03); `TopbarControls`' popover sizes; chevron buttons; a URL move.

## Architecture / Approach

The /10x-ui order: model and copy → shared bars (Phase 1) → the one new component on the focused pages (Phase 2) →
states, specimens, guard and rules (Phase 3). Phases 1 and 2 touch disjoint files, so either can land first.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Four destinations | Progress in TabBar and pill, one current item, nav on the roles | Polish pill at `md` (mitigated: icons from `lg`, e2e at 768 / 1024) |
| 2. Tonight sub-nav | Chip row in the strip on six pages, back link only on the finder | Skeleton parity after the back link goes (measured within 2 px) and the strip seam |
| 3. States and rule | `/design` matrix, type-roles guard, CLAUDE.md | Low |

**Prerequisites:** none (independent of PRs #180 / #181; the umbrella table is updated at archive time).
**Estimated effort:** about 2 sessions across 3 phases.

## Open Risks & Assumptions

- The four agent defaults marked above (order, labels, fade, icons from `lg`) are UI choices put to the owner with
  this plan. Changing any one changes only Phase 1 or 2 copy or classes, not the structure.
- Stored offline copies taken before the deploy keep the back link until their next online refresh (harmless).

## Success Criteria (Summary)

- From any focused Tonight page, any sibling is one tap away, and the current page is visible in the row on a phone.
- Progress is one tap from every signed-in page, and exactly one destination is current everywhere.
- The dashboard's first screen and the skeleton swaps do not move.
