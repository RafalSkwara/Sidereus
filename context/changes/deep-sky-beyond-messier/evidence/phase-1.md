# Phase 1 evidence: Caldwell catalogue

Spot check (Progress 1.5), run 2026-10-06 by the implementing agent: `caldwell.json` compared with the pinned OpenNGC rows (commit da90466).

| C | id | Check against OpenNGC | Result |
|---|---|---|---|
| 14 | NGC869 | NGC0869 RA 02:18:58.56 / Dec +57:07:02.1 and NGC0884 RA 02:22:32.10 / Dec +57:08:38.8. Midpoint RA 2.345925 h, Dec +57.13068°. vMag 3.7 is the brighter V-Mag (869: 3.70, 884: 3.80), and bMag is 4.3. The major axis of 41.5′ is a merge (centre separation plus the mean radius). Label "NGC 869 / 884". | ✓ |
| 20 | NGC7000 | HII → emission-nebula, 120′ × 30′. V-Mag is empty, so B-Mag 4.00 → vMag 4, recorded as a normalisation. | ✓ |
| 33 | NGC6992 | SNR → supernova-remnant, 60′ × 8′. V-Mag is empty, so B-Mag 7.00 → vMag 7. Common name "Eastern Veil" (first entry). | ✓ |
| 39 | NGC2392 | PN, 0.86′, V 9.61 / B 10.12, Gem, "Eskimo Nebula". | ✓ |
| 63 | NGC7293 | PN, 16.33′, V 7.30 / B 7.50, Aqr, Dec −20.84° (inside the −23° floor), "Helix Nebula". | ✓ |

**Correction to research.md §5:** all 10 reachable objects without a V-Mag have a B-Mag in OpenNGC, not only 3. So the plan's magnitude policy needed no hand-sourced V-mag override. The override mechanism stays in the generator, unused.

**Watch in Phase 2 (calibration):** some B-Mag values for emission nebulae differ from published integrated magnitudes:
- IC 405: 10.0 against about 6.0 on Wikipedia, which is probably the magnitude of the star AE Aur.
- NGC 2238: 6.0 against 9.0 for the Rosette Nebula.
- NGC 7635: 11.0 against 10.

If one of them ranks oddly, add a single sourced override to `CALDWELL_OVERRIDES` in `scripts/build-catalogue.mjs`.

**Gates:**
- `catalogue:build`: 110 Messier + 61 Caldwell. `messier*.json` is byte-identical, and two builds give identical `caldwell*.json` md5s.
- vitest: 73 files, 775 passed, 6 todo.
- `astro check`: 0 errors.
- eslint (`--ignore-pattern '.claude/**'`, the local OOM workaround): 0 errors, plus 2 old warnings in `determinism.test.ts`.
- Break check: setting the Caldwell label to the id turned 2 `caldwell.test.ts` tests red; the file was restored.
