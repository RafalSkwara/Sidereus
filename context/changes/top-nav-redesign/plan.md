# Top Navigation Redesign Implementation Plan

## Overview

Replace the 11-item, multi-row top bar with direction **A** from the design board (https://claude.ai/artifact/VBMVqSE9846VQhhUjtjKTv).

- **Phones:** a single slim top bar (name, a one-tap red-mode eye, a settings button) and a bottom tab bar for Tonight, Log and My gear.
- **Wider screens:** one row with inline links.
- **Settings:** theme, language, who is signed in and Sign out move into a settings popover (a bottom sheet on phones).
- **Removed:** the "Welcome!" pill.

## Current State Analysis

Framing lives in `change.md` (### Framing). The measured problem: the signed-in header is 169 px tall at 360/390 px (4 rows), 88 px at 768 px and one 46 px row only from 1024 px. Signed out it's 135 px on phones. The bar holds 11 items at equal weight.

- `src/components/Topbar.astro:1-66`: brand; signed-in links Tonight/Log/My gear with `aria-current`; the "Welcome!" pill (`m.nav.welcome`); a Sign out POST form; the `PreferenceSwitches` island (signed out: Sign in + switches).
- `src/components/PreferenceSwitches.tsx`: theme group (moon/sun/red eye, S-10) and EN/PL group. Theme changes set `<html data-theme>` plus a cookie with no reload; language sets a cookie and reloads. It has wrapped since S-10.
- `src/lib/preferences.ts`: `THEMES`, `THEME_COOKIE`, `LOCALE_COOKIE`, `preferenceCookie()`. Island-safe.
- Shells: `src/components/gear/GearShell.astro` (Tonight, Log, Gear, **Onboarding**), `src/components/AuthShell.astro` (sign-in, sign-up, confirm-email), `src/components/Welcome.astro` (landing). Each renders `<Topbar />` in a `max-w-5xl` container.
- `src/pages/design.astro:115` renders `PreferenceSwitches` on the dev token page.
- E2E tests touching the bar:
  - `sign-in-continue.spec.ts:16` clicks the Sign out button.
  - `red-night-mode.spec.ts:17-41` uses the theme group and its buttons.
  - `observation-log-management.spec.ts:75` clicks the "Log" link.

## Desired End State

- **Phones (below the `sm` breakpoint, 640 px):**
  - The top bar is one row of 64 px or less: star + name, eye button, settings button. Signed out it also has a Sign in link.
  - Signed in, except on `/onboarding`, a fixed bottom tab bar shows Tonight / Log / My gear with icons and labels. The current page is marked with `aria-current="page"`. It sits above the phone's safe area, and pages keep room for it so no content hides behind it.
- **`sm` and up:** one row with name, inline links (current one underlined), eye and settings. No tab bar.
- **Eye button:** toggles red mode. Turning red off returns to the theme in use before red (dark or light), remembered on the device.
- **Settings button:** opens a native popover with:
  - "Signed in as <email>" (signed in only)
  - Theme (Dark / Light / Red)
  - Language (English / Polski)
  - Sign out (signed in only)

  It is a bottom sheet on phones and a panel under the button on wider screens. Esc or a tap outside closes it and focus returns to the button. It opens even before React hydrates.
- **Pill:** the "Welcome!" pill is gone.
- **Measured at 360, 390, 768 and 1280 px, in EN and PL, in all three themes:** no horizontal overflow, header height ≤ 64 px, and red mode still passes the red-only pixel audit.

### Key Discoveries:

- The native Popover API (`popover` + `popovertarget`) gives open without JS, light dismiss, Esc and focus return. So no dialog library and no new dependency (only `src/components/ui/button.tsx` exists from shadcn).
- The eye and the settings theme control must share one state. Otherwise tapping the eye leaves the settings segment stale. So both live in one island.
- `getByRole` ignores `display:none` elements, so rendering inline links (hidden below `sm`) and tabs (hidden from `sm`) side by side keeps exactly one visible "Log" link per width for the existing e2e spec.
- Lessons: the Tonight island needs JS (lesson 3). The nav is outside that island. Sign out stays a plain form inside the popover, which opens without JS, so signing out works before hydration.

## What We're NOT Doing

- Directions B and C from the board.
- Hiding the bar on scroll, or any animation beyond the popover's open state.
- CSS anchor positioning for the desktop panel (patchy browser support). The panel is fixed to the top-right under the bar.
- A no-JS fallback for theme or language changes (they need a script, as today).
- Showing tabs on signed-out pages or during onboarding.
- Changing the page content layouts below the bar.

## Implementation Approach

Two phases. Phase 1 builds the new top bar and settings (usable at every width, still without tabs). Phase 2 adds the phone tab bar, the room it needs, and the full visual and e2e verification.

Delegated decisions (user chose "2 questions, rest delegated"; the agent decided these, open to challenge in plan review):
- **Breakpoint:** Tailwind `sm` (640 px) splits the phone and wide layouts. At 640 px the one-row bar fits even in PL (about 520 px of content).
- **Settings mechanics:** native popover, rendered inside the controls island, so it is server-rendered HTML that works before hydration.
- **Return theme:** a new device cookie `sidereus-theme-return` (`dark` | `light`, default `dark`, never `red`). It is written whenever red turns on (from the eye or from settings) and whenever dark or light is chosen.
- **Tabs hidden on `/onboarding`**, and on every signed-out page.
- **Settings trigger:** a sliders icon with an accessible label "Settings" / "Ustawienia". The settings content reuses the existing segment styling.
- **Icons:** inline SVG like the existing moon/sun/eye (tonight: moon with sparkle; log: notebook; gear: telescope), with no icon dependency added.

## Phase 1: One-row top bar with eye toggle and settings popover

### Overview

From `sm` up the bar becomes one row, with the Welcome pill removed and preferences and Sign out moved into a settings popover. Phones keep the inline links in this phase, so their bar can still wrap (name + 3 PL links + 2 buttons ≈ 470 px). Their final one-row shape lands with the tab bar in phase 2, in the same PR, so the wrap is never deployed.

### Changes Required:

#### 1. Return-theme preference

**File**: `src/lib/preferences.ts`, `src/lib/preferences.test.ts`

**Intent**: Remember which theme to go back to when red mode is turned off.

**Contract**: `RETURN_THEME_COOKIE = "sidereus-theme-return"`; `resolveReturnTheme(cookie?: string): "dark" | "light"`, which returns `light` only for `"light"` and `dark` for everything else, `"red"` included. `preferenceCookie()` accepts the new cookie name. Tests: valid values, `red` → `dark`, missing/invalid → `dark`.

#### 2. Top bar controls island

**File**: `src/components/TopbarControls.tsx` (new; replaces `src/components/PreferenceSwitches.tsx`, which is deleted)

**Intent**: One island owns theme state for both the eye button and the settings theme control, plus the language choice and the settings popover.

**Contract**: props `{ theme: Theme; returnTheme: "dark" | "light"; locale: Locale; email: string | null }`.
- **Eye button:** `aria-pressed` = red; label `preferences.red`. Tapping it switches to red and writes the return cookie with the current theme, or switches back to `returnTheme`.
- **Settings button:** `popovertarget` pointing at the popover; label `nav.settings`; `aria-haspopup="dialog"`.
- **Popover** (`popover="auto"`, `role="dialog"`, `aria-label` = `nav.settings`):
  - "Signed in as" + email when `email` is set
  - Theme segmented control (Dark / Light / Red, labelled, same state as the eye)
  - Language segmented control (English / Polski, reloads as today)
  - When signed in, a plain `<form method="POST" action="/api/auth/signout">` Sign out button
- **Layout by width:** below `sm` the popover is a bottom sheet (full width, rounded top, safe-area bottom padding, `::backdrop` dim). From `sm` it is a fixed panel under the bar at the top right. Token colours only.

#### 3. Top bar

**File**: `src/components/Topbar.astro`

**Intent**: One row: brand, then (signed in) inline Tonight/Log/My gear links, then (signed out) the Sign in link, then `TopbarControls`. The Welcome pill is removed. The top bar reads the return-theme cookie and the user's email for the island.

**Contract**: the existing `navState()` / `aria-current` logic is kept, and the links sit in `<nav aria-label={m.nav.primary}>`. `Astro.locals.user?.email` and `resolveReturnTheme(Astro.cookies.get(RETURN_THEME_COOKIE)?.value)` are passed to the island.

#### 4. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Contract**: remove `nav.welcome`; add `nav.settings` ("Settings" / "Ustawienia"), `nav.primary` ("Main" / "Główna nawigacja"), `nav.signedInAs` ("Signed in as" / "Zalogowano jako"). Reuse `preferences.*` for the controls.

#### 5. Dev token page and e2e tests

**File**: `src/pages/design.astro`, `tests/e2e/helpers.ts`, `tests/e2e/sign-in-continue.spec.ts`, `tests/e2e/red-night-mode.spec.ts`

**Intent**: Keep the dev page and the existing specs working with the new controls.

**Contract**:
- `design.astro` renders `TopbarControls` instead of `PreferenceSwitches`.
- New helper `signOut(page)` opens settings and submits Sign out, and `sign-in-continue` uses it.
- `red-night-mode` covers two paths:
  - Eye on → red; reload keeps red; eye off → dark (the return theme).
  - Choosing Light in settings, then eye on and off → light.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including `resolveReturnTheme` and i18n parity: `npm test`
- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- Updated e2e specs pass on a local preview: `BASE_URL=http://localhost:4321 npx playwright test red-night-mode sign-in-continue`

#### Manual Verification:

- At 1280 and 768 px (EN, PL; signed in and out) the bar is one row, the settings panel opens under the button, and Esc / an outside click closes it with focus back on the button.
- Sign out works from the popover with JavaScript disabled.

**Implementation Note**: run the manual checks yourself (local preview + Playwright screenshots, per the user's standing instruction) and record the evidence.

---

## Phase 2: Phone tab bar and verification

### Overview

Below `sm` the destinations move to a bottom tab bar, and the whole layout is verified across widths, languages and themes.

### Changes Required:

#### 1. Tab bar

**File**: `src/components/TabBar.astro` (new)

**Intent**: A fixed bottom `<nav aria-label={m.nav.primary}>` with three icon+label links, rendered only when signed in and not on `/onboarding`, hidden from `sm`. A same-height spacer is rendered in flow so page content never sits behind the bar.

**Contract**:
- `sm:hidden` on both the bar and the spacer.
- Height 64 px plus `env(safe-area-inset-bottom)`.
- `aria-current="page"` on the active tab, using the same whole-segment matching as `navState`.
- Token colours; the active tab uses `text-heading` with a `text-primary` icon.

#### 2. Shell wiring and phone top bar

**File**: `src/components/gear/GearShell.astro`, `src/components/AuthShell.astro`, `src/components/Welcome.astro`, `src/components/Topbar.astro`

**Intent**: Every shell renders `<TabBar />` after its main content. The inline links in `Topbar.astro` become `hidden sm:flex`, so phones show only name + controls. `Layout.astro` gains `viewport-fit=cover` in the viewport meta so safe-area insets apply.

**Contract**: no page file changes. The shells own the tab bar.

#### 3. E2E spec for the navigation

**File**: `tests/e2e/top-nav.spec.ts` (new)

**Intent**: Pin the responsive behaviour that the screenshot checks describe, so a later change can't quietly bring back the tall bar.

**Contract**:
- At 390 px, signed in: header height ≤ 64 px; the tab bar is visible with 3 links; tapping Log navigates to `/log` with that tab `aria-current`; `document.documentElement.scrollWidth` ≤ 390; the settings sheet opens from the settings button and Esc closes it.
- At 1280 px: the tab bar is not visible, and the inline links are.
- Signed out at 390 px: no tab bar, and a Sign in link.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- Full e2e suite passes in parallel: `BASE_URL=http://localhost:4321 npx playwright test --workers 5`

#### Manual Verification:

- Screenshots at 360, 390, 768 and 1280 px, EN/PL, dark/light/red, signed in and out, plus the sheet open on a phone: every header ≤ 64 px, no horizontal overflow (scrollWidth check), and the last element of Tonight, Log and Gear is visible above the tab bar when scrolled to the bottom.
- The red-mode pixel audit (no green or blue channel above 8) passes on every page and with the settings sheet open.
- The user reviews the before/after top bars (links to screenshots in the PR).

**Implementation Note**: run these checks yourself and record the evidence; the last item is the user's visual sign-off on the PR.

---

## Testing Strategy

### Unit Tests:

- `resolveReturnTheme`: light, dark, red → dark, missing and invalid → dark.
- i18n parity for the new `nav.*` keys.

### Integration Tests:

- `red-night-mode.spec.ts`: eye toggle and return theme (dark and light paths).
- `sign-in-continue.spec.ts`: sign out through settings.
- `top-nav.spec.ts`: responsive bar height, tabs, overflow, sheet open/close, signed-out shape.

### Manual Testing Steps:

1. Local preview on local Supabase, signed-in user.
2. Capture the width × language × theme matrix; run the overflow and pixel audits.
3. Open the settings popover on phone and desktop; check Esc, outside tap and focus return; sign out with JS disabled.

## Performance Considerations

One island replaces another of similar size. The popover and tab bar are CSS plus server-rendered HTML.

## Migration Notes

Existing theme cookies keep working. The new return cookie defaults to dark when absent.

## References

- Framing, measurements and board link: `context/changes/top-nav-redesign/change.md`
- Current bar: `src/components/Topbar.astro`, `src/components/PreferenceSwitches.tsx`
- Theme tokens and red palette: `src/styles/global.css`; red guard `src/styles/red-theme.test.ts`
- S-10 red-mode archive (switch origin): `context/archive/2026-09-28-red-night-mode/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: One-row top bar with eye toggle and settings popover

#### Automated

- [x] 1.1 Unit tests pass, including `resolveReturnTheme` and i18n parity — 1260402
- [x] 1.2 Type check passes — 1260402
- [x] 1.3 Lint passes — 1260402
- [x] 1.4 Production build succeeds — 1260402
- [x] 1.5 Updated e2e specs pass on a local preview — 1260402

#### Manual

- [x] 1.6 One-row bar at 1280/768, settings panel opens and closes with focus return — 1260402
- [x] 1.7 Sign out works from the popover with JavaScript disabled — 1260402

### Phase 2: Phone tab bar and verification

#### Automated

- [x] 2.1 Unit tests pass
- [x] 2.2 Type check passes
- [x] 2.3 Lint passes
- [x] 2.4 Production build succeeds
- [x] 2.5 Full e2e suite passes in parallel

#### Manual

- [x] 2.6 Width × language × theme screenshots: header ≤ 64 px, no overflow, content clear of the tab bar
- [x] 2.7 Red-mode pixel audit passes, sheet open included
- [ ] 2.8 User reviews the before/after top bars on the PR
