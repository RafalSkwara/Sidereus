// The maskable icon (app-icon), from its own source: public/pwa-maskable.svg keeps the sky and ground full bleed and
// draws the star at 0.8 about the centre, inside the safe circle (r = 204.8 of 512). The generator's `padding` would
// instead shrink the whole picture, sky included, into a flat #050916 frame, so padding is 0 here. Run by
// `npm run icons:build` after pwa-assets.config.mjs (see there).
import { defineConfig } from "@vite-pwa/assets-generator/config";

const background = { background: "#050916", fit: "contain" };
// Full colour: the generator's default (quality 60) quantises to a palette, which bands the sky gradient.
const png = { compressionLevel: 9, palette: false };

export default defineConfig({
  preset: {
    png,
    transparent: { sizes: [], padding: 0, resizeOptions: background, favicons: [] },
    maskable: { sizes: [512], padding: 0, resizeOptions: background },
    apple: { sizes: [], padding: 0, resizeOptions: background },
  },
  images: ["public/pwa-maskable.svg"],
});
