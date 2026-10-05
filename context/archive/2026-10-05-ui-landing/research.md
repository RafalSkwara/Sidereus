---
date: 2026-10-05T14:15:00+02:00
researcher: Claude (ui-landing agent)
git_commit: d834703
branch: feat/ui-landing
repository: sidereus
topic: "/10x-ui audit of the landing view `/` against the Nightfall contract"
tags: [research, ui, landing, nightfall, welcome]
status: complete
last_updated: 2026-10-05
last_updated_by: Claude (ui-landing agent)
---

# Research: /10x-ui audit of the landing view `/`

**Date**: 2026-10-05T14:15+02:00
**Researcher**: Claude (ui-landing agent)
**Git Commit**: d834703 (origin/main)
**Branch**: feat/ui-landing
**Repository**: sidereus

## Research Question

Audit `/` (`src/pages/index.astro`, `src/components/Welcome.astro` and what it renders) in both directions against the
Nightfall contract (`src/styles/global.css`, `src/components/ui/`, `CLAUDE.md` "UI (Nightfall)"), and write 3–5 charges
with file:line and user impact. Scope is one view, so the audit ran locally (no sub-agents): two files, one shell.

## Summary

The landing page is the one view S-10 explicitly left for "its own, bigger rework"
(`context/changes/visual-redesign/plan.md:54`). It reads tokens for colour (zero palette classes, zero hex in
`Welcome.astro`; the colour guard passes), but it reads **none** of the shared components (0 imports from
`src/components/ui/`) and **none** of the type roles (0 of `text-display|title|label|body`): 13 lines in the
hardcoded-value scan below are off-contract type sizes, radii or arbitrary tracking. Its composition predates
Nightfall (centred hero over a CSS star field, boxed cards, pill chips) instead of the sky header and ruled bands
that `/gear` and `/tonight` use. Two non-visual gaps: the decided signed-in redirect from `/` to `/tonight` does not
exist (`src/middleware.ts` and `src/pages/index.astro` have no such branch; a signed-in visitor gets the landing page
with an "Open Tonight" button, confirmed in the preview), and the product screenshot it embeds
(`public/landing/tonight.png`) shows the pre-Nightfall Tonight.

Five charges follow; all five are planned (none deferred).

## Pre-audit

- **Value source:** `src/styles/global.css` (three theme blocks + `@theme inline`). Contract variant: **existing
  design system** — extend, never fork.
- **Shared components:** `src/components/ui/` (`Button`/`buttonVariants`, `PageHeader`, `Band`, `BackLink`, `Notice`,
  inputs) and `src/components/tonight/TonightSky.astro` (the sky band, the Nightfall signature).
