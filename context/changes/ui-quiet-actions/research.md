---
date: 2026-10-14T14:30:50+0200
researcher: Claude (herdr agent ui-refine)
git_commit: 73a594e
branch: feat/ui-refine
repository: sidereus
topic: "Quieter per-item actions: what uses the action look, what pins it, which decisions constrain it"
tags: [research, ui, buttonVariants, action, tile-cue, red-mode, offline, contrast]
status: complete
last_updated: 2026-10-14
last_updated_by: Claude (herdr agent ui-refine)
---

# Research: quieter per-item actions (ui-quiet-actions)

**Date**: 2026-10-14T14:30:50+0200
**Researcher**: Claude (herdr agent ui-refine)
**Git Commit**: 73a594e (main a98e77a plus the ui-refine docs)
**Branch**: feat/ui-refine
**Repository**: sidereus

## Research Question

The owner's decision 1 on the ui-refine audit (direction 3C, `context/changes/ui-refine/audit.md`, "Owner decisions") changes the per-item actions:

- "Mark observed" is the one per-item button, as a hairline.
- Every other per-item or standalone action becomes a text action with an icon: Finder chart, Manage sites/telescopes, the washed-out link, the back link, the /log header links, Pager.
- The tile cue becomes a bare arrow.
- Eyepiece names leave the link colour.

This research answers four questions:

1. Which code uses or depends on today's `action` look?
2. Which tests, specimens and docs pin it?
3. Which earlier decisions constrain a quieter look?
4. What does S-07 sky-events add on top?

## Summary

- **Call sites.** `buttonVariants({ variant: "action", size: "sm" })` has 12 production call sites in 10 files (listed under Code References). No `<Button variant="action">` exists in tsx.
- **Tokens.** The `action` look rests on two tokens, `--action-surface` and `--action-border`, plain hex in four blocks: dark, light, the light theme's `.night-sky` and red (`src/styles/global.css:41-42,96-97,150-151,194-195`, published at `:662-663`).
  - Three non-button places use the same tokens: the sky-check answers (`SkyAnswerForm.astro:38,57` through `RESTING_BORDER_CLASS`, `button.tsx:17`), the milestone medallion (`MilestoneCelebration.astro:74`) and the tile cue (`ui/tile.ts:25-26`).
- **Tests.** No e2e spec locates or asserts these controls by class or computed style. Specs use role plus accessible name (test-plan §6, `context/foundation/test-plan.md:172-175`), so a restyle that keeps labels, roles and names breaks no e2e oracle.
  - The unit pins are `src/styles/contrast.test.ts:124-130`: `primary-strong` on `action-surface` at ≥4.5 and `action-border` at ≥3 on background, surface, zenith and horizon, in dark, light, red and night.
  - `red-theme.test.ts` requires every new `:root` token to have a pure-red value.
- **Decisions that constrain the work.**
  - **Red mode.** Red has one hue, so the clickable cue must come from shape (border, fill, icon, underline, weight), never hue (ui-user-adjustments `research.md:417`).
  - **Touch targets.** Targets stay at least 44 px (`button.tsx` base `min-h-11`).
  - **Polish labels.** Long Polish labels must wrap (`whitespace-normal`).
  - **Offline.** The muted, dashed look shows its dashed cue only where a border width exists (`global.css:543-562`).
- **The neutral hairline needs a new token.** Experiment B's hairline used `--border`, which measures **1.17-1.78:1** against the ground in the four themes (computed below). It is not a 3:1 indicator, and in red it nearly vanishes.
- **S-07** (`feat/sky-events`, c050bd2) adds **no** `action` call site.
  - Its events tile inherits the cue through `Tile`.
  - `EventsPageContent.astro:48` uses only the `link` variant.
  - The only S-07 interaction is that the dashboard shows six cue arrows instead of five.

## Detailed Findings

### 1. The `action` variant and its call sites

