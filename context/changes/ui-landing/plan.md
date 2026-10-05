# Landing page in Nightfall, signed-out only — Implementation Plan

## Overview

Bring `/` onto the Nightfall contract (charges C1–C5 in `research.md`): the hero becomes Tonight's sky band, the CTAs
become `buttonVariants`, the type uses the roles, content sits in ruled `Band`s, the product screenshot shows today's
Tonight dashboard, and a signed-in visitor is redirected from `/` to `/tonight` as decided on 2026-10-04.

## Current State Analysis

See `research.md` (Pre-audit and Charges). In short: `Welcome.astro` reads colour tokens but no shared component and
no type role (13 scan hits, one inline star-field style); there is no signed-in redirect (`GET /` → 200 for a user);
`public/landing/tonight.png` is the pre-Nightfall Tonight.

## Desired End State

- `GET /` with a session → 302 to `/tonight`. Without one → the landing page.
- The landing opens with the Topbar on a zenith strip and `TonightSky` (zenith → horizon, stars in dark/red, the
  horizon silhouette into the ground colour), holding a short eyebrow line, `PageHeader` (the tagline as `h1`, the lead
  as subtitle, the two CTAs as `actions`) and the verdict legend.
- Below the sky, in the `max-w-3xl px-4` column: a "How it works" `Band` (ruled ordered rows) and a preview `Band`
  with the recaptured dashboard screenshot; a muted footer.
- The hardcoded-value scan on `Welcome.astro` and `index.astro` returns 0 hits; no new tokens in `global.css`.

### Key Discoveries:

- `TonightPageSky.astro:24-41` is the pattern: `TonightSky` + `PageHeader` + a `text-label text-muted-foreground`
  context line.
- `GearShell.astro:25-30` (`skyFlow`): Topbar inside `bg-zenith`, so the sky band continues it seamlessly.
- `contrast.test.ts:70-85` pins `heading`/`muted-foreground` on `zenith`/`horizon` in all three themes, but not
  `faint`; so text on the sky and the footer use `heading`/`muted-foreground`.
- `tests/e2e/landing-screenshot.spec.ts` already captures `/tonight` after onboarding (it waits for the tiles).

## What We're NOT Doing

- No new colour tokens, type roles or shared components (none needed; so `/design` is unchanged).
- No edit to `Topbar`, `TopbarControls`, `TabBar`, `GearShell`, `AuthShell` or `Layout`. The Topbar logo keeps linking
  to `/` (the redirect sends a signed-in user on to `/tonight`; one extra hop, accepted).
- No new marketing copy or features: copy stays the existing `landing.*` claims (PRD-true), plus one Band heading and
  an updated screenshot alt text.
- No per-locale or per-theme screenshots: one English dark 1280×800 capture, as today (red mode filters it red).
- No redirect logic in the middleware (page-level redirect; see Delegated decisions in `change.md`).

## Implementation Approach

Entry point first (C4), because it settles which branches of `Welcome` survive; then the view (C1–C3) in one pass;
then the screenshot (C5), the states matrix and the guard.

## Phase 1: Entry point and copy

### Overview

Signed-in visitors leave `/` for `/tonight`; the catalogue gets the keys the new view needs.

### Changes Required:

#### 1. The redirect

**File**: `src/pages/index.astro`

**Intent**: Redirect a signed-in visitor (`Astro.locals.user`) to `/tonight` before rendering; signed out (and with
Supabase unconfigured, where `user` is `null`) the page renders as before.

**Contract**: `GET /` → `302 Location: /tonight` when `Astro.locals.user` is set.

#### 2. Landing copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Add `landing.previewHeading` (the screenshot band's heading); rewrite `landing.screenshotAlt` to describe
the Nightfall dashboard; remove `landing.openTonight` (dead after the redirect). Keys stay in the same order otherwise.

**Contract**: `landing.previewHeading: string`, both locales; `openTonight` gone from both.

### Success Criteria:

#### Automated Verification:

- `npx astro check` passes and the i18n parity test passes (`npm test`)
- New e2e `tests/e2e/landing.spec.ts`: a signed-up user opening `/` lands on `/tonight`

#### Manual Verification:

- In the preview, a throwaway signed-in user's `GET /` returns 302 to `/tonight`

---

## Phase 2: The view in Nightfall

### Overview

Rebuild `Welcome.astro` from the contract (C1, C2, C3).

### Changes Required:

#### 1. Welcome shell

**File**: `src/components/Welcome.astro`

**Intent**: Topbar on a `bg-zenith` strip, then `TonightSky` holding the eyebrow (`landing.kicker`, sentence case,
`text-label text-muted-foreground`), `PageHeader` (title = `tagline`, subtitle = `lead`, `actions` = "Get started"
`buttonVariants()` + "Sign in" `buttonVariants({ variant: "outline" })`) and the verdict legend (dot + headline,
`text-label`, `aria-label` = `verdictsLabel`, keeping `data-sky-headline`). Under it the `max-w-3xl px-4` column with
`Band` "How it works" (an `ol`, `divide-y` rows: number in `font-mono text-label text-muted-foreground`, step in
`text-body text-foreground`) and `Band` `previewHeading` (the screenshot `figure`, `rounded-lg border border-border`),
then the footer (`text-label text-muted-foreground`). Remove the CSS star field, the glow, `primaryCta`/`secondaryCta`,
the `user` branch and `TabBar`.

