# Top Navigation Redesign — Plan Brief

> Full plan: `context/changes/top-nav-redesign/plan.md`
> Framing: `context/changes/top-nav-redesign/change.md` (### Framing) · Design board: https://claude.ai/artifact/VBMVqSE9846VQhhUjtjKTv

## What & Why

The top bar gives equal weight to three kinds of thing: places you go every visit (Tonight, Log, My gear), account items (a decorative "Welcome!" pill, Sign out) and preferences set once (5 theme and language buttons). The one exception is red mode, which you want in one tap at the eyepiece. The result is 11 items that wrap into a 169 px header on phones. The fix is hierarchy, not squeezing.

## Starting Point

- `Topbar.astro` renders links, the pill, a Sign out form and the `PreferenceSwitches` island in one wrapping row.
- The three shells (`GearShell`, `AuthShell`, `Welcome`) each render it.
- It is one row only from 1024 px.

## Desired End State

- **Phones:** a single 64 px top bar with the name, a red-mode eye and a settings button, plus a bottom tab bar (Tonight · Log · My gear) in thumb reach.
- **Wider screens:** one row with inline links.
- **Settings sheet or panel:** who is signed in, Dark/Light/Red, English/Polski and Sign out.
- **Eye:** turns red on, and off again returns to the theme you had.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Direction | A: bottom tabs on phones, one row on wider screens, settings in a popover | Destinations one tap away in thumb reach; the least chrome that still shows where you can go | User (board) |
| Eye button | Red ↔ the last theme you used | Behaves like a light switch at the eyepiece and never flips a light-theme user to dark | User |
| Settings mechanism | Native popover (`popover` + `popovertarget`) inside one island | Opens without JS, Esc and outside-tap close, focus returns; no new dependency | Delegated |
| Shared state | Eye and settings theme control in one island | Tapping the eye can't leave the settings control stale | Delegated |
| Breakpoint | Tailwind `sm` (640 px) | At 640 px the one-row bar fits even in Polish | Delegated |
| Return theme storage | Device cookie `sidereus-theme-return` (dark/light, default dark) | Same "remembered on the device" model as theme and language | Delegated |
| Where tabs show | Signed in, not on `/onboarding`, below `sm` | Onboarding has one way forward; signed-out pages have nothing to navigate to | Delegated |
| Welcome pill | Removed; settings shows "Signed in as <email>" | It took space and did nothing | Board, all options |

## Scope

**In scope:**
- Rebuilt `Topbar.astro`; new `TopbarControls.tsx` island (replaces `PreferenceSwitches.tsx`); new `TabBar.astro` in all three shells
- Return-theme preference with unit tests; EN/PL copy
- Updated `red-night-mode` / `sign-in-continue` specs; new `top-nav` spec

**Out of scope:**
- Directions B/C; hide-on-scroll; CSS anchor positioning
- No-JS theme or language changes; page content layouts; tabs on signed-out pages

## Architecture / Approach

The top bar stays server-rendered, with one small island for everything stateful: the eye, the settings button and the popover holding the theme/language controls and a plain Sign out form. The tab bar is server-rendered HTML with a same-height spacer, so page content never hides behind it. All colours come from theme tokens, so dark, light and red work unchanged.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. One-row bar + settings | Eye toggle, settings popover, pill gone, one row at every width | Popover styling across browsers (bottom sheet vs. panel) |
| 2. Phone tab bar + verification | Bottom tabs below 640 px, spacer, responsive e2e spec, screenshot/overflow/red audits | Content hidden behind the fixed bar; safe-area insets on iOS |

**Prerequisites:** none beyond the current `main`. No migration, no new dependency.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- The Popover API is assumed available: it is in all current evergreen browsers since 2024. An older browser would show the settings inline. Acceptable, and checked in WebKit during verification.
- The iOS safe-area inset needs `viewport-fit=cover`; it is verified by screenshot only, since there's no real device in CI.

## Success Criteria (Summary)

- On a phone, Tonight starts right under a 64 px bar, and every page is one tap away at the bottom of the screen.
- Red mode is one tap on and one tap off, back to your own theme.
- No page scrolls sideways at 360 px, in any theme or language.
