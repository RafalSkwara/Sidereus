# What to expect (M-3 S-04) — Plan Brief

> Full plan: `context/changes/what-to-expect/plan.md`
> Research: `context/changes/what-to-expect/research.md`
> Plan review: `context/changes/what-to-expect/reviews/plan-review.md` (F1-F10 applied)

## What & Why

Each ranked deep-sky target gets one plain-language line on what it will look like in the user's own telescope from their site (PRD FR-038, US-05, OQ17), for example "A very faint grey smudge; use averted vision." The line is a full-plan feature (FR-045). A free account sees what it does and that it needs the full plan.

## Starting Point

The catalogue and the engine already hold every input:

- type, magnitude and size;
- a core surface brightness (`effectiveSurfaceBrightness`);
- the sky brightness per Bortle class;
- the telescope's limiting magnitude.

Nothing classifies how an object looks. Planets and the Moon already ship fixed, free notes. Every ranked row's details render through one component, `ObjectDetails`. The finder loader already proves the plan before it builds a chart.

## Desired End State

- **Full-plan user:** every ranked row on `/tonight/targets` and every finder chart shows an eye line from a fixed set of 22 phrases, in EN or PL. The line changes with the telescope's aperture and the site's sky class. A planet's chart shows its existing note.
- **Free user:** one muted line on Targets and a fourth bullet on the locked finder page. No free island's HTML ever contains a phrase, and smoke proves it over HTTP.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Scope | Deep-sky only; planet and Moon notes stay as they are (free); the finder chart reuses the planet note | FR-038's inputs are deep-sky terms, and the notes shipped before v3 stay free | Research / Plan D-1, D-9 |
| Rule | Contrast deficit (core SB − Bortle sky − 0.5 mag per aperture doubling from 150 mm) → 4 bands, a near-limit floor, then a type table → 22 keys | Reuses the engine's own sky model, so the line never contradicts the washed-out rule | Plan D-2 |
| Globulars | Resolved at ≥ 150 mm and V ≤ 7, grainy at ≥ 100 mm and V ≤ 8, else a glow | Published guides: a 4-inch starts on M13's edge, 4.5-6 inches resolves it | Research §7 / D-2 |
| Moon | Not an input | The line is a property of object, site and scope; the reason line already covers the Moon | Plan D-4 |
| Calibration | Source-cited reference fixture (about 12 objects, at least 2 sources each, 150 mm at Bortle 4) with known divergences, never edited to pass | No observer; follows finder-chart D-11 | Plan D-6 |
| Gate | Computed server-side in the Targets island and the finder loader after the plan read, passed as a prop; never in `TonightView` | Islands replay without the shell, and the plan-blind view would leak the text | Plan D-7 |
| Overlap with S-07 | No edit to S-07's files (`build.ts`, `load.ts`, `island.ts`, `TONIGHT_PAGES`, `copies.ts`, dashboard, `tonight-phone.spec.ts`, `fixtures/index.ts`); new blocks at named places, away from S-07's: `EXPECT_*` after `WASHED_OUT_TYPES`, the barrel export after `./moonlight`, `tonight.expect` after `tonight.finder` | S-07's `e57dadf` already appends at the ends of `parameters.ts` and `engine/index.ts` | Review F3 / D-10 |
| Failed plan read (D-13) | `unknown` shows neither the lines nor the free line; access stays fail-closed | A paying user is never told they lack the plan because of a transient error | Review F5 / Plan |
| Free view (O-1) | One muted lock line under the Targets count | Owner chose A on 2026-10-14 | Owner |
| Plan loss offline (O-2) | A stored Targets copy keeps its lines until replaced online or expired (36 h); no `copies.ts` change | Owner chose A on 2026-10-14 | Owner |
| Hard cases (D-6) | The fixture also samples M42 at Bortle 7, M56 at 200 mm, Helix and M97, NGC 7000, a ~11 mag galaxy and M33 at Bortle 9; Phase 1 may apply 5 listed, source-backed rule changes | The showcase-only fixture could not fail | Review F2, F8 |
| Proof timing | The Targets gate's smoke and e2e land with the gate in Phase 2; markers are valued (`data-expect="<key>"`) | Bare `data-expect` could not fail the smoke checks | Review F1, F7 |

## Scope

**In scope:**

- the engine rule and its `EXPECT_*` candidates;
- the reference fixture;
- 22 EN and PL phrases;
- the gated line on Targets rows and finder charts;
- the free line and the locked finder bullet;
- `/design` specimens;
- smoke steps, an e2e spec and a CLAUDE.md paragraph.

**Out of scope:**

- new planet or Moon lines;
- any Moon input;
- the dashboard, Session plan and washed-out rows;
- `TonightView` and loader changes;
- the offline drop rule (O-2 = A);
- new data, migrations or logs;
- observer calibration.

## Architecture / Approach

- `src/lib/engine/expectation.ts` holds the pure `expectationFor(object, bortle, apertureMm) → ExpectationKey`.
- `src/lib/tonight/expectation.ts`, server-only, does the catalogue lookup and the translation.
- `TargetsPageContent` awaits the memoised plan read after the Tonight load and decides through `expectationView`: on `full` it passes `{ key, text }` through `ObjectCard` / `ObjectRow` to `ObjectDetails`; on `free` it renders the lock line; on `unknown` it renders neither.
- `loadFinderFor`'s chart result gains `expectation`, and `FinderContent` renders it.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. The rule | `expectationFor`, `EXPECT_*`, property tests, reference fixture with hard cases | The hard cases may leave more than 3 divergences, which stops the phase for the owner |
| 2. Copy, Targets rows and proof | 22 phrases in EN and PL, helper, gated row line, free line, `/design`, Targets smoke and e2e (EN and PL at 320 px) | Wording judged without an observer; owner reads it on `/design` |
| 3. Finder chart line | Deep-sky phrase and planet note on the chart; locked bullet; `finder 3` check and an e2e test | Small; `load.ts` chart variant shape |
| 4. Leaked island, docs, whole suite | Signed-out island step, CLAUDE.md, whole e2e suite and smoke | Shared-file merges with S-07 |

**Prerequisites:** F-01 (account plans) and S-03 (finder chart), both done. Rebase onto main if S-07 merges first.

**Estimated effort:** about 1-2 sessions across 4 phases.

## Open Risks & Assumptions

- The thresholds and phrases are candidates judged without an observer. The reference fixture catches gross errors, not nuance.
- The plan review's recomputation shows the starting rule misclassifies known hard cases: faint globulars, Helix and M97, M42 under a city sky, NGC 7000 and small galaxies near 11 mag. They are now in the fixture, and Phase 1 resolves each by a sourced rule change (D-2 (a)-(e)) or a known divergence. More than 3 left over goes to the owner.
- Polish copy quality depends on the owner's read in Phase 2.

## Success Criteria (Summary)

- A full-plan beginner reads, on every ranked target and its finder chart, a sentence that matches what published guides say they will see with their aperture and sky.
- A free account learns the feature exists and needs the full plan, and the server never sends them the text.
- Nothing on the dashboard or in S-07's files changes.
