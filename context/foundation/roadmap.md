---
project: Sidereus
version: 2
status: draft
created: 2026-09-30
updated: 2026-09-30
prd_version: —
main_goal: learn
top_blocker: skills
milestone_id: first-real-nights
milestone_seq: 2
milestone_status: open
---

# Roadmap: Sidereus

> Derived from the user's milestone description (2026-09-30, recorded in the `## Milestone` charter as MS-01…MS-09), with `context/foundation/prd.md` (v2) as the product baseline it extends, plus a codebase baseline probed the same day.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-2: First real nights** — Status: open

- **Intent:** Take Sidereus from a Messier ranking you read at home to a companion for a real night out: it covers the Moon, the planets and more of the sky than Messier, lays the night out as a plan, still opens at a dark site with no signal, asks afterwards whether the sky matched the verdict, and makes adding a site as easy as a tap or a point on a map.
- **Source materials:** user description, 2026-09-30 (verbatim below), building on `context/foundation/prd.md` (v2). No real usage evidence exists yet: the author has no equipment and no observing experience, so scope and judgment calls are made on judgment ("we really need to go on vibes here – which is fine, this is mostly a learning project").
- **User description (verbatim, condensed from the conversation):** "I like option 1 – all these improvements sound great [session plan, offline at a dark site, 'was the verdict right?' in the log, Moon and planets]. Plan 2 – moon, planets etc – yes, this also we need to plan for, I want this. And third thing – I need to improve the add site functionality. First – we need to ask user if he wants to use his current location, of course we prompt him via the browser to allow for location info. This can be only after he click a button (use my location or sth like this). Also we need to give him opportunity to point at a location on a map. So another option of locating the site he wants to add is 'Pick from map' or sth like this. That sounds like a lot of features but we don't have to implement them all at once."
- **Done when:** every S-NN below is `done`, or explicitly moved to Parked by the user.
- **Scope anchors:**
  - MS-01: The planets appear on Tonight as targets alongside the Messier objects, with a reason and an eyepiece, and can be logged.
  - MS-02: The Moon appears on Tonight as a target in its own right, not only as interference for faint objects, and can be logged.
  - MS-03: Bright deep-sky objects beyond the Messier catalogue can appear on Tonight ("moon, planets etc").
  - MS-04: Double stars can appear on Tonight ("etc").
  - MS-05: Tonight can be read as a plan for the session: a timeline ordered by when each target is best.
  - MS-06: Sidereus is installable and still shows tonight's plan at a dark site with no network.
  - MS-07: After a night, the user can say whether the sky matched the verdict, and see how often the verdicts were right.
  - MS-08: Adding or editing a site offers an explicit "Use my location" button; the browser's location permission is requested only after that click.
  - MS-09: Adding or editing a site offers "Pick from map": the user points at the location on a map.

## Vision recap

A beginner amateur astronomer with a first telescope cannot answer two questions on a clear evening: is tonight worth setting up for, and what should I point at? M-1 answered both for the Messier catalogue: a go / marginal / no-go verdict and a ranked, explained shortlist with an eyepiece pair from the user's own kit. M-2 extends the answer to what a beginner actually points at first (the Moon and the planets), to the night itself (a plan to follow, working without signal), and to the question the product has never been able to check: were its verdicts right?

## North star

**S-01: Planets on Tonight** — a north star is the smallest end-to-end slice whose delivery would prove the milestone's main idea, so it is sequenced first and everything else is ordered around it. Here the idea is that the product can reason about more than a fixed deep-sky list. Planets break M-1's assumptions: they move, they are not bound to the dark window, bright planets ignore moonlight and light pollution, and they want high magnification rather than a wide field. With `main_goal: learn`, this slice also exercises the most unfamiliar domain logic first.

## At a glance

