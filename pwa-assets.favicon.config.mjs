// The tab icon's raster fallbacks (app-icon), from public/favicon.svg (32 viewBox: a rounded tile and a star with a
// thicker waist, drawn to stay a star at 16 px). Layout.astro links the SVG first and favicon.png second; favicon.ico
// answers the implicit /favicon.ico request of browsers, crawlers and feed readers that ignore the links. Run by
// `npm run icons:build` after pwa-assets.config.mjs (see there).
import { defineConfig } from "@vite-pwa/assets-generator/config";

const background = { background: "#050916", fit: "contain" };
// Full colour: the generator's default (quality 60) quantises to a palette, which bands the sky gradient.
const png = { compressionLevel: 9, palette: false };

export default defineConfig({
  preset: {
    png,
    // The rounded tile's corners stay transparent.
    transparent: { sizes: [32], padding: 0, resizeOptions: background, favicons: [[32, "favicon.ico"]] },
    maskable: { sizes: [], padding: 0, resizeOptions: background },
    apple: { sizes: [], padding: 0, resizeOptions: background },
    assetName: () => "favicon.png",
  },
  images: ["public/favicon.svg"],
});
