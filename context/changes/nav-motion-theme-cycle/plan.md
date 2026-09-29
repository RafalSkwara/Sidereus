# Nav Motion and Theme Cycle Implementation Plan

## Overview

Two user follow-ups to top-nav-redesign:

1. **Theme cycle.** The top-bar eye button becomes a theme button that cycles **Dark → Light → Red** and shows the current theme's icon, because a red-only toggle was unclear.
2. **Sliding indicator.** Switching pages animates the active indicator:
   - Desktop: the amber pill segment glides from the old page's segment to the new one.
   - Phone: a short amber bar glides along the top of the tab bar, and the new tab's icon bounces.
   - Both squeeze slightly on press.

## Current State Analysis

- `src/components/TopbarControls.tsx`:
  - Eye button: `aria-pressed` = red; `chooseTheme(theme === "red" ? returnTheme : "red")`.
  - The return theme comes from the `sidereus-theme-return` cookie (`RETURN_THEME_COOKIE`, `resolveReturnTheme`, type `ReturnTheme` in `src/lib/preferences.ts`), read in `Topbar.astro` and passed as the `returnTheme` prop.
  - The settings popover has a Dark / Light / Red segmented control sharing the same state.
- `THEMES = ["dark", "light", "red"]` (`preferences.ts:5`) is already in the requested cycle order.
- Pill segments: `Topbar.astro`, links with `bg-selected` on the current one, `transition-[background-color,color] duration-150`, icon lift on hover.
- Tab bar: `TabBar.astro`, current tab `font-semibold text-heading` with a `text-primary` icon.
- Every navigation is a full page load (no client router), so any "inactive → active" motion has to span two documents. Cross-document View Transitions (`@view-transition { navigation: auto; }`, Chrome 126+, Safari 18.2+) do exactly this with CSS alone. Browsers without them switch instantly.
- E2E: `tests/e2e/red-night-mode.spec.ts` drives the eye as a red toggle and checks the return-theme cookie. `top-nav.spec.ts` doesn't touch the eye.

## Desired End State

- **Eye → theme button.** Its icon is the current theme (moon / sun / eye), and its accessible name says the current theme and the next one ("Theme: Dark. Switch to Light."). Tapping cycles dark → light → red → dark with no reload, remembered in `sidereus-theme`. The settings control stays in sync.
- **Return-theme cookie removed.** The `sidereus-theme-return` code is gone. A cookie left in existing browsers is ignored.
- **Desktop page change** (Chrome/Safari): the filled amber segment slides and resizes from the previous page's segment to the new one in about 250 ms. The rest of the page swaps instantly.
- **Phone page change:** a 2 px amber bar on top of the current tab glides to the new tab, and the new tab's icon bounces once (scale ≈0.8 → 1.12 → 1).
- **Press feedback:** pill segments and tabs scale to about 0.96 while pressed, in every browser.
- **Reduced motion:** navigation transitions are off, and press scale and hover lift don't animate.

### Key Discoveries:

- `THEMES` order already equals the requested cycle, so `nextTheme` is index + 1, wrapping.
- In a view transition, named elements are hidden in the live page and drawn as snapshots above it. So naming the whole current segment gives the classic "moving pill" (label cross-fades while it slides). A separate unlabelled indicator would cover the labels mid-flight instead.
- The tab icon bounce must not pair old and new icons (that would make the icon fly across). A shared `view-transition-class: tab-icon` with per-tab names (`tab-icon-tonight`, …) gives the new icon its own entry animation instead.

## What We're NOT Doing

- A client-side router or SPA transitions.
- Page-content transitions: the root snapshot swaps with no animation.
- A JavaScript fallback animation for Firefox.
- Changing the settings popover's theme control or the language control.

## Implementation Approach

Two phases. Phase 1 is the theme cycle, test-first on a pure `nextTheme`. Phase 2 is the motion (CSS view transitions plus press feedback) with visual verification.

Delegated decisions (agent; open to challenge in review):
- Accessible name via a new parameterised message `preferences.cycle({ current, next })`. `aria-pressed` is dropped, since the button is no longer a toggle.
- The page root swaps without a cross-fade (`::view-transition-old/new(root) { animation: none }`), so only the indicator moves.
- Animation: 250 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`; icon bounce 320 ms.
- The mobile indicator is a new visual element: a 2 px × 32 px amber bar at the top edge of the current tab.

## Phase 1: Theme cycle

### Changes Required:

#### 1. Cycle rule

**File**: `src/lib/preferences.ts`, `src/lib/preferences.test.ts`

**Intent**: One pure rule for the eye button's next theme; the return-theme machinery goes.

**Contract**: `nextTheme(theme: Theme): Theme` gives dark → light, light → red, red → dark. Remove `RETURN_THEME_COOKIE`, `ReturnTheme` and `resolveReturnTheme` (and their tests); `preferenceCookie` names only the theme and locale cookies again.

#### 2. Theme button

**File**: `src/components/TopbarControls.tsx`, `src/components/Topbar.astro`, `src/pages/design.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: The eye button becomes the theme button: it shows the current theme's icon and cycles on tap. The settings control keeps sharing the same state.

