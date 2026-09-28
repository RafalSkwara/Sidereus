# Red Night Mode Implementation Plan

## Overview

Add red night mode (PRD FR-024, roadmap S-10) as a third theme on the F-03 token layer. The theme switch in the top bar gains a third segment (moon / sun / red eye). Choosing it sets `<html data-theme="red">`, and the choice is remembered in the existing `sidereus-theme` cookie. The palette is strictly red: every colour has zero green and zero blue, because only long-wavelength light leaves the eye's dark adaptation intact. A unit test enforces this, so a later token cannot silently break it.

## Current State Analysis

- F-03 (`context/archive/2026-09-26-ui-foundation/`) built the theme layer so that a third theme is only a palette and a switch option (plan line 79: "The token layer is shaped so it becomes a third `data-theme` value later").
- `src/styles/global.css:18-66`: base tokens live on `:root` (dark, the default) and `[data-theme="light"]`. The derived tokens at `global.css:72-101` are declared on `:root, [data-theme]`, so any new `[data-theme="red"]` block gets its derived colours (card, accent, faint, verdict surfaces and borders) recomputed from its own base values. `global.css:103-107` holds per-theme overrides of derived tokens (light only).
- `global.css:10`: the `dark:` variant matches `:root:not([data-theme="light"])`, so red counts as dark automatically. That is what we want: the shadcn `dark:` rules in `src/components/ui/button.tsx:8-18` stay in effect.
- `src/lib/preferences.ts:5`: `THEMES = ["dark", "light"]` is the single list. `resolveTheme` validates the cookie against it (`preferences.ts:29-31`), and the middleware stores the result in `Astro.locals.theme` (`src/middleware.ts:24`). `Layout.astro:17` renders `data-theme={theme}`. `src/lib/preferences.test.ts:10-14` currently asserts that `"red"` falls back to dark.
- `src/components/PreferenceSwitches.tsx:92-117`: the theme group has two segments with inline SVG icons. `chooseTheme` sets the attribute and the cookie without a reload. Labels come from `m.preferences.{theme,dark,light}` (`src/i18n/messages/en.ts:43-45`, `pl.ts:33+`).
- Verdict colour is never the only signal. Every go/marginal/no-go dot sits next to its text label (`src/components/tonight/VerdictCard.astro:43`, `NightStrip.astro:54-57`), and the `bg-go-surface` success notices carry text (`src/pages/tonight.astro:48`, `src/pages/log/index.astro:71`).
- Surfaces the tokens do not reach: the landing screenshot `<img src="/landing/tonight.png">` (`src/components/Welcome.astro:92`), the browser's text-selection highlight, native `<input type="radio|date|number">` and `<select>` controls (OnboardingWizard, ObservationForm, gear forms, `GearSelector.astro:61`), autofill backgrounds and scrollbars.
- `src/styles/no-hardcoded-colors.test.ts` bans colour literals outside `global.css`.

## Desired End State

On every page (landing, auth, onboarding, Tonight, log, gear), the theme group in the top bar shows three segments. Choosing the red-eye segment turns the whole interface near-black and red at once, with no reload. The choice survives reloads and new sessions on that device, and choosing moon or sun switches back. In red mode no colour the page controls has a green or blue component, the landing screenshot included. `npm test` fails if someone adds a red token with green or blue in it, or drops the red palette below its contrast floor. Dark stays the default for a new visitor.

Verify: `npm test`, `npx astro check`, `npm run lint`, the new e2e spec, and a pixel audit of screenshots taken in red mode.

### Key Discoveries:

- Only base tokens need red values. Every derived token is `var()` or `color-mix()` over base tokens, so it stays red-only when its inputs are (`global.css:72-101`).
- Strict red caps contrast: pure `#ff0000` on near-black `#0a0000` is about 5.2:1. That is enough for AA body text only if the foreground is close to full red (about `#ee0000`), and it leaves little room for muted text (≥ 3:1 means about `#bb0000` or brighter).
- The `dark:` variant already covers red (`global.css:10`), so no component needs a `red:` variant.
- Lessons: none of the three recorded lessons applies (no coordinates, no per-user list queries, nothing planned inside the Tonight island needs no-JS behaviour; the switch lives in the top bar, outside the island).

## What We're NOT Doing