- **Agent rules:** `CLAUDE.md` "UI (Nightfall)" — no rule invites one-off values; it forbids them. No rule-file charge.
- **Hardcoded-value scan** on `Welcome.astro` + `index.astro` (the skill's regex plus the off-role type sizes, `rounded-2xl|full` and arbitrary tracking): **13 hits**, all in `Welcome.astro`
  (lines 47, 48, 49, 50, 52, 55, 58, 65, 70, 72, 77, 100, 113). Plus one inline `style` with three literal
  `radial-gradient`s (line 37). Palette classes / hex: 0.
- **Source → view counts** (`Welcome.astro`): imports from `ui/`: 0 (vs. `/gear` hub: `PageHeader`, `Band`,
  `buttonVariants`, `Notice`); type-role classes: 0; `TonightSky`/`from-zenith`: 0.

## Charges

### C1 — Missing shared component: hand-rolled CTAs with no visible focus (Welcome.astro:27-30, 86-97)

`primaryCta` / `secondaryCta` are string copies of a button (`px-6 py-3 font-semibold`, `border-border`) that shadow
`buttonVariants` (`src/components/ui/button.tsx:13-44`). They have no `focus-visible` style, so keyboard focus falls
back to the base layer's `outline-ring/50` (`global.css:443`): a thin half-opacity ring flush on the button
(screenshot `before/en-dark-1280-tab5.png`). The secondary uses `border-border` where `outline` uses `border-primary`,
so "Sign in" reads as a disabled-looking box. **User impact:** a keyboard user tabbing to "Get started" can barely
tell it has focus, and the two CTAs don't look like the buttons they meet one click later on `/auth/*` and `/gear`.

### C2 — Missing tokens: off-role type, radii and arbitrary tracking (Welcome.astro:47-50, 52, 55, 65, 70, 72, 77, 100, 113)

`text-xs` + `tracking-[0.18em]`/`tracking-[0.3em]` uppercase kickers (47, 65), `text-5xl sm:text-7xl` (48),
`text-xl sm:text-2xl italic` (49), `text-base sm:text-lg` (50), `text-sm` (52, 77), `rounded-2xl` / `rounded-full`
(55, 58, 70, 72, 100), `text-xs text-faint` footer (113). The contract has `text-display|title|label|body`, the
radius scale (`rounded-lg` for controls) and `PageHeader`'s "no uppercase kicker" rule (`PageHeader.astro:3-5`).
`text-faint` is not in the contrast floors (`contrast.test.ts:70-85` pin `foreground`, `heading`, `muted-foreground`),
so the 12 px footer has no AA guarantee. **User impact:** the landing page looks like a different product from the
app behind it (different type scale, expanded italic tagline, letter-spaced caps), and the smallest text has no
contrast floor.

### C3 — Accidental architecture: composition predates Nightfall (Welcome.astro:33-41, 64-82, 52-62)

A CSS-gradient star field over the whole page (35-39) and a `from-surface` glow at the bottom (41) stand in for the
sky; the steps are three boxed cards (70) and the verdicts are pill chips (55). Nightfall is a sky header (zenith to
horizon, `TonightSky.astro:51`, with the silhouette into the ground colour) and content in ruled `Band`s
(`Band.astro`, `/gear`). In the light theme the star field is still painted (`--star` light values,
`global.css:113-114`), while `TonightSky` hides stars there (`TonightSky.astro:52`). **User impact:** the first screen
a visitor sees does not show the product's look (the sky band they will see on Tonight), and on a phone the three
stacked cards plus chips push the CTAs below the fold (`before/pl-dark-390.png`: CTAs at ~850 px of an 844 px
viewport).

### C4 — Accidental architecture: no signed-in redirect (src/pages/index.astro:1-9, Welcome.astro:86-90)

Decided 2026-10-04 (`context/foundation/roadmap.md:169`, `context/changes/visual-redesign/change.md:15`): `/` is
signed-out only; a signed-in user goes to `/tonight`. Today neither the middleware (`src/middleware.ts:37-44`, only
the protected-route branch) nor the page redirects; `Welcome.astro:86-90` renders an "Open Tonight" button for a
user. Verified in the preview: a throwaway user signed up through `POST /api/auth/signup` gets `GET /` → **200**,
stays on `/`. The Topbar's logo links to `/` (`Topbar.astro:27`), so every signed-in click on the logo lands on the
marketing page. **User impact:** a signed-in observer clicking the logo (or opening the bookmarked root) gets a sales
pitch instead of tonight's verdict.

### C5 — Stale product screenshot (public/landing/tonight.png, Welcome.astro:24, 100-110; en.ts/pl.ts `landing.screenshotAlt`)

The embedded 1280×800 image is the pre-Nightfall Tonight (gold accents, serif type, boxed verdict card,
"Next 7 nights ↓" anchor), and the alt text describes the old ranked-list page. `/tonight` is now the dashboard with
the live sky and tiles (handoff.md, S-11). The capture tool exists (`tests/e2e/landing-screenshot.spec.ts`, opt-in
with `CAPTURE_LANDING=1`) but waits for the old structure only partly (it already waits for `[data-tonight-tiles]`).
**User impact:** the visitor is shown a product that no longer exists, and a screen-reader user hears a description
of a page they won't get.

## Detailed Findings

### The shell

- `index.astro:6-8` wraps `Welcome` in `Layout` with the default title (`Layout.astro:13`, `m.common.appName`).
- `Welcome.astro:43-45` renders `Topbar` in the `max-w-5xl` row (same as `GearShell.astro:39-41`); `TabBar` (117)
  renders nothing signed out (`TabBar.astro:12`), so after C4 it is dead on this page.
- The config-status banner comes from `Layout.astro:24-37`, above the shell, independent of `Welcome`.
- The verdict legend reuses `skyHeadline` and `VERDICT_TONES` (`Welcome.astro:14-20`, `verdict-tones.ts:3-8`), so
  its wording matches Tonight; keep that.

### Copy (PRD check)

`landing.*` in `en.ts:94-113` / `pl.ts:76-95`. Claims match the PRD (go/marginal/no-go, Messier, eyepieces from your
kit, up to five targets). `screenshotAlt` (en.ts:108-109) is the only one that no longer matches the product (C5).
`openTonight` becomes unused after C4.

## Code References

- `src/components/Welcome.astro:27-30` — `primaryCta`/`secondaryCta`
- `src/components/Welcome.astro:35-41` — star field + glow
- `src/components/Welcome.astro:47-82` — hero, chips, step cards
- `src/components/Welcome.astro:100-110` — screenshot figure
- `src/pages/index.astro:1-9` — no redirect
- `src/components/ui/button.tsx:13-44`, `PageHeader.astro`, `Band.astro`, `src/components/tonight/TonightSky.astro`
- `src/styles/contrast.test.ts:70-85` — pinned contrast pairs
- `tests/e2e/landing-screenshot.spec.ts` — capture tool for `public/landing/tonight.png`

## Architecture Insights

- `GearShell` `skyFlow` (`GearShell.astro:25-30`) is the pattern for a page whose first band is `TonightSky`: the
  Topbar on a `bg-zenith` strip, then the band. The landing can compose the same way inside `Welcome` without
  touching `GearShell` or `Topbar`.
- `TonightSky` without `verdict` is the short sky (setup states); its slot sits in `VERDICT_CONTAINER_CLASS`.

## Historical Context (from prior changes)

- `context/changes/visual-redesign/plan.md:54` — landing deferred to its own rework, with the redirect; tonight.png
  stays stale until then.
- `context/changes/visual-redesign/research.md:118` — `Welcome.astro:27-30` listed as a `primaryLink`-style duplicate.
- `context/archive/2026-09-26-first-run-onboarding/plan-brief.md:82` — the screenshot was expected to go stale and
  be regenerated after the redesign.

## Related Research

- `context/changes/visual-redesign/research.md`

## Open Questions

None blocking. Visual choices (left-aligned hero, which line is the `h1`) are made in the plan and listed for
review in the PR.
