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
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "vite";
import { injectManifest } from "workbox-build";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDir = path.join(root, "dist/client");
const swPath = path.join(clientDir, "sw.js");

await build({
  configFile: false,
  logLevel: "warn",
  root,
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

const { count, size, warnings } = await injectManifest({
  swSrc: swPath,
  swDest: swPath,
  globDirectory: clientDir,
  globPatterns: ["_astro/**/*.{js,css,woff2}"],
  // Hashed file names carry their own revision.
  dontCacheBustURLsMatching: /^_astro\//,
});
for (const warning of warnings) {
  console.warn(`build-sw: ${warning}`);
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
