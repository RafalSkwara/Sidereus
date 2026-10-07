---
project: Sidereus
version: 2
status: draft
created: 2026-09-30
updated: 2026-10-07
prd_version: —
main_goal: learn
top_blocker: skills
milestone_id: first-real-nights
milestone_seq: 2
milestone_status: open
---

# Roadmap: Sidereus

> Derived from the user's milestone description (2026-09-30, recorded in the `## Milestone` charter as MS-01…MS-09; extended 2026-10-04 with MS-10 and MS-11), with `context/foundation/prd.md` (v2) as the product baseline it extends, plus a codebase baseline probed the same day.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-2: First real nights** — Status: open

- **Intent:** Take Sidereus from a Messier ranking you read at home to a companion for a real night out: it covers the Moon, the planets and more of the sky than Messier, lays the night out as a plan, still opens at a dark site with no signal, asks afterwards whether the sky matched the verdict, and makes adding a site as easy as a tap or a point on a map. Extended 2026-10-04, ahead of everything still open: Sidereus gets a look of its own instead of a generic one, and the crowded Tonight page becomes a dashboard of tiles that each open a focused page.
- **Source materials:** user description, 2026-09-30 (verbatim below), building on `context/foundation/prd.md` (v2). No real usage evidence exists yet: the author has no equipment and no observing experience, so scope and judgment calls are made on judgment ("we really need to go on vibes here – which is fine, this is mostly a learning project").
- **User description (verbatim, condensed from the conversation):** "I like option 1 – all these improvements sound great [session plan, offline at a dark site, 'was the verdict right?' in the log, Moon and planets]. Plan 2 – moon, planets etc – yes, this also we need to plan for, I want this. And third thing – I need to improve the add site functionality. First – we need to ask user if he wants to use his current location, of course we prompt him via the browser to allow for location info. This can be only after he click a button (use my location or sth like this). Also we need to give him opportunity to point at a location on a map. So another option of locating the site he wants to add is 'Pick from map' or sth like this. That sounds like a lot of features but we don't have to implement them all at once."
- **User description, 2026-10-04 (verbatim):** "we make two more tasks that need our attention. First is UI redesign. Both light and dark themes are very generic and look very much like coming from an LLM. This needs to be properly redesigned. Second task is dashboard page and pages after it. What I mean is - tonight page is super crowded right now and it.s really difficult to find anything there. We need a dashboard with cards/tiles that will lead to separate pages for tonight's verdict, tonight's moon, verdict judgement, planets and forecast. Maybe even more or separated differently. […] Both are more Important than anything else"
- **User description, 2026-10-06 (verbatim):** "I need to add a task which would involve modifying how we add gear, we should provide some list of gear to choose from and not only expect a beginner to be able to type this in. I need a long list for each type of gear added and user should be able to choose from this (via select or something more complex) and the fields would fill in for him after he chooses". Same day the user parked S-04 (double stars): "I really fail to see the value in s-04, at least at this point."
- **Done when:** every S-NN below is `done`, or explicitly moved to Parked by the user.
- **Scope anchors:**
  - MS-01: The planets appear on Tonight as targets alongside the Messier objects, with a reason and an eyepiece, and can be logged.
  - MS-02: The Moon appears on Tonight as a target in its own right, not only as interference for faint objects, and can be logged.
  - MS-03: Bright deep-sky objects beyond the Messier catalogue can appear on Tonight ("moon, planets etc").
  - MS-04: Double stars can appear on Tonight ("etc"). Parked 2026-10-06 with S-04.
  - MS-05: Tonight can be read as a plan for the session: a timeline ordered by when each target is best.
  - MS-06: Sidereus is installable and still shows tonight's plan at a dark site with no network.
  - MS-07: After a night, the user can say whether the sky matched the verdict, and see how often the verdicts were right.
  - MS-08: Adding or editing a site offers an explicit "Use my location" button; the browser's location permission is requested only after that click.
  - MS-09: Adding or editing a site offers "Pick from map": the user points at the location on a map.
  - MS-10: The light and dark themes are properly redesigned so they no longer look generic or LLM-made (added 2026-10-04, top priority).
  - MS-11: A dashboard of cards/tiles replaces the crowded Tonight page and leads to separate pages for tonight's verdict, the Moon, the verdict judgement (sky check), planets and the forecast, "maybe even more or separated differently" (added 2026-10-04, top priority).
  - MS-12: Adding a telescope or eyepiece offers a long list of real models to choose from, and choosing one fills in the fields (added 2026-10-06).

