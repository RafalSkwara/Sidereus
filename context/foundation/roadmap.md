---
project: Sidereus
version: 1
status: draft
created: 2026-09-22
updated: 2026-09-26
prd_version: 2
main_goal: speed
top_blocker: time
milestone_id: mvp-night-decision
milestone_seq: 1
milestone_status: open
---

# Roadmap: Sidereus

> Derived from `context/foundation/prd.md` (v2), `context/foundation/tech-stack.md`, `context/foundation/infrastructure.md`, `context/deployment/deploy-plan.md`, the `## Forward: technical-roadmap` block of `context/foundation/shape-notes.md`, and an auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: MVP night decision** — Status: open

- **Intent:** A signed-in beginner gets, from their own site and kit, an honest verdict on whether tonight is worth setting up for and a ranked, explained shortlist of Messier objects to point at, with the supporting flows (onboarding, multi-night planning, observation log, account hardening) that PRD v1 declares as must-have.
- **Source materials:** `context/foundation/prd.md` (v2; FR-025 and FR-026 added 2026-09-26)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-001 through FR-026 (all 26 must-have functional requirements), US-01 through US-04, the Business Logic invariants, and the Non-Functional Requirements they depend on.

## Vision recap

A beginner amateur astronomer with a first telescope cannot answer two questions on a clear evening: is tonight worth setting up for, and what should I point at? The data exists but is scattered across a weather app, a moon-phase site, an altitude chart and the eyepiece specs in a drawer, and none of it is expressed as a decision. Sidereus makes the interpretation explicit: a go / marginal / no-go verdict for the night, and a ranked shortlist of Messier objects each carrying the reason it was chosen and the pair of the user's own eyepieces to use. It is built primarily as a learning project, with the author as the reference user for judgment calls.

## North star

**S-02: Tonight view: verdict and ranked Messier list** — the smallest end-to-end slice that proves the product's core hypothesis (that a beginner can be handed a decision, not data), placed as early as its prerequisites allow because with `main_goal: speed` the PRD's pre-committed cut checkpoint fires on exactly this outcome: if the engine does not produce a sane top 5, the cut order drops the 7-night planner, manual log entry, password reset and red night mode.

> "North star" here means the one slice whose successful delivery would validate the product idea; everything else on this roadmap only matters if this slice works, so it is sequenced first and the rest is ordered around it.

## At a glance

