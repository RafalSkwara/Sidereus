# App icon: ship the owner's pick

## Overview

Roadmap S-12, issue #216. The owner picked R2-4's dusk composition (2026-10-17, final) with a single white star
(`--primary` #f2f4f8, no companion). This plan turns it into the real icon: favicon, PWA and apple-touch icons, the
maskable icon, the `/design` specimen, and the evidence.

## Decisions

- **Geometry**: R2-4's sky gradient (`--zenith` → `--horizon` → `--dusk-glow-horizon`), its ground (`--background`)
  and its main star's size and height, unchanged; the star turns white and the companion goes. Owner correction
  (PR #217, 2026-10-17): with the companion gone the star is centred horizontally in every variant (R2-4 had it
  20/512 left of centre to make room for the companion; the favicon star moves 1.5/32 to x = 16). The favicon keeps
  R2-4's favicon star (thicker waist), so it stays a star at 16 px. The maskable icon keeps the sky full bleed and
  draws the star at 0.8 about the centre (inside the safe circle r = 204.8).
- **Pipeline**: `@vite-pwa/assets-generator` takes one source per run and applies every preset to it, so
  `npm run icons:build` runs three configs: `pwa-assets.config.mjs` (`public/pwa-icon.svg` → 64/192/512 and the
  apple-touch 180), `pwa-assets.maskable.config.mjs` (`public/pwa-maskable.svg` → maskable 512, padding 0; the
  generator's padding would shrink the whole picture, sky included, into a flat #050916 frame, so it is not
  equivalent) and `pwa-assets.favicon.config.mjs` (`public/favicon.svg` → `favicon.png` 32 and `favicon.ico` 32).
  PNGs are written full colour (`palette: false`): the generator's default quality 60 quantises and bands the sky.
- **Favicon links**: `Layout.astro` links `/favicon.svg` first and `/favicon.png` (32×32) second; `/favicon.ico`
  has no link and answers clients that request it unprompted (it used to fall through to the Worker).
- **Manifest**: unchanged. `theme_color` #050916 is `--zenith` (the icon's top), `background_color` #070a12 is
  `--background` (the icon's ground and the app's page).
- **Topbar and landing**: the Topbar's star is an inline SVG glyph, not the icon file, so it stays; the landing uses
  `public/landing/tonight.png`, not the icon.
- **Service worker**: the precache held only `_astro/**`, so no icon was ever precached. `favicon.svg` and
  `favicon.png` join it (a stored page then keeps its tab icon offline); `build-sw.mjs` fails when either is missing
  from the written manifest. The home-screen PNGs are fetched by the browser at install and stay out.
- **/design**: the proposals band becomes an "App icon" specimen read from `public/` by URL (no glob over the
  change folder any more), 16/32 (svg and png), 64, 96, 128 (apple-touch, 512) and the maskable icon in a circle, a
  squircle and unmasked; the states that apply are dark, light and red through the theme switch.

## What we're NOT doing

- No change to `context/foundation/roadmap.md` (PR #212 owns the S-09..S-12 entries).
- No red-mode favicon: the browser tab and installed icons are outside the page, so red mode cannot reach them.
- No change to the Topbar glyph, the manifest colours or `public/template.png` (an unused starter file).

## Phase 1: Final sources and evidence

Final `icon.svg`, `favicon.svg`, `maskable.svg` under `evidence/icon-proposals/final/` with PNG previews and
`final-sheet.png` (`render.mjs final`).

## Phase 2: Ship the icon

`public/` sources and generated files, the three generator configs, `icons:build`, `Layout.astro` links, the
service-worker precache and its check.

## Phase 3: /design specimen

The band reads the shipped files; capture in `final/design-specimen.png` (`capture-design.mjs final`).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Final sources and evidence

#### Automated

- [x] 1.1 `node context/changes/app-icon/evidence/icon-proposals/render.mjs final` writes the previews and `final-sheet.png` — 1bbf08d

#### Manual

- [x] 1.2 `final-sheet.png` shows the single white star legible at 16 and 32 px on dark, light and red, and whole inside the maskable circle and squircle — 1bbf08d

### Phase 2: Ship the icon

#### Automated

- [x] 2.1 `npm run icons:build` regenerates every PNG and the ICO from the three sources; the 512 PNG is pixel-identical to the evidence render — 1d3e1c6
- [x] 2.2 `npm run build` passes, and `dist/client/sw.js` precaches `favicon.svg` and `favicon.png` (build-sw check) — 1d3e1c6
- [x] 2.3 No proposal file or proposal text reaches `dist/` (grep for `icon-proposals`, the proposal names and comments) — 1d3e1c6
- [x] 2.4 The preview serves `/favicon.svg`, `/favicon.png`, `/favicon.ico` and the maskable files with 200, and the page head links the SVG before the PNG — 1d3e1c6
- [x] 2.5 After the worker installs, its cache holds `/favicon.svg` and `/favicon.png` (Chromium, preview on 4413) — 1d3e1c6

### Phase 3: /design specimen

#### Automated

- [x] 3.1 Lint, `astro check`, `npm test`, `npm run build`, the whole e2e suite and `npm run smoke` pass against the local stack — 21022a3

#### Manual

- [x] 3.2 `final/design-specimen.png` shows the band in dark, light and red; red mode turns the icon red through the `#red-only` image filter — 21022a3
- [ ] 3.3 After merge and deploy, a fresh PWA install (or a manifest refresh) shows the new home-screen icon; the tab shows the new favicon after a hard reload
- [x] 3.4 Star centred (owner correction): the weighted centroid of the star's pixels sits within 0.02 px of width / 2 in every raster (16, 32, 64, 180, 192, 512, maskable 512), the ICO's image is pixel-identical to `favicon.png`, and `final-sheet.png` and `design-specimen.png` are re-rendered
