// The home-screen icons (S-06): the Topbar's four-point star in the dark theme's primary ink on its zenith navy, both
// drawn in public/pwa-icon.svg (the background is part of the source, so every size is opaque). Literal hex on purpose: icons cannot read the CSS tokens (`--primary`, `--zenith` in
// src/styles/global.css, dark block). Regenerate with `npm run icons:build`; the PNGs in public/ are committed.
import { defineConfig } from "@vite-pwa/assets-generator/config";

const background = { background: "#050916", fit: "contain" };

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    transparent: { sizes: [64, 192, 512], padding: 0, resizeOptions: background, favicons: [] },
    maskable: { sizes: [512], padding: 0.15, resizeOptions: background },
    apple: { sizes: [180], padding: 0, resizeOptions: background },
  },
  images: ["public/pwa-icon.svg"],
});
