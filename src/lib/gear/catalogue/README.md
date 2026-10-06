# Gear catalogue

Hand-entered telescopes and eyepieces behind the comboboxes on `/gear` and in onboarding (roadmap S-12). The data is
stored as numbers only: choosing an entry fills the form's own fields, which stay editable. The licence and provenance
are in `LICENSE-DATA.md`.

- `types.ts`: the entry shapes (island-safe).
- `telescopes.json`, `eyepieces.json`: the data, prettier-formatted, edited by hand.
- `fill.ts`: `telescopeFill`, `eyepieceFill` (through `presetForAfov`, so 50 / 68 / 82 degrees pick a named preset and
  anything else picks `other`) and `bundledEyepieces`.
- `load.ts`: `loadTelescopes` / `loadEyepieces`, a memoised dynamic `import()` of each file, so each is its own chunk.
- `search.ts`: the "every word matches" search.
- `catalogue.test.ts`: pins the data's integrity. Run it after every edit.

## Adding an entry

1. Find the product on the **manufacturer's page**; use a reputable retailer (First Light Optics, Teleskop-Express, OPT,
   Astronomics) only when the manufacturer's page does not show the figure. Never copy from a database, and never copy
   descriptions.
2. Add the entry with an `https` `source` pointing at that page. If sources disagree, leave the entry out until they
   agree.
3. `id` is a stable kebab slug (`skywatcher-heritage-130p`). It never changes once shipped.
4. `name` is what fills the form: it starts with the brand, is at most 60 characters, and is unique within its file.
   Brand, model and numbers only: the name is copied into the user's own data in any language, so no descriptive
   words ("bundled", "Tabletop Dobsonian", "Maksutov", "SCT"), no parentheses, no brand tagline and no mount. Those
   go in `aliases`, where search still finds them. Put the focal length in the name only when two models share a
   name and differ only in it (Explorer 130/900 and 130/650).
5. Numbers: at most one decimal. Telescope aperture 20-1000 mm, focal length 100-5000 mm (the effective focal length
   for a catadioptric), focal ratio f/3-f/16. Eyepiece focal length 2-60 mm, AFOV a whole number of degrees, 30-120.
6. One entry per optical tube; mount variants go in `aliases`. Barlows are out of scope.
7. A telescope that ships with eyepieces lists their ids in `bundledEyepieces` (add them to `eyepieces.json` too, with
   `"bundled": true`; the localised detail line says "bundled", the name does not).
8. Keep exactly one "Heritage 130" in the telescopes: the e2e search relies on it.

## Estimated AFOV

A manufacturer who does not publish an AFOV gets the typical value for the eyepiece's design, and the entry is flagged
`afovEstimated`:

| Design       | AFOV |
| ------------ | ---- |
| Plössl       | 50°  |
| Kellner (SR) | 45°  |
| Huygens (H)  | 40°  |

A bundled eyepiece whose page gives only its focal length gets a design by its kind: the "Super" and "SR" eyepieces
shipped with beginner scopes count as Kellner, "H" as Huygens, "PL" as Plössl.

## Zoom eyepieces

A form stores one focal length and one AFOV, so a zoom becomes one entry per click stop, each with `zoom: { minMm,
maxMm }` and a name that says where it is set ("Baader Hyperion Zoom 8-24 mm @ 12 mm"); the detail line says it is a
zoom. The AFOV at a click stop is interpolated linearly between the published values at the two ends, rounded to whole
degrees (halves round up), and flagged `afovEstimated`; the two endpoint stops carry the published figure and are not flagged. For the Baader Hyperion Zoom Mark IV that is 68° at 8 mm down to 50° at 24 mm, which gives 68, 64, 59,
55 and 50 degrees at 8, 12, 16, 20 and 24 mm.
