<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Sky events (M-3 S-07)

- **Plan**: context/changes/sky-events/plan.md
- **Scope**: Full plan (branch feat/sky-events, e57dadf..c050bd2 on main 172c0cf)
- **Reviewed phases**: 1, 2, 3, 4, 5
- **Date**: 2026-10-14
- **Reviewer**: the "reviewer" agent (Opus), with three Opus subagents (plan drift, domain correctness, safety and patterns), independent of the author
- **Verdict**: REJECTED. One critical fault: close pairings visible only in twilight are reported as not visible, with a false reason. The fix stays inside `pairings.ts` and its tests. Everything else is a warning or an observation. The eye-safety line, engine purity, the 5° topocentric rule, the 10°/2° limits, the shower sourcing, offline storage, tile order, i18n parity and tokens all hold.
- **Findings**: 1 critical, 5 warnings, 4 observations
- **change.md**: deliberately not stamped `impl_reviewed`. The orchestrator limited this review to writing this file, so the author flips the status.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Evidence

**Automated checks, run by the reviewer in the worktree at c050bd2:**
- `npm test`: 107 files, 1899 passed, 1 skipped, 6 todo.
- `npx astro check`: 0 errors, 0 warnings.
- `npm run lint`: clean.
- `npm run build` and e2e were not run. Ports 4331, 4333, 4343, 4400 and 4401 belong to other agents, and the author's preview serves `dist/`.

**Rebase onto main a98e77a (S-04 what-to-expect):**
- `git merge-tree` finds no textual conflicts.
- The overlapping files auto-merge: CLAUDE.md, roadmap.md, en.ts, pl.ts, engine `index.ts`, `parameters.ts` and `design.astro`.
- The merged tree, extracted to the scratchpad, passes `astro check` (0 errors) and `vitest` (109 files, 1923 passed).
- **Residual risk:**
  - The whole e2e suite has not run on the merged tree. S-04 changed Targets, finder and `/design`.
  - In CLAUDE.md, the Sky events paragraph lands before "Finder chart" and "What to expect". That reads fine.

**Verified as correct:**
- **Engine purity.** `purity.test.ts` scans the engine directory recursively, and there is no clock, random, env, fetch, fs or console in the new files.
- **Determinism.** The determinism test passes, and nothing depends on Map order.
- **Thresholds.** All come from `parameters.ts`; the local constants are sampling steps only.
- **Pairings.**
  - Both bodies use `Equator(body, t, observer, true, true)` (topocentric, of date), compared with `AngleBetween`.
  - The threshold is inclusive (`<=`).
  - Refinement never leaves the visible minutes.
  - The Skyfield fixtures are asserted at 0.05° and 10 min.
- **Eclipses.**
  - A lunar eclipse uses the topocentric Moon; a solar eclipse uses the search's own refracted contact altitudes.
  - Eclipses use 2°, everything else 10°.
  - A penumbral eclipse is never notable.
- **Meteors.**
  - J2000 λ comes from `GeoVector(Sun)` and `Rotation_EQJ_ECL` with a wrap-safe `Search`, which is robust at 283° (Quadrantids).
  - Radiants go through `Rotation_EQJ_HOR` and `HorizonFromVector`, per the CLAUDE.md engine rule.
- **Shower sourcing.**
  - No IMO-derived field; every row has its NASA date.
  - Radiant and speed come from the IAU MDC and are cited.
  - The rate is labelled approximate and never rendered.
  - `iau-mdc-request.md` holds no personal data.
- **Eye-safety line.**
  - Every solar-eclipse row, visible or not, renders `tonight.events.solarSafety` unconditionally (`safety` = kind).
  - The tile and the verdict line add "eclipse glasses only" whenever they name a solar eclipse, in EN and PL. That includes the `tomorrowAt` branch, pinned on 2027-08-02 at Warsaw (`build.test.ts`).
- **Offline.**
  - `/tonight/events` is last in `TONIGHT_PAGES`, every "six pages" comment now says seven, and `offline.astro` has the title.
  - The events island renders `OfflineCopy` like `/tonight/nights`, and the `?night=next` copy works.
- **Dashboard.**
  - `EventsTile` is a `ui/Tile.astro` placed right after Targets and always shown, and the skeleton row is in the same position.
  - The verdict line is a plain muted `<p data-verdict-event>` with no link. It sits inside the `pointer-events-none` verdict and also in the static fallback.
  - `VERDICT_MIN_HEIGHT_CLASS` is unchanged.
