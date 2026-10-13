<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Finder chart (M-3 S-03)

- **Plan**: context/changes/finder-chart/plan.md (commit a96d30b, branch feat/finder-chart)
- **Phases**: 5
- **Date**: 2026-10-11
- **Reviewer**: the "reviewer" agent (Opus), independent of the plan's author
- **Verdict**: REJECTED by the rubric (one critical FAIL, Feasibility). **Triage is recommended over re-planning.** The premise holds: a server-rendered SVG, a server-only HYG file to 7.5, a pure engine fed the star list, and a two-layer plan check. The critical finding (F1) is a bounded rule plus a test change in Phase 2, so it does not need a new plan.
- **Findings**: 1 critical, 7 warnings, 2 observations
- **Triage**: applied by the plan author on 2026-10-11 (see each Decision line). **Owner decisions resolved 2026-10-13 (all seven)**: O-1, O-3, O-5 confirmed; O-2 (F1) and O-7 (F8) confirmed as planned; O-4 changed: Phase 5 "Offline finder charts" added (old Phase 5 is now Phase 6, so this review's "Phase 5" references mean Phase 6); O-6 resolved as option (A): stay on HYG v4.1, the owner requests an ESA commercial licence, SAO-only fallback before any payment if ESA refuses (research §9, §9.1). Phase 5 and the O-6 outcome need a re-review. Originally not run interactively. The owner is away and the orchestrator's rules forbid asking, so each finding carries the reviewer's **Recommended resolution** and `Decision: PENDING`. The plan's author applies the accepted fixes. `change.md` was deliberately left at `planned` (the author flips it). The roadmap edit in the working tree is the author's and was not touched.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Claim Accuracy | WARNING |
| Substance | WARNING |
| Feasibility | FAIL |
| Sequencing | WARNING |
| Architecture Fit | PASS |
| Scope Discipline | WARNING |
| Verifiability | WARNING |
| Coverage | WARNING |

## Grounding

- **Claims:** two Opus sub-agents checked them (claim verification, and feasibility with geometry). The geometry work included astronomy-engine computations over the Messier and Caldwell catalogues at Madrid (40.42° N) and Warsaw (52.23° N); the scripts are in the session scratchpad, not the repo. The reviewer spot-checked the decisive ones.
- **Confirmed:**
  - **Server-island replay is feasible.** Research §7 is wrong and the plan is right. Astro 7.3.2 emits `<link rel="preload" as="fetch" href="/_server-islands/<Name>?e=…&p=…&s=…">` when the URL is under 2048 characters (`node_modules/astro/dist/runtime/server/render/server-islands.js:26-30,144-152`). The endpoint decrypts with the per-build key (no `ASTRO_KEY` is set), with no session binding, nonce or expiry, so the same build accepts a replay from any cookie. The repo already replays it in the service worker (`src/lib/offline/copies.ts:161-171`, `src/sw.ts:419-421`). Caveat: the href is HTML-escaped (`&amp;`).
  - **Purity.** `src/lib/engine/purity.test.ts` skips `*.test.ts` (l.68) and `fixtures/` (l.62) and does not forbid JSON imports, so the test-only star import passes. Engine files already import `@/lib/catalogue` (type-only).
  - **Constants.** `FOV_FIT_FRACTION = 0.8`, `NAKED_EYE_LIMITING_MAG` = 7.6 … 4.0, `EYE_PUPIL_REFERENCE_MM = 7`. D-5 gives 7.16-7.5, as the plan says. The D-3 limits never exceed the naked-eye limit.
  - **Refraction.** `objectPosition` is refracted and `skyFrames` unrefracted, so D-6's "errs on the safe side" holds.
  - **Planet direction.** `Equator(body, date, observer, false, true)` gives J2000 coordinates.
  - **Plan guard order, gating and island.** `requireFullPlan` checks not-configured, then signed-out, then needs-full (`account-plan/index.ts:43-61`). `/tonight/finder` is gated and `/_server-islands` is not. `loadTonightFor` exposes the site's Bortle and minimum altitude, the telescope and the eyepieces.
  - **Tokens.** `stroke-heading` and `stroke-primary-strong` exist and are already used.
  - **Crosshair** is in lucide-react 1.45.0.
  - **CI.** It runs smoke and the e2e spec in the `smoke` job against the all-clear forecast fixture (`.github/workflows/ci.yml:51-75`). Only `test:db` receives `SUPABASE_SECRET_KEY` (l.48).
  - **No collisions.** None of the plan's new files exists yet.
- **Wrong or missing:** see F9.
- **Commands:**
  - Resolve: `npm run stars:build`, `npm run smoke`, `npx vitest run <dir>` (include `src/**/*.test.ts`; `src/i18n/i18n.test.ts` and the three `src/styles` tests exist), `npm test`, `npm run lint`, `npx astro check`, `npm run build`, `npx playwright test <spec>`.
  - Not executed: `stars:build` rewrites the generated files in the author's checkout, and smoke and e2e need a preview, local Supabase and the fixture. The reviewer ran nothing that writes.
- **Licence:** O-6 and D-10 are adequate for M-3; see F10 for the attribution coverage. (2026-10-13: O-6 resolved by the owner as option (A); see the Triage line.)

## Findings

### F1 — "Zenith up" breaks for targets near the zenith, and the Phase 2 orientation test is false
- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Feasibility
- **Location**: plan.md D-6, O-2, Phase 2 › 2 (`finderChart`), Phase 2 › 4 tests ("a star higher in altitude has smaller `y`"), Phase 5 › 3 e2e
- **Detail**:
  - **The plan's own e2e site hits it.** M31 (dec +41.3°) culminates at about 89° in Madrid (40.42° N). On 2026-10-11 its best time is 23:40 UTC at 88.8°. Within ±10 minutes its azimuth swings 51° → 329° → 293° and the field rotation jumps from −130° to +133°. "Facing NNW, 89° up" means nothing, and a zenith-up chart is valid only for minutes.
  - **The overview panel straddles the zenith.** At Bortle 5-9 the start is Mirach at 83.4°; the panel's midpoint is 2.7° from the zenith with a half-field of about 6.9°.
  - **The e2e is likely to land on it.** It "follows the first Finder chart link" on `/tonight/targets` in Madrid, which in October plausibly opens M31.
  - **This is not rare.** In Madrid on 2026-10-11, 12 of 131 objects that clear 15° peak above 85°, and 24 above 80°. At 52° N, 5-7 objects a season do (October: M76 89.4°, M39 86.3°, NGC 869 84.9°; January: M109 89.0°, M101 87.6°, M97 87.4°).
  - **The test property is false even away from the zenith.** Circles of equal altitude curve toward the zenith, so a star 5° off the vertical at a centre altitude of 45° projects about 0.2° higher than its altitude implies, about 1.2° at 10° from the zenith. Past the zenith, altitude falls as `y` decreases.

  Phase 2 cannot pin its own orientation test as written, and the slice's headline view breaks for a common class of targets.
- **Fix**: Add a parameter `FINDER_OVERHEAD_ALT_DEG = 80`.
  - **Overhead rule:** when a panel's centre is at or above it, or the zenith falls inside the panel, draw a zenith mark, orient that panel with north (toward the pole) up, and make the context line read "Nearly overhead" instead of a compass point.
  - **Otherwise:** "up" is the vertical at each panel's own centre.
  - **Orientation test:** pin it only along `x = 0` and only for centres at least 10° from the zenith.
  - **Zenith test:** add a synthetic target exactly at the zenith and assert finite, deterministic output.
  - **e2e:** pin a deterministic target rather than "the first link", or assert the overhead variant when it occurs.
  - **Owner question:** fold the overhead rule into O-2.

  · Strength: bounded, testable, and keeps the "as the user faces it" view for the common case · Tradeoff: one more variant to render and specimen on `/design` · Confidence: HIGH — computed with astronomy-engine; M31's 89.1° peak at Madrid checked by hand · Blind spot: the exact threshold (80° vs 85°) is a judgement call
- **Recommended resolution**: apply the fix. **The overhead presentation is UI, so add it to O-2 as pending owner confirmation**, e.g. „Gdy cel jest prawie w zenicie (≥ 80°), mapka pokazuje znacznik zenitu i północ u góry zamiast kierunku patrzenia. Czy tak?"
- **Decision**: APPLIED as the default, owner confirms via O-2 (2026-10-11, plan author). Plan: `FINDER_OVERHEAD_ALT_DEG = 80` in Phase 2 parameters; D-6 rewritten (up = vertical through each panel's centre; when either panel's centre is ≥ 80° or the zenith is inside a panel, the whole chart switches to north up with a zenith marker and "Nearly overhead"; one orientation for both panels so they compare); `FinderChartData` gains `orientation` and per-panel `zenith`; the false "higher = smaller y" property replaced by an `x = 0` test for centres ≥ 10° from the zenith, plus a zenith-target test and a 79.9°/80.0° boundary test; overhead specimen on `/design` and manual step 4; e2e pins M13 and accepts either orientation via `data-finder-orientation`. O-2 updated in Polish. **Owner confirmed O-2 on 2026-10-13 (vertical up, ≥ 80° overhead rule): RESOLVED.**

### F2 — The smoke positive control is too weak, and the replay needs four details
- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Verifiability
- **Location**: plan.md Phase 5 › 1 smoke steps 1-5; Critical Implementation Details "Smoke ordering"; research.md §7 (l.112)
- **Detail**:
  - **(a) Weak positive control.** Step 3 accepts any body that "excludes `data-finder-state="locked"`", so a `failed` page (F3) passes. With the CI fixture, M13 is ranked at the smoke site (52.23° N, Bortle 6) on every night except about 8 June to 2 July (no astronomical darkness), so the chart path is normally testable.
  - **(b) Escaped href.** The captured href is HTML-escaped (`&amp;`) and must be decoded before replay.
  - **(c) Marker placement.** If `data-finder-chart` sits inside `FinderChart`, the free explainer's example chart carries it and step 4 fails (or gets weakened). It must sit on the chart-state root in `FinderContent` only.
  - **(d) Leaked URL case missing.** `/_server-islands/*` is not gated, so the case of a leaked island URL replayed while signed out is untested.
  - **(e) Shared state in smoke.** Smoke steps are a static array whose failures don't stop the run (`request()` is at `scripts/smoke.mjs:59-76`), so the captured URL needs a shared variable, and a failed capture must fail the dependent steps.
  - **(f) Research contradicts the plan.** research.md §7 says the island cannot be hit over HTTP, which contradicts the plan; the plan is right.
- **Fix**:
  - Require `data-finder-chart` in step 3, with an explicit, printed skip only in the no-darkness window.
  - Decode `&amp;` (mirror `islandUrlFromShell`).
  - Place the marker on `FinderContent`'s chart root.
  - Add step 6: signed out, replay the island URL → 200 and `data-finder-state="locked"`, with no `data-finder-chart`.
  - Hold the URL in a shared variable that fails loudly when empty.
  - Correct research §7.
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED (plan author). Smoke step 3 now requires `data-finder-chart`, with a printed skip only in the 8 June-2 July no-darkness window (then `not-ranked` is required); `&amp;` decoded like `islandUrlFromShell`; `data-finder-chart` only on `FinderContent`'s chart root (Critical Implementation Details); new step 6 replays the island URL signed out; a shared `islandUrl` fails dependent steps loudly when empty. research.md §7 corrected (struck through, superseding note).

### F3 — A failed chart becomes a 200 page with no trace
- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md Phase 4 › 1 ("A failed star load or engine error → `failed` with a fixed key, no log of values"), Phase 4 › 4 ("`no-console-guard.test.ts` (no new disables)")
- **Detail**:
  - A failed dynamic import of the star file in workerd, or an engine throw, renders the `failed` state and nothing reaches the logs.
  - The workspace rule says "no failures turned into … `200`s … If the fix needs a `catch`, it logs or reports the error with its cause."
  - The repo's sanctioned pattern is `src/lib/tonight/build.ts:1227-1231`: a fixed line plus `error.name` only (never the message, which could carry coordinates), with an allowlisted `eslint-disable-next-line no-console -- <reason>` and an entry in `ALLOWED_DISABLES`.
  - This matters most here: the slice's riskiest new code (Phase 2) is exactly what would fail silently.
- **Fix**: In `loadFinderFor`, log `"loadFinderFor: the star load failed"` / `"loadFinderFor: the chart failed"` plus `error.name`, each with a reasoned disable. Bump `ALLOWED_DISABLES`, and change Phase 4 › 4 to "two new allowlisted disables".
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED (plan author). New D-12: `loadFinderFor` logs a fixed line plus `error.name` for a failed star load and a failed chart, each behind a reasoned `no-console` disable; Phase 4 › 4 now adds `src/lib/finder/load.ts` with count 2 to `ALLOWED_DISABLES`; the loader test covers the logged `failed` path.

### F4 — The hop rule's tie-break is not precise enough for a deterministic, deep-equal implementation
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Substance
- **Location**: plan.md D-4; Phase 2 › 2 and its tie-break tests
- **Detail**:
  - "Fewest steps first, then the brightest hop stars, then the shortest total length, then star index" leaves "brightest hop stars" undefined: a sum, the faintest star on the path, or a lexicographic comparison of the magnitudes. "Star index" is also undefined for a path of several stars.
  - With a non-additive criterion such as the faintest star, keeping one best path per node (the obvious BFS or Dijkstra) loses the true optimum. Example: prefix A has a faintest star of 5.0 and length 10, prefix B has 6.0 and length 5; a suffix through a 6.2 star makes length decide, but A was kept.
  - The candidate bound ("stars within start distance + one step") is only in Performance Considerations, yet the test oracle depends on it.
- **Fix**: Define the cost lexicographically and additively as (steps, Σ intermediate mag × 10 as integers, Σ step length in 0.01° integers, then the index sequence), solved by an exact search one step count at a time. Write the candidate bound into D-4. · Strength: exact, deterministic, testable with synthetic skies · Tradeoff: slightly more complex search code · Confidence: HIGH — counterexample constructed · Blind spot: whether a sum of magnitudes picks hops an observer would prefer
- **Recommended resolution**: apply the fix (a delegated, team-owned decision).
- **Decision**: APPLIED as a delegated decision (plan author). D-4 now defines the cost as (steps, Σ round(mag×10) over intermediate stars, Σ round(step length in 0.01°), index sequence) compared lexicographically, solved exactly by a layered search per step count (k = 1…8), and states the candidate bound (distance to target ≤ start distance + one step). Phase 2 tests cover each tie-break level and the review's counterexample.

### F5 — The reference hops and the 95 % coverage gate will fail or drift as written
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Verifiability
- **Location**: plan.md D-11; Phase 2 › 4 (reference hops, "≥ 95 % of those at Bortle 3 get `hop`")
- **Detail**:
  - **References whose start depends on the start limit** (bright-stars.json, nearest start above the limit):
    - M81 at 4.5 starts from 23 UMa (3.65 mag, 6.5° away), not Dubhe.
    - M92 at 4.5 starts from ι Her (3.82, 4.9°), not π or η Her; π Her wins only at 3.5.
    - M13 at 2.5 starts from Alphecca (2.22, 17.2°).
    - M27 at 2.5 starts from Altair (about 14°).
    - Only M31 at 4.5 (μ And, 3.9°) lands in its route set.

    The test does not fix a Bortle band per reference, so a run at the "wrong" band fails, and the easy fix becomes editing the reference.
  - **The 95 % gate is not measured.** At 52° N over four nights, 80.1 % of object-nights have the nearest start (≤ 4.5, above 15°) within one 5.6° step. The other 19.9 % depend on 4.5-6.5 stars that only the new file holds. The 95 % figure is plausible (a 5.6° disc holds about 21 stars ≤ 6.5) but unmeasured, so it is a guess used as a gate.
- **Fix**: Give each reference a fixed Bortle band, the one whose limit admits the published start star. Record the first measured coverage in the plan (Progress note) and set the gate a margin below it. Treat a reference failure as an engine finding, never a fixture edit. · Strength: turns an armchair threshold into a measured one · Tradeoff: the first Phase 2 run sets the bar · Confidence: MED — computed with ≤ 4.5 stars only · Blind spot: coverage with the real 7.5 file
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED (plan author). D-11: each reference gets a fixed Bortle band chosen in Phase 2 so the published start is the nearest qualifying start, recorded in the fixture with the reason; an irreconcilable reference is listed as a known divergence, never forced; a reference failure is an engine finding. The 95 % gate is gone: coverage is measured on the first run and the gate set 3 points below it, recorded on new Progress row 2.4.

### F6 — The free account's example chart: cost per view, a contradiction, and a phase-order break
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Sequencing
- **Location**: plan.md O-5; Phase 4 › 1 (`locked` "before any other read"), Phase 4 › 2 (`FinderLocked`); Phase 3 › 4 (`/design` "locked (free)" specimen)
- **Detail**:
  - **Cost:** `FinderLocked` renders a fixed example chart (M13 from a fixed site and date). Built live, every free page view loads the 354 KB star file and runs the engine in the shell.
  - **Contradiction:** `FinderLocked` also renders in the island's `locked` state, which contradicts the Phase 4 test that a free account "returns `locked` without calling … the star loader".
  - **Phase order:** the Phase 3 `/design` specimen "locked (free)" needs `FinderLocked` and the example, both created in Phase 4, so Phase 3 depends on Phase 4.
- **Fix**: Commit the example as precomputed `FinderChartData` (a small JSON or TS fixture). Add a unit test asserting it deep-equals `finderChart(fixed inputs, real stars)`, so it cannot drift. Create `FinderLocked` in Phase 3 (or move that specimen to Phase 4). · Strength: zero runtime cost, keeps the locked path free of star reads, fixes the order · Tradeoff: a generated fixture to refresh when the engine changes, which the test enforces · Confidence: HIGH · Blind spot: none significant
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED (plan author). The example is a committed `FinderChartData` fixture (`src/lib/finder/example-chart.ts`) with a deep-equality test against `finderChart(fixed inputs, real stars)`; `FinderLocked` moves to Phase 3 (now "Chart rendering and the free explainer"), so the `/design` locked specimen no longer depends on Phase 4; the locked path reads no star file, matching the Phase 4 loader test.

### F7 — Giving CI's smoke and e2e steps `SUPABASE_SECRET_KEY` changes a documented rule
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Coverage
- **Location**: plan.md D-9, Phase 5 › 1-2, Phase 5 › 4 docs list; CLAUDE.md "Env" (l.61) and Commands (l.47-48); `scripts/account-plan.mjs` header; `.github/workflows/ci.yml:64-75`
- **Detail**:
  - **The rule.** CLAUDE.md says the secret key "exists only in the operator's shell for `npm run account:plan` and `npm run test:db`". D-9 extends it to CI's smoke and e2e steps (the local stack's key, not hosted), but the docs list updates neither the Env sentence nor the script header.
  - **Inheritance.** In `ci.yml`, `npm run preview &` runs in the same step as smoke. An `export` would put the key into the preview's environment.
  - **Local runs.** `npm run smoke` and the e2e spec would now refuse to run without the key.