**Contract**:
- `TopbarControls` props lose `returnTheme`.
- The button's icon is Moon / Sun / RedEye for the current theme.
- `aria-label = preferences.cycle({ current, next })`, using the short theme names in lower case, per locale. EN: "Theme: Dark. Switch to Light." PL: "Motyw: ciemny. Przełącz na jasny."
- `onClick = chooseTheme(nextTheme(theme))`.
- `Topbar.astro` and `design.astro` stop passing `returnTheme`.

#### 3. E2E

**File**: `tests/e2e/red-night-mode.spec.ts`

**Intent**: Pin the cycle and red mode's guarantees.

**Contract**:
- Start dark; tap → light; tap → red.
- Reload keeps red, with zero green/blue on the body background and the red-only image filter.
- Tap → dark.
- The settings control reflects each state, and picking Red in settings then tapping the button → dark.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including `nextTheme` and i18n parity: `npm test`
- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- `red-night-mode` e2e passes on a local preview: `BASE_URL=http://localhost:4321 npx playwright test red-night-mode`

#### Manual Verification:

- The button's icon matches the current theme in all three themes, EN and PL, and its accessible name reads the current and next theme.

---

## Phase 2: Sliding indicator and press feedback

### Changes Required:

#### 1. Cross-document view transitions

**File**: `src/styles/global.css`

**Intent**: Turn on same-origin cross-document view transitions, swap the page root instantly, and style the named navigation elements.

**Contract**:
- `@view-transition { navigation: auto; }`, disabled under `prefers-reduced-motion: reduce`.
- `::view-transition-old(root)` and `::view-transition-new(root)` get `animation: none`.
- `::view-transition-group(nav-current)` and `::view-transition-group(tab-current)` animate over 250 ms with `cubic-bezier(0.2, 0.8, 0.2, 1)`; their old/new images use `height: 100%` so the label doesn't stretch.
- `::view-transition-new(.tab-icon)` runs a 320 ms bounce keyframe; `::view-transition-old(.tab-icon)` has no animation.

#### 2. Named elements and press feedback

**File**: `src/components/Topbar.astro`, `src/components/TabBar.astro`

**Intent**: Give the moving parts their transition names, add the mobile indicator bar, and squeeze on press.

**Contract**:
- Pill: the current segment gets `[view-transition-name:nav-current]`. All segments get `active:scale-[0.96]` with transform in the transition list (none under reduced motion).
- Tab bar: the current tab renders an absolutely positioned 2 × 32 px `bg-primary` bar at its top edge named `tab-current`, and its icon gets `[view-transition-name:tab-icon-<name>]` and `[view-transition-class:tab-icon]`. Tabs get `active:scale-[0.96]`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- Full e2e suite passes in parallel: `BASE_URL=http://localhost:4321 npx playwright test --workers 5`

#### Manual Verification:

- In Chromium, frames captured mid-transition show the pill segment between the old and new positions (desktop), and the tab bar indicator between tabs with the new icon scaling (phone).
- With reduced motion, a page change shows no intermediate frame.
- WebKit switches pages correctly.
- The user reviews the motion.

---

## Testing Strategy

### Unit Tests:

- `nextTheme` for all three themes; i18n parity for `preferences.cycle`.

### Integration Tests:

- `red-night-mode.spec.ts`: the full cycle, red persistence and guarantees, sync with the settings control.
- `top-nav.spec.ts` / full suite: navigation unchanged functionally.

### Manual Testing Steps:

1. Chromium: click Tonight → Log on desktop and phone widths, and capture frames about 120 ms into the transition.
2. Same with reduced motion: no intermediate frame.
3. WebKit: navigation works.

## Performance Considerations

View transitions snapshot only the named elements plus the root; there's no script and no layout work beyond the navigation itself.

## Migration Notes

The obsolete `sidereus-theme-return` cookie may linger in browsers that used the previous build; nothing reads it. No database change.

## References

- Previous change: `context/changes/top-nav-redesign/` (plan phases 1–3)
- `src/components/TopbarControls.tsx`, `src/components/Topbar.astro`, `src/components/TabBar.astro`, `src/lib/preferences.ts`
- MDN: Cross-document view transitions (`@view-transition`), `view-transition-class`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Theme cycle

#### Automated

- [x] 1.1 Unit tests pass, including `nextTheme` and i18n parity — dfbb2cb
- [x] 1.2 Type check passes — dfbb2cb
- [x] 1.3 Lint passes — dfbb2cb
- [x] 1.4 Production build succeeds — dfbb2cb
- [x] 1.5 `red-night-mode` e2e passes on a local preview — dfbb2cb

#### Manual

- [x] 1.6 Button icon and accessible name match the current theme in all themes and languages — dfbb2cb

### Phase 2: Sliding indicator and press feedback

#### Automated

- [x] 2.1 Unit tests pass — 8c19608
- [x] 2.2 Type check passes — 8c19608
- [x] 2.3 Lint passes — 8c19608
- [x] 2.4 Production build succeeds — 8c19608
- [x] 2.5 Full e2e suite passes in parallel — 8c19608

#### Manual

- [x] 2.6 Mid-transition frames show the indicator between positions (desktop pill, phone tab bar with icon bounce) — 8c19608
- [x] 2.7 Reduced motion shows no intermediate frame; WebKit switches pages correctly — 8c19608
- [ ] 2.8 The user reviews the motion