- **Phone check.** `tonight-phone.spec.ts` measures the line (0 when it is absent) and subtracts it, so it does not depend on the run date.
- **Privacy.** No coordinates appear in URLs, data attributes or logs. The one new log is a fixed line plus `error.name`, allowlisted in `ALLOWED_DISABLES`.
- **Styling.**
  - Tokens only: no arbitrary values, hex or palette classes.
  - Red mode separates visible from not visible by icon, mark word and weight.
- **i18n.** EN/PL parity holds, numbers go through `formatDegrees` (PL "1,8°"), and directions go through `compassPoint`.
- **Timing.** `skyEvents` over 30 nights takes 39 ms cold and 19 ms warm locally.

**Benign extras, documented in CLAUDE.md or code comments rather than the plan:**
- `EVENT_DARK_SUN_ALTITUDE_DEG` and the `darkThresholdDeg` / `{ pairings }` parameters of `skyEvents`;
- `goNight`, and `meteorEvents` looking 2 days back;
- the solar search starting a day early;
- eight showers (no Draconids or Ursids, which follows the plan's own "NASA does not list it, drop it" rule);
- `EventsTile.astro` and `event-samples.ts`;
- the `Attribution.astro` credits;
- `formatNightSpan` / `formatDegrees`.

None crosses "What We're NOT Doing".

## Findings

### F1 — Pairings visible only in twilight are reported as not visible, with a false reason

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/engine/pairings.ts:276-286 (visible test on the coarse grid only), :45-50 (steps), :188-190 (docstring)
- **Detail**:
  - **Cause.** A night's visibility is tested only at the grid samples: every 60 min for Moon pairs and every 180 min for planet pairs, from local noon. Refinement starts only when a grid sample is already visible.
  - **Effect.** A visible span shorter than the stride is missed. This is the typical evening or morning twilight pairing: both bodies at least 10° up and the Sun at or below −6° for 10–60 minutes. The event then falls back to the geometric minimum and gets that instant's reason.
  - **Reproduced by the reviewer** (independent probe, 2-min brute force):
    - Warsaw, night of 2020-12-21, Jupiter–Saturn 0.10°: visible from 15:12 UTC.
    - `pairingEvents` returns `{"visible":false,"reason":"below-horizon"}` at 18:31 UTC.
  - **Further misses found by the domain subagent:**
    - Warsaw 2026-06-09, Venus–Jupiter 1.61°: visible at 19:54 UTC, reported as "daylight". This one is within the coming year.
    - Sydney 2026-04-20, Mercury–Saturn.
    - Several Moon–planet pairs.
    - About 10% of visible clusters are missed at Warsaw and about 20% at Sydney, over two years.
  - **Consequences:**
    - The PRD invariant (never call a not-visible event visible) still holds; the error is the other way round.
    - But the page tells the user that a bright, visible conjunction is "below your horizon" or "in daylight", and the tile and verdict line never name it.
    - The docstring's claim that this happens only at high latitudes near midsummer is wrong.
  - **Why tests didn't catch it.** Neither Skyfield fixture contains a twilight-only pair.
- **Fix**: For a pair and night that passes the coarse prefilter, run the visible test on a fine grid (e.g. 10 min) inside the night's −6° span, including the span's two ends, then refine from the best fine sample.
  - **Strength:** it keeps the prefilter, so the cost lands only on nights that are already close. It closes the gap at any latitude.
  - **Tradeoff:** more `Equator` calls on close nights. The 200 ms budget test (19 ms warm today) has room. Correct the docstring too.
  - **Confidence:** HIGH. Reproduced, and the cause is visible in the code.
  - **Blind spot:**
    - The exact fine step needed for the shortest spans (a few minutes at the limit) has not been measured.
    - Pin Warsaw 2020-12-21 Jupiter–Saturn and 2026-06-09 Venus–Jupiter as regression tests, red first, and add a brute-force cross-check over one window.
- **Decision**: FIXED (author, 2026-10-14): fine visible test on close nights (10 min plus bisected ends of the −6° span), regression tests red first, 2-min brute-force cross-check over four windows.

### F2 — A solar eclipse's day-time wording ignores "now": it vanishes on its own morning and reads "Tonight:" in the afternoon

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/lib/engine/events.ts:396 (`moment < window.start` skipped), :500-503 (window from local noon of `fromNight`); src/lib/tonight/sky-events.ts:231-234 (`tomorrowAt`), :246-247 (`tonight` / `next` filter on `goNight >= date`)
- **Detail**:
  - **How the night is assigned.** An eclipse before local noon belongs to the previous observing night (2027-08-02 11:22 CEST at Warsaw belongs to the night of 08-01). After civil dawn, `tonightDateFor` moves on to 08-02, and that window starts at noon on 08-02.
  - **The morning gap.** From dawn (about 04:30) until the eclipse, it is in neither `tonight`, `next`, nor `/tonight/events`. The tile may say "Nothing to go out for", or name a later event, on the very morning of the eclipse.
  - **Wrong day before dawn.** At about 02:00 the verdict line already says "Tomorrow, 11:22", although it is that same day.
  - **The afternoon case.** An eclipse in the afternoon of day D belongs to night D. Its line reads "Tonight: Partial solar eclipse, eclipse glasses only", from the morning and still after it has ended. The next case is 2028-01-26, near sunset in Iberia.
  - **Coverage.** The plan only covered the evening-before "Tomorrow, 11:22" (owner decision 6). `events.test.ts` (around :410) pins the window boundary as it is.
  - **Safety.** The glasses wording itself is never lost. This finding is about timeliness and truthful time words.
- **Fix A ⭐ Recommended**: Keep a solar eclipse of the previous observing night in view until its partial phase ends. For example, `skyEvents` also returns solar eclipses whose `partial.end` falls after `window.start` minus 12 h, and `formatSkyEvents` words the day relative to the local calendar date of the view's `date` ("Today, 11:22" / "Tomorrow, 11:22"). Pin it with unit tests at 2027-08-02T07:00 Warsaw (tonight 08-02, eclipse still shown, "Today, 11:22") and 02:00 (tonight 08-01).
  - Strength: fixes the one morning when the event matters most, using a known date with a test oracle.
  - Tradeoff: "Today" vs "Tomorrow" needs the request time or the view's calendar date in the formatter. The engine stays pure if the comparison is done in `src/lib/tonight/`. Owner copy decision needed for "Today, …" and for afternoon eclipses.
  - Confidence: MED. The shape is clear, but the plumbing of "now" into `formatSkyEvents` has not been traced.
  - Blind spot: the `?night=next` offline copy, and a stored copy read on the morning, would still show stale wording.
- **Fix B**: Accept and document it as a known gap (owner decision), plus a test pinning the current behaviour.
  - Strength: no code change before the PR. The first affected morning in Europe is 2027-08-02, so there is time for a follow-up change.
  - Tradeoff: on 2027-08-02 the app is silent about a total solar eclipse visible across Spain on that morning.
  - Confidence: HIGH that it is cheap. LOW that the owner wants it.
  - Blind spot: none significant.
- **Decision**: A (owner, 2026-10-14): a solar eclipse stays on Tonight until its partial phase ends, "Today/Tomorrow, HH:mm" from today's date in the site's zone; pinned at Warsaw 2027-08-02 and Lisbon 2028-01-26.

### F3 — The solar eclipse can hide behind "+N more" without its glasses wording

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/sky-events.ts:246 (`tonight` in time order), :285 (only `first` gets `withGlasses`); `next` has the same tie-break (:93)
- **Detail**:
  - With an evening pairing before a morning solar eclipse on the same night, the verdict line reads "Tonight: Venus and Jupiter, 1.8° apart +1 more". The eclipse is not named, and there is no glasses wording.
  - `sky-events.test.ts:91` pins `[shower, pairing, eclipse]` → "+2 more".
  - The safety rule holds technically, because the unnamed eclipse carries no advice. But the night's most significant and most hazardous event is the one buried.
- **Fix**: Order `tonight` with solar eclipses first (then by moment) and break `next` ties in their favour. Add a unit test where a pairing precedes the eclipse and the line names the eclipse with "eclipse glasses only".
- **Decision**: FIXED: solar eclipses first in `tonight`, `next` ties to the eclipse; unit test.

### F4 — The dashboard e2e assertion fails on the evening before a morning solar eclipse

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/e2e/tonight-dashboard.spec.ts:87
- **Detail**:
  - `toHaveText(/^Tonight: \S/)` predates c050bd2, which added "Tomorrow, HH:MM: …".
  - The spec runs on the real clock in Madrid. From noon on 2027-08-01 to dawn on 2027-08-02 the line reads "Tomorrow, 10:4x: Total solar eclipse, eclipse glasses only", and CI fails on that date.
  - That breaks the plan's F3 rule that e2e must not depend on the run date. The whole e2e suite (Progress 5.1) last ran at 95d1ccc, before this change.
- **Fix**: Accept both forms, e.g. `/^(Tonight: |Tomorrow, \d{2}:\d{2}: )\S/`, or build the pattern from `en.tonight.events.verdictLine*`.
- **Decision**: FIXED: the pattern is built from the EN messages (Tonight / Today / Tomorrow).

### F5 — A partly visible eclipse's "best" time is a contact, when nothing is eclipsed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/engine/events.ts:209-237 (`eclipseVisibility`); pinned by events.test.ts:~178 (`best === partial.end`); src/lib/tonight/sky-events.ts (tile `nightWhen` and `tomorrowAt` use `event.moment`)
- **Detail**:
  - **Solar eclipse at sunrise:** `best` is `partial_end`, the moment the eclipse is over, with zero coverage.
  - **Lunar eclipse from Madrid with the Moon rising:** the best contact is the end of the partial phase.
  - **Tile and verdict time:** `nightWhen` and `tomorrowAt` use the peak even when the peak is below the horizon. The `partly` and `lowHorizon` notes never reach the tile or the verdict line.
  - **Effect:** a user is pointed at a time when there is nothing, or nothing visible, to see.
- **Fix**: For `partly`, take `best` as the first (or last) moment the body clears 2° while the phase is still in progress (bisect between the peak and the contact), and have the tile and verdict line use `visibility.best` for eclipses.
  - Strength: the time shown is a time with something to see. Local change in `eclipseVisibility`.
  - Tradeoff: one bisection per partly visible eclipse, plus updating the test that pins `best === partial.end`.
  - Confidence: MED. The defect is clear, but the right "best" for a lunar eclipse rising mid-totality is a judgement call.
  - Blind spot: whether the owner prefers "from 05:40 (low)" wording to a single time.
- **Decision**: FIXED: a partly visible eclipse's best is where the body clears 2° in the phase in progress (bisection); tile and line use it.

### F6 — Polish verdict and tile copy: double colons, capital after a colon, "bright" dropped

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/i18n/messages/pl.ts:814, :817 (`elongationName`, `oppositionName`), :855 (`brightMoon`), :863-866 (`verdictLine*`); src/lib/tonight/build.test.ts:1889
- **Detail**:
  - **Double colons:** "Dziś: Mars: opozycja", "Dziś: Merkury: największa elongacja", "Mars: opozycja · dziś w nocy".
  - **Capital after a colon:** "Jutro, 11:22: Częściowe zaćmienie Słońca" should read "częściowe" in a Polish sentence; the test pins the capital.
  - **"Bright" dropped:** `brightMoon` reads "Księżyc w górze: …", so "bright" disappears ("only the brighter meteors show" loses its reason).
- **Fix**:
  - Add in-sentence forms like the showers' `showerNameInLine`: "opozycja Marsa", "największa elongacja Merkurego", and a lowercase eclipse name in the line.
  - `brightMoon`: "Jasny Księżyc nad horyzontem: widać tylko jaśniejsze meteory".
  - Update `build.test.ts:1889`.
- **Decision**: FIXED: PL in-sentence forms, titles without a colon, lowercase after a colon, "Jasny Księżyc nad horyzontem".

### F7 — Shower names: untyped keys, dead `targets.meteorShower` copy, and the name test covers the wrong keys

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/tonight/sky-events.ts:116-117, :173, :230; src/lib/catalogue/meteor-showers.ts:34, :38; src/lib/catalogue/meteor-showers.test.ts:39-52; en.ts:1213, pl.ts:1023
- **Detail**:
  - Since owner decision 6, the UI reads only `tonight.events.showerName` / `showerNameInLine`. These are typed `Record<string, string>` with a `?? event.shower` fallback, so a new shower without names shows its raw key.
  - The "every shower has an EN/PL name" test checks `targets.meteorShower`, which nothing renders any more, and the catalogue comment still points there.
- **Fix**: Type the shower keys (an `as const` union with `satisfies Record<ShowerKey, string>` on both maps), point the test at `showerName` and `showerNameInLine`, drop or repoint `targets.meteorShower`, and fix the comment.
- **Decision**: FIXED: typed `ShowerKey`, `satisfies` on both name maps, `targets.meteorShower` removed, test repointed.

### F8 — Success criteria after the last commit, and the rebase onto a98e77a

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 5.1 (e2e at 95d1ccc); manual 4.4, 5.3 and 5.4 open
- **Detail**:
  - **Whole e2e suite.** It ran at 95d1ccc, before c050bd2 changed the verdict-line copy and the `/design` specimens. `npm run smoke` is not recorded, though the lesson "Run the whole e2e suite before a PR" asks for it.
  - **Rebase onto a98e77a.** It merges without textual conflicts, and the merged tree passes `astro check` and 1923 unit tests (reviewer, scratchpad).
    - The e2e suite has not run on it.
    - S-04 changed the Targets and finder pages and `/design`, and both slices append to `parameters.ts`, the engine barrel, `en.ts`/`pl.ts` and CLAUDE.md.
  - **Manual checks.** The open manual checks are deferred by plan, so they are pending, not rubber-stamped.
- **Fix**: After the fixes, rebase onto main, then run `npm run build`, the whole `npm run test:e2e` and `npm run smoke` the CI way, and record the counts in the PR. Do the manual checks 4.4, 5.3 and 5.4 with screenshots.
- **Decision**: FIXED: rebased onto main, whole e2e suite and smoke rerun, manual checks with screenshots (counts in the PR).

### F9 — The phone fold check can be too lenient on event nights

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: tests/e2e/tonight-phone.spec.ts:62-72, :111-119
- **Detail**:
  - The spec subtracts the line's full height and margins, which is date-independent and correct when the line pushes the cards down.
  - But the verdict container has a min-height (`VERDICT_MIN_HEIGHT_CLASS`). When the headline is short, the line fills that spare space without moving the cards, and the spec still subtracts it.
  - The error only goes towards leniency: up to one line, on event nights. It never fails falsely.
- **Fix**: On an event night, hide the line with `page.addStyleTag({ content: "[data-verdict-event]{display:none}" })`, measure the cards, then remove the style, instead of subtracting.
- **Decision**: FIXED: the phone spec hides the line with a style tag while it measures.

### F10 — Small consistency nits

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: see each item
- **Detail**:
  - **(a) Stale comments.** `island.ts:21`, `load.ts:61` and `build.ts:631-632` say only the events page asks for sky events, but the dashboard does too (`TonightContent.astro:82`).
  - **(b) Bright-Moon note on not-visible showers.** A not-visible shower can still carry "Bright Moon up: only the brighter meteors show" (`meteors.ts:169`, `sky-events.ts:203`), which reads as viewing advice.
  - **(c) `/design` eclipse time.** The specimen says "Tomorrow, 12:03" from 10:03 UTC, but Warsaw's local peak is 11:22 (`event-samples.ts:94`). The comment at `build.test.ts:~1797` ("12:0x") is stale too.
  - **(d) MDC citation not shown in the app.** `iau-mdc-request.md:18` says the app "cites the references", but `Attribution.astro` only links the IAU MDC. Jopek 2024 and Jenniskens 2020 appear only in `meteor-showers.ts` and `LICENSE-DATA.md`.
  - **(e) Circular λ test.** `meteor-showers.test.ts:69-77` recomputes λ with the same function: a consistency check, not an independent reference. The reviewer's manual comparison with published λ is within about 1°.
  - **(f) Circular imports.** `events.ts` ↔ `pairings.ts` / `meteors.ts`. Safe today, since there is no top-level use. Consider moving `visibleAt` and the span helpers into their own module.
- **Fix**:
  - (a) Say "the dashboard and the events page".
  - (b) Show the note only on visible showers.
  - (c) Use the Warsaw peak time and fix the comment.
  - (d) Add the citation to the credits, or reword the draft.
  - (e) and (f): optional.
- **Decision**: FIXED (a)-(d); (e) and (f) left as optional.