- **Fix**:
  - **CI scope:** set the key inline on the `npm run smoke` and `npx playwright test` commands only, never `export`, so the preview never inherits it.
  - **Docs:** update CLAUDE.md's Env and Commands lines and the `account-plan.mjs` header in Phase 5.
  - **Local behaviour (pick one):** fail without the key under `CI`, and locally print a loud `SKIPPED (no SUPABASE_SECRET_KEY)` for the finder steps; or document the new requirement.

  · Strength: keeps the key out of the app process and the rule documented · Tradeoff: two behaviours (CI vs local) to explain · Confidence: HIGH — ci.yml read · Blind spot: none significant
- **Recommended resolution**: apply the fix. It relaxes an owner-set rule for the local stack only, so mention it in the PR description for the owner's eye; no decision is needed before implementing.
- **Decision**: APPLIED (plan author). D-9 and Phase 5 › 2: the local stack's `SUPABASE_URL`/`SUPABASE_SECRET_KEY` are set inline on the `npm run smoke` and `npx playwright test` commands only, never exported, so `npm run preview &` never inherits them; without the key the finder steps fail under `CI` and print a loud `SKIPPED` locally. Phase 5 › 4 updates CLAUDE.md Env and Commands and the `account-plan.mjs` header. The rule change is recorded for the PR description (D-9, Phase 5 contract, new manual Progress row 5.6).

