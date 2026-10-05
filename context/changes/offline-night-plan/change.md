---
change_id: offline-night-plan
title: Offline night plan — installable app with cached dashboard pages per site
status: implementing
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Notes

S-06 from the M-2 roadmap (MS-06, GitHub #70). Prerequisites S-05 and S-11 are done.

Phase 1 (2026-10-05): the planned fallback was taken. vite-plugin-pwa 2 never emits sw.js under Astro 7. Astro builds through Vite environments under one top-level config with `build.ssr: true`, and the plugin's `closeBundle` only writes the worker when that flag is off. The worker is now bundled by `scripts/build-sw.mjs` (npm `postbuild`: Vite library build + `workbox-build` injectManifest), and the manifest is a static `public/manifest.webmanifest`. There is no `theme-color` meta in the layout because `no-hardcoded-colors.test.ts` forbids hex under `src/`; the manifest carries the colours.

Phase 3 (2026-10-05): the manual offline checks found that Playwright 1.55's `context.setOffline(true)` does not reliably cut a service worker's own fetches, even with `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1`. Under emulation some navigations still reached the server (`/log` rendered for real, and a never-opened page was fetched and stored). With the preview server actually stopped, every rule held. The Phase 4 e2e spec therefore must not rely on `setOffline` alone. It has to make the server unreachable in a way the worker can see, or assert `data-from-device` before it trusts an "offline" result.