## Vision recap

A beginner amateur astronomer with a first telescope cannot answer two questions on a clear evening: is tonight worth setting up for, and what should I point at? M-1 answered both for the Messier catalogue: a go / marginal / no-go verdict and a ranked, explained shortlist with an eyepiece pair from the user's own kit. M-2 extends the answer to what a beginner actually points at first (the Moon and the planets), to the night itself (a plan to follow, working without signal), and to the question the product has never been able to check: were its verdicts right?

## North star

**S-01: Planets on Tonight** — a north star is the smallest end-to-end slice whose delivery would prove the milestone's main idea, so it is sequenced first and everything else is ordered around it. Here the idea is that the product can reason about more than a fixed deep-sky list. Planets break M-1's assumptions: they move, they are not bound to the dark window, bright planets ignore moonlight and light pollution, and they want high magnification rather than a wide field. With `main_goal: learn`, this slice also exercises the most unfamiliar domain logic first.

## At a glance

| ID   | Change ID               | Outcome (user can …)                                                                                                                | Prerequisites | PRD refs | Status  |
| ---- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------- | ------- |
| S-01 | planets-on-tonight      | see the visible planets on Tonight with best time, altitude, direction, a detail eyepiece and a reason, and log one as observed     | —             | MS-01    | done    |
| S-02 | moon-as-target          | see the Moon on Tonight as a target with its phase and what is worth looking at, and log it as observed                             | S-01          | MS-02    | done    |
| S-03 | deep-sky-beyond-messier | see bright non-Messier deep-sky objects ranked alongside Messier ones, and log them                                                 | S-01          | MS-03    | done    |
| S-10 | visual-redesign         | use Sidereus in a distinct visual identity of its own in light and dark, on every screen, with red night mode unchanged in function | —             | MS-10    | done    |
| S-11 | tonight-dashboard       | land on a dashboard of tiles (verdict, Moon, planets, targets, forecast, sky check) that each open a focused page                   | —             | MS-11    | done    |
| S-05 | session-plan-timeline   | open the session plan from the dashboard: a timeline ordered by when each target is best, with the dark window and moonrise/set     | S-11          | MS-05    | done    |
| S-06 | offline-night-plan      | install Sidereus and open tonight's dashboard pages for a site with no network, seeing when they were prepared                      | S-05, S-11    | MS-06    | done    |
| S-07 | verdict-check           | tell Sidereus whether a past night's sky matched its verdict, and see a tally of how often verdicts were right                      | —             | MS-07    | done    |
| S-08 | site-use-my-location    | add or edit a site with a "Use my location" button that asks the browser for location only after the click                          | —             | MS-08    | done    |
| S-09 | site-pick-from-map      | add or edit a site by pointing at its location on a map                                                                             | S-08          | MS-09    | in-progress |
| S-12 | gear-catalogue          | add a telescope or eyepiece by picking a real model from a searchable list that fills in the fields                                 | —             | MS-12    | done    |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                 | Chain                    | Note                                                                                                                                                                                                                                                        |
| ------ | --------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | More of the sky       | `S-01` → `S-02` → `S-03` | North-star stream; `S-01` establishes how a non-Messier target is ranked and logged, the rest reuse it. `S-02` and `S-03` may run in parallel once `S-01` lands; `S-04` (double stars) parked 2026-10-06.                                                   |
| B      | Tonight, page by page | `S-11` → `S-05` → `S-06` | Top priority (2026-10-04): the dashboard splits Tonight into focused pages; the timeline becomes one of them and the offline slice caches them.                                                                                                             |
| C      | Checking the verdict  | `S-07`                   | Standalone; needs no equipment to use, only a look out of the window, so it is the one source of real evidence this milestone can collect.                                                                                                                  |
| D      | Adding a site         | `S-08` → `S-09`          | Standalone; the smallest user-visible wins, good for interleaving between the heavier Stream A slices.                                                                                                                                                      |
| E      | The look              | `S-10`                   | Top priority (2026-10-04): a visual identity of its own. Not a prerequisite of `S-11`, but the recommended order is to settle the direction and the shared tokens and components first, so the dashboard pages are built on them (Open Roadmap Question 4). |
| F      | Adding gear           | `S-12`                   | Added 2026-10-06, ordered before `S-03`: the beginner's first hurdle is typing in specs they don't know.                                                                                                                                                    |

