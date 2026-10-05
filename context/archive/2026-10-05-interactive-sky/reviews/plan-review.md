<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Interactive Tonight Sky

- **Plan**: `context/changes/interactive-sky/plan.md`
- **Date**: 2026-10-05
- **Phases**: 4
- **Findings**: 2 critical, 8 warnings, 0 observations
- **Overall**: NEEDS ATTENTION. The premise and the phase order are sound. Both critical findings sit in single-phase contracts and can be fixed in triage without re-planning.

## Verdicts

| Dimension | Verdict |
| --- | --- |
| Claim Accuracy | WARNING (F3, F5) |
| Substance | WARNING (F4) |
| Feasibility | FAIL (F1, F2, F6) |
| Sequencing | PASS |
| Architecture Fit | WARNING (F8) |
| Scope Discipline | PASS |
| Verifiability | WARNING (F10) |
| Coverage | WARNING (F7, F9) |

Verification commands: `npm test`, `npm run lint`, `npm run build` and `npm run test:e2e` all resolve; `npm test -- src/lib/engine/purity.test.ts` passes (3 tests). `stars:build` is absent, as expected, because Phase 1 creates it. Step 3.3 cannot be run as written (F10).

## Findings

### F1 — The island cannot paint the band it sits inside
- **Severity**: CRITICAL · **Impact**: MEDIUM · **Dimension**: Feasibility · **Location**: Phase 3 › Dashboard composition
- **Detail**:
  - The gradient lives on TonightSky's outer div (`TonightSky.astro:35`), and custom properties only inherit downward, so a React island in a slot cannot set it.
  - The slider is meant to sit "on the ground", below the silhouette (`:47-55`), which is outside the slot. One island's state can't render on both sides of a static Astro sibling.
- **Fix**: In live mode the island owns the whole band: gradient, verdict (passed as Astro children, as MoonCard does), panorama, silhouette and slider. Move the silhouette path and the verdict's minimum height into shared constants, so the static TonightSky (focused pages, setup states, /design, skeleton) stays identical.
- **Decision**: FIXED

### F2 — skyView's payload is 2–4× the 30 KB budget, and every Tonight page would pay for it
- **Severity**: CRITICAL · **Impact**: MEDIUM · **Dimension**: Feasibility · **Location**: Phase 2 › The sky view in Tonight's build; Progress 2.3
- **Detail**:
  - A simulated December night at 52°N has 99 frames and 13 bodies. Its JSON is about 54 KB; with Astro's `serializeProps` wrapping it is about 75 KB, and about 106 KB once HTML-escaped in the server island.
  - `buildTonight` runs for all five Tonight pages through `loadTonightFor` (`load.ts:142`), and the Targets page passes `limit: Infinity`.
- **Fix**:
  - Use a columnar shape: `startMs`, `stepMs`, a flat rotation array (frames × 9, 4 decimals), and per-body flat int arrays in tenths of a degree. Keep only the start and end labels server-formatted.
  - Assert on the serialised `skyView` (`JSON.stringify`) under 30 KB.
  - Gate skyView behind a `withSkyView` option that only the dashboard passes.
  - Take `ranked.entries.slice(0, MAX_RANKED_OBJECTS)`.
- **Decision**: FIXED

### F3 — The rotation layout and the unrefracted call are mis-specified
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Claim Accuracy · **Location**: Critical Implementation Details › Axis convention
- **Detail**:
  - `RotateVector` computes out_j = Σ_i rot[i][j]·v_i (`astronomy.js:6535-6537`), the transpose of a textbook M·v.
  - `HorizonFromVector`'s refraction parameter is typed `string` (`astronomy.d.ts:2255`), so `null` fails `astro check`.
- **Fix**: State `out_j = flat[j]·x + flat[3+j]·y + flat[6+j]·z` (with `flat[3i+j] = rot[i][j]`) in the contract, and use `""` for no refraction.
- **Decision**: FIXED

### F4 — The star names and key don't fit the data
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Substance · **Location**: Phase 1 › Generator, Loader
- **Detail**:
  - Five of the 15 brightest named stars (Canopus, Rigil Kentaurus, Achernar, Hadar, Acrux) never rise at 52°N, so Poland would see about 6–9 labels.
  - 6 of the 925 stars at mag ≤ 4.5 have no `hip` (Gl 194B, Castor B).
- **Fix**: Keep `name` on the 40 brightest named stars and let `placeLabels` cap the labels at 15 above the horizon. Key by HYG `id`. Update the "exactly 15" test.
- **Decision**: FIXED