- A separate red on/off toggle layered over dark/light (user chose the third theme segment).
- Warm or amber tints to keep verdict hues apart (user chose strict red; verdicts differ by brightness plus their existing labels).
- A brightness slider or automatic switching by time of night or sunset.
- Storing the theme per account. It stays a device cookie like F-03's preferences.
- Theming OS-rendered popups: the open `<select>` option list and the date-picker calendar are drawn by the browser/OS and ignore page CSS. Documented as a known limitation.
- A red variant of the landing screenshot file. The existing PNG is filtered to red at render time.
- Favicon, browser UI (address bar) or `theme-color` meta tags.

## Implementation Approach

Two phases. Phase 1 is the theme itself: the palette, the `THEMES` entry and the guard test. Phase 1 alone already renders correctly if `data-theme="red"` is set by hand or via the cookie. Phase 2 exposes it in the switch and covers the surfaces tokens cannot reach, then proves the result with an e2e spec and a screenshot pixel audit.

Delegated decisions (user chose "LOW, 2 UI questions"; the agent decided these, all open to challenge in plan review):
- Theme id and cookie value `red`. Message label "Red night mode" / "Czerwony tryb nocny".
- Contrast floor within strict red: foreground, heading and text on primary ≥ 4.5:1; muted text and `no-go` (also used for error text via `--destructive`) ≥ 3:1. Full AA for muted text is impossible without green or blue.
- Verdict tones are distinguished by brightness: go brightest, marginal middle, no-go dimmest but still ≥ 3:1.
- Images are filtered to red via one SVG `feColorMatrix` defined in `Layout.astro`, not a hand-made red asset.
- The red-eye icon is an inline SVG like the existing moon/sun, not a new icon dependency.

## Phase 1: Red palette and theme id

### Overview

The `red` theme exists end to end on the server (cookie → middleware → `data-theme`) with a complete strict-red palette and a test that guards it.

### Changes Required:

#### 1. Theme list

**File**: `src/lib/preferences.ts`

**Intent**: Make `red` a valid theme, so the cookie is accepted and the middleware renders it. Dark stays the default and light stays opt-in.

**Contract**: `THEMES = ["dark", "light", "red"]`; `Theme` gains `"red"`. `resolveTheme` and `DEFAULT_THEME` are unchanged. Update the doc comment on `resolveTheme` to mention red.

#### 2. Preference tests

**File**: `src/lib/preferences.test.ts`

**Intent**: `resolveTheme("red")` now returns `"red"`. Keep an invalid-value case (e.g. `"RED"`, `"sepia"`) falling back to dark.

**Contract**: the existing `resolveTheme` describe block; the assertion at line 12 moves from the fallback test to the valid-cookie test.

#### 3. Red palette

**File**: `src/styles/global.css`

**Intent**: Add a `[data-theme="red"]` base-token block next to the light one, with `color-scheme: dark` and a value for every base token the dark `:root` block defines, using only colours whose green and blue channels are zero. If any derived token reads badly on red, override it in a red block beside the light override at `global.css:103-107`. The likely candidate is `--destructive-foreground` on the `dark:bg-destructive/60` fill.

**Contract**: every base token from `:root` (`--background`, `--surface`, `--border`, `--foreground`, `--muted-foreground`, `--heading`, `--primary`, `--primary-foreground`, `--primary-strong`, `--go`, `--marginal`, `--no-go`, `--verdict-surface-alpha`, `--verdict-border-alpha`, `--star`, `--star-accent`) is set in the red block. Starting values to tune against the test and screenshots: background `#0a0000`, surface `#170000`, border `#3d0000`, foreground `#f20000`, muted `#bb0000`, heading `#ff0000`, primary `#ff0000` with primary-foreground `#000000`, primary-strong `#cc0000`, go `#ff0000`, marginal `#d60000`, no-go `#bb0000`, stars `rgb(255 0 0 / 0.35)` and `rgb(255 0 0 / 0.2)`. Update the palette comment at `global.css:12-17` to name the third theme.

#### 4. Palette guard test

**File**: `src/styles/red-theme.test.ts` (new)

**Intent**: Make "preserves dark adaptation" testable. The test reads `global.css`, extracts the `[data-theme="red"]` blocks, and checks every colour literal in them. It also resolves the base tokens and checks the contrast floor, and it checks that the red block defines every base token the `:root` block defines, so a token added later without a red value fails.