| ID   | Change ID                        | Outcome (user can …)                                                                                                            | Prerequisites | PRD refs       | Status   |
| ---- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------- | -------- |
| S-01 | planets-on-tonight               | see the visible planets on Tonight with best time, altitude, direction, a detail eyepiece and a reason, and log one as observed | —             | MS-01          | ready · GitHub #65 |
| S-02 | moon-as-target                   | see the Moon on Tonight as a target with its phase and what is worth looking at, and log it as observed                         | S-01          | MS-02          | proposed · GitHub #66 |
| S-03 | deep-sky-beyond-messier          | see bright non-Messier deep-sky objects ranked alongside Messier ones, and log them                                             | S-01          | MS-03          | proposed · GitHub #67 |
| S-04 | double-stars                     | see well-placed double stars on Tonight with an eyepiece that splits them, and log them                                         | S-01          | MS-04          | blocked · GitHub #68 |
| S-05 | session-plan-timeline            | read Tonight as a timeline for the session, ordered by when each target is best, with the dark window and moonrise/set on it    | —             | MS-05          | ready · GitHub #69 |
| S-06 | offline-night-plan               | install Sidereus and open tonight's plan for a site with no network, seeing when it was prepared                                | S-05          | MS-06          | proposed · GitHub #70 |
| S-07 | verdict-check                    | tell Sidereus whether a past night's sky matched its verdict, and see a tally of how often verdicts were right                  | —             | MS-07          | ready · GitHub #71 |
| S-08 | site-use-my-location             | add or edit a site with a "Use my location" button that asks the browser for location only after the click                     | —             | MS-08          | ready · GitHub #72 |
| S-09 | site-pick-from-map               | add or edit a site by pointing at its location on a map                                                                         | S-08          | MS-09          | blocked · GitHub #73 |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                    | Chain                           | Note                                                                                                     |
| ------ | ------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A      | More of the sky          | `S-01` → `S-02` → `S-03` → `S-04` | North-star stream; `S-01` establishes how a non-Messier target is ranked and logged, the rest reuse it. `S-02`, `S-03`, `S-04` may run in parallel once `S-01` lands. |
| B      | At the telescope         | `S-05` → `S-06`                 | Field use; the offline slice caches the plan `S-05` produces. Richer once Stream A lands, but not dependent on it. |
| C      | Checking the verdict     | `S-07`                          | Standalone; needs no equipment to use, only a look out of the window, so it is the one source of real evidence this milestone can collect. |
| D      | Adding a site            | `S-08` → `S-09`                 | Standalone; the smallest user-visible wins, good for interleaving between the heavier Stream A slices.  |

## Baseline

What's already in place in the codebase as of `2026-09-30` (probed after M-1; everything M-1 delivered is present).

