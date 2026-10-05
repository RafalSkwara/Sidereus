# Tonight's night skies in the light theme, and the panorama's pan cue: Implementation Plan

## Overview

In the light theme, Tonight's skies keep a night sky: a slightly brighter navy than the dark theme, with light inks, so the stars, labels and markers show. The other views' sky headers stay pale. The live panorama gets two edge chevron buttons that show it scrolls and pan it. Charges C1–C4 are in `research.md`.

## Current State Analysis

- The light theme has one sky token set. `--zenith`/`--horizon` (`global.css:81-82`) paint both the Tonight bands and every `PageHeader` sky, and the stars are switched off by theme (`hidden dark:block`, `TonightSky.astro:50`, `TonightSkyView.tsx:319`).
- On sky-flow pages the Topbar sits on a `bg-zenith` strip (`GearShell.astro:27`), which the band continues. Navy under the Topbar therefore needs light Topbar inks, and the settings popover (`TopbarControls.tsx:158`) must keep the page's own tokens.
- Derived tokens recompute only on `:root, [data-theme]` (`global.css:148`).
- The silhouette is `fill-background`, so the ground must stay the page colour.
- The panorama scroller (`TonightSkyView.tsx:284-293`) has no affordance besides a thin, often-hidden scrollbar.

## Desired End State

- **Light theme, Tonight pages:** `/tonight`, its skeleton, `/tonight/{targets,moon,planets,nights}` and the no-view states draw a navy sky from the Topbar down to the silhouette.
  - The live band shows the star field and star names, with the verdict and markers in light ink.
  - At sunset and in twilight the band turns a navy-world dusk, not pastel.
  - The slider row under the silhouette stays on the light page.
- **Light theme, other views:** gear, log, auth, onboarding and landing are unchanged.
- **Dark and red:** pixel-identical to today, apart from the chevrons.
- **Chevrons:**
  - Each side of the panorama has a chevron button that pans it, named "Scroll the sky left/right" ("Przewiń niebo w lewo/w prawo").
  - A button disappears at its end and both are hidden when the strip doesn't overflow.
  - Focus is visible in all three themes.

### Key Discoveries:

- `color-mix` derived tokens must be re-declared on the scope: `global.css:148`.
- Theme switches set `<html data-theme>` in the page (`TopbarControls.tsx:112`), so a CSS-only scope follows them.
- The contrast test parses blocks by exact selector (`contrast.test.ts:20-23`), so a `[data-theme="light"] .night-sky` block can be read the same way.
- Candidate values were checked numerically (2026-10-05). The scope's muted ink `#b4bccf` reaches ≥ 4.84:1 on every navy and dusk stop; the dark theme's `#a9b1c5` falls to 4.29 on the dusk horizon.

## What We're NOT Doing

- No change to any theme's base tokens, and none to the gear, log, auth, onboarding or landing skies (user decision).
- No change to the dark or red appearance of Tonight.
- No auto-scroll, drag-to-pan or wheel hijacking, and no visible scrollbar.
- No change to `sky-view` maths, labels or markers.
- No Topbar restructure: only its sky-flow strip joins the scope, and the popover keeps the page tokens.

## Implementation Approach

Tokens before views before states (the 10x-ui order).

- One scoped block holds the night sky's light-theme values. It is active only when `<html data-theme="light">` and has no effect in dark or red, so those stay identical.
- The Tonight views opt in with the `night-sky` class.
- Stars switch on a new `night:` variant meaning "dark or red root, or inside a night sky".

## Phase 1: Night-sky tokens

### Overview

Add the scoped night-sky token set, its variant, and the contrast guard for it.

### Changes Required:

#### 1. Scope block, derived tokens, variant

**File**: `src/styles/global.css`

**Intent**:
- Add a `[data-theme="light"] .night-sky` block after the light block. It sets `color-scheme: dark` plus navy `--zenith`, `--horizon`, the four `--dusk-*` and `--surface`, `--border` and `--star`/`--star-accent`, with the dark theme's inks: `--foreground`, `--heading`, `--primary*`, `--go`/`--marginal`/`--no-go` and the verdict alphas.
- Its muted ink is `#b4bccf`.
- `--background` is deliberately left out (the silhouette and the ground).
- Add `.night-sky` to the derived-token selector.
- Add `@custom-variant night` matching a non-light root's descendants or a `.night-sky` descendant.

**Contract**: values (provenance: this change, contrast-checked):
- zenith `#0d1836`, horizon `#263d7a`, surface `#121d3d`, border `#2c3a62`
- dusk-glow `#43304f` / `#6c3a2c`, dusk-twilight `#1d2c5e` / `#34376b`
- star `rgb(255 255 255 / 0.55)`, star-accent `rgb(253 230 138 / 0.3)`

