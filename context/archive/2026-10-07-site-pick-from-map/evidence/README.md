# S-09 evidence

All captures from a local production preview (`npm run build` + `astro preview`, local Supabase) on 2026-10-07, with **real OpenStreetMap tiles** (the e2e spec stubs them). Each shows the open map after "Place pin at map centre", with keyboard focus on the zoom-in button so the focus ring shows.

- `e2e-baseline.txt`: the full e2e suite before phase 2 (32 passed, 1 skipped). After phase 3: 34 passed, 1 skipped (the 32 plus the 2 `site-map.spec.ts` tests), no new failures.
- `screens/chromium-{site,onboarding}-{en,pl}-{dark,light,red}-{390,1280}.png`: `/gear/sites/new` and onboarding's home-site step in every locale, theme and width (24 captures).
- `screens/webkit-{site,onboarding}-en-red-390.png`: red mode in WebKit (Desktop Safari).
- `screens/*-red-*--map.png`: the map region alone in every red capture, the input to the channel check.

## Red-mode channel check

The maximum of each channel over every pixel of the red map crops (sharp, raw RGB). Target: G = B = 0.

```
chromium-onboarding-en-red-1280--map.png: max R=255 G=0 B=0
chromium-onboarding-en-red-390--map.png: max R=255 G=0 B=0
chromium-onboarding-pl-red-1280--map.png: max R=255 G=0 B=0
chromium-onboarding-pl-red-390--map.png: max R=255 G=0 B=0
chromium-site-en-red-1280--map.png: max R=255 G=0 B=0
chromium-site-en-red-390--map.png: max R=255 G=0 B=0
chromium-site-pl-red-1280--map.png: max R=255 G=0 B=0
chromium-site-pl-red-390--map.png: max R=255 G=0 B=0
webkit-onboarding-en-red-390--map.png: max R=255 G=0 B=0
webkit-site-en-red-390--map.png: max R=255 G=0 B=0
```

The first WebKit capture failed this check by eye: the tiles kept full colour, because WebKit does not apply an SVG `url()` filter to Leaflet's composited (`translate3d`) tile pane. In red mode the `#red-night-map` filter therefore sits on the tile images, with no pane filter (global.css), and both engines now report G = B = 0.

## Observations

- Light: normal OSM tiles. Dark: inverted and dimmed tiles, with the controls and credit on `--surface`. Red: `#red-night-map` (inverted luminance × 0.7 into red). Leaflet's default white, grey or blue shows nowhere.
- Polish copy ("Postaw pinezkę na środku mapy", "Zamknij mapę", the source caption and the summary line) fits at 390 px without overflow; the summary wraps to two lines as the English one does.
- Panning performance on a phone was not measured (desktop preview only).