- **Frontend:** present — every M-1 screen: landing, onboarding wizard, Tonight (verdict, ranking, seven-night strip, selectors, all-objects page), gear pages, observation log; dark/light/red themes and EN/PL catalogue. Onboarding's location step already has a click-triggered "use my location" and a place-name search; the gear site form has only raw latitude/longitude fields. No map component anywhere.
- **Backend / API:** present — gear, log, onboarding and auth routes following the redirect-with-message-key error contract.
- **Data:** present — per-user sites, telescopes, eyepieces and observations with RLS and the isolation suite. The observations table accepts Messier numbers 1–110 only; there is no stored record of the verdict a user was shown.
- **Auth:** present — email + password, 30-day rolling session, continue-after-sign-in. Password reset parked.
- **Deploy / infra:** present — CI lint, type-check, unit tests, isolation suite and smoke; migrations and app deploy on merge to the default branch; forecast cached per site. No service worker or web app manifest (nothing installable, nothing offline).
- **Observability:** partial — platform request logs only; the Free-plan CPU re-measurement for Tonight is still open (GitHub #22).
- **Engine:** present — pure, deterministic ephemeris, scoring and verdict over a library that already computes Moon and planet positions; Messier catalogue generated from a pinned OpenNGC commit, which also carries the NGC/IC objects.

## Foundations

None this milestone. The one cross-cutting change M-2 needs — identifying a target by kind (Messier, planet, Moon, other deep-sky, double star) instead of by Messier number, in the ranking and in the observation log — is folded into S-01, the first slice that consumes it, so it is exercised end to end from the start rather than built ahead of use. S-02, S-03 and S-04 reuse it.

## Slices

### S-01: Planets on Tonight

- **Outcome:** user can see the planets that are above the site's minimum altitude tonight on Tonight — each with its best time, altitude and compass direction then, constellation, a detail eyepiece from their own kit and a one-line reason — and can mark one as observed so the log records it.
- **Change ID:** planets-on-tonight
- **PRD refs:** MS-01
- **Prerequisites:** — (M-1 done)
- **Parallel with:** S-05, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - Do planets share the Messier top-5 or get their own "Planets tonight" group? Candidate: their own group above the deep-sky ranking, because they are scored on different grounds and a beginner looks for them first. — Owner: user. Block: no.
  - What window do planets use? They are observable in twilight and on nights with no astronomical darkness, which M-1's "never outside the darkness window" guardrail forbids for deep-sky objects. Candidate: sun below −6° (civil dusk) for bright planets, keeping the dark window for deep sky; they still never show on a cloud no-go night or below the minimum altitude. — Owner: user. Block: no.
  - Which planets count? Candidate: Mercury, Venus, Mars, Jupiter, Saturn always; Uranus and Neptune only with aperture of 130 mm or more and a note that they look like tiny discs. — Owner: user. Block: no.
  - What makes a planet worth recommending on a given night? Candidates: altitude (seeing worsens near the horizon), apparent size, and elongation from the Sun for Mercury and Venus; moonlight and Bortle class do not penalise them. — Owner: user. Block: no.
  - Log shape: observations currently accept Messier numbers only. Candidate: one generic target identity (kind + key) used by the ranking, the log and the "seen N times" tag; existing entries migrate as the Messier kind. — Owner: team. Block: no.
- **Risk:** Sequenced first because it breaks the most M-1 assumptions (moving targets, twilight window, magnification instead of field of view, the log's identity), and the three sibling slices reuse whatever it settles. It adds per-request ephemeris work to Tonight, so it should re-measure the CPU figure tracked in #22. With no observing experience to check against, planet positions should be verified against Stellarium fixtures (the pattern in #19).
- **Status:** ready

### S-02: The Moon as a target

- **Outcome:** user can see the Moon on Tonight as a target in its own right — its phase, when it is up and how high, and a plain-language note on what is worth looking at in this phase (the terminator and craters near it, or "too full for detail, try filter or low power") — and can log it as observed; on nights when moonlight makes faint deep-sky objects a poor bet, Tonight says so and points at the Moon and planets instead.
- **Change ID:** moon-as-target
- **PRD refs:** MS-02
- **Prerequisites:** S-01 (target identity in the ranking and the log; twilight window for solar-system targets)
- **Parallel with:** S-03, S-04, S-05, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - What counts as "a Moon night"? Candidate: illumination above 70% and the Moon up for most of the dark window. — Owner: user. Block: no.
  - How specific are the phase notes? Candidate: a short fixed set per phase band (crescent, quarter, gibbous, full) naming 2–3 well-known features, no feature-by-feature terminator prediction. — Owner: user. Block: no.
- **Risk:** Mostly copy and judgment rather than maths (the engine already has phase and position), so the risk is advice that sounds confident but is wrong; keep the notes coarse and cite the phase they apply to.
- **Status:** proposed

### S-03: Deep-sky objects beyond Messier

- **Outcome:** user can see bright deep-sky objects that are not in the Messier catalogue ranked on Tonight with the same scoring, reasons and eyepiece pair as Messier objects, and can log them.
- **Change ID:** deep-sky-beyond-messier
- **PRD refs:** MS-03
- **Prerequisites:** S-01 (target identity)
- **Parallel with:** S-02, S-04, S-05, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - Which objects? Candidate: a curated list of roughly 50–100 bright NGC/IC objects suited to 100–200 mm (the Caldwell selection as a guide, with members too far south for the user's latitudes dropped), taken from the same pinned catalogue source as Messier. — Owner: user. Block: no.
  - Does the wider list crowd Messier out of the top 5 for a beginner? Candidate: rank together, but tie-break towards Messier and show the catalogue label on each row. — Owner: user. Block: no.
  - The manual log entry picker lists Messier numbers only; it needs search by catalogue name. — Owner: team. Block: no.
- **Risk:** The scoring was calibrated only against Messier objects; faint objects with missing surface brightness fall back to type-based penalties, so check the new objects' ranks against published seasonal lists as the S-02 checkpoint of M-1 did.
- **Status:** proposed

### S-04: Double stars

- **Outcome:** user can see well-placed double stars on Tonight — which suit suburban skies and moonlit nights — each with its separation, colours where notable, and the lowest-power eyepiece from their own kit that splits it given the telescope's resolving power, and can log them.
- **Change ID:** double-stars
- **PRD refs:** MS-04
- **Prerequisites:** S-01 (target identity)
- **Parallel with:** S-02, S-03, S-05, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - Data source and licence: the current catalogue source has no double stars. Which curated list (with separation, magnitudes and positions) can be redistributed? — Owner: user. Block: yes.
  - Where do doubles appear: in the main ranking, or as an alternative list promoted on bright-moon or light-polluted nights? Candidate: their own group, promoted when deep-sky scores are poor. — Owner: user. Block: no.
- **Risk:** Needs new scoring rules (separation against aperture, magnification to split) with no calibration reference; kept last in Stream A so it can be parked cleanly if the data source question has no good answer.
- **Status:** blocked

### S-05: Session plan timeline

- **Outcome:** user can switch Tonight to a timeline of the night for the selected site and telescope: the dark window, moonrise and moonset, and each recommended target placed at its best observing window, ordered by time, so they can follow it from the first target to the last.
- **Change ID:** session-plan-timeline
- **PRD refs:** MS-05
- **Prerequisites:** — (works with the Messier ranking; picks up planets and the Moon automatically once S-01/S-02 land)
- **Parallel with:** S-01, S-02, S-03, S-04, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - Is the timeline a second view of Tonight's ranking or a separate plan the user can adjust (reorder, drop, add from the all-objects page)? Candidate: a read-only view first; adjusting is a later change. — Owner: user. Block: no.
  - Do overlapping best windows need sequencing (one target at a time), or is showing windows side by side enough? Candidate: side by side, sorted by window start. — Owner: user. Block: no.
- **Risk:** Mostly presentation over data Tonight already computes, which makes it a safe slice; the risk is a layout that doesn't work on a phone in red night mode, which is exactly where it will be read.
- **Status:** ready

### S-06: Offline night plan

- **Outcome:** user can install Sidereus on their phone's home screen and, at a site with no network, open the plan they last loaded for that site — verdict, dark window, targets and timeline — clearly marked with when it was prepared, while screens that need the network say so instead of failing.
- **Change ID:** offline-night-plan
- **PRD refs:** MS-06
- **Prerequisites:** S-05 (the plan being cached)
- **Parallel with:** S-01, S-02, S-03, S-04, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - Tonight's content is rendered on the server and fetched by a script after the page loads (see lessons.md, "Tonight's content needs JavaScript"). Can that fetched fragment be cached as-is, or does offline need a data snapshot the page renders on the device? — Owner: team. Block: no (settled by `/10x-plan` research).
  - What gets cached: only the last-viewed site, or every site's tonight? Candidate: each site the user opened in the last day, with stored plans cleared on sign-out. — Owner: user. Block: no.
  - Can the log be written offline and synced later? Candidate: no in this slice; logging shows "needs a connection". — Owner: user. Block: no.
- **Risk:** Caching is easy to get subtly wrong (stale plans shown as current, a signed-out user's plan left on the device, auth pages cached); the "prepared at" stamp and the sign-out purge are the guardrails. Site coordinates stay on the user's own device, which the privacy guardrail allows.
- **Status:** proposed

### S-07: Verdict check

- **Outcome:** user can, for a past night at one of their sites, answer "how was the sky?" (for example clear as promised, partly cloudy, clouded out) against the verdict Sidereus showed for that night, and see a running tally of how often go, marginal and no-go verdicts matched what they saw.
- **Change ID:** verdict-check
- **PRD refs:** MS-07
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-06, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - Which verdict is judged? The forecast changes through the evening, so Sidereus has to record the verdict it showed (per user, site and night) when Tonight was viewed. Candidate: store the last verdict shown before the dark window started. — Owner: user. Block: no.
  - Where is the question asked? Candidate: on Tonight the day after a viewed night ("How was last night at Home?"), and next to each observing night in the log; answering is always optional. — Owner: user. Block: no.
  - What counts as a match? Candidate: go ↔ clear, marginal ↔ partly, no-go ↔ clouded out; anything else is a miss, with the direction (too optimistic / too pessimistic) kept because the PRD treats a false "go" as worse than a false "no-go". — Owner: user. Block: no.
- **Risk:** The only slice that yields real evidence without a telescope — anyone can look up at the sky — so it is the input the open calibration work (#21) has been missing. Adds a per-user table, so it needs RLS and an isolation-suite entry.
- **Status:** ready

### S-08: "Use my location" on the site form

- **Outcome:** user adding or editing a site sees a "Use my location" button; only when they click it does the browser ask for location permission, and on success the coordinates are filled in, rounded to about 1 km before anything else sees them; a refusal or failure leaves the form usable with a plain message and the manual fields.
- **Change ID:** site-use-my-location
- **PRD refs:** MS-08
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - Should the site form also get onboarding's place-name search, so the add-site options match onboarding's? Candidate: yes, as the same set of choices (use my location · search a place · enter coordinates) shared by both surfaces. — Owner: user. Block: no.
  - Does editing an existing site with a new location need a confirmation ("replace the saved location?")? Candidate: yes, showing the old and new place names or coordinates. — Owner: user. Block: no.
- **Risk:** Small and self-contained; onboarding already has the click-triggered locate and the rounding, so the work is reuse. The risk is ending up with two diverging location pickers, so the plan should extract one shared component.
- **Status:** ready

### S-09: "Pick from map" for a site

- **Outcome:** user adding or editing a site, including onboarding's home-site step, can choose "Pick from map", pan and zoom a map and tap or drag a marker to the location; the chosen point is rounded to about 1 km, and the map starts at the device location only if the user has already allowed it, otherwise at a neutral default view.
- **Change ID:** site-pick-from-map
- **PRD refs:** MS-09
- **Prerequisites:** S-08 (the shared location picker the map joins as a new option)
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - Privacy: the map loads its images (tiles) from a map provider, and tiles requested around the user's home reveal roughly where they live to that provider. The PRD guardrail allows coordinates in third-party requests only for the forecast lookup. Is sending tile requests for the area the user browses acceptable, and under what limits (for example tiles only while the picker is open, no zoom closer than neighbourhood level, a provider that doesn't log or sell requests)? — Owner: user. Block: yes.
  - Which map provider, given its terms, attribution, free-tier limits and the red night theme? Owner: team. Block: no (settled by `/10x-plan` once the privacy question is answered).
- **Risk:** The only M-2 slice that sends location-revealing requests to a new third party, so it waits for an explicit privacy decision. It also adds the heaviest new client-side dependency in the app, which may affect page weight on onboarding.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID               | Suggested issue title                                                  | Ready for `/10x-plan` | Notes |
| ---------- | ----------------------- | ---------------------------------------------------------------------- | --------------------- | ----- |
| S-01       | planets-on-tonight      | Planets on Tonight: rank, explain, recommend an eyepiece and log       | yes                   | North star; run `/10x-plan planets-on-tonight` · GitHub #65 |
| S-02       | moon-as-target          | The Moon as a target on Tonight, with phase notes and logging          | no                    | After S-01 · GitHub #66 |
| S-03       | deep-sky-beyond-messier | Bright non-Messier deep-sky objects on Tonight                         | no                    | After S-01 · GitHub #67 |
| S-04       | double-stars            | Double stars on Tonight with a splitting eyepiece                      | no                    | Blocked: data source and licence · GitHub #68 |
| S-05       | session-plan-timeline   | Session plan: Tonight as a timeline of the night                       | yes                   | Parallel with S-01 · GitHub #69 |
| S-06       | offline-night-plan      | Installable app with tonight's plan available offline                  | no                    | After S-05 · GitHub #70 |
| S-07       | verdict-check           | Verdict check: was the sky what Sidereus promised?                     | yes                   | Feeds calibration #21 · GitHub #71 |
| S-08       | site-use-my-location    | "Use my location" on the add/edit site form                            | yes                   | Smallest win · GitHub #72 |
| S-09       | site-pick-from-map      | "Pick from map" when adding or editing a site                          | no                    | Blocked: map-tile privacy decision · GitHub #73 |

## Open Roadmap Questions

1. **PRD amendment for M-2.** Several M-2 slices cross PRD v2 Non-Goals ("Anything outside the Messier catalogue") and one guardrail ("never outside the darkness window", which S-01/S-02 relax for solar-system targets). Should the PRD be bumped to v3 to record the new scope and the relaxed guardrail, or does this roadmap's charter stand as the record for M-2? — Owner: user. Block: none (recommended before S-01's plan is reviewed, so the guardrail change is written down).
2. **Judging advice without an observer.** With no equipment or observing experience (`top_blocker: skills`), how is planet, Moon, double-star and field-use advice checked? Candidate: Stellarium fixtures for positions (as F-01 of M-1 did), published seasonal and phase guides for advice, and S-07's verdict check for weather; anything else is accepted as judgment and noted in each plan. — Owner: user. Block: none.
3. **Carry-over follow-ups from M-1:** #19 (Stellarium moon/object fixture values), #21 (ranking calibration refinements), #22 (re-measure Tonight's CPU against the Free-plan trigger). None is a slice; #22 should be re-run after S-01 and S-03, which add the most work per request. — Owner: team. Block: none.

## Parked

- **Finding the object** (star-hopping, sky charts, finder views, named anchor stars) — Why parked: PRD §Non-Goals; floated during M-2 scoping but not chosen. The strongest candidate for a later milestone, because a beginner who can't find a target gives up.
- **Comets and other transient objects** — Why parked: need regularly refreshed orbital elements from an external feed; outside M-2's "etc".
- **Adjustable session plan** (reorder, drop, add targets to the timeline) — Why parked: S-05 ships a read-only timeline first.
- **Offline logging with later sync** — Why parked: S-06 keeps logging online-only.
- **Astrophotography** — Why parked: PRD §Non-Goals.
- **Hardware control** (GoTo mounts, telescope integration) — Why parked: PRD §Non-Goals.
- **Notifications** (push, email, "clear tonight" alerts) — Why parked: PRD §Non-Goals; would need a custom email sender, which also gates password reset.
- **Social and sharing features** — Why parked: PRD §Non-Goals.
- **AI features** (planner chat, object descriptions, summaries) — Why parked: PRD §Non-Goals; floated during M-2 scoping, not chosen. The engine's tool-callable scoring shape is still kept.
- **Modelling seeing, transparency or light pollution** (including automatic Bortle from coordinates) — Why parked: PRD §Non-Goals.
- **Native mobile app** — Why parked: PRD §Non-Goals; S-06 makes the web app installable instead.
- **Email verification, OAuth sign-in, read-only demo account** — Why parked: PRD §Access Control, post-MVP.
- **Password reset (FR-003)** — Why parked: cut-order #3 applied 2026-09-28; needs a custom SMTP sender.
- **Going public** (custom domain, preview environments with a separate database, usage analytics) — Why parked: floated during M-2 scoping as a way to gather real usage; deferred until the product has more to show.
- **Forecast caching by grid cell shared between nearby users** — Why parked: only needed beyond the target scale.

## Milestone History

(Append-only. Carried forward verbatim into each successor milestone's roadmap; empty on the very first milestone.)

- **M-1: MVP night decision** (`mvp-night-decision`) — closed 2026-09-28. All 3 foundations and 10 slices shipped and deployed: a signed-in beginner gets tonight's go / marginal / no-go verdict and a ranked, explained Messier shortlist from their own site and kit, with onboarding, a seven-night planner, an observation log, light/dark/red themes, EN/PL, a 30-day session and continue-after-sign-in; password reset (FR-003) parked by cut-order #3.

## Done

(`/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived. Do NOT pre-populate. M-1's entries live in git history and in `context/archive/`.)
