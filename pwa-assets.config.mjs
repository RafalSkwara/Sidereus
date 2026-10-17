// The home-screen icons (S-06; app-icon, the owner's pick of 2026-10-17): a white star over a dusk horizon, drawn in
// public/pwa-icon.svg (512 viewBox, full bleed, so every size is opaque). Literal hex on purpose: icons cannot read
// the CSS tokens (`--zenith`, `--horizon`, `--dusk-glow-horizon`, `--background`, `--primary` in src/styles/global.css,
// dark block). `npm run icons:build` runs this config, then the maskable and the favicon configs beside it, because
// the generator takes one source image per run and the three sources differ:
//   pwa-assets.config.mjs           public/pwa-icon.svg     -> pwa-64x64, pwa-192x192, pwa-512x512, apple-touch-icon-180x180
//   pwa-assets.maskable.config.mjs  public/pwa-maskable.svg -> maskable-icon-512x512
//   pwa-assets.favicon.config.mjs   public/favicon.svg      -> favicon.png (32), favicon.ico (32)
// The PNGs and the ICO in public/ are committed. The sources are copies of
// context/changes/app-icon/evidence/icon-proposals/final/ (icon.svg, maskable.svg, favicon.svg).
import { defineConfig } from "@vite-pwa/assets-generator/config";

const background = { background: "#050916", fit: "contain" };
// Full colour: the generator's default (quality 60) quantises to a palette, which bands the sky gradient.
const png = { compressionLevel: 9, palette: false };

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    png,
    transparent: { sizes: [64, 192, 512], padding: 0, resizeOptions: background, favicons: [] },
    maskable: { sizes: [], padding: 0, resizeOptions: background },
    apple: { sizes: [180], padding: 0, resizeOptions: background },
  },
  images: ["public/pwa-icon.svg"],
});
