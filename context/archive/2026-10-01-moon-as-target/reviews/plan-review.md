<!-- PLAN-REVIEW-REPORT -->
# Plan Review: The Moon as a Target

- **Plan**: `context/changes/moon-as-target/plan.md`
- **Date**: 2026-10-01
- **Phases**: 3
- **Findings**: 0 critical · 8 warnings · 2 observations
- **Overall**: NEEDS ATTENTION

## Verdicts

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Claim Accuracy | WARNING | F1, F10 |
| Substance | WARNING | F9 |
| Feasibility | PASS | — |
| Sequencing | PASS | — |
| Architecture Fit | WARNING | F5 |
| Scope Discipline | PASS | — |
| Verifiability | WARNING | F2, F3, F8 |
| Coverage | WARNING | F4, F6, F7 |

**Verification commands checked:**
- `npm test` ran and passed on main.
- `npx astro check` reported 0 warnings and 0 hints.
- Scripts `test`, `test:db`, `db:types`, `lint`, `build` and `test:e2e` exist in package.json.
- `npx supabase db reset` and `db:types` were not run, because they change state.
- `npx supabase status` hung with the stack partly stopped.

## Findings

### F1 — Pinned test nights don't describe a visible Moon or sit on band edges
- **Severity**: WARNING · **Impact**: 🏃 LOW · **Dimension**: Claim Accuracy
- **Location**: plan.md, Current State table, and Phase 1 §7
- **Detail**: All values below were rechecked with astronomy-engine for Warsaw.
  - 2026-10-17: the Moon is at −4.5° at 20:00 UTC and peaks at about 10.6° around 16:00 UTC, below the 15° default minimum. At that time its elongation is 79–80°, which is a waxing crescent, not first quarter.
  - 2026-11-02: the Moon is at −16° at 20:00 UTC.
  - Band tests routed through `moonTarget` or `buildTonight` on these nights fail or flake on the band edges.
- **Fix**: Test bands on explicit instants through `moonPhaseBand(moonElongationDeg(t))`, at least 5° from an edge. Assert `moonTarget` only on nights checked to clear the minimum (10-24, 10-26). Fix the table caption to say it is a 20:00 UTC snapshot.
- **Decision**: FIXED

### F2 — Manual check 3.6 cannot pin a night on the preview
- **Severity**: WARNING · **Impact**: 🏃 LOW · **Dimension**: Verifiability
- **Location**: Phase 3 Manual Verification, Progress row 3.6
- **Detail**:
  - `TonightContent.astro:51` passes `now: new Date()`, with no clock override.
  - `tests/e2e/forecast-fixture.mjs` is relative to `Date.now()`.
  - No "pinned bright-Moon night" can be shown on the local preview.
- **Fix**: Make the guarantee an automated `build.test.ts` assertion (bright on 10-26, absent on 10-10). The manual check becomes a screenshot of whatever tonight shows, plus the line's presence or absence matching `brightMoonNight` for today. Row 3.6 keeps its title, with an inline note in the phase block.
- **Decision**: FIXED

### F3 — The e2e criterion names no command or setup, and the Moon spec usually skips
- **Severity**: WARNING · **Impact**: 🏃 LOW · **Dimension**: Verifiability
- **Location**: Phase 3 Automated Verification, Progress row 3.4
- **Detail**:
  - The command is `npm run test:e2e` (playwright). `playwright.config.ts` has no `webServer`.
  - It needs local Supabase, `FIXTURE_PORT=4400 node tests/e2e/forecast-fixture.mjs`, `FORECAST_BASE_URL` in `.dev.vars`, then `npm run build && npm run preview`, with `BASE_URL=http://localhost:4321`. The site is Madrid.
  - The real-clock Moon spec skips on roughly half of all days.
- **Fix**: Spell out the command and setup in the phase block. Add the `tonight-all-objects` spec, since ObjectDetails is shared. State that the unit tests carry the Moon guarantee and the e2e only covers the flow.
- **Decision**: FIXED

### F4 — The Skyfield reference plumbing is under-specified
- **Severity**: WARNING · **Impact**: 🏃 LOW · **Dimension**: Coverage
- **Location**: Phase 1 §3, §6, §7, Progress row 1.2
- **Detail**:
  - Skyfield JSON is parsed in `src/lib/engine/fixtures/index.ts` (`parsePlanetReference` :266, `PLANET_REFERENCES` :294). That file is not in the plan, and neither is the fixtures README.
  - `planets.test.ts:14` compares only samples above 5°, because the two refraction models diverge near the horizon. The Moon contract leaves this filter out.
  - The tie-break claim is wrong. `maxBy` (`eyepieces.ts:63-72`) keeps the earlier eyepiece in input order, and `EyepieceOpticsInput` has no id.
  - Row 1.2 is not a separate check: `npm test` covers it once the fixture is committed.
- **Fix**:
  - Add `fixtures/index.ts` (type, parser, export) and the README row.
  - Specify the 5° filter.
  - Reword the tie-break as "earlier in input order".
  - Note under §7 that 1.2 means "the fixture is committed with provenance and `moon.test.ts` passes". The row title stays.
- **Decision**: FIXED

### F5 — The bright-Moon predicate duplicates the outlook, and its failure is unhandled
- **Severity**: WARNING · **Impact**: 🔎 MEDIUM · **Dimension**: Architecture Fit
- **Location**: Phase 1 §5, Phase 3 §1
- **Detail**:
  - `sevenNightOutlook` already computes illumination at the dark-window midpoint and `moonFreeMinutes` for tonight (`outlook.ts:141-177`, called at `build.ts:289`). The strip shows those values.
  - A second computation adds work and could disagree with the strip.
  - `brightMoonText` sits outside the solar-system try/catch, so a throw there takes down the whole view.
  - An exact 0.5 boundary cannot be reached from real ephemeris input.