| ID   | Change ID                               | Outcome (user can …)                                                                                                     | Prerequisites | PRD refs                                                                 | Status   |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------ | -------- |
| F-01 | verified-ephemeris-core                 | (foundation) Messier catalogue loaded and moon, dark-window and altitude results verified against the planetarium reference under a fixture test harness | —             | NFR determinism, NFR ephemeris tolerance, Success Criteria Primary #2, Open Question 9 | done        |
| F-02 | ci-test-and-deploy-gate                 | (foundation) every merge to the default branch runs the checks and unit tests, then deploys; a failing check blocks the deploy | F-01          | tech-stack.md `ci_default_flow`, shape-notes Forward: technical-roadmap  | done        |
| F-03 | ui-foundation                           | (foundation) every screen draws its colours from shared theme tokens and its copy from an English/Polish message catalogue; the user can switch light/dark theme and language | —             | FR-025, FR-026, NFR dark default, NFR attribution | in-progress |
| S-01 | sites-and-gear-management               | manage private observing sites, telescopes and eyepieces, with coordinates rounded and isolation verified outside the UI | —             | FR-007, FR-008, FR-009, NFR isolation, NFR coordinate privacy            | done        |
| S-02 | tonight-verdict-and-ranking             | see tonight's verdict, dark window and up to five ranked Messier objects with eyepiece pair and reason for their site and telescope | F-01, S-01    | FR-010, FR-013, FR-014, FR-015, FR-019, NFR determinism, NFR fair-use, NFR performance, NFR dark default, NFR attribution | done        |
| S-04 | no-go-and-no-darkness-explanations      | on a no-go or no-darkness night see why and when to try next; forecast outage degrades instead of erroring               | S-02, F-01    | US-02, FR-020, FR-023, NFR outage                                        | done        |
| S-03 | first-run-onboarding                    | go from the public landing page through sign-up, location, sky picker and gear presets to Tonight in under a minute      | S-01, S-02, F-03 | US-01, FR-001, FR-004, FR-005, FR-006, NFR under-a-minute, Access Control | in-progress |
| S-05 | seven-night-site-planner                | see the next 7 nights for a site (verdict on 1-3, moon/darkness/cloud outlook on 4-7) and switch sites                   | S-01, S-02, F-03 | US-03, FR-011, FR-012, NFR daylight-saving, Success Criteria Secondary   | proposed |
| S-06 | log-observation-from-ranking            | mark a ranked object observed with night and rating, and see it mildly deprioritized and tagged in later rankings        | S-02, F-03    | US-04, FR-016, FR-018                                                    | proposed |
| S-07 | observation-log-management              | view, edit and delete log entries, add one manually for any Messier object, and read entries whose gear was deleted      | S-06          | FR-017, FR-022, FR-021                                                   | proposed |
| S-08 | telescope-selector-and-empty-states     | pick the telescope the ranking is for when owning several; delete any gear and get honest empty states on Tonight        | S-01, S-02, F-03 | FR-019, FR-021                                                           | proposed |
| S-09 | account-reset-and-long-session          | reset a forgotten password, stay signed in for a rolling 30 days, and continue to the requested page after sign-in       | F-03          | FR-001, FR-002, FR-003, NFR session longevity, Access Control            | proposed |
| S-10 | red-night-mode                          | switch the interface to a red night mode that preserves dark adaptation                                                  | S-02, F-03    | FR-024, NFR dark default                                                 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                               | Chain                                              | Note                                                                                                                    |
| ------ | ----------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A      | Night decision main line            | `F-01` → `S-01` → `S-02` → `S-04` → `F-03` → `S-03` | The shortest chain of slices that satisfies both Primary Success Criteria; `main_goal: speed` puts everything else behind it. `F-03` sits before S-03's UI phases (S-03 phase 1 is a pure data layer and may land first). |
| B      | More than one site or telescope     | `S-05` → `S-08`                                    | Joins Stream A at `S-02`. Multi-site and multi-telescope cases; `S-05` is cut-order #1 and drops cleanly if the checkpoint fires. |
| C      | Observation log                     | `S-06` → `S-07`                                    | Joins Stream A at `S-02`. Closes the learning loop; `S-07` carries cut-order #2 (manual entry).                          |
| D      | Ship path and hardening tail        | `F-02` → `S-09` → `S-10`                           | `F-02` joins Stream A at `F-01`; `S-09` and `S-10` join Stream A at `F-03`; `S-10` is cut-order #4.           |

## Baseline

What's already in place in the codebase as of `2026-09-22` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — SSR web framework with island components and a UI kit per tech-stack.md; only the starter's landing, dashboard and auth pages exist (`src/pages/`, `src/components/`). No product screens.
- **Backend / API:** present — server-rendered routes and API handlers for sign-up, sign-in and sign-out (`src/pages/api/auth/`). No product routes.
- **Data:** partial — the database client is wired and returns `null` when unconfigured (`src/lib/supabase.ts`); local config only, no migrations and no product tables (`supabase/`).
- **Auth:** present — email + password sign-up, sign-in, sign-out, and route gating by prefix in `src/middleware.ts`. Missing: password reset, the 30-day rolling session, and continuing to the originally requested page after sign-in (all covered by S-09).
- **Deploy / infra:** present — live on the chosen edge runtime with secrets wired (see `context/deployment/deploy-plan.md`); CI runs lint, type-check, build and smoke on the default branch. Missing: deploy job on merge, unit test runner, forecast cache (covered by F-02, F-01 and S-02 respectively).
- **Observability:** partial — platform request logs are enabled and tailable (`wrangler.jsonc`); no structured application logging or error tracking. No PRD requirement forces more at MVP; the coordinate-privacy NFR (never log coordinates) applies to whatever logging each slice adds.

## Foundations

### F-01: Verified ephemeris core

