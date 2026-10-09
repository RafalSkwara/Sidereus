---
project: Sidereus
version: 3
status: draft
created: 2026-09-30
updated: 2026-10-09
prd_version: 3
main_goal: quality
top_blocker: skills # and decisions: the user named both (2026-10-07)
milestone_id: find-it-and-keep-going
milestone_seq: 3
milestone_status: open
---

# Roadmap: Sidereus

> Derived from `context/foundation/prd.md` (v3, FR-037 to FR-046, US-05 to US-08) and the user's description of two UI passes (MS-01, MS-02), plus a codebase baseline confirmed on 2026-10-07.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-3: Find it and keep going** — Status: open

- **Intent:** Make Sidereus comfortable on a phone first, then take a beginner past "what to look at": find the target from a star they can see, know what it will look like, see how far they are through the classic lists, plan around the sky's events and shape the night's plan. Finder charts and plan edits are the first features of a paid ("full") plan; the plan is granted by hand for now.
- **Source materials:** `context/foundation/prd.md` (v3), plus the user's description, 2026-10-07 (verbatim below).
- **User description, 2026-10-07 (verbatim):** "throw in 4 as well and add a task for UI improvements, I'll list things that bother me in how the app looks later on. Actually, make it two UI/UX improvements task. First you'll go over the views (especially mobile as they feel crowded) and try and improve them (especially dashboard/tonight). So: 1. your UI improvements 2. My UI adjustments afterwards 3. And then the suggestions accepted from your research." On paid features: "We have provided some functionality for free so let's keep in mind if some of the next ones should be behind paywall. I also need an easy way to create accounts with all functionalities unlocked so I can access them."
- **Done when:** every F-NN and S-NN below is `done`, or explicitly moved to Parked by the user.
- **Scope anchors:** PRD v3 FR-037 to FR-046, US-05 to US-08 and the phone-first NFR; plus:
  - MS-01: Claude goes over the views, mobile first, and improves them, especially the dashboard and Tonight, which feel crowded.
  - MS-02: The user's own UI adjustments, from a list the user gives after MS-01.

## Vision recap

A beginner with a first telescope can't tell whether tonight is worth setting up for or what to point at; Sidereus answers both as a verdict and a ranked, explained shortlist from their own site and kit, and since M-2 covers the Moon, the planets, a night plan and offline use. PRD v3 widens the promise: help the user find each target from a star they can already see, say what it will look like, track what they have seen, flag the sky's events and let them shape the night's plan.

## North star

**S-03: Finder chart** — the north star is the smallest slice whose delivery proves the milestone's main claim, so it goes as early as its prerequisites allow: here, that Sidereus alone gets a beginner from a naked-eye star to the target (PRD v3 Secondary criterion), and that the first paid feature is worth having.

## At a glance

| ID   | Change ID               | Outcome (user can …)                                                                                     | Prerequisites | PRD refs               | Status   |
| ---- | ----------------------- | -------------------------------------------------------------------------------------------------------- | ------------- | ---------------------- | -------- |
| F-01 | account-plans           | (foundation) every account is on the free or full plan, enforced on the server; the operator grants full | —             | FR-045, FR-046         | in-progress |
| S-01 | ui-mobile-pass          | use every view comfortably on a phone, with the dashboard and Tonight leading with their answer          | —             | MS-01, NFR phone first | done     |
| S-02 | ui-user-adjustments     | see the user's own list of look-and-feel fixes applied                                                   | S-01          | MS-02                  | done        |
| S-03 | finder-chart            | open a finder chart that hops from a naked-eye star to a ranked target, with finder and eyepiece circles | F-01, S-02    | FR-037, FR-045, US-05  | proposed |
| S-04 | what-to-expect          | read what each ranked target will look like in their telescope from their site                           | F-01, S-02    | FR-038, US-05          | proposed |
| S-05 | observing-progress      | see Messier and Caldwell checklists, firsts and "not seen yet" marks on tonight's targets                | S-02          | FR-039, FR-040, US-06  | proposed |
| S-06 | observing-milestones    | have milestones celebrated when a log entry reaches them, and listed on the progress page                | S-05          | FR-041, US-06          | proposed |
| S-07 | sky-events              | see the next 30 days of sky events, the next one on the dashboard and tonight's beside the verdict       | S-02          | FR-042, FR-043, US-07  | proposed |
| S-08 | adjustable-session-plan | reorder, drop and add targets on the session plan, saved to their account                                | F-01, S-02    | FR-044, US-08          | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme            | Chain                             | Note                                                                                        |
| ------ | ---------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| A      | Phone-first look | `S-01` → `S-02`                   | First, by the user's order: every later slice builds on the reworked layout (quality goal). |
| B      | Full plan        | `F-01` → `S-03` → `S-04` → `S-08` | `F-01` runs alongside Stream A; the paid slices join Stream A after `S-02`.                 |
| C      | Progress         | `S-05` → `S-06`                   | Free; joins Stream A after `S-02`.                                                          |
| D      | Sky events       | `S-07`                            | Free; joins Stream A after `S-02`.                                                          |