## Baseline

What's already in place in the codebase as of `2026-09-30` (probed after M-1; everything M-1 delivered is present).

- **Frontend:** present — every M-1 screen: landing, onboarding wizard, Tonight (verdict, ranking, seven-night strip, selectors, all-objects page), gear pages, observation log; dark/light/red themes and EN/PL catalogue. Onboarding's location step already has a click-triggered "use my location" and a place-name search; the gear site form has only raw latitude/longitude fields. No map component anywhere.
- **Backend / API:** present — gear, log, onboarding and auth routes following the redirect-with-message-key error contract.
- **Data:** present — per-user sites, telescopes, eyepieces and observations with RLS and the isolation suite. The observations table accepts Messier numbers 1–110 only; there is no stored record of the verdict a user was shown.
- **Auth:** present — email + password, 30-day rolling session, continue-after-sign-in. Password reset parked.
- **Deploy / infra:** present — CI lint, type-check, unit tests, isolation suite and smoke; migrations and app deploy on merge to the default branch; forecast cached per site. No service worker or web app manifest (nothing installable, nothing offline).
- **Observability:** partial — platform request logs only; the Free-plan CPU re-measurement for Tonight is still open (GitHub #22).
- **Update 2026-10-04:** Tonight now stacks the verdict, the Moon card with its time slider, the solar-system targets, the sky-check card, the deep-sky ranking, the seven-night strip and two selectors on one page, which is what MS-11 answers. The themes still use M-1's tokens (a navy and amber palette, an editorial serif over a neutral sans), which is what MS-10 answers. Onboarding and the site form now share one location picker (S-08).
- **Engine:** present — pure, deterministic ephemeris, scoring and verdict over a library that already computes Moon and planet positions; Messier catalogue generated from a pinned OpenNGC commit, which also carries the NGC/IC objects.

## Foundations

None this milestone. The one cross-cutting change M-2 needs — identifying a target by kind (Messier, planet, Moon, other deep-sky, double star) instead of by Messier number, in the ranking and in the observation log — is folded into S-01, the first slice that consumes it, so it is exercised end to end from the start rather than built ahead of use. S-02 and S-03 reuse it (S-04 parked 2026-10-06).

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
- **Status:** done

### S-02: The Moon as a target

- **Outcome:** user can see the Moon on Tonight as a target in its own right — its phase, when it is up and how high, and a plain-language note on what is worth looking at in this phase (the terminator and craters near it, or "too full for detail, try filter or low power") — and can log it as observed; on nights when moonlight makes faint deep-sky objects a poor bet, Tonight says so and points at the Moon and planets instead.
- **Change ID:** moon-as-target
- **PRD refs:** MS-02
- **Prerequisites:** S-01 (target identity in the ranking and the log; twilight window for solar-system targets)
- **Parallel with:** S-03, S-05, S-06, S-07, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - What counts as "a Moon night"? Candidate: illumination above 70% and the Moon up for most of the dark window. — Owner: user. Block: no.
  - How specific are the phase notes? Candidate: a short fixed set per phase band (crescent, quarter, gibbous, full) naming 2–3 well-known features, no feature-by-feature terminator prediction. — Owner: user. Block: no.
- **Risk:** Mostly copy and judgment rather than maths (the engine already has phase and position), so the risk is advice that sounds confident but is wrong; keep the notes coarse and cite the phase they apply to.
- **Status:** done

### S-03: Deep-sky objects beyond Messier

- **Outcome:** user can see bright deep-sky objects that are not in the Messier catalogue ranked on Tonight with the same scoring, reasons and eyepiece pair as Messier objects, and can log them.
- **Change ID:** deep-sky-beyond-messier
- **PRD refs:** MS-03
- **Prerequisites:** S-01 (target identity)
- **Parallel with:** S-02, S-05, S-06, S-07, S-08, S-09, S-10, S-11
- **Blockers:** —
- **Unknowns:**
  - Which objects? Candidate: a curated list of roughly 50–100 bright NGC/IC objects suited to 100–200 mm (the Caldwell selection as a guide, with members too far south for the user's latitudes dropped), taken from the same pinned catalogue source as Messier. — Owner: user. Block: no.
  - Does the wider list crowd Messier out of the top 5 for a beginner? Candidate: rank together, but tie-break towards Messier and show the catalogue label on each row. — Owner: user. Block: no.
  - The manual log entry picker lists Messier numbers only; it needs search by catalogue name. — Owner: team. Block: no.
- **Risk:** The scoring was calibrated only against Messier objects; faint objects with missing surface brightness fall back to type-based penalties, so check the new objects' ranks against published seasonal lists as the S-02 checkpoint of M-1 did.
- **Status:** done

### S-10: A visual identity of its own

- **Outcome:** user sees Sidereus in a distinct, deliberate visual identity in light and dark — its own palette, typography, spacing rhythm, surfaces and component shapes — on every screen, so that a screenshot of any page reads as Sidereus rather than a template; the red night mode keeps its function (no green or blue light) and may adopt the new shapes and type.
- **Change ID:** visual-redesign
- **PRD refs:** MS-10
- **Prerequisites:** —
- **Parallel with:** S-03, S-09, S-11
- **Blockers:** —
- **Unknowns:**
  - ~~Which design direction?~~ Settled 2026-10-04: **C · Nightfall** (canvas https://claude.ai/artifact/8VZbxuqAVU1RntyMQ8u6vu): the sky at this hour is the page, a horizon splits the answer from full-width detail bands, no boxed cards, one huge verdict word. — Owner: user.
  - ~~Do the current typefaces stay?~~ Settled 2026-10-04: replaced; Nightfall uses one family with widths, Archivo (expanded for display, normal for reading), self-hosted and subset. — Owner: user.
  - ~~Does the landing page get a bigger rework?~~ Settled 2026-10-04: yes, its own composition pass; and `/` becomes a signed-out page only: a signed-in user is redirected to `/tonight` (to the dashboard once S-11 lands). — Owner: user.
- **Risk:** Touches every screen, so the danger is a restyle that drifts into one-off styling per page; the change should rework the shared design tokens and components first and apply them second, keep the existing colour, red-theme and contrast guardrails green, and gate on before/after screenshots of every screen in EN/PL × light/dark/red at phone and desktop widths. GitHub #86.
- **Status:** done

### S-11: Tonight as a dashboard of focused pages

- **Outcome:** user who signs in lands on a dashboard of tiles — tonight's verdict, the Moon, the planets, the deep-sky targets, the forecast for the next nights and the sky check — each tile giving a one-glance summary and opening its own focused page, instead of one long Tonight page; the chosen site and telescope carry across the dashboard and every page.
- **Change ID:** tonight-dashboard
- **PRD refs:** MS-11
- **Prerequisites:** — (reuses the content Tonight already shows; the recommended order puts it after S-10's direction and tokens, see Open Roadmap Question 4)
- **Parallel with:** S-03, S-09, S-10
- **Blockers:** —
- **Unknowns:**
  - ~~Interactive sky (user, 2026-10-04)~~ Settled 2026-10-05: real stars, the 925 naked-eye stars (mag ≤ 4.5) of HYG v4.1 (CC BY-SA 4.0), user 2026-10-05. The dashboard's sky is a horizon panorama with a slider from sunset to sunrise: the top five targets, the planets and the Moon at their real altitude and azimuth, the sky colour following the Sun, and a tap opening the body's page; the server sends the rotations and the tracks, the browser only draws them. Change `interactive-sky`, GitHub #97. — Owner: user (stars), team (how positions reach the island).
  - ~~The final tile set and grouping~~ Settled 2026-10-04 (tonight-dashboard): four tiles, Point here first, The Moon, Planets and Next 7 nights; the verdict stays the dashboard's sky and the sky check shows inline only while a question is open; no log or gear shortcuts. — Owner: user.
  - ~~Tile order~~ Settled 2026-10-04: fixed, targets → Moon → planets → nights, as ruled full-width rows. — Owner: user.
  - ~~Dashboard address~~ Settled 2026-10-04: the dashboard keeps `/tonight`; pages at `/tonight/targets` (absorbing `/tonight/all`, now a 301), `/tonight/moon`, `/tonight/planets`, `/tonight/nights`. — Owner: user.
  - ~~How each page loads and fails~~ Settled 2026-10-04: each page has its own server island calling `loadTonight` (JavaScript still required), with its own no-setup, unavailable and error states. — Owner: team.
  - ~~One change or several~~ Settled 2026-10-04: one change (`tonight-dashboard`) for the dashboard and the four pages; the interactive sky above is a follow-up change. — Owner: team.
- **Risk:** The largest navigation change since M-1: every end-to-end test that walks Tonight moves, and a dashboard that computes every page's content for every tile would slow the landing page, so tiles should show only their summary. S-05 and S-06 were re-scoped on top of it (2026-10-04), so it goes before them. GitHub #87.
- **Status:** done

### S-05: Session plan timeline

- **Outcome:** user can open the session plan from the dashboard (S-11) as its own page: a timeline of the night for the selected site and telescope: the dark window, moonrise and moonset, and each recommended target placed at its best observing window, ordered by time, so they can follow it from the first target to the last.
- **Change ID:** session-plan-timeline
- **PRD refs:** MS-05
- **Prerequisites:** S-11 (the timeline becomes one of the dashboard's pages, and possibly a tile)
- **Parallel with:** S-03, S-07, S-08, S-09, S-10
- **Blockers:** —
- **Unknowns:**
  - Is the timeline a second view of Tonight's ranking or a separate plan the user can adjust (reorder, drop, add from the all-objects page)? Candidate: a read-only view first; adjusting is a later change. — Owner: user. Block: no.
  - Do overlapping best windows need sequencing (one target at a time), or is showing windows side by side enough? Candidate: side by side, sorted by window start. — Owner: user. Block: no.
  > Note (2026-10-04): re-scoped against S-11. The timeline was planned as a second view of the single Tonight page; it is now a page reached from the dashboard, so it waits for S-11.
- **Risk:** Mostly presentation over data Tonight already computes, which makes it a safe slice; the risk is a layout that doesn't work on a phone in red night mode, which is exactly where it will be read.
- **Status:** done

### S-06: Offline night plan

- **Outcome:** user can install Sidereus on their phone's home screen and, at a site with no network, open the dashboard pages they last loaded for that site — verdict, dark window, targets and timeline — clearly marked with when it was prepared, while screens that need the network say so instead of failing.
- **Change ID:** offline-night-plan
- **PRD refs:** MS-06
- **Prerequisites:** S-05 (the plan being cached), S-11 (the pages being cached)
- **Parallel with:** S-03, S-07, S-08, S-09, S-10
- **Blockers:** —
- **Unknowns:**
  - Tonight's content is rendered on the server and fetched by a script after the page loads (see lessons.md, "Tonight's content needs JavaScript"); S-11 may change how its pages load. Can those pages be cached as-is, or does offline need a data snapshot rendered on the device? — Owner: team. Block: no (settled by `/10x-plan` research, after S-11).
  - What gets cached: only the last-viewed site, or every site's tonight? Candidate: each site the user opened in the last day, with stored plans cleared on sign-out. — Owner: user. Block: no.
  - Can the log be written offline and synced later? Candidate: no in this slice; logging shows "needs a connection". — Owner: user. Block: no.
- **Risk:** Caching is easy to get subtly wrong (stale plans shown as current, a signed-out user's plan left on the device, auth pages cached); the "prepared at" stamp and the sign-out purge are the guardrails. Site coordinates stay on the user's own device, which the privacy guardrail allows.
- **Status:** done

### S-07: Verdict check

- **Outcome:** user can, for a past night at one of their sites, answer "how was the sky?" (for example clear as promised, partly cloudy, clouded out) against the verdict Sidereus showed for that night, and see a running tally of how often go, marginal and no-go verdicts matched what they saw.
- **Change ID:** verdict-check
- **PRD refs:** MS-07
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-05, S-06, S-08, S-09
- **Blockers:** —
- **Unknowns:**
  - Which verdict is judged? The forecast changes through the evening, so Sidereus has to record the verdict it showed (per user, site and night) when Tonight was viewed. Candidate: store the last verdict shown before the dark window started. — Owner: user. Block: no.
  - Where is the question asked? Candidate: on Tonight the day after a viewed night ("How was last night at Home?"), and next to each observing night in the log; answering is always optional. — Owner: user. Block: no.
  - What counts as a match? Candidate: go ↔ clear, marginal ↔ partly, no-go ↔ clouded out; anything else is a miss, with the direction (too optimistic / too pessimistic) kept because the PRD treats a false "go" as worse than a false "no-go". — Owner: user. Block: no.
    > Note (2026-10-02, moonlight-and-the-verdict): Tonight now words the verdict as the sky ("Clear", "Partly clear", "Cloudy", plus "Clear, but damp", "Clear (old forecast)", "No forecast" and "No dark window"), so a match compares the user's answer against the sky words that were shown, not against go / marginal / no-go.
    > Note (2026-10-03, verdict-check): delivered as a card on Tonight for the newest unanswered night of the last two (with Skip) plus a Sky checks page at `/log/sky` that lists every recorded night, lets any of them be answered or changed, and shows the tally (matched, too optimistic / too pessimistic, per sky word). The verdict recorded is the last one shown before the dark window starts. "Clear, but damp" and "Clear (old forecast)" count as a promise of Clear; "No forecast" and "No dark window" nights are never asked.
- **Risk:** The only slice that yields real evidence without a telescope — anyone can look up at the sky — so it is the input the open calibration work (#21) has been missing. Adds a per-user table, so it needs RLS and an isolation-suite entry.
- **Status:** done

### S-08: "Use my location" on the site form

- **Outcome:** user adding or editing a site sees a "Use my location" button; only when they click it does the browser ask for location permission, and on success the coordinates are filled in, rounded to about 1 km before anything else sees them; a refusal or failure leaves the form usable with a plain message and the manual fields.
- **Change ID:** site-use-my-location
- **PRD refs:** MS-08
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - Should the site form also get onboarding's place-name search, so the add-site options match onboarding's? Candidate: yes, as the same set of choices (use my location · search a place · enter coordinates) shared by both surfaces. — Owner: user. Block: no.
  - Does editing an existing site with a new location need a confirmation ("replace the saved location?")? Candidate: yes, showing the old and new place names or coordinates. — Owner: user. Block: no.
- **Risk:** Small and self-contained; onboarding already has the click-triggered locate and the rounding, so the work is reuse. The risk is ending up with two diverging location pickers, so the plan should extract one shared component.
- **Status:** done

### S-09: "Pick from map" for a site

- **Outcome:** user adding or editing a site, including onboarding's home-site step, can choose "Pick from map", pan and zoom a map and tap or drag a marker to the location; the chosen point is rounded to about 1 km, and the map starts at the device location only if the user has already allowed it, otherwise at a neutral default view.
- **Change ID:** site-pick-from-map
- **PRD refs:** MS-09
- **Prerequisites:** S-08 (the shared location picker the map joins as a new option)
- **Parallel with:** S-01, S-02, S-03, S-05, S-06, S-07, S-10, S-11
- **Blockers:** —
- **Unknowns:**
  - ~~Privacy: is sending map-tile requests for the area the user browses acceptable, and under what limits?~~ Settled 2026-10-07 by the user: yes, with explicit consent. Nothing that reveals location (map tiles included) is requested until the user has opted in, the same way "Use my location" asks only after its click. The map stays unloaded until the user chooses "Pick from map", which serves as that consent. — Owner: user.
  - Which map provider, given its terms, attribution, free-tier limits and the red night theme? Owner: team. Block: no (settled by `/10x-plan` once the privacy question is answered).
- **Risk:** The only M-2 slice that sends location-revealing requests to a new third party, so it waits for an explicit privacy decision. It also adds the heaviest new client-side dependency in the app, which may affect page weight on onboarding.
- **Status:** in-progress

### S-12: Pick gear from a catalogue

- **Outcome:** user adding a telescope or eyepiece — on the gear pages and in onboarding — can type into a searchable combobox over a long, curated list of real models (telescopes by brand and model; eyepieces by brand, line and focal length); choosing one fills in the form's fields (telescope: name, aperture, focal length; eyepiece: name, focal length, apparent field), which stay editable before saving; "Not listed? Enter manually" keeps today's manual entry.
- **Change ID:** gear-catalogue
- **PRD refs:** MS-12
- **Prerequisites:** —
- **Parallel with:** S-03, S-09
- **Blockers:** —
- **Unknowns:**
  - ~~How is a model picked?~~ Settled 2026-10-06: a searchable combobox with a "Not listed? Enter manually" escape. — Owner: user.
  - Catalogue source: no open, redistributable gear database is known, so the candidate is a hand-curated list in the repo (published specs are facts), a few hundred entries across the brands beginners actually buy (Sky-Watcher, Celestron, Bresser, Levenhuk, Orion, Explore Scientific, Baader, SVBony …), each with its source noted. — Owner: team. Block: no.
  - Does onboarding's five generic telescope presets and two eyepiece kits (`src/lib/onboarding/presets.ts`) give way to the catalogue, or stay as a "not sure what I have" shortcut next to it? Candidate: the combobox replaces the generic telescope choice; the starter-kit shortcut for eyepieces stays, because many scopes ship with a known pair. — Owner: user (UI). Block: no.
  - Is the chosen catalogue model remembered with the saved gear (a model id), or are only the filled-in numbers stored? Candidate: numbers only, so no migration and no dependency on the list staying stable. — Owner: team. Block: no.
- **Risk:** Data accuracy across hundreds of hand-entered specs; the plan should validate the list (plausible ranges, unique ids, focal ratio consistent) in a unit test and keep it data, not code. A long list on a phone needs a combobox that stays accessible (keyboard, screen reader, red theme) and small enough not to bloat the gear pages' bundle.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID               | Suggested issue title                                             | Ready for `/10x-plan` | Notes                                                                               |
| ---------- | ----------------------- | ----------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| S-01       | planets-on-tonight      | Planets on Tonight: rank, explain, recommend an eyepiece and log  | yes                   | North star; run `/10x-plan planets-on-tonight` · GitHub #65                         |
| S-02       | moon-as-target          | The Moon as a target on Tonight, with phase notes and logging     | no                    | After S-01 · GitHub #66                                                             |
| S-03       | deep-sky-beyond-messier | Bright non-Messier deep-sky objects on Tonight                    | no                    | After S-01 · GitHub #67                                                             |
| S-10       | visual-redesign         | UI redesign: a distinct visual identity for light and dark themes | yes                   | Top priority; restyle of existing screens, so run it through `/10x-ui` · GitHub #86 |
| S-11       | tonight-dashboard       | Tonight dashboard: tiles leading to focused pages                 | yes                   | Top priority; new pages, so the ordinary chain from `/10x-new` · GitHub #87         |
| S-05       | session-plan-timeline   | Session plan: the night as a timeline page                        | no                    | After S-11 (re-scoped 2026-10-04) · GitHub #69                                      |
| S-06       | offline-night-plan      | Installable app with tonight's pages available offline            | no                    | After S-05 and S-11 · GitHub #70                                                    |
| S-07       | verdict-check           | Verdict check: was the sky what Sidereus promised?                | yes                   | Feeds calibration #21 · GitHub #71                                                  |
| S-08       | site-use-my-location    | "Use my location" on the add/edit site form                       | yes                   | Smallest win · GitHub #72                                                           |
| S-09       | site-pick-from-map      | "Pick from map" when adding or editing a site                     | no                    | Unblocked 2026-10-07 (consent-gated tiles) · GitHub #73                                  |
| S-12       | gear-catalogue          | Pick telescopes and eyepieces from a catalogue                    | yes                   | Added 2026-10-06, before S-03; run `/10x-new gear-catalogue` · GitHub #113          |

## Open Roadmap Questions

1. **PRD amendment for M-2.** Several M-2 slices cross PRD v2 Non-Goals ("Anything outside the Messier catalogue") and one guardrail ("never outside the darkness window", which S-01/S-02 relax for solar-system targets). Should the PRD be bumped to v3 to record the new scope and the relaxed guardrail, or does this roadmap's charter stand as the record for M-2? — Owner: user. Block: none (recommended before S-01's plan is reviewed, so the guardrail change is written down).
2. **Judging advice without an observer.** With no equipment or observing experience (`top_blocker: skills`), how is planet, Moon, double-star and field-use advice checked? Candidate: Stellarium fixtures for positions (as F-01 of M-1 did), published seasonal and phase guides for advice, and S-07's verdict check for weather; anything else is accepted as judgment and noted in each plan. — Owner: user. Block: none.
3. **Carry-over follow-ups from M-1:** #19 (Stellarium moon/object fixture values), #21 (ranking calibration refinements), #22 (re-measure Tonight's CPU against the Free-plan trigger; closed 2026-09-30 when Sidereus moved to Workers Paid, so the 10 ms CPU cap no longer applies). None is a slice. — Owner: team. Block: none.
4. **Order of the two top-priority slices (2026-10-04).** S-10 (the look) and S-11 (the dashboard) are both ahead of everything else and neither strictly needs the other. Recommended: settle S-10's direction and rework the shared tokens and components first, build S-11's pages on them, then restyle the remaining screens, so the crowded Tonight page is not restyled only to be split apart. — Owner: user. Block: none.

## Parked

- **Double stars (was S-04, `double-stars`, GitHub #68, MS-04)** — Why parked: by the user, 2026-10-06. The Moon and planets already give bright-Moon and light-polluted nights something to point at, while doubles need a redistributable data source and new splitting rules with no calibration reference. Kept for a later milestone; the original slice text is in git history.
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

- **S-01: user can see the planets that are above the site's minimum altitude tonight on Tonight — each with its best time, altitude and compass direction then, constellation, a detail eyepiece from their own kit and a one-line reason — and can mark one as observed so the log records it.** — Archived 2026-09-30 → `context/archive/2026-09-30-planets-on-tonight/`. Lesson: —.
- **S-02: user can see the Moon on Tonight as a target in its own right — its phase, when it is up and how high, and a plain-language note on what is worth looking at in this phase (the terminator and craters near it, or "too full for detail, try filter or low power") — and can log it as observed; on nights when moonlight makes faint deep-sky objects a poor bet, Tonight says so and points at the Moon and planets instead.** — Archived 2026-10-02 → `context/archive/2026-10-01-moon-as-target/`. Lesson: —.
- **S-07: user can, for a past night at one of their sites, answer "how was the sky?" (for example clear as promised, partly cloudy, clouded out) against the verdict Sidereus showed for that night, and see a running tally of how often go, marginal and no-go verdicts matched what they saw.** — Archived 2026-10-03 → `context/archive/2026-10-03-verdict-check/`. Lesson: —.
- **S-10: user sees Sidereus in a distinct, deliberate visual identity in light and dark — its own palette, typography, spacing rhythm, surfaces and component shapes — on every screen, so that a screenshot of any page reads as Sidereus rather than a template; the red night mode keeps its function (no green or blue light) and may adopt the new shapes and type.** — Archived 2026-10-05 → `context/archive/2026-10-04-visual-redesign/`. Lesson: —.
- **S-08: user adding or editing a site sees a "Use my location" button; only when they click it does the browser ask for location permission, and on success the coordinates are filled in, rounded to about 1 km before anything else sees them; a refusal or failure leaves the form usable with a plain message and the manual fields.** — Archived 2026-10-04 → `context/archive/2026-10-03-site-use-my-location/`. Lesson: —.
- **S-11: user who signs in lands on a dashboard of tiles — tonight's verdict, the Moon, the planets, the deep-sky targets, the forecast for the next nights and the sky check — each tile giving a one-glance summary and opening its own focused page, instead of one long Tonight page; the chosen site and telescope carry across the dashboard and every page.** — Archived 2026-10-05 → `context/archive/2026-10-04-tonight-dashboard/`. Lesson: —.
- **S-05: user can open the session plan from the dashboard (S-11) as its own page: a timeline of the night for the selected site and telescope: the dark window, moonrise and moonset, and each recommended target placed at its best observing window, ordered by time, so they can follow it from the first target to the last.** — Archived 2026-10-05 → `context/archive/2026-10-05-session-plan-timeline/`. Lesson: —.
- **S-06: user can install Sidereus on their phone's home screen and, at a site with no network, open the dashboard pages they last loaded for that site — verdict, dark window, targets and timeline — clearly marked with when it was prepared, while screens that need the network say so instead of failing.** — Archived 2026-10-06 → `context/archive/2026-10-05-offline-night-plan/`. Lesson: Make the server unreachable to test a service worker offline (lessons.md).
- **S-12: user adding a telescope or eyepiece — on the gear pages and in onboarding — can type into a searchable combobox over a long, curated list of real models (telescopes by brand and model; eyepieces by brand, line and focal length); choosing one fills in the form's fields (telescope: name, aperture, focal length; eyepiece: name, focal length, apparent field), which stay editable before saving; "Not listed? Enter manually" keeps today's manual entry.** — Archived 2026-10-06 → `context/archive/2026-10-06-gear-catalogue/`. Lesson: —.
- **S-03: user can see bright deep-sky objects that are not in the Messier catalogue ranked on Tonight with the same scoring, reasons and eyepiece pair as Messier objects, and can log them.** — Archived 2026-10-06 → `context/archive/2026-10-06-deep-sky-beyond-messier/`. Lesson: —.