### F8 — Four "delegated" outcomes depart from FR-037's wording and belong on the owner list
- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: plan.md D-3 (a planet as its own start), D-4 (the start among the 5 nearest; the `direct` fallback), Phase 2 `no-start`; "Pending owner confirmation" O-1 to O-6
- **Detail**: FR-037 promises a chart for "any ranked deep-sky object and any planet": "the nearest star bright enough to see with the naked eye … the hop … through intermediate stars where needed". The plan:
  - **Non-nearest start:** may start from the 2nd to 5th nearest star when the nearest has no path.
  - **`direct`:** shows a straight line with no intermediate stars when no path exists.
  - **`naked-eye`:** shows no hop for a bright planet.
  - **`no-start`:** shows no chart when no star qualifies.

  All four keep the PRD invariant (the start always meets both limits) and are sensible, but each is a user-visible departure from the requirement's wording. They are not team tuning like OQ14-16. O-1 to O-6 are otherwise the right questions: OQ13 is owner-owned, OQ14-16 are rightly delegated, and O-4, O-5 and O-6 are product calls.
- **Fix**: Add an O-7 listing the four outcomes as pending owner confirmation, e.g. „Gdy od najbliższej gwiazdy nie ma ścieżki, mapka zaczyna od jednej z 5 najbliższych albo pokazuje prostą linię; jasna planeta jest sama punktem startu; gdy żadna gwiazda się nie kwalifikuje, pokazujemy komunikat zamiast mapki. Czy tak?", and keep planning on these defaults.
- **Recommended resolution**: apply the fix. **This needs an owner decision (O-7).**
- **Decision**: RESOLVED (owner, 2026-10-13): O-7 confirmed, all four departures accepted as planned. Originally PENDING (owner); added as O-7 in the plan (four departures from FR-037's wording: start among the 5 nearest, `direct` line, bright planet as its own start, no chart without a qualifying start); the plan keeps these defaults until the owner answers.

### F9 — Claim and contract corrections
- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Claim Accuracy
- **Location**: plan.md Phases 1-4 contracts
- **Detail**:
  - **(a) `Vec3`** does not exist in `src` (`grep -rn "Vec3\b" src` is empty); the repo writes `readonly [number, number, number]` (`src/lib/catalogue/stars.ts:20`).
  - **(b) `pairEyepieces`** returns `EyepiecePair | NoEyepieceFits | null`, so D-7's `pairEyepieces(…, null).finding` needs narrowing.
  - **(c) `tonightPageOf`** returns `undefined`, not `null` (`copies.test.ts:71-72` uses `toBeUndefined`).
  - **(d) `readStars` needs refactoring.** It drops `mag > 4.5` while streaming (`scripts/build-stars.mjs:135`), keeps only `id, proper, ra, dec, mag`, and throws on out-of-range RA/Dec (l.140-141) rather than filtering "valid RA/Dec". The refactor is unnamed: filter at 7.5 per output, and keep `bayer`/`flam`/`con`.
  - **(e) Island mock in the loader test.** No unit test imports `src/lib/tonight/island.ts` (it pulls `astro:env/server` and `cloudflare:workers`), so the `loadFinderFor` test needs `vi.mock("@/lib/tonight/island", …)`.
  - **(f) `TonightPageSky`** has only `{ title, view }` with a hard-coded back link to `/tonight`. The "if needed" `backHref` is needed for `from`.
  - **(g) `fill-star` in light mode.** `--star` is decorative and semi-transparent (light: `rgb(22 27 43 / 0.16)`, `src/styles/global.css:115`), so chart stars would be nearly invisible on the light content ground. Chart stars carry meaning and need a chart token with a contrast row.
  - **(h)** The smoke `request()` lines are 59-76, not 32-57.
- **Fix**: Correct each contract line as above. For (g), plan a `--chart-star` token (all themes, red with zero G/B, contrast row) instead of `fill-star`.
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED (plan author). (a) `Vec3` replaced by `readonly [number, number, number]`; (b) D-7 and `findingEyepiece` narrow `pairEyepieces`' three results; (c) `tonightPageOf` asserted `undefined` (superseded 2026-10-13 by the owner's O-4: charts are stored offline, so Phase 5 adds `storedPageOf` and the assertion is gone); (d) Phase 1 › 1 names the `readStars` refactor (keep stars to 7.5 with bayer/flam/con, filter per output, out-of-range RA/Dec still throws); (e) loader test uses `vi.mock("@/lib/tonight/island", …)`; (f) `TonightPageSky` gains `backHref`/`backLabel` (no longer "if needed"); (g) new Phase 3 › 2 `--chart-star` token (all themes, zero G/B in red, contrast row) instead of `fill-star`; (h) `request()` anchor corrected to l.59-76.