- Definition: `src/components/ui/button.tsx:39-40`. Its classes are `border border-action-border bg-action-surface py-2 text-left whitespace-normal text-primary-strong underline-offset-4 hover:border-primary-strong hover:underline disabled:…`, used with `size: "sm"` (`gap-1.5 px-3 has-[>svg]:px-2.5`).
- Base for every variant: `min-h-11 … rounded-lg text-label font-semibold`, plus the ring focus (`button.tsx:21-27`).
- Production call sites (all `<a>`):

| # | Where | What | `data-needs-network` | 3C target |
|---|---|---|---|---|
| 1 | `tonight/TargetDetails.astro:40,65` | Mark observed (Check) | yes | **hairline** |
| 2 | `tonight/TargetDetails.astro:41,71-75` | Finder chart (Crosshair) | no (D-15) | text action |
| 3 | `ui/BackLink.astro:20` | back link (ChevronLeft), on 11 pages and shells | no | text action |
| 4 | `ui/Pager.astro:24,28,36` | newer / older | no | text action |
| 5 | `tonight/GearCard.astro:73` | Manage sites / telescopes (Settings2) | yes | text action |
| 6 | `tonight/MoonCard.astro:33,49` | washed-out link | no | text action |
| 7 | `pages/log/index.astro:71` | Progress (Award) | no | text action (change 4 moves it to the nav) |
| 8 | `pages/log/index.astro:75` | Sky checks (ListChecks) | no | text action |
| 9 | `pages/log/progress.astro:77` | empty state "to Tonight" (Telescope) | no | text action |
| 10 | `pages/gear/index.astro:92-97,132,167,199` | Add site / telescope / eyepiece when the band is not empty | no | **hairline** (per-section add) |
| 11 | `progress/MilestoneCelebration.astro:37,87` | "See your progress" beside the filled Continue | no | text action |
| 12 | `pages/auth/confirm-email.astro:23` | Back to sign in (ArrowLeft) | no | text action |

  The 12 rows are 12 `buttonVariants` call sites in 10 files: TargetDetails has two (rows 1 and 2), `/log` has two (rows 7 and 8), and `/gear`'s three Add links share the one `addClass` call (row 10).
- `/design` uses `action` in the variants table and the generic default, hover and focus loops (`pages/design.astro:187,191,193,827,842,857`), the offline specimen (`:866-877`, through the hand-copied `offlineAction`, `:195-196`), the long Polish label wrap specimen (`:880-887`), the Manage specimens (`:1715,1745`) and a select (`:1773`). The BackLink block is `:994-1020` (hover drawn as `bg-accent` at `:1009`), and the Pager block is `:1022-1075`.

### 2. Other weights in use (full map, for context)

These variants stay out of scope:

- `default`: one filled primary per screen, for example Add entry (`log/index.astro:79`), Continue (`MilestoneCelebration.astro:84`), the setup prompts (`TonightContent.astro:218-234`) and the primary /gear add (`gear/index.astro:94`).
- `outline`: "Now" (`TonightSkyView.tsx:121`, `MoonTimeSlider.tsx:40`), "Show the other … objects" and the links to nights (`TargetsPageContent.astro:167,211`, `PlanPageContent.astro:97`), the empty-band /gear add (`:96`), the sky-check answers (`SkyAnswerForm.astro:56`).
- `ghost` plus `RESTING_BORDER_CLASS`: the sky-check answers (`SkyAnswerForm.astro:57`).
- `link`: the inline links in sentences (`inlineLink` in seven Tonight page contents), the auth switch links, Skip, SiteForm Undo.
- `destructive` and `secondary` have no `buttonVariants` call site.

### 3. Link colour on non-links

`font-semibold text-primary-strong` on plain text, not inside an `<a>`:

- `ObjectDetails.astro:50,55` (find and detail eyepieces)
- `PlanetCard.astro:56`
- `MoonCard.astro:88,98`
- the `/design` specimen `design.astro:709`

`log/index.astro:148` ("Edit") is inside the row's `<a>`, so it is a link label and stays.

### 4. Tokens, contrast and red mode

