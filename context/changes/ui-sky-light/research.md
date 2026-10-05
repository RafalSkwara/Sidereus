---
date: 2026-10-05T16:10:00+02:00
researcher: Claude (main session)
git_commit: c7666a9
branch: feat/ui-sky-light
repository: Sidereus
topic: "10x-ui audit: Tonight's skies in the light theme, and the panorama's scroll affordance"
tags: [research, ui, nightfall, tonight, sky-view, tokens]
status: complete
last_updated: 2026-10-05
last_updated_by: Claude (main session)
---

# Research: Tonight's skies in the light theme, and the panorama's scroll affordance

**Date**: 2026-10-05T16:10:00+02:00 · **Git Commit**: c7666a9 (origin/main after #102) · **Branch**: feat/ui-sky-light

## Research Question

User report (2026-10-05): in the light theme the live sky's stars are invisible; the sky depicts night, so even in light it should stay navy (a bit brighter than dark), which makes every object visible again. And the horizontally scrolling panorama has no visual cue that it scrolls (the scrollbar is hidden, which is right), so add an unobtrusive cue such as chevron buttons at the sides.

User decisions (AskUserQuestion, 2026-10-05):
- **Scope:** Tonight skies only — the live sky on `/tonight`, its skeleton, and the `/tonight/*` page skies. Gear, log, auth, onboarding and landing keep their pale light-theme headers.
- **Cue:** edge chevron buttons (one per side, vertically centred on the panorama, pan about half a viewport, each hides at its end, keyboard-focusable and named).

## Summary

The light theme paints Tonight's sky from the same pale `--zenith`/`--horizon` stops as every sky header, and hides the stars outright by CSS. Nothing lets one view keep a night sky while the others stay pale: the light theme has a single sky token set. The fix is a scoped token set (`.night-sky`, active only under `[data-theme="light"]`) holding a slightly brighter navy and the dark theme's inks, applied to the Tonight bands and the sky-flow Topbar strip, plus a `night:` variant for the stars. The panorama's only scroll cue is a thin token-coloured scrollbar that overlay-scrollbar platforms (macOS, iOS, Android) hide until scrolling starts.

## Charges

| # | Category | Evidence | Effect on the user |
|---|---|---|---|
| C1 | Missing tokens | Light `--zenith: #a9c3e6` / `--horizon: #e9f0f8` (`src/styles/global.css:81-82`) and `--star: rgb(22 27 43 / 0.16)` (`:91`) feed the live band's `dusk-band` gradient (`global.css:318-337`) and the static `TonightSky` (`src/components/tonight/TonightSky.astro:49`). | In the light theme Tonight's sky is a pale day-blue band: it no longer reads as the night the verdict is about, and the faint ink stars would not show on it even if drawn. |
| C2 | Accidental architecture | Stars are switched off by theme, not by sky: `hidden dark:block` in `TonightSky.astro:50` and `TonightSkyView.tsx:319` (`dark:` = "root not light", `global.css:8`). Decided in tonight-nightfall (`context/archive/2026-10-04-tonight-nightfall/plan.md:222`) and kept by interactive-sky (`context/archive/2026-10-05-interactive-sky/plan-brief.md:39`). | A light-theme user loses the whole star field of the live sky: 925 catalogue stars and their names (`TonightSkyView.tsx:319-335`). Only the target, planet and Moon markers remain, on a sky that looks empty. |
| C3 | Missing tokens (scope) | One sky token set per theme: the sky-flow strip behind the Topbar is `bg-zenith` (`src/components/gear/GearShell.astro:27`), the sky header of every other page is `from-zenith to-horizon` (`GearShell.astro:33`), and the Topbar and its settings popover (`src/components/TopbarControls.tsx:158`) read the page inks. | Turning Tonight's sky navy by changing the light tokens would repaint the five views just redone (#102–#105). Changing only the band would open a pale-to-navy seam under the Topbar, and leave the light theme's dark inks (verdict, back link, labels, Topbar) unreadable on navy. |
| C4 | Missing shared affordance | The panorama scroller (`TonightSkyView.tsx:284-293`) is `overflow-x-auto` with `scrollbar-strip` (`global.css:307-310`, thin, `--border` thumb). It has no button, edge cue or hint. | On a desktop with a mouse, or any platform with overlay scrollbars, nothing shows that the sky continues beyond the visible ~390–1280 px. Users see one slice of the horizon and miss the targets and planets placed elsewhere. |

All four charges are in scope; none deferred.

## Detailed Findings

### Tokens and scopes (`src/styles/global.css`)
- Base colours sit in three blocks: `:root` (dark, `:19-61`), `[data-theme="light"]` (`:63-100`) and `[data-theme="red"]` (`:106-140`).
- Derived tokens (`--accent`, `--ring`, `--selected`, verdict surfaces and others) are declared on `:root, [data-theme]` (`:148-175`), "so a nested [data-theme] block gets its own derived colours". A new scope must join that selector, or its derived tokens keep the root's resolved values.
- The `dusk-band` utility (`:318-337`) mixes `--zenith`/`--horizon` with the four `--dusk-*` tokens. A scope that overrides those six tokens repaints the live band at every Sun altitude.
- The horizon silhouette is `fill-background` (`src/components/tonight/sky-band.ts`, `SILHOUETTE_CLASS`). A night scope must **not** override `--background`, or the ground would turn navy too.

### Where Tonight's skies render
- **`TonightSky.astro` callers:**
  - `TonightSkeleton.astro:27`
  - `TonightPageSkeleton.astro:35`
  - `TonightPageSky.astro:26`
  - `TonightContent.astro:129`
  - `src/pages/tonight.astro:48`
  - `src/pages/design.astro:1286` (the specimen)
  - `src/components/Welcome.astro:45`, the landing page, which stays pale by the user's decision.
- **`TonightSkyView.tsx`:**
  - The band is the `dusk-band` div at `:271`.
  - The slider row (`:405-470`) sits on the page ground below the silhouette and keeps the page tokens.
- **The sky-flow Topbar strip** is `GearShell.astro:26-31`. Of the inspected pages, only `src/pages/tonight.astro` and `src/pages/tonight/{targets,moon,planets,nights}.astro` use `skyFlow`.

### Theme switching
- `TopbarControls` sets `document.documentElement.dataset.theme` in the page (`TopbarControls.tsx:112`), so a scope keyed on `[data-theme="light"] .night-sky` follows an in-page theme switch with no reload.
- The settings popover renders inside the Topbar (`:158`). Inside a night scope it would inherit the navy inks. Giving the panel its own `data-theme={theme}` brings back the page tokens through the existing `[data-theme]` blocks.

### Contrast guard
- `src/styles/contrast.test.ts:15-40` reads each base block's hex tokens through a `blocks(selector)` regex, then checks `CHECKS` pairs (`:62-89`).
- A night scope block can be read the same way, as a fourth "light-night" token map (dark ⊕ light ⊕ scope), with the zenith/horizon/dusk rows applied to it.

## Architecture Insights
- **Existing design system** (Nightfall). This change extends it: one scope block, one variant, one derived-selector addition. No new palette and no change to any theme's base tokens.
- `lucide-react` (`package.json:42`) is already in use for icons (for example `CircleAlert` in `LocationPicker`, ui-onboarding), so the chevrons come from it.

## Historical Context
- `context/archive/2026-10-04-tonight-nightfall/plan.md:222`: the stars were hidden in the light theme "as in the design". This change reverses that, for Tonight skies only, at the user's request.
- `context/archive/2026-10-05-interactive-sky/plan-brief.md:39`: the stars stayed hidden through the CSS rule so an in-page theme switch is honoured. The new `night:` variant keeps the switch CSS-only.

## Open Questions
None blocking. The exact navy values are a visual call for the user to judge in the PR. Their floor is the contrast test.