## Baseline

What's already in place in the codebase as of `2026-10-07` (probed and user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 7 SSR with React islands, Nightfall tokens and shared components, the Tonight dashboard with focused pages, and the live sky's projection code (`src/lib/sky-view/`).
- **Backend / API:** present — Astro routes on Cloudflare Workers; the Open-Meteo forecast behind a Workers KV cache.
- **Data:** present, with gaps — Supabase Postgres with per-user RLS tables (sites, telescopes, eyepieces, observations, sky checks). Absent: any per-account plan, stored session-plan edits. Partial: bundled stars stop at magnitude 4.5 (927 stars).
- **Auth:** present — Supabase email and password, gated routes in the middleware, 30-day sessions. Absent: plans and operator tooling.
- **Deploy / infra:** present — Workers deploy and migrations from CI.
- **Observability:** partial — Workers observability enabled; no error tracker.

## Foundations

### F-01: Account plans and complimentary full accounts

- **Outcome:** (foundation) every account carries a free or full plan that pages and routes can read and the server enforces, and the operator can create a full account, or switch one to full and back, with one command.
- **Change ID:** account-plans
- **PRD refs:** FR-045, FR-046, Access Control (Plans, v3)
- **Unlocks:** S-03, S-04, S-08 (the paid slices); the user's own full account for testing them
- **Prerequisites:** —
- **Parallel with:** S-01, S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Minimal by design: the plan, its server-side check and the command only. The "needs the full plan" state each paid feature shows lands with S-03, the first slice that has a paid feature to show; no checkout (PRD Non-Goals).
- **Status:** in-progress

## Slices

### S-01: Phone-first UI pass

- **Outcome:** user can use every view comfortably on a phone, the dashboard and Tonight above all: each leads with its answer, nothing scrolls sideways, and the dashboard shows the sky verdict and its first tiles on the first screen.
- **Change ID:** ui-mobile-pass
- **PRD refs:** MS-01, NFR phone first
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:**
  - Which views beyond the dashboard and Tonight get the pass. Candidate: every view, audited first, the crowded ones fixed. — Owner: team. Block: no.
- **Risk:** First by the user's order; the risk is reworking views that M-3's own slices then change again, so the pass concentrates on layout density and shared components rather than per-feature details.
- **Status:** done

### S-02: The user's UI adjustments

- **Outcome:** user can see their own list of look-and-feel fixes applied across the app.
- **Change ID:** ui-user-adjustments
- **PRD refs:** MS-02
- **Prerequisites:** S-01
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:**
  - The list of things that bother the user. — Owner: user. Block: yes. Resolved 2026-10-08 (list in `context/changes/ui-user-adjustments/change.md`).
- **Risk:** Blocked until the user writes the list after seeing S-01; may split into several changes if the list is long.
- **Status:** done

### S-03: Finder chart

- **Outcome:** user can open a finder chart for any ranked deep-sky object or planet: the nearest star they can see with the naked eye from their site, the hop to the target, and their finder's and finding eyepiece's fields drawn to scale, oriented as they face that part of the sky; a free account sees what the chart does and that it needs the full plan.
- **Change ID:** finder-chart
- **PRD refs:** FR-037, FR-045, US-05
- **Prerequisites:** F-01, S-02
- **Parallel with:** S-05, S-07
- **Blockers:** —
- **Unknowns:**
  - The finder's field: the gear has no finder (PRD Open Question 13). Candidate: a standard 6×30 finder plus reflex-finder rings. — Owner: user. Block: no.
  - Star depth: bundled stars stop at magnitude 4.5, a finder shows about 8 (Open Question 14); licence and page weight checked in the plan. — Owner: team. Block: no.
  - Naked-eye limit by sky class and hop length (Open Questions 15, 16). — Owner: team. Block: no.
- **Risk:** The milestone's riskiest slice: new star data, chart geometry and orientation, judged without an observer; placed first among the features so its lessons reach S-04 and S-08.
- **Status:** proposed

### S-04: What to expect