- **Fix**: Make the engine function pure, `isBrightMoon(illuminatedFraction, upFraction)`, with the boundary tests. `buildTonight` feeds it from `outlook[0]`'s Moon values when night 1 is tonight with a dark window, and any failure yields `null`.
  - Strength: one source of truth with the strip, zero extra ephemeris work, testable boundaries.
  - Tradeoff: couples the line to the outlook's night-1 shape.
  - Confidence: HIGH. Read in `outlook.ts` and `build.ts:289`.
  - Blind spot: the exact field names on the outlook's night entry; the implementer confirms them.
- **Decision**: FIXED

### F6 — The bright-Moon copy can promise targets that aren't on the page
- **Severity**: WARNING · **Impact**: 🏃 LOW · **Dimension**: Coverage
- **Location**: Phase 3 §3, `tonight.card.brightMoon`
- **Detail**:
  - The predicate counts the Moon as up above 0°, but the Moon card needs the site minimum.
  - The section needs the solar-system verdict to be go or marginal.
  - So "The Moon and planets below are better bets" can show with nothing below it.
- **Fix**: Split the copy into the washed-out sentence, which is always shown, and a pointer sentence shown only when `solarSystem?.moon || solarSystem?.entries.length`.
- **Decision**: FIXED

### F7 — Existing copy not covered by the rename
- **Severity**: WARNING · **Impact**: 🏃 LOW · **Dimension**: Coverage
- **Location**: Phase 2 §3–4, Phase 3 §3
- **Detail**:
  - `tonight.planets.weather.line` reads "For planets: …" / "Dla planet: …" (`en.ts:443`), and `build.test.ts:632,656,689,723` pin it.
  - `none` / `noneInClearHours` say "for your telescope". The Moon is not limited by aperture.
  - `log.manualIntro` reads "Pick a Messier object or a planet…" (`en.ts:650`).
  - The picker order is pinned by `target-search.test.ts:18`. The Moon should go between Messier and the planets, not "before the planets".
  - The plan's "Logged: the Moon" is wrong. The real notice is `tonight.logged`, which gives "Moon logged." / "Zapisano obserwację: Księżyc." It needs no new grammar.
- **Fix**: Add these keys, tests and comments to Phase 2 §4 and Phase 3 §3, and correct the Desired End State notice text.
- **Decision**: FIXED

### F8 — The planets e2e breaks on Moon-only nights
- **Severity**: WARNING · **Impact**: 🏃 LOW · **Dimension**: Verifiability
- **Location**: Phase 3 §5, `tests/e2e/planets-on-tonight.spec.ts:27-33,52`
- **Detail**:
  - The spec expects `tonight.planets.none` when no planet card shows. Under the new rule `noneText` is null when the Moon is present, so a Moon-only night fails instead of skipping.
  - `ol > li` matches the Moon card if the Moon is also an `ol > li`.
- **Fix**: Scope the spec to the labelled planet list, and skip when there are no planet cards and no `noneText`. Render the Moon card outside any `ol > li`, or give it its own labelled list.
- **Decision**: FIXED

### F9 — The `TargetDetails` extraction needs slots and an accessible-name prop
- **Severity**: OBSERVATION · **Impact**: 🏃 LOW · **Dimension**: Substance
- **Location**: Phase 3 §4
- **Detail**:
  - In ObjectDetails and PlanetCard, the eyepiece and reason paragraphs sit between the `dl` and the log link.
  - The link's accessible name differs: an sr-only id span in one, an `aria-label` in the other.
  - ObjectDetails is also used by ObjectRow (`/tonight/all`).
  - Nothing checks "identical output".
- **Fix**: Specify `TargetDetails` with a default slot between the `dl` and the link, and an `accessibleName` prop. Verify with the existing e2e specs (Tonight, all-objects) and before/after screenshots.
- **Decision**: FIXED

### F10 — Engine contract details
- **Severity**: OBSERVATION · **Impact**: 🔎 MEDIUM · **Dimension**: Claim Accuracy
- **Location**: Phase 1 §3–4, Phase 2 §5
- **Detail**:
  - `planetEyepiece` falls back to the lowest magnification, so "detail" can sit below `wholeDisc`.
  - `bestWindow`/`maskedTrack` are typed `HorizontalPosition`, so the peak loses its illumination. Facts need `moonState(peak.time)`.
  - `placementOf` is private and keyed to `PLANET_LOW_ALTITUDE_DEG = 20`. The Moon's 30° line leaves its "well" band at only 30–40°.
  - No illumination floor: a 1–2% sliver in bright twilight gets a card with a low site minimum.
  - DB anchor `:336-346` is wrong. The planet update cases are at `tests/db/observations.test.ts:226-240`.
  - No determinism assertion covers the new view fields.
- **Fix**:
  - Set `detail = null` when its magnification is at or below `wholeDisc`'s.
  - Take facts from `moonState(peak.time)`.
  - Use a Moon-specific placement with the 30° asymmetry documented as deliberate.
  - Add `MOON_MIN_ILLUMINATION = 0.03`, below which the Moon is not listed.
  - Fix the anchor.
  - Add a same-inputs → same `solarSystem.moon` / `brightMoonText` assertion.
  - Strength: removes nonsense outputs before they are coded. Tradeoff: one more candidate parameter. Confidence: HIGH, read in `eyepieces.ts:131-143` and `objects.ts:76`. Blind spot: 3% is a judgment call, though a 2-day crescent at 4.5% still shows.
- **Decision**: FIXED

*Dismissed before triage:* "no step updates roadmap or board". `/10x-plan` already flipped roadmap S-02 and board #66 to `planning` in this session.