**Contract**: one `h1` (the tagline); one `default`-variant action; links `/auth/signup`, `/auth/signin`; image keeps
`width`/`height`/`loading="lazy"`.

### Success Criteria:

#### Automated Verification:

- Hardcoded-value scan on `Welcome.astro` + `index.astro` returns 0
- `npm run lint`, `npx astro check`, `npm test` (incl. `no-hardcoded-colors`, `red-theme`, `contrast`) pass
- `tests/e2e/landing.spec.ts`: signed out, `/` shows the `h1` and both CTAs with their hrefs
- `tests/e2e/red-night-mode.spec.ts` (runs on `/`) passes

#### Manual Verification:

- Screenshots EN/PL × dark/light/red × 390/1280 read as Nightfall (sky band, ruled bands), no horizontal overflow, PL
  wraps cleanly at 390 px

---

## Phase 3: Screenshot, states and guard

### Overview

Recapture the product image (C5), walk the 7-state matrix, leave the rule.

### Changes Required:

#### 1. Product screenshot

**File**: `public/landing/tonight.png` (via `tests/e2e/landing-screenshot.spec.ts`)

**Intent**: Re-run the capture tool against the local preview + forecast fixture so the image is the Nightfall
dashboard. Adjust the spec only if it no longer reaches a settled dashboard (e.g. wait for the live sky).

**Contract**: 1280×800 PNG, dark, English, no coordinates visible.

#### 2. Rule

**File**: `CLAUDE.md` ("UI (Nightfall)")

**Intent**: One line: the landing is `Welcome` = `TonightSky` hero with `PageHeader` + `Band`s, signed out only
(`index.astro` redirects), and its image is regenerated with the capture spec after a Tonight redesign.

**Contract**: one bullet under "UI (Nightfall)".

### Success Criteria:

#### Automated Verification:

- e2e specs touching `/` pass against the 4324 preview (`landing.spec.ts`, `red-night-mode.spec.ts`)
- `npm run lint`, `npx astro check`, `npm test` pass after the final edit

#### Manual Verification:

- `public/landing/tonight.png` shows the Nightfall dashboard (live sky, tiles)
- 7-state matrix covered with screenshots: default, hover (N/A-reason or shot), focus-visible on both CTAs and the
  Topbar controls, disabled (N/A), error (N/A), empty (N/A), loading (N/A); plus the Supabase-unconfigured banner,
  long PL copy at 390 px and 320 px, wide desktop, reduced motion
- Contrast and focus checked by eye in all three themes

---

## Testing Strategy

### Integration Tests:

- `tests/e2e/landing.spec.ts` (new, modest): signed out renders `h1` + CTA hrefs; signed in redirects to `/tonight`.
  Everything visual is screenshot evidence, not assertions.

### Manual Testing Steps:

1. Build, write `dist/server/.dev.vars`, `npx astro preview --port 4324`.
2. Run the scratch screenshot harness (scratchpad, not committed) for the matrix.
3. Rebuild with an empty `.dev.vars` copy for the unconfigured banner.

## References

- Research: `context/changes/ui-landing/research.md`
- Pattern: `src/components/tonight/TonightPageSky.astro:24-41`, `src/components/gear/GearShell.astro:25-30`,
  `src/pages/gear/index.astro:118-147`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Entry point and copy

#### Automated

- [x] 1.1 `npx astro check` passes and the i18n parity test passes (`npm test`)
- [x] 1.2 New e2e `tests/e2e/landing.spec.ts`: a signed-up user opening `/` lands on `/tonight`

#### Manual

- [x] 1.3 In the preview, a throwaway signed-in user's `GET /` returns 302 to `/tonight` (evidence: harness `ONLY_SIGNEDIN=1` → 302 Location /tonight, landed on /tonight)

### Phase 2: The view in Nightfall

#### Automated

- [ ] 2.1 Hardcoded-value scan on `Welcome.astro` + `index.astro` returns 0
- [ ] 2.2 `npm run lint`, `npx astro check`, `npm test` (incl. `no-hardcoded-colors`, `red-theme`, `contrast`) pass
- [ ] 2.3 `tests/e2e/landing.spec.ts`: signed out, `/` shows the `h1` and both CTAs with their hrefs
- [ ] 2.4 `tests/e2e/red-night-mode.spec.ts` (runs on `/`) passes

#### Manual

- [ ] 2.5 Screenshots EN/PL × dark/light/red × 390/1280 read as Nightfall (sky band, ruled bands), no horizontal overflow, PL wraps cleanly at 390 px

### Phase 3: Screenshot, states and guard

#### Automated

- [ ] 3.1 e2e specs touching `/` pass against the 4324 preview (`landing.spec.ts`, `red-night-mode.spec.ts`)
- [ ] 3.2 `npm run lint`, `npx astro check`, `npm test` pass after the final edit

#### Manual

- [ ] 3.3 `public/landing/tonight.png` shows the Nightfall dashboard (live sky, tiles)
- [ ] 3.4 7-state matrix covered with screenshots
- [ ] 3.5 Contrast and focus checked by eye in all three themes
