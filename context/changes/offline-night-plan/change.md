---
change_id: offline-night-plan
title: Offline night plan — installable app with cached dashboard pages per site
status: impl_reviewed
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Notes

S-06 from the M-2 roadmap (MS-06, GitHub #70). Prerequisites S-05 and S-11 are done.

Phase 1 (2026-10-05): the planned fallback was taken. vite-plugin-pwa 2 never emits sw.js under Astro 7. Astro builds through Vite environments under one top-level config with `build.ssr: true`, and the plugin's `closeBundle` only writes the worker when that flag is off. The worker is now bundled by `scripts/build-sw.mjs` (npm `postbuild`: Vite library build + `workbox-build` injectManifest), and the manifest is a static `public/manifest.webmanifest`. There is no `theme-color` meta in the layout because `no-hardcoded-colors.test.ts` forbids hex under `src/`; the manifest carries the colours.