### F10 — Verification lines, budget, `night`, attribution
- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Verifiability
- **Location**: plan.md Progress 1.1, 4.3, 5.1-5.3; Performance Considerations; Phase 4 › 3 `finderHref`; D-10
- **Detail**:
  - **Lines that need more than a command.** 1.1 needs the network (it downloads the pinned CSV). 4.3 ("stay green") and 5.1-5.2 need a running preview, local Supabase and the fixture (Playwright has no `webServer`); they are not standalone commands. 5.3 runs only after a push. Every npm/npx line needs the `nvm use` prefix.
  - **Budget not enforced.** "`dist/server` growth under 500 KB" is only a Progress note, and nothing checks that the star file never reaches the browser bundle.
  - **`night` dropped.** `finderHref` drops `?night=`. That only matters when a stored next-night copy is shown online after the 4 s timeout; it is rare, but note it.
  - **Refraction in the context line.** It will read unrefracted altitude while the rows show refracted values; take the shown number from the ranking's refracted peak.
  - **Attribution.** The rendered SVG is HYG Adapted Material, so every view that draws stars (the chart, the free example, `/design`) must render `Attribution` with the CC BY-SA 4.0 notice and "Credit: ESA". O-6 (recording Hipparcos CC BY-NC 3.0 IGO in PRD OQ21, no money in M-3) is the right owner question and adequate for this slice.
- **Fix**: Write 4.3, 5.1 and 5.2 as full commands with the env and preview prerequisites. Add a scripted check for the budget, plus `! grep -rl finder-stars dist/client`. Carry `night` through `finderHref` (or note why not). Use the refracted altitude in the context line. List `Attribution` on every star-drawing view.
- **Recommended resolution**: apply the fix.
- **Decision**: APPLIED (plan author). 1.1 notes the network; 4.3, 5.1 and 5.2 now spell out the full commands and prerequisites (local Supabase, forecast fixture, preview on 4331), every npm/npx line behind the `nvm use` prefix; 5.3 noted as after-push. New Progress row 4.7 enforces the budget (`! grep -rl finder-stars dist/client`, `dist/server` JS ≤ 4,290,555 bytes) and `build-sw.mjs` fails on a leak. `finderHref` carries `night` (D-8). The context line uses the ranking's refracted `bestDirection`. D-10: every star-drawing view (chart, free example, `/design`) renders `Attribution`.
