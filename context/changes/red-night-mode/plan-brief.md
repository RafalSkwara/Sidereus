# Red Night Mode — Plan Brief

> Full plan: `context/changes/red-night-mode/plan.md`

## What & Why

Add a red night mode (PRD FR-024, roadmap S-10) that the user can switch on outdoors so the screen doesn't ruin their dark adaptation. It is the third theme on the F-03 token layer, next to dark (the default) and light.

## Starting Point

F-03 built the colour system as base tokens per `[data-theme]`, with derived tokens that recompute per theme, a `THEMES` list in `src/lib/preferences.ts`, and a two-segment moon/sun switch in the top bar that sets `data-theme` and a cookie without a reload. Verdict colours always sit next to a text label, so hue is never the only signal.

## Desired End State

The top-bar theme group has three segments: moon, sun, red eye. Picking the red eye turns every page near-black and red at once, and the choice is remembered on the device. No colour the page controls has any green or blue component, the landing screenshot included. A unit test fails if a future token breaks that or drops below the contrast floor.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| How red mode is switched on | Third segment in the theme group (moon / sun / red eye) | It is a theme, as the roadmap planned, so it adds no second preference or control (user) |
| Palette strictness | Strict red: zero green and blue in every colour | Only long-wavelength light leaves dark adaptation intact; amber tints would erode it (user) |
| Verdict tones in red | Told apart by brightness (go brightest, no-go dimmest), labels unchanged | Hue is gone; labels already carry the meaning (delegated) |
| Contrast floor | ≥ 4.5:1 for body text, heading and text on primary; ≥ 3:1 for muted and no-go, measured on both background and cards | Pure red on near-black tops out at about 5.2:1, so full AA for muted text is impossible (delegated) |
| Images | One SVG `feColorMatrix` filter maps luminance to red, applied to `img` in red mode | Covers the landing screenshot and any future image without a second asset (delegated) |
| Browser-drawn surfaces | Selection, scrollbars, autofill re-coloured from tokens; date/number input icons through the red filter; red theme only | Tokens alone don't reach them; dark and light stay untouched (delegated) |
| Id / storage | `red` in the existing `sidereus-theme` cookie; dark stays default | Reuses F-03's preference plumbing unchanged (delegated) |

## Scope

**In scope:**
- `red` theme id, strict-red palette in `global.css`, palette guard test
- Third switch segment with a red-eye icon, EN/PL label
- Red handling for images, selection, date/number input icons, scrollbars, autofill
- E2E spec on the public landing page; CLAUDE.md rule for future tokens

**Out of scope:**
- Separate red toggle over dark/light; amber-tinted variant; brightness slider; auto-switch at night
- Per-account theme storage
- OS-drawn popups (open `<select>` list, date-picker calendar): can't be styled, documented
- Red landing screenshot asset, favicon, browser `theme-color`

## Architecture / Approach

The `data-theme` attribute is the single switch point. A new `[data-theme="red"]` base-token block feeds the existing derived tokens, so components need no changes (the `dark:` variant already matches red). A hidden SVG filter in `Layout.astro` plus a few red-scoped CSS rules handle what the browser draws itself. The switch island reuses `chooseTheme`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Red palette and theme id | `red` accepted via cookie; complete strict-red palette; guard test | Contrast inside strict red is tight; muted text may need tuning |
| 2. Switch, edge surfaces, verification | Red-eye segment, image filter, browser surfaces, e2e spec, pixel audit | In-document SVG filter on `<img>` across browsers; top bar width at 390 px |

**Prerequisites:** S-02 and F-03 done (they are). No migration and no new dependency.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- OS-rendered popups stay grey or blue in red mode; accepted as a platform limit.
- `filter: url(#red-only)` on `<img>`: Chromium checked by e2e, WebKit by a local screenshot; if WebKit ignores it, the landing figure falls back to a grayscale + red multiply overlay.
- Delegated contrast floor (3:1 for muted text) is below WCAG AA for small text by design; red mode is an opt-in, special-purpose theme.

## Success Criteria (Summary)

- A user outdoors taps the red eye once and every page they visit is near-black and red, and stays that way on the next visit.
- Screenshots of every page in red mode contain no green or blue pixel above a small tolerance.
- Dark and light are unchanged, and dark remains the default.
