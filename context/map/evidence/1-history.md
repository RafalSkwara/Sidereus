# Evidence: history

Source: `context/map/.work/git-log.txt` (one pass, `--no-merges --name-status -M`), attributed only through `python3 -I context/map/.work/attribute.py` (3,615 distinct paths, 0 unmapped).
Window: 2026-09-15 .. 2026-10-27 (whole history, ~6 weeks); buckets: ISO weeks W38 (5 commits, partial) .. W44 (9 commits, partial: 26-27 Oct).
Commits: 810 non-merge, 8 mass commits excluded (`excluded-shas.txt`) -> **802 counted**. Authors: 1 human (single-author baseline, false-signal rule 6); 0 bots.
Totals reproduced from the contract: 6,915 file changes = 3,381 code + 2,115 `docs` + 1,419 noise (1,333 binary media, 27 generated catalogue data, 20 recorded gear data, 13 lockfile, 9 db types, 8 stars designations, 8 fixtures, 1 wrangler types). Raw intermediates: `.work/history-parsed.json`, `top-files.json`, `fix-commits.json`, `cochange-pairs.json`, `hub-files.json`.
Counting rules: changes per file, commits once per capability touched (a cross-cutting commit counts for each); `docs` and noise never ranked.

## Activity per capability
(label: evidence unless marked; "agent%" = share of that capability's commits with a Claude `Co-authored-by` trailer; see Mechanical signals, the trailer is a lower bound)

| capability | code changes | % of code | commits | % of 802 | agent% |
|---|---|---|---|---|---|
| shared (bucket) | 657 | 19.4 | 210 | 26.2 | 52 |
| tonight | 656 | 19.4 | 152 | 19.0 | 55 |
| engine | 297 | 8.8 | 63 | 7.9 | 35 |
| observation-log | 277 | 8.2 | 71 | 8.9 | 56 |
| sites-gear | 268 | 7.9 | 65 | 8.1 | 57 |
| platform (bucket) | 199 | 5.9 | 91 | 11.3 | 40 |
| accounts | 159 | 4.7 | 60 | 7.5 | 47 |
| session-plan | 124 (99 after the misattribution below) | 3.7 | 45 (26 after) | 5.6 | 44 |
| progress | 106 | 3.1 | 28 | 3.5 | 7 |
| error-visibility | 105 | 3.1 | 38 | 4.7 | 11 |
| sky-view | 104 | 3.1 | 43 | 5.4 | 49 |
| offline | 87 | 2.6 | 30 | 3.7 | 40 |
| catalogue | 83 | 2.5 | 32 | 4.0 | 22 |
| onboarding | 76 | 2.2 | 41 | 5.1 | 56 |
| finder | 72 | 2.1 | 20 | 2.5 | 0 |
| sky-events | 57 | 1.7 | 19 | 2.4 | 21 |
| forecast | 54 | 1.6 | 16 | 2.0 | 38 |
| docs (prose, not ranked) | 2,115 | - | 769 (95.9%) | - | 37 |

- Unmapped: 0 changes, 0%. Commits with no non-noise file at all: 9. Agent-trailer commits overall: 297 of 802 (37.0%); authorship is one human for all.
- Catch-alls `shared` + `platform` = 25.3% of code (evidence, matches contract); `tonight` + `shared` alone are 38.8% of code changes. Inference: the verdict/dashboard and the design system are where the product was shaped.
- 95.9% of commits touch `docs` (every change ships plan/review/archive text): prose lockstep, not code (rule 8).

## Top files in top capabilities
(commits touching the file; all exist at HEAD unless noted in Hub files and freshness)

- tonight: `src/lib/tonight/build.ts` 49, `build.test.ts` 48, `src/components/tonight/TonightContent.astro` 46, `src/lib/tonight/format.ts` 29, `TonightSkeleton.astro` 24, `load.ts` 21, `VerdictCard.astro` 20.
- shared: `src/i18n/messages/en.ts` 123 and `pl.ts` 123 (translations, move in lockstep), `src/pages/design.astro` 81 (dev-only kitchen sink), `src/styles/global.css` 44, `Topbar.astro` 22, `Layout.astro` 16, `styles/contrast.test.ts` 15.
- engine: `src/lib/engine/index.ts` 25 (barrel), `parameters.ts` 23, `ranking.test.ts` 15, `fixtures/README.md` 13, `determinism.test.ts` 11, `verdict.test.ts` 9.
- observation-log: `pages/log/new.astro` 16, `log/index.astro` 16, `tests/db/observations.test.ts` 13, `log/sky.astro` 12, `observations/store.ts` 11.
- sites-gear: `tests/e2e/telescope-selector.spec.ts` 14, `GearShell.astro` 12, `pages/gear/index.astro` 11, the three `gear/<entity>/[id].astro` pages 10 each.
- platform: `package.json` 24, `scripts/smoke.mjs` 24, `eslint.config.js` 18, `tests/e2e/helpers.ts` 14, `.github/workflows/ci.yml` 13, `wrangler.jsonc` 9.
- accounts: `src/middleware.ts` 17, `tests/db/isolation.test.ts` 10, auth pages/forms 6-9 each.
- Misattribution caveats (evidence; `attribute.py` unchanged, not re-scored): (a) glob `src/components/tonight/Plan*` also catches `PlanetCard.astro` (13), `PlanetsPageContent.astro` (9), `PlanetSection.astro` (3) = 25 changes in 21 commits that are about planets (Tonight), so session-plan's top file list is partly planet code; without them session-plan is 99 changes / 26 commits. (b) `GearShell.astro` (12) sits in sites-gear by prefix but is the shell that wraps every signed-in page (inference, from the file name and CLAUDE.md; not opened). (c) `src/components/Welcome.astro` (16 changes) is mapped to onboarding, the contract and CLAUDE.md describe it as the signed-out landing page (shared). Combined effect: onboarding and sites-gear look slightly busier, session-plan and tonight slightly different from reality.

## Trend
Commits per capability per ISO week (a cross-cutting commit counts in each; W38 and W44 partial).

| capability | W38 | W39 | W40 | W41 | W42 | W43 | W44 | label |
|---|---|---|---|---|---|---|---|---|
| (all counted commits) | 5 | 80 | 116 | 243 | 313 | 36 | 9 | rising to W42, then stops |
| tonight | 1 | 18 | 35 | 48 | 50 | 0 | 0 | rising, then stopped after 17 Oct |
| shared | 1 | 23 | 48 | 62 | 75 | 1 | 0 | rising, then stopped after 19 Oct |
| engine | 0 | 13 | 13 | 15 | 18 | 3 | 1 | constant (the steadiest), tapering |
| observation-log | 0 | 11 | 20 | 23 | 14 | 3 | 0 | peaked W41, fading |
| sites-gear | 0 | 9 | 15 | 28 | 12 | 1 | 0 | seasonal (gear-catalogue + ui-user-adjustments, W41), fading |
| platform | 2 | 16 | 13 | 16 | 38 | 2 | 4 | constant with a W42 spike; the only code area still moving in W44 |
| accounts | 1 | 13 | 7 | 14 | 22 | 2 | 1 | constant, mild rise to W42 |
| onboarding | 1 | 9 | 7 | 13 | 10 | 1 | 0 | constant, fading |
| session-plan | 0 | 0 | 8 | 13 | 24 | 0 | 0 | rising until it was finished (17 Oct) |
| sky-view | 0 | 0 | 3 | 22 | 18 | 0 | 0 | campaign W41-W42, finished |
| progress | 0 | 0 | 0 | 5 | 23 | 0 | 0 | campaign W41-W42, finished (9-17 Oct) |
| offline | 0 | 0 | 0 | 11 | 14 | 4 | 1 | campaign W41-W42, small tail to 27 Oct (e2e offline-site-switch) |
| catalogue | 0 | 4 | 1 | 6 | 18 | 3 | 0 | spike in W42 (star-source-switch) |
| error-visibility | 0 | 2 | 1 | 5 | 21 | 9 | 0 | campaign W42-W43 (error-visibility, sky-check-record-cause) |
| forecast | 0 | 5 | 1 | 3 | 6 | 1 | 0 | constant, low |
| finder | 0 | 0 | 0 | 0 | 20 | 0 | 0 | one-off campaign 13-17 Oct (finder-chart) |
| sky-events | 0 | 0 | 0 | 0 | 19 | 0 | 0 | one-off campaign 14-17 Oct (sky-events) |

Campaigns behind spikes (top change-id scopes of non-docs commits): W39 first-run-onboarding, observation-log-management, log-observation-from-ranking, verified-ephemeris-core; W40 moonlight-and-the-verdict, tonight-nightfall, visual-redesign, verdict-check, planets-on-tonight, tonight-dashboard; W41 gear-catalogue (20), ui-user-adjustments (19), deep-sky-beyond-messier, offline-night-plan, session-plan-timeline, observing-progress; W42 star-source-switch (20), error-visibility, observing-milestones, ui-sky-modes, adjustable-session-plan, sky-events, finder-chart, test-suite-diet; W43 openngc-galaxy-magnitudes (7), error-visibility (6), sky-check-record-cause; W44 `test`, `hooks`, `auth-redirect`, `verdict`.
Inference (not measured): since 19 Oct the repository has moved from features to tests, hooks and e2e setup; every feature capability is quiet in W43-W44 (0-4 commits each). Whether that is "done" or a pause is unknown.

## Fix pressure
Heuristic: subject type `fix` (88 commits, 11.0% of 802); the brief's keyword regex (`fix|bug|hotfix|revert|regression|broken|incident`, word-bounded) adds only 17 subjects, all `docs`/`chore`/`feat`/`test` wording ("plan review fixes", "fixed") and is not used for ranking. A fix commit counts for each capability it touches; "cross-cutting" = more than 3 business capabilities (excl. docs, platform, shared). **Reverts: 0** (no subject starts or contains `revert`, no merge commit mentions one), so no revert spillover.

| capability | commits | fix | fix% | review-driven fixes | other fixes | cross-cutting fix commits |
|---|---|---|---|---|---|---|
| error-visibility | 38 | 13 | 34.2 | 12 | 1 | 3 |
| sky-view | 43 | 14 | 32.6 | 11 | 3 | 2 |
| offline | 30 | 9 | 30.0 | 8 | 1 | 3 |
| catalogue | 32 | 9 | 28.1 | 9 | 0 | 1 |
| engine | 63 | 17 | 27.0 | 15 | 2 | 2 |
| tonight | 152 | 41 | 27.0 | 36 | 5 | 5 |
| observation-log | 71 | 19 | 26.8 | 16 | 3 | 3 |
| forecast | 16 | 4 | 25.0 | 2 | 2 | 1 |
| progress | 28 | 7 | 25.0 | 5 | 2 | 1 |
| shared | 210 | 50 | 23.8 | 48 | 2 | 5 |
| sites-gear | 65 | 15 | 23.1 | 12 | 3 | 4 |
| session-plan | 45 | 9 | 20.0 | 8 | 1 | 3 |
| accounts | 60 | 10 | 16.7 | 10 | 0 | 4 |
| sky-events | 19 | 3 | 15.8 | 3 | 0 | 0 |
| finder | 20 | 3 | 15.0 | 3 | 0 | 1 |
| onboarding | 41 | 6 | 14.6 | 6 | 0 | 2 |
| platform | 91 | 12 | 13.2 | 8 | 4 | 2 |

- 6 of the 88 fix commits are cross-cutting (more than 3 business capabilities); 6 touch only buckets or docs.
- **Review-driven**: 71 of 88 `fix` commits (81%; subject contains "review", "F<n>" finding ids or "owner") are `fix(<change-id>): impl review F1-F9`, i.e. the review findings of a change applied before or at its merge; 17 are other fixes. In this repo the type `fix` mostly labels the review loop, not a defect that escaped (inference from subjects, all 88 read). The 17 others: sky-check-record-cause cause on the line, app-icon star centring, two e2e waits, Workers Logs stopped storing visitor location (platform/security-relevant, 16 Oct), Moon skeleton, focus after the milestone dialog, tooltip Esc, gear-card sizing x2, forecast-honesty p1/p2 (partial forecast, no "go"), gear-catalogue ranking, CI post-deploy `?next=`, parallel-e2e hydration wait, "tonight moves on once last night's darkness ends", skeleton bars.
- False-signal rules applied: UI polish capabilities (`shared` 50 fixes, `sky-view`, `tonight`) are 48/50, 11/14, 36/41 review-driven, so their high absolute fix counts are the review process and trial-and-error UI work (rule 5), not a broken capability; `platform` (CI/e2e/hooks) 4 of 12 are real trial-and-error fixes (rule 5), 8 review-driven. Rule 12: `ab582fd21b fix(error-visibility): impl review F2, F6, F7, F8, F9` (53 files, 10 capabilities) is about error-visibility; it adds one fix to accounts, forecast, observation-log, onboarding, progress, session-plan, sites-gear, tonight and platform that is spillover (e.g. forecast 4 -> 3, progress 7 -> 6, onboarding 6 -> 5). `9f4f4b3b25` (144 files, ui-quiet-actions) similarly adds to shared/tonight/offline.
- Ranking after rules 5 and 12 (inference): the only capabilities with a notable share of non-review fixes are `tonight` (5), `platform` (4), `sky-view` (3), `sites-gear` (3), `observation-log` (3). No capability shows fix pressure that is not explained by the review loop. Fix pressure is a weak risk signal in this history.

## Co-change between capabilities
Counted commits 802; co-change drops commits touching more than 9 of the 18 capabilities: **5 dropped** (`db88164ab0`, `68e12aee24`, `e1eee5ed51`, `614f3d78a1` all test-suite-diet, and `ab582fd21b` error-visibility review) -> 797 kept; `docs` excluded from pairs. Of the kept: 260 touch 2+ non-docs capabilities, 100 touch 1, 437 touch none (docs/noise only). Confidence = shared commits / commits of the less active side (within the kept set).

Pairs with business capabilities only (the two buckets removed):

| pair | support | confidence | commits A / B |
|---|---|---|---|
| observation-log + tonight | 39 | 0.59 | 66 / 147 |
| session-plan + tonight | 35 | 0.85 | 41 / 147 |
| sites-gear + tonight | 34 | 0.57 | 60 / 147 |
| sky-view + tonight | 29 | 0.71 | 41 / 147 |
| engine + tonight | 25 | 0.41 | 61 / 147 |
| accounts + tonight | 21 | 0.38 | 55 / 147 |
| observation-log + sites-gear | 17 | 0.28 | 66 / 60 |
| onboarding + sites-gear | 16 | 0.44 | 36 / 60 |
| session-plan + sites-gear | 15 | 0.37 | 41 / 60 |
| accounts + error-visibility | 13 | 0.37 | 55 / 35 |
| observation-log + progress | 12 | 0.50 | 66 / 24 |
| sky-events + tonight | 11 | 0.65 | 17 / 147 |

With the buckets: shared + tonight 113 (0.77), observation-log + shared 48 (0.73), shared + sites-gear 46 (0.77), platform + shared 35 (0.40), session-plan + shared 32 (0.78), shared + sky-view 33 (0.80), onboarding + shared 31 (0.86), accounts + platform 30 (0.55), shared + sky-events 14 (0.82).

- Evidence: `tonight` is the integration capability. session-plan, sky-view and sky-events change with it at confidence 0.65-0.85, meaning most of their commits also touch Tonight. Inference: they are features rendered inside Tonight rather than independent modules, as the commit change-ids (session-plan-timeline, interactive-sky, sky-events) and CLAUDE.md describe.
- `shared` couples with everything because the translation catalogs and the design system change with every feature (see Hub files, rules 3 and 4); the pair counts with `shared` are a workflow corridor, not a finding.
- `accounts` + `platform` (30) and `accounts` + `error-visibility` (13): accounts changes ride with CI/test harness work (isolation tests, smoke) and with the error-visibility sweep. Common cause: the testing and error-visibility changes (rule 4).

## Hub files and freshness
Hub = file co-changing with the most distinct other capabilities (partners seen in 2+ kept commits; docs-attributed files excluded).

| file | capability | commits | distinct partners | what it is |
|---|---|---|---|---|
| `src/lib/tonight/build.ts` | tonight | 49 | 16 | assembles `TonightView`; 33 feat + 15 fix + 1 refactor commits across 24 change ids: every feature that adds a block to Tonight edits it (inference from commit types; not opened) |
| `src/lib/tonight/build.test.ts` | tonight | 47 | 16 | its test |
| `src/i18n/messages/en.ts`, `pl.ts` | shared | 123 each | 15 | translation catalogs, edited in lockstep by the i18n rule; `src/i18n/i18n.test.ts` exists at HEAD (parity test per CLAUDE.md), so drift fails loudly: corridor (rule 3), not a risk |
| `src/pages/design.astro` | shared | 81 | 15 | dev-only kitchen sink; each new component adds a specimen; no build guard seen: a lockstep chore (inference) |
| `src/lib/tonight/load.ts` | tonight | 20 | 15 | loader for Tonight islands (16 feat, 5 fix) |
| `src/components/tonight/TonightContent.astro` | tonight | 46 | 14 | dashboard island root |
| `src/lib/tonight/format.ts` | tonight | 29 | 14 | locale formatting for Tonight wording |
| `src/components/tonight/TargetsPageContent.astro` | tonight | 16 | 13 | targets page |
| `package.json` | platform | 24 | 12 | root manifest (scripts, deps): shared config (rule 2/7) |
| `src/lib/observability/silent-catch-guard.test.ts` | error-visibility | 15 | 12 | static guard whose allowlist changes when any store/route adds a catch: rule 3 corridor guarded by a failing test |
| `src/lib/engine/index.ts` | engine | 25 | 11 | engine barrel (every new engine export) |
| `scripts/smoke.mjs` | platform | 21 | 11 | HTTP smoke walk; every feature with a gate adds steps |

Rules applied: 4 (a shared cause counted once: the Tonight build and i18n files are hubs because each feature edits them, and these are the same ~15 feature campaigns); 3 (en/pl guarded by `i18n.test.ts`); 7 (no generated files here: db types, lockfile, catalogue json are noise and excluded). Caveat: partner counts also include multi-capability review-fix sweeps (rule 12) such as `9f4f4b3b25`; they were not removed.
Freshness (`git cat-file -e HEAD:<path>` on 154 files named in top-file and hub lists): **148 exist; 6 do not**: `context/changes/error-visibility/plan.md`, `context/changes/star-source-switch/plan.md`, `context/changes/test-suite-diet/plan.md` (moved to `context/archive/` when the change closed, prose), and three deleted tests `src/components/design/finder-samples.test.ts`, `src/components/tonight/TonightSkyView.test.ts`, `src/lib/onboarding/schemas.test.ts` (test-suite-diet pruning). They are history, not current hot files (rule 11). Deleted code-file entries overall: 60 in code capabilities (tonight 14, shared 9, engine/session-plan/sites-gear 7 each, observation-log 4, accounts 3, others 1-2).

## Mechanical signals
- `docs` churn (2,115 changes, 95.9% of commits) is prose; shown, never ranked (rule 8).
- Fix share: 81% of `fix` commits are impl-review follow-ups (rule 5, and a naming habit of the workflow); UI (`shared`, `sky-view`, `tonight`) and platform fix ratios are trial-and-error/process, not instability. Spillover from two large review-fix commits (rule 12). No reverts exist.
- `shared`/`platform` are catch-all buckets (25.3% of code) and are the first partner of nearly every pair; pairs with them reflect workflow lockstep (rules 3, 4).
- `en.ts`/`pl.ts` and `design.astro` are top-changed files because every feature touches them (corridor, rule 3). `database.types.ts`, lockfile, catalogue JSON, screenshots are noise and excluded by the contract (rule 7).
- Agent trailer share is a **timing artefact, not a measure of agent involvement**: trailer commits by week are 4/5, 57/80, 101/116, 87/243, 41/313, 2/36, 5/9 (W38..W44), i.e. 87% in W40 and 13% in W42 and 6% in W43, while the owner says most code was written by Claude Code throughout. So per-capability agent% (finder 0%, progress 7%, error-visibility 11%) mostly says "built in a week without trailers", not "human-written" (rules 4, 7). Single-author baseline (rule 6): no concentration statistic is a finding.
- Pair and trend numbers inherit the three glob misattributions listed under Top files (Plan* matches Planet*, GearShell, Welcome); they are reported, not corrected, to keep one attribution scheme.

## Unknowns
- Whether quiet capabilities in W43-W44 are finished or paused (history ends 27 Oct; the window is the whole 6-week life of the repo): `unknown`.
- Escaped bugs: no issue-labelled bug references were read (forge not used by this pass), commit subjects use `fix` for review follow-ups, and there are no reverts, so post-merge defect rates are `unknown`; the discussion agent (PRs, issues) may fill this.
- Pairs that should co-change but are not visible in co-change: `src/i18n/messages/pl.ts` vs `en.ts` stay in lockstep (guarded by `i18n.test.ts`); the engine's pure scoring (`engine`) and its Tonight presentation wording (`tonight/format.ts`, `build.ts`): engine + tonight confidence is only 0.41, so engine changes often land without the Tonight view, which is expected if the engine API is stable, but whether a rule change can silently misstate a Tonight sentence is `unknown`; `scripts/*-reference.py` (Skyfield oracles) vs engine fixtures: the Python oracles and the engine's JSON fixtures should change together, but fixtures are noise-excluded, so their lockstep is not measurable here (`unknown`); the SQL migration vs `database.types.ts` vs `tests/db/tables.ts` lockstep is guarded by CI per CLAUDE.md, not measurable from path co-change since types are noise; `src/sw.ts` / `lib/offline` vs the Tonight page list (`TONIGHT_PAGES`, `TONIGHT_NAV`) in `navigation.ts` (shared): offline + shared 17 commits, confidence 0.61, other side unknown.
- Whether `build.ts` growth (49 commits, 33 feat) is a maintainability risk is `inference` only; this pass does not read file size or structure (structure agent).
- Contract-level caveat: change ids are not capabilities; one change (e.g. adjustable-session-plan) spreads over 5-6 capabilities, so per-capability counts include shared review sweeps.

## Commands run
- `python3 -I $SCRATCH/parse.py` (parse `git-log.txt`, exclude `excluded-shas.txt`, attribute 3,615 paths through `python3 -I context/map/.work/attribute.py`) -> `.work/history-parsed.json`
- `$SCRATCH/a1.py` activity and top files; `a2.py` weekly buckets, first/last dates; `a3.py`, `a4.py`, `a5.py` fix share, review-driven split, co-change pairs, hub files; `a6.py` misattribution and build.ts/load.ts commit types; freshness script with `git cat-file -e HEAD:<path>`; weekly agent-trailer counts.
- `git -c core.quotepath=off log --all-match -i --grep=revert`, `git log --merges -i --grep=revert`, `git log --no-merges -i --format=%s | grep -ci '\brevert'` (revert check: 0 in subjects).
- `git ls-files src/i18n`, `git ls-files | grep -E 'island-imports|rhythm-roles|i18n.test'` (guard existence for rule 3).
