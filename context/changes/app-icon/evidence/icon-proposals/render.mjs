// One-off capture for the app-icon change: renders each proposal's SVGs to PNG previews with sharp (the same
// librsvg-based rasteriser @vite-pwa/assets-generator uses) and lays them out in comparison.png with Playwright.
// Run from the worktree root (Node from .nvmrc):
//   node context/changes/app-icon/evidence/icon-proposals/render.mjs
// Colours on the sheet are the Nightfall --background of each theme (dark #070a12, light #fbfcfd, red #080000); the
// red view also runs the icon through the app's #red-only luminance filter (Layout.astro), as red mode does to <img>.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const proposals = [
  { dir: "1-star", name: "1 · Star" },
  { dir: "2-planet", name: "2 · Ringed planet" },
  { dir: "3-free", name: "3 · Horizon star" },
];
// favicon.svg serves the small sizes, icon.svg the home-screen sizes; maskable.svg is rendered at 512.
const renders = [
  { file: "favicon.svg", size: 16, out: "favicon-16.png" },
  { file: "favicon.svg", size: 32, out: "favicon-32.png" },
  { file: "icon.svg", size: 180, out: "apple-touch-180.png" },
  { file: "icon.svg", size: 192, out: "pwa-192.png" },
  { file: "icon.svg", size: 512, out: "pwa-512.png" },
  { file: "maskable.svg", size: 512, out: "maskable-512.png" },
];

const png = {};
for (const p of proposals) {
  png[p.dir] = {};
  for (const r of renders) {
    const svg = readFileSync(join(here, p.dir, r.file));
    const buffer = await sharp(svg, { density: 288 }).resize(r.size, r.size).png().toBuffer();
    writeFileSync(join(here, p.dir, r.out), buffer);
    png[p.dir][r.out] = `data:image/png;base64,${buffer.toString("base64")}`;
  }
}

const grounds = [
  { key: "dark", label: "Dark ground (--background #070a12)", bg: "#070a12", ink: "#dfe3ec", filter: "none" },
  { key: "light", label: "Light ground (--background #fbfcfd)", bg: "#fbfcfd", ink: "#1c2538", filter: "none" },
  {
    key: "red",
    label: "Red night mode (--background #080000, #red-only filter)",
    bg: "#080000",
    ink: "#f20000",
    filter: "url(#red-only)",
  },
];
const shown = [
  { out: "favicon-16.png", size: 16, label: "16" },
  { out: "favicon-16.png", size: 64, label: "16 ×4", pixel: true },
  { out: "favicon-32.png", size: 32, label: "32" },
  { out: "favicon-32.png", size: 64, label: "32 ×2", pixel: true },
  { out: "apple-touch-180.png", size: 90, label: "180 (½)", radius: 20 },
  { out: "pwa-192.png", size: 96, label: "192 (½)" },
  { out: "pwa-512.png", size: 128, label: "512 (¼)" },
  { out: "maskable-512.png", size: 128, label: "maskable, circle", mask: "circle" },
  { out: "maskable-512.png", size: 128, label: "maskable, squircle", mask: "squircle" },
];

const cell = (p, s, g) => {
  const radius = s.mask === "circle" ? "50%" : s.mask === "squircle" ? "28%" : s.radius ? `${s.radius}px` : "0";
  return `<figure><div class="slot"><img src="${png[p.dir][s.out]}" width="${s.size}" height="${s.size}" style="border-radius:${radius};${s.pixel ? "image-rendering:pixelated;" : ""}filter:${g.filter}"></div><figcaption>${s.label}</figcaption></figure>`;
};
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin: 0; font: 13px/1.3 -apple-system, system-ui, sans-serif; background: #070a12; }
  section { padding: 20px 24px; color: var(--ink); background: var(--bg); }
  h2 { margin: 0 0 12px; font-size: 14px; font-weight: 600; }
  .row { display: flex; align-items: flex-end; gap: 18px; margin-bottom: 14px; }
  .name { width: 120px; font-weight: 600; align-self: center; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .slot { height: 128px; display: flex; align-items: flex-end; }
  figcaption { font-size: 11px; opacity: 0.8; white-space: nowrap; }
</style></head><body>
<svg width="0" height="0" style="position:absolute"><filter id="red-only" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter></svg>
${grounds
  .map(
    (g) =>
      `<section style="--bg:${g.bg};--ink:${g.ink}"><h2>${g.label}</h2>${proposals
        .map(
          (p) => `<div class="row"><div class="name">${p.name}</div>${shown.map((s) => cell(p, s, g)).join("")}</div>`,
        )
        .join("")}</section>`,
  )
  .join("")}
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1180, height: 800 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.screenshot({ path: join(here, "comparison.png"), fullPage: true });
await browser.close();
console.log("rendered", proposals.length, "proposals and comparison.png");