`night:` = `(&:where(:root:not([data-theme="light"]) *, .night-sky, .night-sky *))`.

#### 2. Contrast guard

**File**: `src/styles/contrast.test.ts`

**Intent**: read the scope block as a fourth token map, "night" (light ⊕ scope), and hold it to the dark rows for heading and muted on zenith, horizon and the dusk stops, `primary-foreground` on `primary`, verdict inks on zenith and horizon, and `primary`/`primary-strong` at 3:1 on the stops.

**Contract**: a `Theme` union gains `"night"`; there are new `CHECKS` rows; existing rows are untouched.

### Success Criteria:

#### Automated Verification:

- `npm test` passes, including contrast, red-theme and no-hardcoded-colors
- `npm run lint` and `npx astro check` report 0 errors

#### Manual Verification:

- None (no view reads the scope yet)

---

## Phase 2: Apply the night sky to Tonight

### Overview

Put the Tonight skies and the sky-flow Topbar strip in the scope, and switch the stars to `night:`.

### Changes Required:

#### 1. Sky-flow strip

**File**: `src/components/gear/GearShell.astro`

**Intent**: the `skyFlow` strip wrapping the Topbar gets `night-sky`, so the navy runs unbroken from the top of the page and the Topbar inks turn light.

**Contract**: only the `skyFlow` branch changes; the `skyHeader` and plain branches don't.

#### 2. Settings popover keeps the page tokens

**File**: `src/components/TopbarControls.tsx`

**Intent**: the popover panel carries `data-theme={theme}` (its existing theme state), so inside a night scope it renders with the page theme's tokens through the existing `[data-theme]` blocks.

**Contract**: the attribute on the panel element only. It is a no-op in dark and red, and it follows in-page theme changes because it is state-driven.

#### 3. Static sky opt-in

**Files**: `src/components/tonight/TonightSky.astro` and its Tonight callers: `TonightSkeleton.astro`, `TonightPageSkeleton.astro`, `TonightPageSky.astro`, `TonightContent.astro`, `src/pages/tonight.astro`, `src/pages/design.astro`.

**Intent**:
- A `night` prop, default `false`, adds `night-sky` to the band root.
- The Tonight callers pass it. `Welcome.astro` (landing) does not.
- Stars use `hidden night:block`.

**Contract**: `Props.night?: boolean`. Header comment updated.

#### 4. Live band

**File**: `src/components/tonight/TonightSkyView.tsx`

**Intent**: the `dusk-band` div gets `night-sky`; the star group switches from `hidden dark:block` to `hidden night:block`; the slider row stays outside the scope. The header comment is updated.

**Contract**: class changes only.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint` and `npx astro check` pass
- `tests/e2e/tonight-sky.spec.ts` and `red-night-mode.spec.ts` pass against the local preview

#### Manual Verification:

- Light theme `/tonight` at 390 and 1280: a navy band from the Topbar to the silhouette, stars and names visible, verdict, markers and compass legible, and the slider row on the light ground
- Light theme `/tonight/moon` (page sky plus skeleton): navy, back link legible with visible focus
- Light theme: the settings popover opens on a Tonight page with the light panel
- Dark and red `/tonight` look unchanged; the light `/gear` and `/` headers stay pale

---

## Phase 3: Pan chevrons

### Overview

Two edge buttons that show the panorama scrolls and pan it.

### Changes Required:

#### 1. Buttons and scroll state

**File**: `src/components/tonight/TonightSkyView.tsx`

**Intent**:
- Wrap the scroller and two absolutely positioned buttons (left and right) in a relative container that takes the strip's overlap margin. The buttons are vertically centred on the strip below the overlap, above the verdict's layer.
- Each is a 44 px hit area with a smaller round, token-coloured face: `bg-zenith` at partial opacity, a `border-border` edge and a `text-heading` lucide `ChevronLeft`/`ChevronRight`, with a hover and a `--ring` focus outline.
- A click calls `scrollBy` by 60 % of the viewport, `behavior: "smooth"` unless the user prefers reduced motion.
- An `onScroll` handler, plus the resize and initial centring, keeps `atStart` and `atEnd` state; a button at its end is `invisible`.

**Contract**:
- `data-sky-pan="left|right"` hooks for e2e.
- Names come from `t.panLeft` / `t.panRight`.
- The buttons are `type="button"`, not links.

#### 2. Copy

**Files**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: `tonight.sky.panLeft` / `panRight`: "Scroll the sky left/right", "Przewiń niebo w lewo/w prawo".

**Contract**: two keys appended at the end of `tonight.sky`, the same in both catalogues.

#### 3. Pin

**File**: `tests/e2e/tonight-sky.spec.ts`

**Intent**: one check that clicking the right chevron increases the strip's `scrollLeft`, and that the left one is hidden after scrolling fully left.

**Contract**: appended test; existing tests are untouched.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint` and `npx astro check` pass, including i18n parity
- `tests/e2e/tonight-sky.spec.ts` passes, including the new check