- Token values: dark `#16224a` / `#6b82cf`, light `#e4ebfa` / `#3a58b8`, night `#16224a` / `#7389d4`, red `#2a0000` / `#d00000` (surface / border, `global.css` lines above).
- `contrast.test.ts` reads plain hex only; a `var()` or `color-mix` value is reported as "not a plain hex pair" (comment at `:1-12`). Pins at `:124-130`; the comment at `:121-123` names the `action` fill and BackLink on the sky.
- `red-theme.test.ts:45-65`: red literals must have zero green and blue, and every `:root` token needs a red value.
- Computed for this research (WCAG relative luminance), the neutral `--border` against the page background is 1.40 in dark (`#232b3f` / `#070a12`), 1.34 in light (`#d6dce6` / `#fbfcfd`), 1.78 in night (`#2c3a62`), and 1.17 in red (`#3a0000` / `#080000`).
- Against the same backgrounds, `--action-border` is 5.39 in dark, 6.26 in light, 5.90 in night, and 3.64 in red.
- Experiment B's hairline (`evidence/exp-b/experiment-b.diff`, `border border-border`) is therefore below 3:1 in every theme. In red, a hairline "Mark observed" would read almost as text.
- Candidate neutral values, as a starting point for a new hairline token: `#646e8a` (dark, 3.90 on background), `#808a9e` (light, 3.38 on background, 3.17 on surface) and `#7480a8` (night, 4.25 on its surface). For red, `#a00000` reaches only 2.47; a red value nearer `#c80000` is needed for ≥3. The plan must pick and pin the values.
- **Red mode text actions.** In red, `--foreground` is `#f20000` and `--primary-strong` is `#ff0000`, so a text action in the link colour is told apart from body text only by its icon and semibold weight.
  - Existing custom variants are `dark`, `offline` and `night` (`global.css:8-14`). No `red:` variant exists yet; adding one (`&:where([data-theme="red"] *)`) would allow a red-only resting underline.

### 5. Offline

- The rule is `global.css:543-562`. Any `[data-needs-network]` control gets muted ink, a transparent background and no underline (`:550-556`), plus `border-style: dashed; border-color: var(--border)` (`:558-562`). The comment at `:547` notes that borderless links never show the dash.
- The non-visual signals are `aria-disabled` and the "Needs a connection" description, both from `src/lib/offline/page-state.ts`.
- Two of the 3C targets carry `data-needs-network`. "Mark observed" becomes a hairline, so the dash keeps working. "Manage" becomes a text action, so offline it is muted, not-allowed ink without a dash, the same as the Topbar and TabBar links today.
- `/design`'s `offlineAction` (`design.astro:195-196`) is a hand copy of the rule and must follow any change.

### 6. Tests, specimens and docs that would change

- **e2e (role and name only).**
  - Mark observed: `observation-log.spec.ts:38`, `observing-progress.spec.ts:72`, `planets-on-tonight.spec.ts:44-49`, `tonight-targets.spec.ts:74`, `moon-as-target.spec.ts:36-41`.
  - The Finder link: `helpers.ts:211-219`.
  - Manage: `telescope-selector.spec.ts:101,117`.
  - Log header links: `observing-progress.spec.ts:217`, `sky-checks.spec.ts:44`.
  - The BackLink to Tonight: `tonight-dashboard.spec.ts:62`, a `main` link named `en.nav.tonight` with `exact: true`.
  - "See your progress": `observing-milestones.spec.ts:181`.
  - These survive a restyle that keeps text, role (`link`) and name.