**Contract**: fails with the token name and value when (a) a hex or `rgb()` literal in a red block has a non-zero green or blue channel, (b) a base token in `:root` has no red counterpart, or (c) the WCAG contrast ratio against `--background` or `--surface` (whichever is lower; most text sits on `--surface` cards) is below 4.5 for `--foreground` and `--heading`, or below 3.0 for `--muted-foreground` and `--no-go`, or `--primary-foreground` on `--primary` is below 4.5. Reuse the comment-blanking approach of `no-hardcoded-colors.test.ts` if comments get in the way.

#### 5. Docs

**File**: `CLAUDE.md`

**Intent**: Future token additions must carry a red value, so say so where colours are governed.

**Contract**: the Layout paragraph lists `red` among the `data-theme` values. The colour-tokens bullet under Conventions adds: "a new base token needs a value in every theme block, and the red one must have zero green and blue (`src/styles/red-theme.test.ts`)".

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new palette guard and the updated `resolveTheme` cases: `npm test`
- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`

#### Manual Verification:

- With the `sidereus-theme=red` cookie set by hand, the landing, sign-in, Tonight, log and gear pages render near-black and red on a local preview. Checked via Playwright screenshots at 390 px and 1280 px, EN and PL.
- Dark (no cookie) and light render exactly as before: before/after screenshots of Tonight and landing are identical.

**Implementation Note**: After completing this phase and all automated verification passes, run the manual checks yourself (local preview on local Supabase + Playwright screenshots, per the user's standing instruction) and record the evidence before proceeding.

---

## Phase 2: Switch segment, edge surfaces and verification

### Overview

Users can pick red night mode from the top bar on every page. Images, text selection, native controls, autofill and scrollbars follow the red palette too.

### Changes Required:

#### 1. Third theme segment

**File**: `src/components/PreferenceSwitches.tsx`

**Intent**: Add a red-eye segment after moon and sun, working exactly like them (`chooseTheme("red")`: attribute + cookie, no reload), with `aria-pressed` and an accessible label.

**Contract**: a new inline `RedEyeIcon` SVG (eye outline, `stroke="currentColor"`, same size and props as `MoonIcon`/`SunIcon`); segment order dark, light, red. The icon takes its colour from the segment's text colour like the others, so it is not red in the dark and light themes.

#### 2. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Label the new segment.

**Contract**: `preferences.red`: "Red night mode" / "Czerwony tryb nocny". The parity test in `i18n.test.ts` covers PL.

#### 3. Red-only image filter

**File**: `src/layouts/Layout.astro`, `src/styles/global.css`

**Intent**: Raster images (today: the landing screenshot) must not emit green or blue in red mode. Define one hidden SVG filter in the layout that maps each pixel's luminance to the red channel only. In the red theme, apply it to `img` and to the browser-drawn icons of native inputs: the date-picker indicator (`::-webkit-calendar-picker-indicator`) and the number spin buttons (`::-webkit-inner-spin-button`).

**Contract**: a visually hidden, `aria-hidden` `<svg>` with `<filter id="red-only">` and one `feColorMatrix` (`type="matrix"`) whose red row is the Rec. 709 luminance weights (0.2126 0.7152 0.0722 0 0) and whose green and blue rows are zero, alpha passed through. CSS: `[data-theme="red"] img`, and the two pseudo-elements above, get `filter: url(#red-only)`. No hex values are involved, so the colour guard stays green. The e2e spec covers Chromium. WebKit is checked by a local screenshot in 2.8; if WebKit ignores `url(#id)` on `<img>`, fall back for the landing figure to `filter: grayscale(1)` on the image plus a `::after` overlay filled with `--primary` and `mix-blend-mode: multiply`, which zeroes green and blue in every engine.

#### 4. Browser-drawn surfaces

**File**: `src/styles/global.css`

**Intent**: Surfaces the browser draws with its own defaults, re-coloured from tokens in the red theme only, so dark and light are untouched.

**Contract**, all scoped to `[data-theme="red"]`:
- `::selection` uses primary on primary-foreground.
- `scrollbar-color: var(--border) var(--background)`.
- `input:-webkit-autofill` keeps `--surface` background (inset box-shadow) and `--foreground` text (`-webkit-text-fill-color`).

#### 5. Design reference page

**File**: `src/pages/design.astro`

**Intent**: The dev-only token page says "Switch the theme above to review both sets"; make it cover three.

**Contract**: copy change only; the page already re-reads token values on `data-theme` changes (`design.astro:335-345`).

#### 6. E2E spec

**File**: `tests/e2e/red-night-mode.spec.ts` (new)

**Intent**: Prove the switch works end to end in a real browser without signing up a user. It runs on the public landing page, which also keeps load off the parallel sign-up specs flagged in #45.

**Contract**: on `/`, click the red segment → `html[data-theme="red"]`, the `sidereus-theme` cookie is `red`, the red segment has `aria-pressed="true"`; after reload it is still red; `getComputedStyle(document.body).backgroundColor` has zero green and blue; the landing `<img>`'s computed `filter` references `red-only`. Clicking moon returns to `data-theme="dark"`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including i18n parity for the new key and the colour guards: `npm test`
- Type check passes: `npx astro sync && npx astro check`
- Lint passes: `npm run lint`
- Production build succeeds: `npm run build`
- The red-night-mode e2e spec passes against a local production preview: `BASE_URL=http://localhost:4321 npx playwright test red-night-mode`
- Full e2e suite still passes: `BASE_URL=http://localhost:4321 npm run test:e2e`

#### Manual Verification:

- The three-segment switch fits the top bar at 390 px width, signed in and signed out, EN and PL, without overflowing (Playwright screenshots).
- Pixel audit: Playwright screenshots in red mode of landing, sign-in, onboarding, Tonight, log and gear (390 px and 1280 px) contain no pixel with a green or blue channel above 8. That includes the landing screenshot, a focused input, selected text and a hovered number field. The landing page is also shot in WebKit locally (`npx playwright install webkit`), and must pass the same audit. Any exception is traced to an OS-drawn popup or explained.
- Dark and light still look as before on Tonight and landing (before/after screenshots).

**Implementation Note**: After completing this phase and all automated verification passes, run the manual checks yourself (local preview + Playwright screenshots) and record the evidence.

---

## Testing Strategy

### Unit Tests:

- `resolveTheme` accepts `red` and still falls back to dark for invalid values.
- Palette guard: zero green and blue in every red-block colour, full token coverage against `:root`, contrast floors against both `--background` and `--surface` (4.5 for body text and heading, and for text on primary; 3.0 for muted and no-go).
- i18n parity picks up `preferences.red`.

### Integration Tests:

- `tests/e2e/red-night-mode.spec.ts`: switch, persistence across reload, computed colours, image filter, switching back.

### Manual Testing Steps:

1. Local preview on local Supabase. Sign up, onboard, open Tonight, pick the red eye.
2. Walk landing, sign-in, onboarding, Tonight, log (new entry form with date input) and gear forms (selects, number inputs) at 390 px and 1280 px, in EN and PL.
3. Run the pixel audit over those screenshots.
4. Switch back to moon and sun and compare with the baseline screenshots.

## Performance Considerations

The image filter applies to one lazy-loaded landing image. The theme switch is an attribute flip like today. No measurable cost.

## Migration Notes

None. No database change. Existing `sidereus-theme` cookies (`dark`/`light`) stay valid.

## References

- PRD: `context/foundation/prd.md` FR-024, cut order item 4, NFR dark by default
- Roadmap: `context/foundation/roadmap.md` S-10 (`red-night-mode`), GitHub #14
- Theme foundation: `context/archive/2026-09-26-ui-foundation/plan.md` (line 79)
- Token layer: `src/styles/global.css:18-107`; switch: `src/components/PreferenceSwitches.tsx:73-118`; preferences: `src/lib/preferences.ts:5-31`
- Colour guard pattern: `src/styles/no-hardcoded-colors.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Red palette and theme id

#### Automated

- [x] 1.1 Unit tests pass, including the new palette guard and the updated `resolveTheme` cases
- [x] 1.2 Type check passes
- [x] 1.3 Lint passes

#### Manual

- [x] 1.4 Red cookie renders near-black and red on landing, sign-in, Tonight, log and gear (390/1280 px, EN/PL)
- [x] 1.5 Dark and light render exactly as before

### Phase 2: Switch segment, edge surfaces and verification

#### Automated

- [ ] 2.1 Unit tests pass, including i18n parity for the new key and the colour guards
- [ ] 2.2 Type check passes
- [ ] 2.3 Lint passes
- [ ] 2.4 Production build succeeds
- [ ] 2.5 The red-night-mode e2e spec passes against a local production preview
- [ ] 2.6 Full e2e suite still passes

#### Manual

- [ ] 2.7 Three-segment switch fits the top bar at 390 px, signed in and out, EN and PL
- [ ] 2.8 Pixel audit: no green or blue channel above 8 in red-mode screenshots of every page, landing also in WebKit
- [ ] 2.9 Dark and light still look as before on Tonight and landing