- **Outcome:** user can read, with each ranked target, what it will look like in their own telescope from their site.
- **Change ID:** what-to-expect
- **PRD refs:** FR-038, US-05
- **Prerequisites:** F-01, S-02
- **Parallel with:** S-03, S-05, S-07
- **Blockers:** —
- **Unknowns:**
  - The phrase set and its rules (PRD Open Question 17), judged without an observer. — Owner: team. Block: no.
- **Risk:** Advice nobody can check yet; kept to a fixed phrase set derived from data the engine already has, so it stays deterministic and reviewable.
- **Status:** proposed

### S-05: Observing progress

- **Outcome:** user can see the Messier and Caldwell checklists with counts, the planets and the Moon as firsts, and a "not seen yet" mark on tonight's targets.
- **Change ID:** observing-progress
- **PRD refs:** FR-039, FR-040, US-06
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-07, S-08
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Reads the existing log only; the one rule that matters (rated 3 or above counts) mirrors the ranking's penalty rule, so both must stay in step.
- **Status:** proposed

### S-06: Observing milestones

- **Outcome:** user can have a milestone celebrated when the log entry that reaches it is saved, and see every milestone reached on the progress page.
- **Change ID:** observing-milestones
- **PRD refs:** FR-041, US-06
- **Prerequisites:** S-05
- **Parallel with:** S-03, S-04, S-07, S-08
- **Blockers:** —
- **Unknowns:**
  - The milestone set (PRD Open Question 18). — Owner: user. Block: no.
- **Risk:** Builds on S-05's counts; the celebration must appear once, at save, and never for an entry rated 1-2.
- **Status:** proposed

### S-07: Sky events

- **Outcome:** user can see the next 30 days of sky events for their site with times and visibility, the next notable one as a dashboard tile, and tonight's named beside the sky verdict.
- **Change ID:** sky-events
- **PRD refs:** FR-042, FR-043, US-07
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04, S-05, S-08
- **Blockers:** —
- **Unknowns:**
  - Meteor shower data whose terms allow reuse (PRD Open Question 19). — Owner: team. Block: no.
  - What counts as a close pairing (Open Question 20). — Owner: team. Block: no.
- **Risk:** Several kinds of event maths at once; may split by event kind in its plan. Computed by the engine, no feed, so it stays deterministic and works offline in stored copies.
- **Status:** proposed

### S-08: Adjustable session plan

- **Outcome:** user can reorder, drop and add targets on the session plan for a site and night, reset it to the suggested plan, and find their edits on every device and in the offline copy; a free account sees what it does and that it needs the full plan.
- **Change ID:** adjustable-session-plan
- **PRD refs:** FR-044, US-08
- **Prerequisites:** F-01, S-02
- **Parallel with:** S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - Paid features in a stored offline copy (PRD Open Question 23). — Owner: team. Block: no.
- **Risk:** The only slice adding a per-user table (RLS and isolation test required), and edits must never schedule a target outside its window.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID               | Suggested issue title                                       | Ready for `/10x-plan` | Notes                                                       |
| ---------- | ----------------------- | ----------------------------------------------------------- | --------------------- | ----------------------------------------------------------- |
| F-01       | account-plans           | M-3 F-01 · Free and full plans, complimentary full accounts | yes                   | Run `/10x-plan account-plans` · GitHub #121                 |
| S-01       | ui-mobile-pass          | M-3 S-01 · Phone-first UI pass (dashboard and Tonight)      | yes                   | Run `/10x-plan ui-mobile-pass` (or `/10x-ui`) · GitHub #122 |
| S-02       | ui-user-adjustments     | M-3 S-02 · The user's UI adjustments                        | no                    | Waits for the user's list after S-01 · GitHub #123          |
| S-03       | finder-chart            | M-3 S-03 · Finder chart from a naked-eye star               | no                    | After F-01 and S-02 · GitHub #124                           |
| S-04       | what-to-expect          | M-3 S-04 · What each target will look like                  | no                    | After F-01 and S-02 · GitHub #125                           |
| S-05       | observing-progress      | M-3 S-05 · Messier and Caldwell progress, not seen yet      | no                    | After S-02 · GitHub #126                                    |
| S-06       | observing-milestones    | M-3 S-06 · Observing milestones                             | no                    | After S-05 · GitHub #127                                    |
| S-07       | sky-events              | M-3 S-07 · Sky events for the next 30 days                  | no                    | After S-02 · GitHub #128                                    |
| S-08       | adjustable-session-plan | M-3 S-08 · Adjustable session plan, saved to the account    | no                    | After F-01 and S-02 · GitHub #129                           |

## Open Roadmap Questions

