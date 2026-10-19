#!/usr/bin/env node
/**
 * Builds the service worker (S-06, offline-night-plan) after `astro build` (npm's `postbuild`).
 *
 *   1. Bundles src/sw.ts (Workbox modules plus src/lib/offline/*) into dist/client/sw.js with Vite, as one classic
 *      script, so Workers static assets serve it at /sw.js with scope /.
 *   2. Injects the precache manifest (the build's hashed /_astro assets) with workbox-build.
 *   3. Tells the assets layer never to cache /sw.js, so a deploy's new worker is picked up on the next visit.
 *
 * Why not vite-plugin-pwa: Astro 7 builds through Vite environments under one top-level config with `build.ssr`
 * set, and the plugin only writes the worker when that top-level flag is off, so it never emits sw.js here.
 */
import { access, appendFile, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "vite";
import { injectManifest } from "workbox-build";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "dist/client");
const swPath = path.join(clientDir, "sw.js");

// Fail loudly if Astro's client output moved: an empty precache would still "build".
await access(path.join(clientDir, "_astro")).catch(() => {
  console.error("build-sw: dist/client/_astro not found; did `astro build` run, and does it still write there?");
  process.exit(1);
});

await build({
  configFile: false,
  logLevel: "warn",
  root,
  // public/ is already in dist/client (Astro copied it); a library build would copy it again.
  publicDir: false,
  resolve: { alias: { "@": path.join(root, "src") } },
  // Library mode leaves `process.env.NODE_ENV` in Workbox's code; a worker has no `process`.
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: clientDir,
    emptyOutDir: false,
    minify: true,
    lib: { entry: path.join(root, "src/sw.ts"), formats: ["iife"], name: "sidereusSw", fileName: () => "sw.js" },
  },
});

const TAB_ICONS = ["favicon.svg", "favicon.png"];

const { count, size, warnings } = await injectManifest({
  swSrc: swPath,
  swDest: swPath,
  globDirectory: clientDir,
  // The tab icon (app-icon) too, so a page served from the device keeps it offline; the home-screen PNGs are fetched
  // by the browser at install, not by pages, and stay out. Unhashed names, so Workbox revisions them by content.
  globPatterns: ["_astro/**/*.{js,css,woff2}", ...TAB_ICONS],
  // "Pick from map" (S-09) loads Leaflet only after its click; users who never open the map never download it.
  globIgnores: ["_astro/map-panel.*", "_astro/leaflet*"],
  // Hashed file names carry their own revision.
  dontCacheBustURLsMatching: /^_astro\//,
});
for (const warning of warnings) {
  console.warn(`build-sw: ${warning}`);
}
if (count <= TAB_ICONS.length) {
  console.error("build-sw: the precache manifest is empty; no /_astro assets matched.");
  process.exit(1);
}

// injectManifest returns no entry list, so the written worker is the evidence that the map stayed out.
const swText = await readFile(swPath, "utf8");
if (/map-panel|leaflet/.test(swText)) {
  console.error("build-sw: map assets leaked into the precache manifest");
  process.exit(1);
}
// The worker reports failures through src/lib/offline/report.ts, which imports only the leaf modules of the client
// reporter, so the logger is not in the worker. Reaching for `log-failure` (or a module that imports it) would put it
// there. `over_request_rate_limit` is an auth-js code that only that logger's allowlist (and the auth error map, which
// no worker file imports) holds, so finding it in sw.js means one of them was bundled. This does not see page code that
// has no such marker (the barrel gains `browser.ts` in Phase 9): that rule is an import test, not this check.
const LOGGER_MARKER = "over_request_rate_limit";
if (swText.includes(LOGGER_MARKER)) {
  console.error(
    `build-sw: dist/client/sw.js holds logger code (found \`${LOGGER_MARKER}\`); the worker must import only the leaf modules of src/lib/observability/client, never log-failure`,
  );
  process.exit(1);
}
// A glob that names no file matches nothing silently: the tab icons must be in public/ and in the manifest.
const missingIcons = TAB_ICONS.filter((icon) => !swText.includes(`"${icon}"`));
if (missingIcons.length > 0) {
  console.error(`build-sw: the tab icon is missing from the precache manifest (${missingIcons.join(", ")})`);
  process.exit(1);
}

// The exclusion above must still name a real file, and Leaflet's CSS must stay out of the site-wide stylesheet
// (map-panel.tsx loads it by URL; a plain import could merge it into the one shared CSS file every page loads).
// global.css carries its own `[data-theme] .leaflet-*` overrides, so look for rules only leaflet.css has.
const LEAFLET_OWN_RULES = [".leaflet-pane", ".leaflet-control-layers"];
const astroFiles = await readdir(path.join(clientDir, "_astro"));
if (!astroFiles.some((file) => file.startsWith("map-panel.") && file.endsWith(".js"))) {
  console.error("build-sw: no _astro/map-panel.*.js chunk; did the map's lazy import or its file name change?");
  process.exit(1);
}
for (const file of astroFiles) {
  if (!file.endsWith(".css") || file.startsWith("leaflet") || file.startsWith("map-panel")) continue;
  const css = await readFile(path.join(clientDir, "_astro", file), "utf8");
  if (LEAFLET_OWN_RULES.some((rule) => css.includes(rule))) {
    console.error(`build-sw: Leaflet CSS leaked into the shared stylesheet _astro/${file}`);
    process.exit(1);
  }
}

// The finder chart's star file (finder-chart, D-1/D-2) is server-only: 25,791 stars that only the finder island's
// loader may read. Fail when any client file names it, carries the unique text of its meta file (its `filter`, which
// the bright-star meta does not share) or carries the start of its packed position column, so a browser import of it
// never ships silently. The last marker is what catches a static import: Vite inlines the JSON into a chunk whose name
// and text hold neither of the other two.
const finderMeta = JSON.parse(await readFile(path.join(root, "src/lib/catalogue/finder-stars.meta.json"), "utf8"));
if (typeof finderMeta.filter !== "string" || finderMeta.filter.length === 0) {
  console.error("build-sw: finder-stars.meta.json has no `filter` string to look for; did its shape change?");
  process.exit(1);
}
const finderStars = JSON.parse(await readFile(path.join(root, "src/lib/catalogue/finder-stars.json"), "utf8"));
if (typeof finderStars.pos !== "string" || finderStars.pos.length < 40) {
  console.error("build-sw: finder-stars.json has no `pos` string to look for; did its shape change?");
  process.exit(1);
}
const FINDER_LEAK_MARKERS = ["finder-stars", finderMeta.filter, finderStars.pos.slice(0, 40)];
async function* clientFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* clientFiles(full);
    } else if (/\.(m?js|css|html|json|map|txt|webmanifest)$/.test(entry.name)) {
      yield full;
    }
  }
}
for await (const file of clientFiles(clientDir)) {
  const text = await readFile(file, "utf8");
  const marker = FINDER_LEAK_MARKERS.find((candidate) => text.includes(candidate));
  if (marker !== undefined) {
    console.error(`build-sw: the finder star file leaked into the browser bundle (${path.relative(root, file)})`);
    process.exit(1);
  }
}

const headersPath = path.join(clientDir, "_headers");
const headers = await readFile(headersPath, "utf8").catch(() => "");
if (!headers.includes("/sw.js")) {
  await appendFile(
    headersPath,
    `${headers.endsWith("\n") || headers === "" ? "" : "\n"}/sw.js\n  Cache-Control: no-cache\n`,
  );
}

console.log(`build-sw: dist/client/sw.js precaches ${count} files (${Math.round(size / 1024)} KiB)`);
