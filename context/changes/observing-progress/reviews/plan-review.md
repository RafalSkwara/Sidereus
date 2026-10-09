<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Observing progress (M-3 S-05)

- **Plan**: `context/changes/observing-progress/plan.md`
- **Date**: 2026-10-09
- **Phases**: 3
- **Reviewers**: claim verification + feasibility/sequencing (Opus agents), verification commands (main session)
- **Findings**: 0 critical, 7 warnings, 3 observations
- **Overall**: NEEDS ATTENTION → all 10 findings fixed in plan.md (F2 by user decision: icon button in the `<h3>`, Moon in `SeenTag`'s slot)

## Verdicts

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Claim Accuracy | WARNING | F2, F10 |
| Substance | PASS | |
| Feasibility | WARNING | F2, F3 |
| Sequencing | WARNING | F1 |
| Architecture Fit | WARNING | F3, F4 |
| Scope Discipline | PASS | |
| Verifiability | WARNING | F5, F6, F8 |
| Coverage | WARNING | F7, F9 |

## Findings

### F1 — Adding `firstNight` breaks six tests the plan doesn't list

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Sequencing
- **Location**: plan.md "Phase 1 › Changes Required › 3"
- **Detail**: `SeenSummary` gains a required field. `tsconfig.json` includes `**/*`, so the tests below fail `astro check` or `toEqual`, and step 1.3 cannot pass as written.
  - `src/lib/engine/ranking.test.ts:281,312,319`: hand-built maps.
  - `src/lib/tonight/format.test.ts:37`: `seenLine({count,lastNight})`.
  - `src/lib/targets/index.test.ts:44`, `src/lib/engine/moon-target.test.ts:166` and `src/lib/engine/planet-ranking.test.ts:208`: `toEqual` on `seenSummaries` output.
  - The plan's own `log.test.ts:25,33,42,63,64`.
- **Fix**: List these files in Phase 1 Changes Required.
- **Decision**: FIXED

### F2 — The mark inside the `<h3>` breaks a planets spec, and the Moon card has no name to put it beside

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Feasibility / Claim Accuracy
- **Location**: plan.md "Phase 2 › Changes Required › 3"
- **Detail**:
  - `tests/e2e/planets-on-tonight.spec.ts:41-45` reads the first planet card's `<h3>` `textContent` for a fresh user and throws unless it equals the planet name. A button label or tooltip text inside the `<h3>` breaks it, yet step 2.3 claims that spec "still passes".
  - `MoonCard.astro:57-60` renders no visible Moon name: the band heading is `headingHidden`, and the target block starts with `SeenTag`. "Beside the Moon target's name" has no anchor.
- **Fix**: This is a UI decision for the user. Option A keeps the icon by the name: only the icon button goes inside the `<h3>`, the tooltip renders outside it, the planets spec reads the name `<span>`, and the Moon's mark takes `SeenTag`'s slot. Option B puts the mark in `SeenTag`'s slot on all three cards, since the two are mutually exclusive.
- **Decision**: FIXED

### F3 — The tooltip mechanics are underspecified and fight each other

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Architecture Fit / Feasibility
- **Location**: plan.md "Phase 2 › Changes Required › 2"
- **Detail**:
  - CSS `:hover`/`:focus` combined with a tap toggle conflict. On touch, `:hover` sticks, so a second tap cannot close the tooltip, and Esc cannot clear `:focus` without a script.
  - A closed tooltip that is only `invisible` still widens `scrollWidth` at 320 px, and `tonight-phone.spec.ts` would then fail, because a fresh user has every mark.
  - An icon-anchored, fixed-width bubble goes off-screen at the end of a wrapped name, and arbitrary `max-w-[…]` values are banned.
  - Where the script lives is unstated. The precedent is a component `<script>` inside a `server:defer` island (`GearCard.astro:82-97`), whose `/_astro` chunk the offline copies already pick up (`copies.ts:209-213`).
- **Fix**: Specify the mechanics:
  - one `data-open` state driven by a delegated `<script>` in `NotSeenMark.astro` (click toggles; Esc and an outside pointerdown close);
  - hover and focus-visible open it only under `@media (hover: hover)`;
  - closed means `hidden`;
  - the tooltip is positioned against the card's `li` (`relative`, full-width under the heading), not the icon;
  - a `specimen`/`open` prop for `/design` and the screenshots;
  - no `console` in the script (`.astro` client scripts are not linted).
- **Decision**: FIXED

### F4 — `observingProgress(seenMap)` makes its rating tests unfalsifiable

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Architecture Fit
- **Location**: plan.md "Phase 1 › Changes Required › 4"
- **Detail**: A seen map carries no ratings or nights. The planned cases "rated-2-only stays unticked", "two entries on one night count once" and "removing the only qualifying entry unticks" cannot fail against a hand-built map, which test-plan §6.3 forbids. The page would also own half the rule.
- **Fix**: Make it `observingProgress(entries: readonly LogEntry[])`, calling `seenSummaries(entries)` itself, and feed the tests raw entries.
- **Decision**: FIXED

### F5 — The e2e and db runs need a recipe the plan doesn't give

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Verifiability
- **Location**: plan.md "Phase 1/2/3 › Implementation Note", Progress 1.2, 2.2, 2.3, 3.1, 3.2
- **Detail**:
  - The worktree has no `node_modules`, so no verification command could run during review: the scripts exist but are not installed.
  - `playwright.config.ts` has no `webServer`. As CI does (`.github/workflows/ci.yml:51-75`), a run needs:
    - the forecast fixture on 127.0.0.1:4400;
    - `.env`/`.dev.vars` pointing at **local** Supabase with `FORECAST_BASE_URL`, before `npm run build`;
    - `npm run preview` on a free port;
    - `BASE_URL`;
    - `SUPABASE_URL`/`SUPABASE_KEY` for seeding.
  - `npm run test:db` also needs `SUPABASE_SECRET_KEY` (the account-plan suites), or it can be scoped to `tests/db/observations.test.ts`.
- **Fix**: Add a "Running the checks" recipe to the plan:
  - `npm ci` in the worktree;
  - env from the orchestrator, or generated from `npx supabase status -o env`;
  - the fixture and preview ports agreed with the orchestrator (never 4329);
  - rebuild after each change;
  - `npm run test:db -- tests/db/observations.test.ts`.
- **Decision**: FIXED

### F6 — The paging loop and its db test miss the failure they guard

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Verifiability
- **Location**: plan.md "Critical Implementation Details", "Phase 1 › Changes Required › 1-2"
- **Detail**:
  - The loop ends on the first short page. If the hosted `max_rows` were below 1000, page 1 would come back short and the read would be cut silently: the bug this slice fixes.
  - Seeding `M1`–`M110` × 10 nights means a capped read drops 100 rows from one night, and "covers all 110 targets" still passes. Only the 1,100 count catches it.
- **Fix**:
  - Loop until a page comes back **empty** (one extra round-trip).
  - Seed `M1`–`M100` × 11 newer nights and `M101`–`M110` only on an older night, then assert those 10 are present along with the total.
- **Decision**: FIXED

### F7 — Polish names, the date format and gender-neutral copy are unspecified

- **Severity**: WARNING
- **Impact**: LOW
- **Dimension**: Coverage
- **Location**: plan.md "Phase 1 › 4", "Phase 3 › 1-3"
- **Detail**:
  - The model's `commonName` is the catalogue's English name. ObjectCard and TonightTiles use `localCommonName`, so PL rows and chip labels would otherwise be English.
  - `formatNightDate` gives "Saturday, 12 September 2026" (`format.ts:249`), which is long for a 320 px row. The plan's "12 Sept 2026" is the private `shortDateFormat` (`format.ts:197`).
  - PL "Widziany" (`pl.ts:502`) is masculine, and the targets mix genders.
- **Fix**:
  - Use `localCommonName` (or `targetLabel` `.id`/`.name`) on the page.
  - Export a `formatShortDate` from `format.ts` (the "12 Sept 2026" form) for the firsts and the seen list.
  - Write gender-neutral PL copy for the mark and the chip states (a phrasing that doesn't inflect by the object's gender), checked in the PL screenshots.
- **Decision**: FIXED

### F8 — e2e specifics that make the specs flaky or weak

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Verifiability
- **Location**: plan.md "Phase 2 › 5", "Phase 3 › 4"
- **Detail**:
  - A logged deep-sky object takes `LOG_PENALTY` and can fall into "show the other N" (`observation-log.spec.ts:62-64`).
  - On the real clock the first Targets row may be a Caldwell object, so "0 / 110 → 1" would fail.
  - Chips have no test hook.
  - A programmatic `.focus()` may not trigger `:focus-visible`.
  - Tap and Esc (2.6) can be automated with a `hasTouch` context.
- **Fix**:
  - Locate rows by `li[data-object]`.
  - Log a fixed key (`/log/new?object=M31&from=log`).
  - Add `data-checklist-item`/`data-seen` hooks.
  - Use keyboard Tab.
  - Add an automated tap/Esc case to `observing-progress.spec.ts`, keeping 2.6 as the visual check.
- **Decision**: FIXED

### F9 — Small gaps: skeleton, tile name, S-06 type, chip contrast, evidence

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Coverage
- **Location**: plan.md "Phase 2 › 3", "Phase 1 › 4", "Phase 3 › 2"
- **Detail**:
  - `TonightSkeleton.astro:69-80` mirrors the targets tile row by row, but has no line for the new legend.
  - The tile's `aria-labelledby` masks the static mark's `sr-only` text. That is acceptable, but should be stated.
  - Checklist items carry no `type`, so S-06 (first galaxy or globular) would need `findDeepSky` again.
  - The seen chip's fill, text and check need an existing contrast-pinned pair.
  - The screenshot evidence location is unnamed.
  - The landing screenshot's tile would change on the next recapture.
- **Fix**:
  - Add the legend line to the skeleton.
  - Note the tile name.
  - Add `type` to the checklist items.
  - Use `selected`/`selected-foreground` or `primary` pairs already pinned by `contrast.test.ts`.
  - Evidence goes to `context/changes/observing-progress/evidence/`.
  - Note the landing recapture under NOT doing.
- **Decision**: FIXED

### F10 — Cosmetic anchor errors

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Claim Accuracy
- **Location**: plan.md "Current State Analysis", "What We're NOT Doing", "Phase 3 › 3"
- **Detail**:
  - The catalogue counts sit at `index.ts:73-74`, and the export and disjointness checks at `:258-265`, not `:191`.
  - `tests/db/structure.test.ts`/`tables.ts` don't exist on this branch until PR #147 merges.
  - `SKY_CHECKS_PAGE` lives in `src/lib/sky-checks/redirect.ts`, so `PROGRESS_PAGE` next to `LOG_LIST` departs from that precedent. That is fine, but deliberate.
- **Fix**: Correct the anchors, and phrase the #147 note conditionally.
- **Decision**: FIXED