1. **Judging advice without an observer.** The finder charts' hops and the what-to-expect wording (S-03, S-04) can't be checked against a real night yet (`top_blocker: skills`). Candidate, as in M-2: published finder charts and observing guides as references, and the decision noted in each plan. — Owner: user. Block: none.
2. **PRD v3 Open Questions 13 to 20 and 23** are routed to the slices that need them (see each slice's Unknowns); 21 (commercial licences) and 22 (pricing) belong to a later payments milestone. — Owner: as in the PRD. Block: none for M-3.
3. **Carry-over follow-ups:** #19 (Stellarium moon/object fixture values) and #21 (ranking calibration refinements). Neither is a slice. — Owner: team. Block: none.

## Parked

- **Payments** (checkout, pricing, subscriptions) — Why parked: PRD v3 Non-Goals; needs commercial forecast, geocoding and tile terms first (PRD Open Question 21).
- **An admin interface for plans** — Why parked: PRD v3 Non-Goals; the operator uses one command (F-01).
- **Choosing your own finder** (finder type and field per telescope) — Why parked: S-03 assumes a standard finder (PRD Open Question 13); a later change.
- **Double stars (was M-2 S-04, `double-stars`, GitHub #68)** — Why parked: by the user, 2026-10-06; doubles need a redistributable data source and splitting rules with no calibration reference.
- **Comets and other transient objects** — Why parked: PRD v3 Non-Goals; need a refreshed external feed.
- **A sky atlas or planetarium view** — Why parked: PRD v3 Non-Goals; the finder chart shows only the stretch between a starting star and its target.
- **Offline logging and offline plan edits with later sync** — Why parked: logging and plan edits stay online-only (FR-044).
- **Astrophotography** — Why parked: PRD §Non-Goals.
- **Hardware control** (GoTo mounts, telescope integration) — Why parked: PRD §Non-Goals.
- **Notifications** (push, email, "clear tonight" alerts) — Why parked: PRD §Non-Goals; would need a custom email sender, which also gates password reset.
- **Social and sharing features, badges and leaderboards** — Why parked: PRD §Non-Goals; v3 progress is private.
- **AI features** (planner chat, object descriptions, summaries) — Why parked: PRD §Non-Goals.
- **Modelling seeing, transparency or light pollution** — Why parked: PRD §Non-Goals.
- **Native mobile app** — Why parked: PRD §Non-Goals; the web app is installable (FR-032).
- **Email verification, OAuth sign-in, read-only demo account** — Why parked: PRD §Access Control, post-MVP.
- **Password reset (FR-003)** — Why parked: cut-order #3 applied 2026-09-28; needs a custom SMTP sender.
- **Going public** (custom domain, preview environments with a separate database, usage analytics) — Why parked: deferred until payments are on the table.
- **Forecast caching by grid cell shared between nearby users** — Why parked: only needed beyond the target scale.

## Milestone History

(Append-only. Carried forward verbatim into each successor milestone's roadmap; empty on the very first milestone.)

- **M-1: MVP night decision** (`mvp-night-decision`) — closed 2026-09-28. All 3 foundations and 10 slices shipped and deployed: a signed-in beginner gets tonight's go / marginal / no-go verdict and a ranked, explained Messier shortlist from their own site and kit, with onboarding, a seven-night planner, an observation log, light/dark/red themes, EN/PL, a 30-day session and continue-after-sign-in; password reset (FR-003) parked by cut-order #3.
- **M-2: First real nights** (`first-real-nights`) — closed 2026-10-07. All 11 slices shipped (S-01–S-03, S-05–S-12; S-04 double stars parked by the user): the Moon, the planets and bright non-Messier objects on Tonight, a redesigned look (Nightfall) and a Tonight dashboard of focused pages with a live sky, a session-plan timeline, an installable app that opens stored Tonight pages offline, the sky check with its verdict tally, "Use my location" and "Pick from map" for sites, and a gear catalogue of real telescope and eyepiece models.

## Done

(`/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived. Do NOT pre-populate. M-1's and M-2's entries live in git history and in `context/archive/`.)

- **S-01: user can use every view comfortably on a phone, the dashboard and Tonight above all: each leads with its answer, nothing scrolls sideways, and the dashboard shows the sky verdict and its first tiles on the first screen.** — Archived 2026-10-07 → `context/archive/2026-10-07-ui-mobile-pass/`. Lesson: —.
- **S-02: user can see their own list of look-and-feel fixes applied across the app.** — Archived 2026-10-09 → `context/archive/2026-10-08-ui-user-adjustments/`. Lesson: —.