- **`tonight-phone.spec.ts:60-102`.** It measures the Site and Telescope cards against the TabBar. The Manage link's height inside `GearCard` (`min-h-11` plus `py-2`) is part of `GEAR_CARD_MIN_HEIGHT_CLASS` (`sky-band.ts`). A text action keeping `min-h-11` leaves the card height unchanged; this needs checking, not assuming. The sideways-scroll checks at 320 and 375 px in PL (`:106-130`) are why the variant is `whitespace-normal`.
- **`/design`.** The token swatches (`:111-112`), the variants table and its hover mirror (`:187`), `offlineAction` (`:195-196`), the specimens listed in §1, and the tile specimens (`:1861-1905`). These rely on `Tile`'s root being the `<a>`: depth selectors `*:bg-accent` and `*:*:bg-accent` at `:604-608`. Changing only the cue chip leaves them intact.
- **Docs.** The CLAUDE.md "Clickables" bullet (`CLAUDE.md:99`; `AGENTS.md` is a symlink to `CLAUDE.md`, so one edit covers both) and the "Gear cards" bullet (Manage as an `action` link). Code comments: `button.tsx:8-15`, `tile.ts:22-25`, `BackLink.astro:7`, `SkyAnswerForm.astro`, `global.css:543-549`, `contrast.test.ts:121-123`.

### 7. S-07 sky-events

Read only, from `.claude/worktrees/sky-events` at c050bd2. `git diff 172c0cf -- src` shows no new `variant: "action"`, `TILE_CUE_CLASS`, `action-*` token or `text-primary-strong` emphasis.

- `EventsTile.astro:24` renders a `Tile`, so it gets the bare arrow with the rest.
- `EventsPageContent.astro:48` builds an `inlineLink` from the `link` variant.
- The plan's implementation starts after S-07 merges, so the change rebases onto main with S-07 and re-checks the dashboard's six tiles and `/tonight/events` in its screenshots.

## Code References

- `src/components/ui/button.tsx:17,21-27,39-40,72`: `RESTING_BORDER_CLASS`, the base, the `action` variant, the export.
- `src/components/ui/tile.ts:22-26`: `TILE_CUE_CLASS`. `src/components/ui/Tile.astro:9,29-31`: the arrow chip.
- `src/components/ui/BackLink.astro:20`, `src/components/ui/Pager.astro:24`.
- `src/components/tonight/TargetDetails.astro:40-41,63-76`; `ObjectDetails.astro:50,55`; `PlanetCard.astro:56`; `MoonCard.astro:33,49,88,98`; `GearCard.astro:73`.
- `src/pages/gear/index.astro:92-97`; `src/pages/log/index.astro:71,75`; `src/pages/log/progress.astro:77`; `src/pages/auth/confirm-email.astro:23`; `src/components/progress/MilestoneCelebration.astro:37,74,87`.
- `src/components/sky-checks/SkyAnswerForm.astro:5,38,56-57`.
- `src/styles/global.css:8-14` (custom variants), `:41-42,96-97,150-151,194-195` (action tokens), `:543-562` (offline), `:662-663` (`@theme`).
- `src/styles/contrast.test.ts:1-12,46-50,121-130`; `src/styles/red-theme.test.ts:45-65`; `src/styles/no-hardcoded-colors.test.ts:25-77`.
- `src/pages/design.astro:111-112,187-196,604-608,709,816-900,994-1075,1715-1773,1861-1905`.
- `tests/e2e/tonight-phone.spec.ts:60-130`, `tests/e2e/tonight-dashboard.spec.ts:62`, `tests/e2e/helpers.ts:211-219`.

## Architecture Insights

