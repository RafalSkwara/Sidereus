/// <reference lib="webworker" />
// The service worker (S-06, offline-night-plan), built by vite-plugin-pwa in injectManifest mode and served at
// /sw.js with scope /. Phase 1: it only precaches the build's static assets; the Tonight pages are stored at runtime
// from Phase 3 on.
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