- **Outcome:** (foundation) the Messier catalogue is loaded from the licensed source, and moon position and illumination, the Bortle-dependent dark window, and object altitude over a night agree with the independent planetarium reference within the candidate tolerance, all exercised by fixture-driven unit tests that run without network access.
- **Change ID:** verified-ephemeris-core
- **PRD refs:** NFR determinism ("identical inputs produce identical output"), NFR ephemeris tolerance, Success Criteria Primary #2 (cross-check against a planetarium reference), Business Logic invariant 1 (object below minimum altitude never ranks), Open Question 9
- **Unlocks:** S-02 (ranking consumes altitude, moon and dark-window results), S-04 (FR-023's "date the dark window returns" is a forward search over the same twilight computation), S-05 (nights 4-7 moon and darkness data); reduces Open Question 9 (tolerance) from candidate to measured; establishes the fixture-test verification path that the determinism NFR requires and that F-02 wires into CI.
- **Prerequisites:** —
- **Parallel with:** S-01, S-09
- **Blockers:** —
- **Unknowns:**
  - Is 1 degree of altitude and 5 minutes of time (Open Question 9) achievable against the reference, or does the tolerance need to widen? — Owner: user. Block: no (candidate value lets the work start; the result calibrates it).
- **Risk:** Every ranking and the "never recommends the physically impossible" guardrail rest on this being right, so it comes first. Scope is deliberately capped: no scoring, no verdict, no forecast, no persistence here; those arrive in S-02 where a user first sees them.
- **Status:** done

### F-02: CI runs tests and deploys on merge

- **Outcome:** (foundation) every merge to the default branch runs lint, type-check, the unit tests from F-01 and the existing smoke check, then deploys to the live environment; a failing check blocks the deploy.
- **Change ID:** ci-test-and-deploy-gate
- **PRD refs:** tech-stack.md `ci_default_flow: auto-deploy-on-merge`; shape-notes `## Forward: technical-roadmap` ("engine unit tests run against fixture forecasts"; CI/CD scheduled before the deadline); infrastructure.md Operational Story (agent may deploy once CI has passed)
- **Unlocks:** the verification path for S-02's determinism NFR on every change, and continuous delivery of S-02 through S-10 to the live URL without a manual deploy step.
- **Prerequisites:** F-01 (a test suite to run)
- **Parallel with:** S-01, S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The PRD schedules CI/CD last, which with `top_blocker: time` is exactly when it would be squeezed out; doing it right after F-01 turns it into wiring only. Deferring it means every slice ships by hand. Kept minimal: no preview environments, no staging database (see Parked).
- **Status:** done

### F-03: UI foundation — themes and languages

- **Outcome:** (foundation) every screen takes its colours from shared theme tokens and its user-facing copy (including verdict reasons, object explanations and error messages) from a message catalogue in English and Polish, with locale-aware dates and times; the user can switch between the dark theme (default) and a light theme, and between English and Polish, and the choice is remembered on the device. A short design pass settles the tokens and the look of the key screens first.
- **Change ID:** ui-foundation
- **PRD refs:** FR-025, FR-026, NFR dark by default, NFR attribution (credits translated with the rest of the copy)
- **Unlocks:** S-03's UI phases (onboarding island, landing page) and S-05, S-06, S-07, S-08, S-09 build on tokens and message keys from the start instead of being retrofitted; S-10 becomes a third theme on the same tokens.
- **Prerequisites:** — (retrofits the landing, auth, gear and Tonight screens that S-01, S-02 and S-04 already shipped)
- **Parallel with:** S-03 phase 1 only (data layer, no UI)
- **Blockers:** —
- **Unknowns:**
  - Is the language carried in the URL or stored as a preference? — Owner: user. Block: no (decided in `/10x-plan ui-foundation`).
  - Visual direction for the design pass (palette, type, density) — Owner: user. Block: no (settled at the start of the change).
- **Risk:** Added mid-milestone by the user (PRD v2) because every view built on hard-coded colours and English strings is rework later; placed right after S-04 and before S-03's UI so the largest remaining island is built once. Scope is capped at tokens, the two switches, the catalogue and retrofitting the screens that already exist, with no new product capability. Polish copy is cut-order #5 if time runs short.
- **Status:** in-progress

## Slices

### S-01: Sites and gear management

- **Outcome:** user can create, view, update and delete their observing sites (name, coordinates rounded to about 1 km at capture, Bortle class, minimum altitude), telescopes (name, aperture, focal length) and eyepieces (name, focal length, apparent field of view chosen through a type picker), and no user can read or change another user's records.
- **Change ID:** sites-and-gear-management
- **PRD refs:** FR-007, FR-008, FR-009; NFR per-user isolation ("verified by a test that exercises the boundary outside the user interface"); NFR coordinate privacy (rounded at capture, never written to logs)
- **Prerequisites:** —
- **Parallel with:** F-01, S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is where the first per-user tables appear, so the isolation test that the NFR demands lands here or every later slice inherits the gap. Coordinates are entered through the plain site form in this slice; the beginner-friendly geolocation and place-name search arrive in S-03. Sequenced before the north star because S-02 has nothing to run against without a site and a telescope.
- **Status:** done

### S-02: Tonight view: verdict and ranked Messier list

- **Outcome:** user with a site and telescope can open Tonight and see the go / marginal / no-go verdict with its reason and the dark window in the site's timezone; on a go or marginal night, up to five ranked Messier objects, each with its best observing window, constellation, altitude and compass direction at that time, a finding and detail eyepiece pair from their own kit, and a one-line reason that leads with the factor distinguishing it from the others; the view states how many objects cleared the minimum score, and with a single telescope it is used automatically with no selector shown.
- **Change ID:** tonight-verdict-and-ranking
- **PRD refs:** FR-010, FR-013, FR-014, FR-015, FR-019 (single-telescope case); Business Logic invariants 1-3; NFR determinism; NFR forecast fair-use (per-site forecast cache); NFR performance (Tonight renders in about 2 s, full-catalogue ranking under 1 s); NFR dark by default; NFR attribution of licensed data sources; Guardrail "never a confident go on a clouded-out night"
- **Prerequisites:** F-01, S-01
- **Parallel with:** F-02, S-09
- **Blockers:** —
- **Unknowns:**
  - Component weights for the object score (Open Question 1) — Owner: user. Block: no (candidate values let the work start).
  - Verdict cloud and humidity thresholds (Open Question 2) — Owner: user. Block: no.
  - Minimum object score (Open Question 3) — Owner: user. Block: no.
  - Exit-pupil ceiling and floor (Open Question 4) — Owner: user. Block: no.
  - Bortle surface-brightness penalty and its object-type fallback (Open Question 5) — Owner: user. Block: no.
  - Darkness threshold by Bortle class (Open Question 7) — Owner: user. Block: no.
  - Default minimum altitude (Open Question 8) — Owner: user. Block: no.
  - Does the ranking's compute cost on the chosen edge runtime stay under the free plan's limit? The upgrade trigger is recorded in infrastructure.md's Risk Register. — Owner: user. Block: no.
- **Risk:** This is the north star and the outcome the PRD's cut checkpoint tests. It introduces the forecast integration and its hourly per-site cache, the verdict, the object score and the eyepiece pairing in one slice because they are only meaningful together on one screen; the ephemeris underneath is already verified by F-01, which keeps this slice's risk on the scoring logic rather than the sky maths. If the top 5 is not sane here, the cut order drops S-05, the manual-entry half of S-07, the reset half of S-09 and S-10.
- **Status:** done

### S-04: No-go and no-darkness explanations

- **Outcome:** on a weather no-go night the user sees the verdict, its reason and the next night that is not a no-go instead of a ranking; where the site has no dark window for the night the user sees the latitude and season cause and the date the dark window returns; with no current forecast the user sees the last successful forecast with its age, or an explicit "no weather data" state, while moon, twilight and altitude results stay usable, and never an error page.
- **Change ID:** no-go-and-no-darkness-explanations
- **PRD refs:** US-02, FR-020, FR-023; Business Logic invariant 2 (a no-go night shows no ranking); NFR forecast outage; Guardrail "forecast outage degrades, never blanks"
- **Prerequisites:** S-02, F-01
- **Parallel with:** S-03, S-05, S-06, S-08, S-10
- **Blockers:** —
- **Unknowns:**
  - What does the view show when nights 1-3 are all no-go, given nights 4-7 carry no verdict (FR-011)? — Owner: user. Block: no (the plan can propose "no clear night within the forecast window" and the user confirms).
- **Risk:** In an autumn build these are the states the reference user hits most evenings, and a blank Tonight is the worst outcome for the persona. Sequenced immediately after the north star, before onboarding, so that the first real users never see an empty screen.
- **Status:** done

### S-03: First-run onboarding

- **Outcome:** a visitor can read what the product does on the public landing page, sign up, and be walked through setting a home site (browser geolocation or place-name search, coordinates rounded to about 1 km, site named "Home" with the default minimum altitude), picking sky quality from a plain-language Bortle picker, and accepting an editable telescope and eyepiece-kit preset, arriving at Tonight in under a minute of interaction without looking up a single number.
- **Change ID:** first-run-onboarding
- **PRD refs:** US-01, FR-001 (sign-up is the entry), FR-004, FR-005, FR-006; NFR under-a-minute onboarding; Access Control (public surface is a static landing page only); Success Criteria Primary #1
- **Prerequisites:** S-01, S-02, F-03 (phase 1, a pure data layer, may land before F-03; phases 2-4 build UI on F-03)
- **Parallel with:** S-04, S-05, S-06, S-08, S-10
- **Blockers:** —
- **Unknowns:**
  - Which telescope and eyepiece-kit presets ship, by name and values (Open Question 10)? FR-006 requires a fixed, named set. — Owner: user. Block: yes.
  - Do the geocoding endpoint's non-commercial fair-use terms allow place-name search (Open Question 12)? — Owner: user. Block: no (confirm before implementation; planning can proceed with the same-vendor assumption and a named fallback).
- **Risk:** Carries the first Primary Success Criterion, and the end-to-end test from shape-notes (sign in, add site and gear, ranked list, with a fixture forecast) belongs here because this is the flow it exercises. Blocked until the preset list is named; naming it is a short user decision, not research.
- **Status:** in-progress

### S-05: Seven-night planner and site switching

- **Outcome:** user can see the next 7 nights for a selected site, with a go / marginal / no-go verdict on nights 1-3 and moon, darkness and cloud outlook without a verdict on nights 4-7, and can switch the selected site to see the same view for it, with all times in the site's timezone and correct across the 2026-10-25 daylight-saving transition.
- **Change ID:** seven-night-site-planner
- **PRD refs:** US-03, FR-011, FR-012; Business Logic invariant 5 (nights 4-7 carry no verdict); NFR daylight-saving correctness; Success Criteria Secondary (multi-site comparison)
- **Prerequisites:** S-01, S-02, F-03
- **Parallel with:** S-03, S-04, S-06, S-08, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Cut-order #1. Sequenced after the north star so it drops cleanly if the cut checkpoint fires; the data model is already multi-site from S-01, so only this view is at stake.
- **Status:** proposed

### S-06: Log an observation from the ranking

- **Outcome:** user can mark a ranked object as observed, confirming or editing the prefilled observing night, site and telescope and giving a 1-5 rating; later rankings mildly deprioritize objects rated 3 or above, never those rated 1-2, and a logged object that still ranks is tagged "seen N times - last [date]".
- **Change ID:** log-observation-from-ranking
- **PRD refs:** US-04, FR-016, FR-018; Business Logic invariant 4 (an entry rated 1-2 never deprioritizes)
- **Prerequisites:** S-02, F-03
- **Parallel with:** S-03, S-04, S-05, S-08, S-10
- **Blockers:** —
- **Unknowns:**
  - Log penalty size (Open Question 6) — Owner: user. Block: no (candidate value 0.15 lets the work start).
- **Risk:** Closes the learning loop the persona needs; the deprioritization rule is tested with fixture logs so that the determinism NFR holds with a non-empty log. Kept separate from S-07 so the ranking-side log survives if manual entry is cut.
- **Status:** proposed

### S-07: Observation log management and manual entry

- **Outcome:** user can view, edit and delete their observation log entries, add an entry manually for any Messier object rather than only from the ranking, and read entries whose site or telescope has since been deleted.
- **Change ID:** observation-log-management
- **PRD refs:** FR-017, FR-022, FR-021 (entries remain readable after gear deletion)
- **Prerequisites:** S-06
- **Parallel with:** S-03, S-04, S-05, S-08, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** FR-022 is cut-order #2; it sits in this slice so the cut removes half of one slice without touching the ranking. Editing and deleting must re-run the deprioritization honestly, since deleting an entry silently re-promotes its object.
- **Status:** proposed

### S-08: Telescope selector and empty states

- **Outcome:** a user who owns two or more telescopes can pick which one the Tonight ranking is for, and the ranking names it; a user can delete any site, telescope or eyepiece at any time, and Tonight then shows an empty state linking to add one (no site or no telescope) or a ranking without eyepiece recommendations (no eyepieces).
- **Change ID:** telescope-selector-and-empty-states
- **PRD refs:** FR-019 (multi-telescope case), FR-021
- **Prerequisites:** S-01, S-02, F-03
- **Parallel with:** S-03, S-04, S-05, S-06, S-07, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Small by design. The deletion and empty-state rules superseded an earlier decision to guard the last eyepiece, so they need to be planned explicitly rather than inherited from S-01's forms.
- **Status:** proposed

### S-09: Password reset, long session and redirect continue

- **Outcome:** user can reset a forgotten password through the auth provider's built-in flow, stays signed in across a rolling 30 days without re-authenticating, and after signing in is taken to the page they originally requested; sign-up, sign-in and sign-out keep working as shipped.
- **Change ID:** account-reset-and-long-session
- **PRD refs:** FR-001, FR-002, FR-003; NFR session longevity (rolling 30 days); Access Control ("returns the user to sign-in and continues to the requested page afterwards")
- **Prerequisites:** F-03 (its reset and sign-in screens use the tokens and message catalogue)
- **Parallel with:** S-03 through S-08, S-10
- **Blockers:** —
- **Unknowns:** —
- **Risk:** FR-001 and FR-002 are already present per Baseline; this slice hardens them and adds FR-003, which is cut-order #3 and already confirmed as available without extra email setup by tech-stack.md. Independent of the engine, so it can fill any idle agent slot.
- **Status:** proposed

### S-10: Red night mode

- **Outcome:** user can switch the interface to a red night mode that preserves dark adaptation, on top of the dark-by-default theme that S-02 ships.
- **Change ID:** red-night-mode
- **PRD refs:** FR-024; NFR dark by default
- **Prerequisites:** S-02, F-03
- **Parallel with:** S-03 through S-09
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Cut-order #4, last by design. Built as a third theme on F-03's tokens, so it shrinks to a palette and a switch option. Only meaningful once there is a Tonight screen to look at outdoors.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                           | Suggested issue title                                              | Ready for `/10x-plan` | Notes                                                                          |
| ---------- | ----------------------------------- | ------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------ |
| F-01       | verified-ephemeris-core             | Load Messier catalogue and verify ephemeris against the reference  | yes                   | Run `/10x-plan verified-ephemeris-core`; unlocks the north star · GitHub #3 |
| F-02       | ci-test-and-deploy-gate             | CI runs unit tests and deploys on merge                            | no                    | After F-01 lands · GitHub #6 |
| F-03       | ui-foundation                       | UI foundation: theme tokens, light/dark switch, English/Polish catalogue | yes                   | Run `/10x-plan ui-foundation` after S-03 phase 1 lands; PRD v2 FR-025, FR-026 · GitHub #30 |
| S-01       | sites-and-gear-management           | Manage observing sites, telescopes and eyepieces                   | yes                   | Run `/10x-plan sites-and-gear-management`; parallel with F-01 · GitHub #4 |
| S-02       | tonight-verdict-and-ranking         | Tonight view: verdict, dark window and ranked Messier objects      | no                    | North star; after F-01 and S-01 · GitHub #7 |
| S-04       | no-go-and-no-darkness-explanations  | No-go reasons, next clear night, no-darkness season, outage state  | no                    | After S-02 · GitHub #8 |
| S-03       | first-run-onboarding                | Landing page and first-run onboarding with presets                 | no                    | Planned; phase 1 now, phases 2-4 after F-03 · GitHub #9 |
| S-05       | seven-night-site-planner            | Seven-night view with site switching                               | no                    | Cut-order #1; after F-03 · GitHub #10 |
| S-06       | log-observation-from-ranking        | Log an observed object and deprioritize it in later rankings       | no                    | After F-03 · GitHub #11 |
| S-07       | observation-log-management          | Edit, delete and manually add observation log entries              | no                    | Cut-order #2 (manual entry); after S-06 · GitHub #12 |
| S-08       | telescope-selector-and-empty-states | Telescope selector and gear-deletion empty states on Tonight       | no                    | After F-03 · GitHub #13 |
| S-09       | account-reset-and-long-session      | Password reset, 30-day session, redirect to requested page         | no                    | After F-03; cut-order #3 (reset half) · GitHub #5 |
| S-10       | red-night-mode                      | Red night mode toggle                                              | no                    | Cut-order #4; after F-03 · GitHub #14 |
## Open Roadmap Questions

PRD Open Question 11 (database and authentication choice) is resolved by `context/foundation/tech-stack.md` and is not carried forward. Questions 1-9 are copied from the PRD and keep their candidate values; the PRD sets their resolution point at the end of the engine spike, which on this roadmap is the landing of S-02.

1. **Component weights for the object score** — candidate (uncalibrated): altitude duration 0.35, moon interference 0.30, brightness versus limiting magnitude 0.25, Bortle surface-brightness penalty 0.10. — Owner: user. Block: none (calibrates S-02).
2. **Verdict cloud thresholds** — candidate (uncalibrated): go if a contiguous run of at least 2 hours below 30% cloud within the dark window; marginal if at least 1 hour below 65%; otherwise no-go; humidity above 90% caps at marginal; scored on the longest contiguous clear run. — Owner: user. Block: none (calibrates S-02, S-04).
3. **Minimum object score** — candidate (uncalibrated): 0.45 on a 0-1 scale. — Owner: user. Block: none (calibrates S-02).
4. **Exit-pupil ceiling and floor** — candidate (uncalibrated): 5.5 mm ceiling, 0.7 mm floor. — Owner: user. Block: none (calibrates S-02).
5. **Bortle penalty** — candidate (uncalibrated): applies to objects fainter than about 21 mag/arcsec2 surface brightness, scaling from 0 at Bortle 1-2 to 0.40 at Bortle 8-9; falls back to object type where the catalogue lacks surface brightness. — Owner: user. Block: none (calibrates S-02).
6. **Log penalty size** — candidate (uncalibrated): 0.15 subtracted for entries rated 3 or above; zero for 1-2. — Owner: user. Block: none (calibrates S-06).
7. **Darkness threshold by Bortle class** — candidate (uncalibrated): sun at -18 degrees for Bortle 1-4, -15 for 5-6, -12 for 7-9. — Owner: user. Block: none (calibrates F-01, S-02, S-04).
8. **Default minimum altitude** — candidate (uncalibrated): 15 degrees. — Owner: user. Block: none (calibrates S-01, S-03).
9. **Ephemeris tolerance** — candidate (uncalibrated): 1 degree of altitude and 5 minutes of time against an independent planetarium reference. — Owner: user. Block: none (measured by F-01). Measured by F-01 on 2026-09-24 against Stellarium: sun events and −18° twilight crossings within 1 minute across three fixtures (Warsaw autumn, Warsaw DST night, Tromsø midnight sun); moon and object positions spot-checked within about 1° but not recorded as fixtures — see `context/changes/verified-ephemeris-core/tolerance-report.md`. The 5-minute candidate holds with a wide margin; the 1° altitude candidate is not yet formally measured.
10. **Which telescope and eyepiece-kit presets ship** — the fixed, named preset set required by FR-006. — Owner: user. Block: S-03.
11. **Geocoding terms** — confirm the geocoding endpoint's non-commercial fair-use terms before FR-004 depends on it. — Owner: user. Block: none for planning; gates S-03 implementation.
12. **Cut checkpoint** — when S-02 lands, does it produce a sane top 5 against the observation-planner reference? If not, which of the PRD's cut-order items (S-05; manual entry in S-07; reset in S-09; S-10) drop, and does S-03 still get the full preset flow? — Owner: user. Block: roadmap-wide (decides whether the Parked section grows). **Answered 2026-09-25 (user): sane, no cuts.** The S-02 checkpoint (`context/changes/tonight-verdict-and-ranking/checkpoint.md`) found the top 5 sane on three nights:
    - Warsaw 2026-10-10 and 2026-10-24, and Bieszczady 2027-04-06 (80 mm);
    - 15/15 invariant checks passed;
    - positions within 0.005° of Skyfield/DE421.

    Consequences:
    - S-05, the manual-entry half of S-07, the reset half of S-09 and S-10 stay in scope, and S-03 keeps the full preset flow.
    - PRD Success Criterion #2's "independent observation planner" (Telescopius) was replaced by an independent Skyfield recompute plus published seasonal lists, because the agent cannot read Telescopius' lists (they are drawn by JavaScript).
    - Calibration refinements are tracked in #21 and the Free-plan CPU re-measurement in #22.

## Parked

- **Astrophotography** — Why parked: PRD §Non-Goals; the largest adjacent scope and the most likely to arrive as "one more field".
- **Objects outside the Messier catalogue** (planets, Moon, comets, double stars, NGC) — Why parked: PRD §Non-Goals; the catalogue filter makes extension cheap later, which is why the boundary is written down now.
- **Finding the object** (star-hopping, sky charts, finder views, named anchor stars) — Why parked: PRD §Non-Goals; FR-013's constellation and altitude/direction partially mitigate it.
- **Hardware control** (GoTo mounts, telescope integration) — Why parked: PRD §Non-Goals.
- **Notifications** (push, email, "clear tonight" alerts) — Why parked: PRD §Non-Goals.
- **Social and sharing features** — Why parked: PRD §Non-Goals; keeps the flat access model honest.
- **AI features** (planner chat, object descriptions, summaries) — Why parked: PRD §Non-Goals; only the scoring functions' tool-callable shape is kept, which the pure engine in F-01/S-02 gives for free.
- **Modelling seeing, transparency or light pollution** — Why parked: PRD §Non-Goals; sky quality stays a coarse user-set number.
- **Native mobile app** — Why parked: PRD §Non-Goals; responsive web is sufficient.
- **Email verification, OAuth sign-in, read-only demo account** — Why parked: PRD §Access Control marks all three post-MVP.
- **Preview environments with a separate non-production database** — Why parked: infrastructure.md Risk Register flags previews pointing at production data; with `main_goal: speed` and no external testers yet, F-02 ships main-branch deploys only. Revisit before sharing any preview URL.
- **Custom domain** — Why parked: deploy-plan.md records the user will add it later; the live URL works for the MVP.
- **Forecast caching by grid cell shared between nearby users** — Why parked: shape-notes scale note; only needed at 1k-10k users, which is beyond `target_scale`.

## Milestone History

(Append-only. Carried forward verbatim into each successor milestone's roadmap; empty on the very first milestone.)

## Done

(Empty on first generation. `/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived. Do NOT pre-populate.)

- **S-01: user can create, view, update and delete their observing sites (name, coordinates rounded to about 1 km at capture, Bortle class, minimum altitude), telescopes (name, aperture, focal length) and eyepieces (name, focal length, apparent field of view chosen through a type picker), and no user can read or change another user's records.** — Archived 2026-09-25 → `context/archive/2026-09-24-sites-and-gear-management/`. Lesson: —.
- **F-01: (foundation) the Messier catalogue is loaded from the licensed source, and moon position and illumination, the Bortle-dependent dark window, and object altitude over a night agree with the independent planetarium reference within the candidate tolerance, all exercised by fixture-driven unit tests that run without network access.** — Archived 2026-09-25 → `context/archive/2026-09-22-verified-ephemeris-core/`. Lesson: —.
- **S-02: user with a site and telescope can open Tonight and see the go / marginal / no-go verdict with its reason and the dark window in the site's timezone; on a go or marginal night, up to five ranked Messier objects, each with its best observing window, constellation, altitude and compass direction at that time, a finding and detail eyepiece pair from their own kit, and a one-line reason that leads with the factor distinguishing it from the others; the view states how many objects cleared the minimum score, and with a single telescope it is used automatically with no selector shown.** — Archived 2026-09-25 → `context/archive/2026-09-25-tonight-verdict-and-ranking/`. Lesson: —.
- **S-04: on a weather no-go night the user sees the verdict, its reason and the next night that is not a no-go instead of a ranking; where the site has no dark window for the night the user sees the latitude and season cause and the date the dark window returns; with no current forecast the user sees the last successful forecast with its age, or an explicit "no weather data" state, while moon, twilight and altitude results stay usable, and never an error page.** — Archived 2026-09-25 → `context/archive/2026-09-25-no-go-and-no-darkness-explanations/`. Lesson: —.
- **F-02: (foundation) every merge to the default branch runs lint, type-check, the unit tests from F-01 and the existing smoke check, then deploys to the live environment; a failing check blocks the deploy.** — Done 2026-09-25 without a change folder (implemented directly in PR #28; first automatic deploy: run 36186077591, Worker version `44a32d95`). Lesson: —.