#### Manual Verification:

- At 390 and 1280 in all three themes, the chevrons are visible, don't hide a label at load, and pan
- Each chevron hides at its end
- Keyboard: tab reaches both, Enter pans, and the focus ring is visible

---

## Phase 4: States, gate and rule

### Overview

The kitchen sink, the screenshot evidence and the agent rule.

### Changes Required:

#### 1. Kitchen sink

**File**: `src/pages/design.astro`

**Intent**: the existing Tonight sky specimen passes `night`, so the light theme shows the navy scope.

**Contract**: one prop.

#### 2. Rule

**File**: `CLAUDE.md`

**Intent**: one line in the "Tonight's sky" bullet:
- Tonight's bands and the sky-flow strip sit in the `night-sky` scope, which keeps a navy night in the light theme.
- Stars use `night:`, never `dark:`.
- A new Tonight sky passes `night`.
- The pan chevrons belong to `TonightSkyView`.

**Contract**: extend the existing bullet rather than adding a new one.

### Success Criteria:

#### Automated Verification:

- The full unit suite and the Tonight e2e specs pass
- The hardcoded-value scan on the touched view files has 0 new hits

#### Manual Verification:

- Screenshots: EN/PL × dark/light/red × 390/1280 for `/tonight` and `/tonight/moon`, plus chevron hover, focus and end states, and the light-theme popover
- 7-state matrix for the chevron: default, hover and focus shown; disabled shown as the hidden end state; error and empty N/A (no data dependency); loading is the skeleton's static navy sky

---

## Testing Strategy

### Unit Tests:

- The contrast rows for the night scope (Phase 1).

### Integration Tests:

- The chevron pans the strip (Phase 3).

### Manual Testing Steps:

1. Run the local preview against local Supabase and the forecast fixture; sign up a throwaway user with a site.
2. In light theme, open `/tonight`, then `/tonight/moon`. Check the navy band, the stars, the popover and the chevrons.
3. Repeat in dark and red, and confirm the `/gear` header is still pale in light.

## References

- Research: `context/changes/ui-sky-light/research.md`
- Prior decisions: `context/archive/2026-10-05-interactive-sky/plan-brief.md:39`, `context/archive/2026-10-04-tonight-nightfall/plan.md:222`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Night-sky tokens

#### Automated

- [x] 1.1 `npm test` passes, including contrast, red-theme and no-hardcoded-colors
- [x] 1.2 `npm run lint` and `npx astro check` report 0 errors

### Phase 2: Apply the night sky to Tonight

#### Automated

- [ ] 2.1 `npm test`, `npm run lint` and `npx astro check` pass
- [ ] 2.2 `tests/e2e/tonight-sky.spec.ts` and `red-night-mode.spec.ts` pass against the local preview

#### Manual

- [ ] 2.3 Light theme `/tonight` at 390 and 1280: a navy band from the Topbar to the silhouette, stars and names visible, verdict, markers and compass legible, and the slider row on the light ground
- [ ] 2.4 Light theme `/tonight/moon` (page sky plus skeleton): navy, back link legible with visible focus
- [ ] 2.5 Light theme: the settings popover opens on a Tonight page with the light panel
- [ ] 2.6 Dark and red `/tonight` look unchanged; the light `/gear` and `/` headers stay pale

### Phase 3: Pan chevrons

#### Automated

- [ ] 3.1 `npm test`, `npm run lint` and `npx astro check` pass, including i18n parity
- [ ] 3.2 `tests/e2e/tonight-sky.spec.ts` passes, including the new check

#### Manual

- [ ] 3.3 At 390 and 1280 in all three themes, the chevrons are visible, don't hide a label at load, and pan
- [ ] 3.4 Each chevron hides at its end
- [ ] 3.5 Keyboard: tab reaches both, Enter pans, and the focus ring is visible

### Phase 4: States, gate and rule

#### Automated

- [ ] 4.1 The full unit suite and the Tonight e2e specs pass
- [ ] 4.2 The hardcoded-value scan on the touched view files has 0 new hits

#### Manual

- [ ] 4.3 Screenshots: EN/PL × dark/light/red × 390/1280 for `/tonight` and `/tonight/moon`, plus chevron hover, focus and end states, and the light-theme popover
- [ ] 4.4 7-state matrix for the chevron: default, hover and focus shown; disabled shown as the hidden end state; error and empty N/A (no data dependency); loading is the skeleton's static navy sky