- Views call `buttonVariants(...)` directly on `<a>` (no `cn` merge inside cva), so two padding utilities on one element (`px-3` from `size: "sm"` and a variant's `px-0`) both apply, and CSS order decides.
  - A text action that should align with the text column needs its own size, or the padding expressed only in one place, not a variant that fights the size.
- The tokens are the contract. A retired token needs its contrast rows, the `/design` swatches, the red value and the `@theme` mapping removed together.
- Keeping `--action-surface` and `--action-border` for the sky-check answers and the medallion avoids touching the red-mode "suggested answer" distinction (ui-user-adjustments impl review F1). Only the buttons stop using them.
- The offline look is a CSS rule keyed on `data-needs-network`, not a variant. A borderless variant gets muted ink only, by the rule's own comment.

## Historical Context (from prior changes)

- `context/archive/2026-10-08-ui-user-adjustments/change.md:40`: the owner's complaint that created `action`. Quote: "The Mark observed button doesn't look clickable; make it stand out more. Anything clickable, link or button, needs to be more differentiated from the rest, in both light and dark theme." The owner now finds the result too loud (ui-refine), and decision 1 (3C) supersedes "every standalone clickable is an `action` box".
- `…/ui-user-adjustments/plan-brief.md:45,56,66`: "Clickables carry a border, a tinted fill, an icon and the link colour"; the user's rule, with red mode relying on shape. The red-mode-relies-on-shape part still holds and is the reason for the red underline and hairline-token questions below.
- `…/ui-user-adjustments/research.md:34,320,417`: red has one hue (`primary`, `primary-strong`, `heading` all `#ff0000`), so affordance must come from shape. At most one `default` action per screen.
- `…/ui-user-adjustments/reviews/plan-review.md:54,83-84`:
  - `color-mix` fills were rejected because the contrast test skips them.
  - Skip and All stay `link`, so they don't outrank the answers.
  - `whitespace-nowrap` would break the long Polish washed-out link.
- `…/ui-user-adjustments/follow-ups/review-fixes.md:8-16` and `reviews/impl-review-phase-1.md:35-78`:
  - The hover keeps the fill and moves the cue to the border and an underline, because `bg-accent` hover measured about 1.00:1 against the fill in red.
  - The suggested sky-check answer gets `border-2` plus the action fill.
  - The rule was applied to every standalone clickable ("apply all").
- `context/archive/2026-10-07-ui-mobile-pass/plan.md:164`: the tile cue started as a bare `ArrowRight`. ui-user-adjustments boxed it (`plan.md:168`, plan-review F3). 3C returns it to bare, and the whole row stays the 44 px link with hover and focus (`tile.ts:9-15`).
- `context/archive/2026-09-28-red-night-mode/reviews/impl-review.md:34-40`: the owner kept 44 px targets over 40 px for cold fingers outdoors.
- `context/archive/2026-10-05-offline-night-plan/plan.md:282-284`: offline controls look disabled, get `aria-disabled` and a "Needs a connection" description, and focus stays visible.
- `context/archive/2026-10-08-ui-user-adjustments/reviews/plan-review.md:57` and `handoff.md:78`: the dashed rule covers `a` as well as `button`.

## Related Research

- `context/changes/ui-refine/audit.md`: findings 1 and 3, directions 3A, 3B and 3C, owner decisions.
- `context/archive/2026-10-08-ui-user-adjustments/research.md`: where `action` came from.

## Open Questions

These are for the plan. Questions 1 and 2 are product and UI choices for the owner.

1. **Hairline colour.** Experiment B's neutral `--border` hairline is below 3:1 everywhere (1.17 in red). Options:
   - a new neutral token at ≥3:1 on background and surface (a little more visible than the experiment, still grey);
   - reuse `--action-border` (blue-ish, already pinned, louder);
   - accept the faint `--border` (quietest, but in red "Mark observed" reads as text).
2. **Red-mode text actions.** In red, link colour equals body colour, so a text action is told apart by icon and weight only. Options:
   - a resting underline in red only, through a new `red:` custom variant;
   - a resting underline everywhere;
   - accept icon plus weight.
3. **Variant naming and migration.** The choice is between restyling `action` in place (12 call sites keep compiling, and the old name now means "text action") and replacing it with explicit `quiet` (text) and `hairline` variants, removing `action` so every call site is migrated deliberately. The text action also needs zero horizontal padding without fighting `size: "sm"` (see Architecture Insights). This is a technical choice for the plan.
4. **Tokens kept or retired.** `--action-surface` and `--action-border` remain needed by `SkyAnswerForm` and the milestone medallion if those stay as they are. Retiring them would widen the change into the sky-check answers' red-mode distinction. This is a technical choice for the plan, and keeping them is the smaller change.
