# Verified Ephemeris Core — Plan Brief

> Full plan: `context/changes/verified-ephemeris-core/plan.md`

## What & Why

Build the pure sky-maths foundation the whole product ranks against: a licensed 110-object Messier catalogue generated from OpenNGC, and an engine that computes the dark window, moon state and object positions for a site and night, verified against Stellarium within the PRD's candidate tolerance (1°, 5 min). Roadmap F-01 exists because every later slice (Tonight ranking, no-darkness explanation, 7-night planner) is only as right as these numbers, and the PRD's "never recommends the physically impossible" guardrail has no other defence.

## Starting Point

The repo is the untouched starter scaffold: auth pages, no product code, **no unit test runner**, CI running lint/type-check/build/smoke. No catalogue data and no astronomy dependency exist. Foundation docs settle the stack (Astro 7 SSR on Cloudflare Workers, TypeScript, Vite 8) and the PRD fixes the contracts: determinism, evening-date nights, Bortle-dependent darkness thresholds, DST correctness on 2026-10-25.

## Desired End State

`npm test` runs Vitest locally and in CI. `src/lib/catalogue/messier.json` holds exactly 110 objects with provenance and attribution, regenerable by one command. `src/lib/engine/` exposes `observingNight`, `darkWindow`, `moonState`, `moonSeparationDeg`, `objectTrack` and `bestWindow`, all pure. Three fixture files carry hand-read Stellarium values for Warsaw (two autumn nights, one spanning the DST change) and Tromsø (midsummer, no darkness), and every engine result matches them within tolerance. A tolerance report answers roadmap Open Question 9 with measured numbers.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Ephemeris library | `astronomy-engine` 2.1.19 | MIT, zero deps, browser-safe, ±1′ accuracy, and its `SearchAltitude` returns `null` when a threshold is never reached, which is exactly the FR-023 signal. |
| Test runner | Vitest 5 via Astro's `getViteConfig` | Only documented Astro path; Vite 8 is in its peer range; tsconfig already includes test files for type-checked lint. |
| Catalogue delivery | Generator script → committed JSON, pinned OpenNGC commit `da90466` | Runtime never parses CSV; licence, provenance and every deviation are reproducible from one command. |
| M102 identity | NGC 5866 as M102 (override of OpenNGC's "duplicate of M101") | Matches Stellarium and beginner guides, so cross-checks and future log entries line up; deviation is documented in metadata. |
| Timezone | IANA zone id is an engine **input**; lookup lives in S-01 | Keeps the engine I/O-free and small; coordinate→zone data belongs where sites are created. |
| Observing night | Local noon D → local noon D+1 | Always contains one sunset, one dark window, one sunrise; survives after-midnight logging and the 25-hour DST night without special cases. |
| Verification fixtures | Warsaw × 2 autumn 2026 nights + Tromsø 2026-06-21, values read from Stellarium by hand | Covers the PRD's 52°N assumptions and its no-dark-window case while keeping home coordinates out of the repo. |
| J2000 handling | Rotate catalogue vectors straight into the horizontal frame (`Rotation_EQJ_HOR` + `HorizonFromVector`) rather than passing J2000 RA/Dec to `Horizon()` | Skipping the rotation silently eats ~0.4° of the 1° tolerance; the direct rotation is two calls and reusable across all 110 objects per time step. |
| Moon fixture night | Warsaw 2026-10-24 (waxing gibbous) and Tromsø; 2026-10-10 marked not-applicable | 2026-10-10 is a new-moon night: the Moon is next to the Sun and below the horizon for the whole dark window (plan review F1). |
| Data licence | `LICENSE-DATA.md` declares the catalogue files CC BY-SA 4.0 derived works | ShareAlike is not satisfied by attribution alone; the code licence is a separate decision (plan review F7). |
| CI scope | Add `npm test` to the existing `ci` job only | Repo rule says wire new test frameworks into CI; the deploy gate stays with F-02. |

## Scope

**In scope:**
- Vitest config, `test` scripts, one CI step
- `scripts/build-catalogue.mjs`, `messier.json`, `messier.meta.json`, typed catalogue module, attribution in README
- Engine: types, candidate parameters, night window, sun events, dark window (incl. `none` variant), moon state/separation/track, object position/track/best window, barrel
- Fixture schema, capture protocol, three fixture files, fixture-driven and synthetic tests, purity and determinism guards, timing budget
- Tolerance report, roadmap Open Question 9 note, `CLAUDE.md` refresh

**Out of scope:**
- Scoring, verdict, forecast, cache, eyepiece maths (S-02); "date darkness returns" forward search (S-04); coordinate→timezone lookup (S-01)
- Display concerns (compass points, constellation names), persistence, UI, API routes
- CI deploy job and preview environments (F-02); southern-hemisphere fixtures; scripted Stellarium export

## Architecture / Approach

`scripts/build-catalogue.mjs` (build time, network) → `src/lib/catalogue/messier.json` + meta → `src/lib/catalogue/index.ts` (typed, read-only). `src/lib/engine/` is a set of pure modules over `astronomy-engine` and `Intl`: `night.ts` (noon-to-noon window), `sun.ts` (events, dark window), `moon.ts`, `objects.ts`, `parameters.ts` (named PRD candidates), exported through `index.ts`. Tests sit beside the code; `fixtures/stellarium/*.json` hold expected values with per-section `pending`/`captured` status so uncaptured fixtures show up as `todo`, never as silent passes.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Test harness and Messier catalogue | `npm test` in repo and CI; 110-object catalogue with overrides, metadata and attribution | Cloudflare adapter's Vite plugin interfering with Vitest startup (documented override exists) |
| 2. Night model, sun events and dark window | `observingNight`, `darkWindow` incl. never-reached case; fixture schema + capture protocol; first Stellarium reading | Local-noon derivation across the DST night; protocol ambiguity making readings unrepeatable |
| 3. Moon and object positions | Moon state/separation, object tracks, `bestWindow`; determinism and <1 s timing tests; second Stellarium reading | J2000→of-date omission; azimuth wrap-around in comparisons |
| 4. Tolerance report and hand-off | Measured deviations vs candidate tolerance; roadmap note; `CLAUDE.md` refreshed | Measured error exceeding 1°/5 min forces a tolerance decision (user's call, Open Question 9) |

**Prerequisites:** Stellarium installed locally for the two manual readings; network access once to fetch the pinned OpenNGC files.
**Estimated effort:** ~4 implementation sessions across 4 phases, with two short Stellarium reading sessions by the user between phases 2→3 and 3→4.

## Open Risks & Assumptions

- Stellarium's displayed *apparent* altitude (atmosphere on) is assumed comparable to astronomy-engine's `'normal'` refraction; a systematic offset near the horizon would show up in the report, not silently.
- Moon separation ignores topocentric parallax (≤1° error) — acceptable for a scoring input, documented in code.
- The 1000 ms timing bound is for position sampling only; S-02 adds scoring on top and owns the full "ranking under a second" NFR.
- OpenNGC's `Dup` handling for M102 could change upstream; the pinned commit isolates us, and the override is asserted by a test.

## Success Criteria (Summary)

- `npm run lint && npx astro check && npm test && npm run build` are green locally and in CI, with zero `todo` fixtures left.
- Every engine result for the three fixtures is within 1° / 5 min of Stellarium, and the measured maxima are recorded against roadmap Open Question 9.
- S-02 can import `@/lib/engine` and `@/lib/catalogue` and get, for any site and evening date, a dark window (or a reasoned `none`), moon state and object tracks without touching I/O.