### F5 — The `--sky-*` token names trip the colour guard
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Claim Accuracy · **Location**: Phase 3 › Twilight tokens
- **Detail**:
  - `no-hardcoded-colors.test.ts:28` flags `(bg|fill|from|to…)-sky`, which is why zenith and horizon were named as they are (`global.css:16-17`). The names would also collide with Tailwind's `--color-sky-*` palette.
  - `contrast.test.ts:95` reads only hex tokens, and its red rows check only background and surface.
- **Fix**: Rename the tokens `--dusk-glow`, `--dusk-glow-horizon`, `--dusk-twilight` and `--dusk-twilight-horizon`, with hex values. Add a red contrast row for muted labels on them (floor 3).
- **Decision**: FIXED

### F6 — "Now" and `showStars` don't work as specified
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Feasibility · **Location**: Phase 2/3 contracts; Phase 4 e2e
- **Detail**:
  - The frames carry no instant, yet the Moon slider's Now finds the frame nearest `Date.now()` (`MoonTimeSlider.tsx:93`).
  - The e2e line "Now restores the initial frame" is false in daytime, when CI usually runs.
  - `TopbarControls.tsx:112` switches theme without a reload, so a `showStars` prop goes stale.
- **Fix**: Make Now find the frame nearest the current time, clamped (from `startMs`/`stepMs`), and reword the e2e line. Drop `showStars` and hide the stars with the existing `hidden dark:block` CSS.
- **Decision**: FIXED

### F7 — HYG credit missing from the UI; the tripwire lands too late
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Coverage · **Location**: Phase 1; Phase 4 › Docs
- **Detail**: `Attribution.astro` credits OpenNGC and Open-Meteo "as required by the licences". CC BY-SA star data shown on /tonight needs the same credit. The CLAUDE.md tripwire for the generated files is planned in Phase 4, after the files land.
- **Fix**: In Phase 1, add a HYG credit (`tonight.attribution.starData`, EN/PL) to `Attribution.astro` and the CLAUDE.md tripwire.
- **Decision**: FIXED

### F8 — The lesson isn't applied, and nothing guards the new browser modules
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Architecture Fit · **Location**: Phase 3 › Pure sky-view maths
- **Detail**:
  - The rotation matrices encode the site's latitude and longitude, but `src/lib/sky-view/**` is not in `gearConfig.files` (`eslint.config.js:85-106`; lessons.md rule 1).
  - The island guard scans only the island's own files, and `purity.test.ts` covers engine and moon-disc only.
  - Shipping the matrices to the client is a new privacy exposure and should be recorded.
- **Fix**:
  - Add `src/lib/sky-view/**` to the no-console globs.
  - Extend the import guard to `src/lib/sky-view/*` and `src/lib/catalogue/stars.ts`, which must not import `./index` or `messier.json` lands in the chunk.
  - Record the decision: 4-decimal matrices, about 600 m precision, recoverable by a reader of the page.
- **Decision**: FIXED

### F9 — Failure isolation, the polar fallback and planets on cloudy nights
- **Severity**: WARNING · **Impact**: MEDIUM · **Dimension**: Coverage · **Location**: Phase 2 › The sky view; brief › No-go nights
- **Detail**:
  - Optional view parts use try/catch → null (`build.ts:596-640`, `:690-757`). The plan's "null only when the view isn't built" means a throw would take down the verdict.
  - The noon-to-noon fallback is 145 frames.
  - `solarSystem` is null when the planet window is clouded out (`build.ts:598`), which contradicts the brief's "planets still shown on no-go nights".
- **Fix**:
  - Wrap skyView in try/catch → null.
  - State the polar fallback and its size.
  - Track planets from the engine's own list of planets, independent of `solarSystem`, drawing each only while it is above the horizon. Link to `/tonight/planets#planet-<key>` when the planet has a row there, otherwise to `/tonight/planets`.
- **Decision**: FIXED

### F10 — Verification lines and e2e determinism
- **Severity**: WARNING · **Impact**: LOW · **Dimension**: Verifiability · **Location**: Progress 1.1, 3.3, Phase 4
- **Detail**:
  - Astro sets `reportCompressedSize: false`, so the build prints no gzip sizes (3.3).
  - 1.1 doesn't say how to compare the two runs.
  - Tonight's e2e specs run on the real clock, and a marker exists only while its body is up.
  - `planets.astro` has no hash-scroll script, and only `targets.astro:72-116` does.
- **Fix**:
  - 3.3 becomes `gzip -c` over the island's chunks, piped to `wc -c`.
  - 1.1 becomes `shasum` of both runs.
  - The e2e steps to a frame that has a marker (read from the DOM) and skips when no planet is listed.
  - Phase 4 adds a hash-scroll script to `planets.astro`.
  - Note that the skeleton keeps the night colour, so a colour change on swap is accepted.
  - The dark span is a positioned overlay with a thumb-width correction, not a track gradient (no arbitrary values).
- **Decision**: FIXED
