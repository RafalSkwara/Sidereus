<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Sky events (M-3 S-07)

- **Plan**: context/changes/sky-events/plan.md (commit 352b1c4, branch feat/sky-events, rebased onto main 998b30f)
- **Phases**: 5
- **Date**: 2026-10-13
- **Reviewer**: the "reviewer" agent (Opus), independent of the plan's author
- **Verdict**: NEEDS ATTENTION. The premise is sound: pure engine searches from astronomy-engine, one visibility rule in the model, a focused page modelled on `/tonight/nights`, and offline through `TONIGHT_PAGES`. But two of the plan's factual claims are wrong in ways its own tests would expose:
  - the J2000 method for meteor peaks;
  - the eclipse test oracle under the 10° rule.

  One Phase 5 design point also needs a decision before work starts: where the verdict line goes. All three are triage fixes, not a re-plan.
- **Findings**: 0 critical, 5 warnings, 2 observations
- **Owner answers (seen in the author's uncommitted working tree while this review was written)**: 1 = A (two sources per value; the MDC email is the owner's, drafted as `iau-mdc-request.md`); 2 = 5° (changed); 3 = 10°; 4 = default; 5 = the events tile right after Targets, **plus the separate muted verdict line on event nights**. The findings below are updated for those answers.
- **Triage** (2026-10-13, by the plan's author): every finding resolved. F2 and F3 were decided by the owner; F1 and F5 were delegated; F4, F6 and F7 were applied as recommended on the orchestrator's instruction. Applied together with the owner's five planning answers (OQ 19 option A, pairings up to 5°, 10° altitude, notable default, events tile after Targets). Originally: not run interactively. The owner is away and the orchestrator's rules forbid asking, so each finding carries a **Recommended resolution** and `Decision: PENDING`. `change.md` was deliberately left at `planned`; the author flips it. The owner is answering the five questions now, so findings that touch them say how the question or its default should change.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Claim Accuracy | FAIL |
| Substance | PASS |
| Feasibility | WARNING |
| Sequencing | PASS |
| Architecture Fit | PASS |
| Scope Discipline | PASS |
| Verifiability | WARNING |
| Coverage | WARNING |

## Grounding

### Claims checked in the repo

All confirmed:
- `observingNightDateFor`, `addDays`, `observingNight` (`night.ts:43,100,112`);
- `observerFor`, `sunEvents`, `darkWindow` (`sun.ts:11,32,52`), and `DarkWindow` has a `kind: "none"` case (`types.ts:42`);
- `PLANET_WINDOW_SUN_ALTITUDE_DEG = -6` (`parameters.ts:221`);
- the `determinism.test.ts` budget pattern (asserted locally, logged on CI, `:25,82-91`);
- `scripts/planet-reference.py` and `fixtures/README.md`;
- `formatDayTime` and `formatNightDate` (`format.ts:231,249`);
- `targets.planet` in `en.ts:1060`;
- `TILES` in `tonight-dashboard.spec.ts:19`;
- `TONIGHT_PAGES` in `tonight-phone.spec.ts:33`;
- `VERDICT_MIN_HEIGHT_CLASS = "min-h-42 sm:min-h-59"` (`sky-band.ts:45`), used by `TonightSky.astro:68` and `TonightSkyView.tsx:454`;
- after S-03, `copies.ts` still drives the stored pages from `TONIGHT_PAGES` (`storedPageOf` adds only the finder page), so the plan's offline edit is the right one.

### Computed with astronomy-engine 2.1.19

These came from scratchpad scripts, not the repo:

- **`Ecliptic()` is of date.** `Ecliptic(GeoVector(Sun, 2026-08-12T12Z, true)).elon` = 139.808°. `SunPosition().elon` (of date) = 139.808°. The J2000 ecliptic longitude through `Rotation_EQJ_ECL` = 139.434°. The library's own doc for `Ecliptic` says "true ecliptic of date (ETC)". See F1.
- **The 2026-08-12 solar eclipse** (`SearchLocalSolarEclipse`), as kind / peak altitude / altitude at partial begin:

  | Site | Kind | Peak altitude | Partial begin altitude |
  |---|---|---|---|
  | Oviedo | total | 10.3° | 20.5° |
  | León | total | 9.7° | 20.0° |
  | Madrid | partial | 7.3° | 17.7° |
  | Valencia | total | 4.6° | 14.8° |
  | Warsaw | partial | −0.1° | 6.8° |
  | Moscow | partial | −5.0° | 0.7° |

  See F2.
- **The 2026-08-28 lunar eclipse** is partial. The Moon at its peak is 15.3° up from Madrid and −4.1° from Warsaw.
- **Mercury's greatest elongation:** 2026-11-20 23:36 UT, morning, 19.6°. Matches the plan.
- **Oppositions:**
  - Jupiter 2027-02-11 00:17 UT; matches.
  - Mars 2027-02-19.
  - Saturn's next is 2027-10-18; its 2026 opposition was 2026-10-04.
  - So the window from 2026-10-13 has no opposition, as the plan says.
- **CPU.** A rough 30-night pass took about 29 ms warm on this laptop:
  - 720 hourly topocentric samples of the Sun, the Moon and five planets with `Horizon` and the separations;
  - every eclipse, elongation and opposition search;
  - 64 `SearchAltitude` calls;
  - 10 `SearchSunLongitude` calls.

  That is well under research's "under about 200 ms". The per-night refinement and the radiant checks add little. Workers CPU (Paid, 30 s) is not a risk. See F6 for the repeated cost.

### Commands

- The verification lines resolve to real scripts and specs: `npx vitest run <files>` (vitest include `src/**/*.test.ts`), `npx astro check`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e` and `npx playwright test <spec>`.
- Nothing was run in the author's worktree: the new test files don't exist yet, and e2e needs the author's preview.

### Sequencing

- Phases 1 → 2 → 3 only extend `skyEvents`.
- Phase 4 adds the view block, the page and offline.
- Phase 5 adds the tile and the verdict line.
- No phase depends on a later one, and no schema change is involved.

## Findings

### F1 — The J2000 peak search uses `Ecliptic()`, which returns the ecliptic of date, so it reintroduces the 9-hour error it was meant to remove

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Claim Accuracy
- **Location**: plan.md "Key Discoveries" (second bullet); Phase 3.2 contract step 1
- **Detail**:
  - **What the plan says.** Searching on `Ecliptic(GeoVector(Body.Sun, t, true)).elon` "avoids a precession formula entirely".
  - **What the library does.** In astronomy-engine 2.1.19, `Ecliptic(eqj)` "converts a J2000 mean equator (EQJ) vector to a true ecliptic of date (ETC) vector" (`astronomy.d.ts`, doc above `:853`).
  - **Measured.** On 2026-08-12 it gives 139.808°, the same as `SunPosition` (of date). The J2000 longitude is 139.434°: 0.374° apart, about 9 h of solar motion. So the plan's method finds the same moment as `SearchSunLongitude`, the very offset research §2 flagged.
  - **Consequence.** The Phase 3 test ("J2000 longitude matches λ within 0.001° and of-date differs by about 0.37°") would fail on the first run. Shipped unnoticed, every shower's peak would be about 9 h early, and a peak near local noon could fall in the wrong observing night.
- **Fix**: Search on the J2000 ecliptic longitude: `SphereFromVector(RotateVector(Rotation_EQJ_ECL(), GeoVector(Body.Sun, t, true))).lon` (EQJ → ECL is the J2000 mean ecliptic). Keep the plan's test, which now pins the right thing, and correct the Key Discoveries bullet and research §2.
- **Recommended resolution**: apply the fix (delegated).
- **Decision**: APPLIED (delegated, 2026-10-13). The J2000 longitude comes from `SphereFromVector(RotateVector(Rotation_EQJ_ECL(), GeoVector(Body.Sun, t, true))).lon`, searched with `Search`. `Ecliptic()` and `SearchSunLongitude` (both of date) are named as never to be used. Updated: Key Discoveries and Phase 3.2 step 1.

### F2 — The solar-eclipse test oracle contradicts the plan's own 10° rule, and that rule hides most of Spain's 2026 total eclipse

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Claim Accuracy
- **Location**: plan.md Phase 1.2 Tests ("The total solar eclipse of 2026-08-12…"); owner decision 3; Phase 1.2 per-kind rule for the solar eclipse
- **Detail**:
  - **The rule.** With `EVENT_MIN_ALTITUDE_DEG = 10`, the plan's solar rule is: visible if the peak altitude is ≥ 10°, "partly" if `partial_begin` or `partial_end` is ≥ 10°.
  - **What the computed altitudes (Grounding) give:**
    - **Warsaw is neither.** Peak −0.1°, partial begin 6.8°, so it is "too-low". The plan's test expects "a partial, and visible or partly visible".
    - **"A northern-Spain site … total, and visible"** holds only for a carefully picked site: Oviedo's peak is at 10.3°, while León (9.7°) and Valencia (total, 4.6°) are only "partly".
    - **Madrid**, the e2e and fixture site, is a partial at 7.3°, so only "partly".
  - **Why it matters to the product.** This is the most watched eclipse in Spain in a century. Totality at 5-10° above a clear western horizon is exactly what people travel to see. Showing it as "partly visible" or "too low" is defensible for planets, but a product call for eclipses. Owner decision 3 asks about "10°" without saying this.
- **Fix A ⭐ Recommended**: Give eclipses their own minimum, e.g. `ECLIPSE_MIN_ALTITUDE_DEG = 2`, with a "low: needs a clear horizon" note below 10°. Then fix the test oracle:
  - Oviedo: total and visible.
  - Valencia: total and visible (low).
  - Madrid: partial and visible (low).
  - Warsaw: partly (partial begin 6.8°).
  - Moscow: listed but not visible (peak −5°). This is the plan's "Sun is down" case, which needs a site inside the penumbra; Moscow works.

  Add to owner question 3, in Polish: „Zaćmienie Słońca 12.08.2026 jest w Hiszpanii nisko (Madryt 7°, Walencja 5°, Oviedo 10°). Czy dla zaćmień przyjąć niższy próg (np. 2°) z dopiskiem «nisko, potrzebny odsłonięty horyzont», czy trzymać 10° jak dla planet?”
  - Strength: matches how eclipses are actually observed; the numbers come from the library itself.
  - Tradeoff: one more constant, plus a "low" note in copy.
  - Confidence: HIGH on the altitudes; MED on the product call.
  - Blind spot: refraction near the horizon (it adds about 0.5° at 2°).
- **Fix B**: Keep 10° for everything, and only rewrite the test oracle to the computed outcomes (Oviedo visible; Madrid, León and Valencia partly; Warsaw too-low; Moscow not visible). Spell out the Spain consequence in question 3.
  - Strength: no new constant.
  - Tradeoff: the headline eclipse shows as "too low" or "partly" for most users in Spain.
  - Confidence: HIGH.
  - Blind spot: none significant.
- **Recommended resolution**: The owner answered 10° (question 3) without this consequence in view. **Owner decision needed: a separate, lower eclipse minimum (Fix A, recommended) or 10° for eclipses too (Fix B).** Use the Polish question above. Until the owner answers, build Fix B's corrected oracle, so the test is right either way.
- **Decision**: RESOLVED (owner, 2026-10-13): Fix A.
  - Eclipses use their own `ECLIPSE_MIN_ALTITUDE_DEG = 2`, labelled "low, needs an open horizon" (`lowHorizon`) between 2° and 10°. Every other kind stays at 10°.
  - Eclipse visibility and "partly" are one rule for both kinds (F7b).
  - The tests use **future** eclipses only, computed with astronomy-engine and checked against the NASA/Espenak catalogue:
    - the 2027-08-02 total solar eclipse (total at Cádiz with the Sun about 37° up; partial at Madrid, about 0.86, and Warsaw, about 0.30);
    - the 2028-12-31 total lunar eclipse;
    - the 2027-02-20 penumbral lunar eclipse (listed, not notable).
  - The past 2026-08-12 and 2026-08-28 eclipses are gone from the plan.

### F3 — An "only on event nights" verdict line can't share a pinned height with the skeleton, and it makes the phone spec date-dependent

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Feasibility
- **Location**: plan.md "Critical Implementation Details › The verdict height"; Phase 5.1 `VerdictCard` contract; owner decision 5
- **Detail**:
  - **The skeleton problem.** `VERDICT_MIN_HEIGHT_CLASS` is shared by `TonightSkyView`, `TonightSky` and the skeleton, so that the skeleton swap never jumps (CLAUDE.md "Phone first"). The skeleton renders before the island knows whether tonight has an event, so a conditional line forces a choice:
    - the min-height grows for every night, pushing the Site card down even on the ~29 nights without an event;
    - or event nights jump.
  - **"Re-measure with and without the line"** can't satisfy both.
  - **The phone spec.** `tonight-phone.spec.ts` runs on the real clock, so whether the line exists depends on the date CI runs. A layout regression would show up only on event nights, which is a date flake by construction (test-plan §6.5).
  - **The fallback.** The plan's own fallback (a suffix in the reason row) is left to "the manual check in Phase 5". That is too late to pick an architecture.
- **Fix A**: Make the suffix the default now. Render "Clear sky · Tonight: Perseids peak" in the existing reason line, in `text-body` muted, wrapping. The verdict's structure stays the same on every night.
  - Re-measure `VERDICT_MIN_HEIGHT_CLASS` once, on the EN go verdict *with* a long PL suffix, at 360 and 640 px.
  - Add a `/design` specimen and a unit-level guard that the suffix is the only addition.
  - Change owner question 5's default to the suffix, in Polish: „Domyślnie nazwa wydarzenia jako dopisek w linii powodu werdyktu («Bezchmurnie · Dziś: maksimum Perseidów»), bez nowej linii. OK?”
  - Strength: no height change and no date-dependent layout; FR-043 says "named next to the sky verdict", which a suffix satisfies.
  - Tradeoff: a longer reason line that may wrap to two lines in PL.
  - Confidence: MED. The wrap needs measuring.
  - Blind spot: the longest PL reason plus suffix at 320 px.
- **Fix B ⭐ Recommended (after the owner's answer)**: Keep a separate line, but always reserve its height: an empty `aria-hidden` slot on nights without an event. Re-measure the min-height once, with the slot.
  - Strength: a clean separate line.
  - Tradeoff: every night's verdict grows by one line and the Site card moves down for good. `tonight-phone.spec.ts` must still pass.
  - Confidence: HIGH.
  - Blind spot: whether the Site card still fits at 390×844.
- **Recommended resolution**: The owner chose a separate line on event nights (question 5), so **Fix B is the default**. The slot is reserved on every night and empty when there is no event; visually that still matches "a line on event nights", and the skeleton and the phone spec stay date-independent. Measure the min-height once with the slot, in PL at 360 px. Mention to the owner that every night's verdict grows by one line height. Offer the suffix (Fix A) only if the Site card no longer fits at 390×844; **that would need the owner to re-confirm question 5.**
- **Decision**: RESOLVED (owner, 2026-10-13).
  - The line appears only on event nights, and the one-line layout shift is accepted. No space is reserved; `VERDICT_MIN_HEIGHT_CLASS` and the skeleton keep today's height, and the skeleton jump on event nights is accepted.
  - `tonight-phone.spec.ts` is made independent of the run date: it subtracts the measured `[data-verdict-event]` line (0 when absent) before its first-screen assertions.
  - An event night is covered by a pinned `/design` specimen in manual check 5.3.
  - Neither Fix A (suffix) nor Fix B (reserved slot) was adopted.

### F4 — Option A can't meet its own "two sources" rule for peak λ and ZHR, and an agent must not send the MDC email

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Claim Accuracy
- **Location**: plan.md owner decision 1 (option A); Phase 3.1 contract; research §4 table
- **Detail**:
  - **Where each field can come from.** Phase 3.1 says each value is cross-checked against at least two of the IAU MDC, the IMO Working List and NASA. Research §4's own table says:
    - the **MDC** has "no ZHR, no peak λ as such" (only an activity-averaged LoS);
    - **NASA** has "only Fast Facts … No λ, RA/Dec or ZHR table";
    - **AMS** and **Wikipedia** values are IMO-derived.
  - **The consequence.** For peak λ and ZHR, the only primary source is the IMO, whose notice requires prior written permission. Option A's peak λ and ZHR would in practice be the IMO's numbers, the case option A was meant to avoid.
  - **The email.** The plan says „Opcjonalnie wysyłam uprzejmego maila do IAU MDC”. Under this run's rules an agent never contacts an external service: any email is the owner's to send.
- **Fix**: Rebuild option A's sourcing so that no field depends on the IMO:
  - **Peak night and rough rate** from NASA's fact boxes (US government work, reusable without endorsement).
  - **Radiant and speed** from the IAU MDC (citation requested).
  - **Peak λ** computed by our own engine from NASA's peak date (a derived fact, documented in the file header), not copied from the IMO.
  - **ZHR** as NASA's rounded "rate", labelled approximate.

  Where NASA lacks a shower, either drop it from the ~10 or mark the value "IMO, pending permission". Reword question 1 so that the courtesy email is the owner's („Właściciel może wysłać…”), not the agent's.
  - Strength: every field gets a source whose terms allow reuse.
  - Tradeoff: coarser peak λ, though the plan already presents peaks as a night, "known only to about 1°", and NASA's rates are rougher than the IMO's ZHR.
  - Confidence: MED. Research §4 shows NASA's fields per shower, but nobody has checked whether every one of the 10 has a NASA fact box.
  - Blind spot: whether NASA lists the Southern Delta Aquariids and the Ursids.
- **Recommended resolution**: The owner chose option A with "at least two sources per value" and has already moved the MDC email to themselves (draft `iau-mdc-request.md`), so that part is resolved. The sourcing problem stands: no two non-IMO sources exist for peak λ and ZHR. Apply the fix as the way to carry out option A (NASA's peak night and rate, our own derived λ, the MDC's radiant and speed), and record it in `LICENSE-DATA.md`. **Tell the owner** that peak λ is derived from NASA's date, not taken from the IMO. No new decision is needed unless the owner prefers asking the IMO (option C) for λ and ZHR.
- **Decision**: APPLIED (orchestrator, 2026-10-13), as the way to carry out option A. No field depends on the IMO:
  - peak night and approximate rate from NASA (public domain);
  - peak λ computed by our engine from NASA's date (a derived fact, recorded in the file header as "not taken from the IMO");
  - radiant and speed from the IAU MDC.

  Second sources are used for reading-only cross-checks. A shower NASA lacks is dropped. The MDC email is the owner's to send (`iau-mdc-request.md`, already drafted). The owner is told that λ is derived from NASA's date.

### F5 — No rule for nights without a dark window (meteors, the bright-Moon flag, the elongation span)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md Phase 3.2 steps 4-6; Phase 1.2 (elongation span "extended to the dark window's start"); `visibility.reason` enum
- **Detail**:
  - **The gap.** `darkWindow` returns `{ kind: "none" }` when the Sun never reaches the site's Bortle threshold (`sun.ts:52`, `types.ts:42`). Opposition has a fallback ("civil-to-civil when there is no dark window"). Meteors, `brightMoon` and the elongation span don't.
  - **The consequence.** At a Bortle 1-4 site (−18°) north of about 54° N, the Perseids (12 Aug), the Lyrids and the Eta Aquariids fall on nights with no astronomical darkness. Under the plan they would read "not visible", although showers are watched in nautical darkness.
  - **The model can't say it either.** The reason enum has no "short night" case.
- **Fix**: When the dark window is `none`, use the span with the Sun at or below `EVENT_SUN_MAX_ALTITUDE_DEG` (−6°), as the opposition does, and add a "short night: no full darkness" note (not a reason, since the event stays visible). Test the Perseids at 57° N, Bortle 2.
- **Recommended resolution**: apply the fix (delegated).
- **Decision**: APPLIED (delegated). On a night with no dark window, meteors, the bright-Moon flag, elongations and oppositions use the span with the Sun at or below −6°, flagged `shortNight` (shown as "short night"). A test covers a summer shower at about 60° N.

### F6 — The CPU cost is fine; the repeat cost and the budget test deserve a note

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Feasibility
- **Location**: plan.md "Performance Considerations"; Phase 1.2 Budget test
- **Detail**:
  - **Measured.** A rough full pass measured about 29 ms warm on a laptop (Grounding), well under research's 200 ms. Workers Paid has no 10 ms cap.
  - **But it runs often.** It runs on every dashboard and events-page render, and again for each page's `?night=next` background copy (the service worker stores one for every Tonight page).
  - **Purity makes it cacheable.** The result depends only on the site's coordinates and zone and the night.
  - **The budget test** follows `determinism.test.ts` (asserted locally, logged on CI), which is right; a hard CI assertion on time would be a flake.
- **Fix**:
  - Log the measured time once from the preview during Phase 4 (a single run, not a test).
  - Optionally memoise `skyEvents` per isolate by (rounded lat/lon, zone, night), a small LRU, in `src/lib/tonight/`, outside the engine.
  - Set the local budget from a first measured run, not a guess.
- **Recommended resolution**: apply the logging; memoising is optional.
- **Decision**: APPLIED (orchestrator).
  - One timing measurement of the island's `skyEvents` on the 4333 preview during Phase 4, noted beside Progress 4.2.
  - The local budget is set from a first measured run.
  - Memoising stays optional and is not planned (recorded in Performance Considerations).

### F7 — Smaller contract and doc gaps

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, narrowly scoped
- **Dimension**: Substance
- **Location**: plan.md Phase 1.2 (`visibleAt`, elongation); Phase 4.3; owner questions
- **Detail**:
  - **(a) The elongation span contradicts the shared rule.** The span runs "sunset to `EVENT_SUN_MAX_ALTITUDE_DEG`, extended to the dark window's start", but `visibleAt` calls every moment with the Sun above −6° "daylight". The sunset-to-−6° part can never count. State that the span starts at Sun −6°, which is what the rule already does, and so avoid a "daylight" reason for an evening Mercury that is merely low.
  - **(b) "Partly" for a solar eclipse** is defined separately from the visible test. Write it as one rule, "visible at the peak, else partly if partial begin or end is at or above the minimum", in the same terms as the lunar case.
  - **(c) Shared files.** Several comments say "six pages": `src/sw.ts:601`, `src/lib/offline/copies.ts:10,160,499`, and CLAUDE.md's Offline section. Update them all with `/tonight/events`. `listCopies` orders by `TONIGHT_PAGES`, so the new page's position in the array is user-visible on `/offline`; put it last, after `/tonight/nights`, and update the `copies.test.ts` order cases.
  - **(d) The owner questions** were the right five. Since the owner's answers:
    - question 3 needs the eclipse follow-up (F2);
    - question 1's execution needs F4;
    - question 5 is carried by F3, Fix B;
    - at 5° (question 2), the Skyfield fixture's threshold cases and the frequency estimate must move to 5°, which the author's working tree already notes.

    No other question is needed: the eye-safety line is fixed safety copy, rightly not optional.
- **Fix**: as listed.
- **Recommended resolution**: apply.
- **Decision**: APPLIED.
  - (a) The elongation span starts at Sun −6°.
  - (b) Eclipse visibility and "partly" are one rule.
  - (c) `/tonight/events` goes **last** in `TONIGHT_PAGES`, with the `copies.test.ts` order cases updated. Every "six pages" comment is updated: `sw.ts` (about :601), `copies.ts` (about :10, :160, :499) and CLAUDE.md's Offline section, and `sw.ts` and `CLAUDE.md` are added to Phase 4.3's files.
  - (d) Covered by F2, F3 and F4, and by the 5° change already in the working tree.
