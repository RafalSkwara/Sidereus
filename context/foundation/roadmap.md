---
project: Sidereus
version: 4
status: draft
created: 2026-09-30
updated: 2026-10-15
prd_version: 3
main_goal: quality
top_blocker: skills # advice judged without an observer; the owner kept it for M-4 (2026-10-15)
milestone_id: finished-and-trustworthy
milestone_seq: 4
milestone_status: open
---

# Roadmap: Sidereus

> Derived from the owner's description of M-4 (MS-01 to MS-04, 2026-10-15) with PRD v3 references (`context/foundation/prd.md`), plus a codebase baseline re-checked on 2026-10-15. There is no PRD change: every PRD v3 functional requirement is delivered except FR-003, which stays parked.
> Edit-in-place; archive when superseded. M-3's closure check is in git history (commit 9a2cdc6) and in Milestone History below.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-4: Finished and trustworthy** — Status: open

- **Intent:** Finish the look the owner asked for on 2026-10-14, make the advice agree with itself and with published references, and let the operator see production failures, before any new feature or payment.
- **Source materials:**
  - the owner's decisions of 2026-10-15, relayed by the orchestrator: outcome A of the M-4 draft, all seven slices, and S-07 on first-party tools only;
  - PRD v3 references;
  - `context/changes/ui-refine/audit.md`, including the owner's decisions 1-5 recorded there.
- **Done when:** every S-NN below is `done`, or cut by the cut order below, or moved to Parked by the owner.
- **Cut order (owner, 2026-10-15):** the PRD's hard deadline of 2026-11-04 still holds. If time runs short, drop **S-06** first, then **S-03**, then **S-01**. The cut order lists what to drop first, not a priority label.
- **Scope anchors:**
  - MS-01: Finish the UI refinement the owner asked for on 2026-10-14: separate the data more visibly, make the buttons quieter, update the navigation. These are changes 3-5 of the `ui-refine` split (`context/changes/ui-refine/`).
  - MS-02: The advice agrees with itself and with published references:
    - the what-to-expect line and the ranking for galaxies in small telescopes (#159, #21 item 3);
    - evening showpieces and window edges (#21 items 1, 4 and 5);
    - PRD Primary criterion 2 re-run.
  - MS-03: The operator sees production failures in the critical flows, with their cause, and is alerted. Only first-party tools (Workers Logs, Cloudflare alerts) and `/10x-observability-audit`, no new third party. No coordinates, emails or keys go into any report.
  - MS-04: Loose ends a user can hit in the auth flow:
    - a signed-in visitor who opens sign-in or sign-up goes on to Tonight;
    - sign-up continues to the page that was asked for (PRD Access Control, ui-auth D1 and D2).

## Vision recap

A beginner with a first telescope can't tell whether tonight is worth setting up for, or what to point at. Sidereus answers both from their own site and kit, and since M-3 it also helps them find each target, says what it will look like, tracks their progress, flags sky events and lets them shape the night's plan. M-4 adds no new promise. It makes the existing one hold:
- the advice must not contradict itself;
- the look must be finished;
- failures must be visible before anyone else relies on the app.

## North star

**S-04: Galaxies in a small telescope.** The north star is the smallest slice whose delivery proves the milestone's main claim, so it goes as early as its prerequisites allow. Here the claim is that the advice can be trusted. Today a beginner with a 60 mm telescope is told M31 is "very faint" in the same place it is called "bright for your 60 mm" (#159), and the persona's typical telescope is a small one.

## At a glance

| ID   | Change ID            | Outcome (user can …)                                                                                                                                | Prerequisites | PRD refs                                                      | Status      |
| ---- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------- | ----------- |
| S-01 | ui-dashboard-tiles   | read the dashboard's tiles and the verdict's event line in the same rhythm and icon language as the focused pages                                    | —             | MS-01, FR-030, FR-043                                         | in-progress |
| S-02 | ui-tonight-nav       | move between Tonight's focused pages in one tap, and reach Progress as a fourth destination                                                          | —             | MS-01, FR-030, FR-039                                         | ready       |
| S-03 | ui-log-progress-gear | see progress as a bar over a quieter checklist, and gear and log rows labelled with icons                                                            | S-02          | MS-01, FR-039, FR-007                                         | proposed    |
| S-04 | small-scope-galaxies | get galaxy advice in a small telescope that agrees with itself: big bright galaxies are not called "very faint", and faint ones are not ranked high  | —             | MS-02, FR-038, FR-013                                         | in-progress |
| S-05 | evening-showpieces   | see short evening showpieces ranked where beginners expect them, with windows that open on time, in a top 5 re-checked against references           | S-04          | MS-02, FR-013, FR-015                                         | proposed    |
| S-06 | auth-loose-ends      | land on Tonight when opening sign-in or sign-up while signed in, and continue to the requested page after signing up from a gated link               | —             | MS-04                                                         | ready       |
| S-07 | error-visibility     | (operator) see every failure in the critical flows with its cause, and be alerted, with no private data in the reports                               | —             | MS-03                                                         | planning    |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                | Chain                     | Note                                                                                                                    |
| ------ | -------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A      | UI refinement        | `S-01`, `S-02` → `S-03`   | The `ui-refine` umbrella. `S-01` stands alone (already running); `S-03` follows `S-02`. The board has four Stream options. |
| B      | Advice you can trust | `S-04` → `S-05`           | The north star first. The PRD's re-check closes the stream.                                                             |
| C      | Seeing production    | `S-07`                    | Standalone; it makes the other streams' post-merge checks observable.                                                   |
| D      | Auth loose ends      | `S-06`                    | Standalone and small; first in the cut order.                                                                           |

## Baseline

What's already in place in the codebase as of `2026-10-15`. This is the 2026-10-07 baseline plus M-3's deltas, re-checked against the code and CI. Slices below assume these are present and do NOT re-scaffold them.

- **Frontend:** present.
  - Astro 7 SSR with React islands.
  - The Nightfall tokens and shared components, including the `ui-refine` contract so far: the `hairline` / `quiet` button tiers, the rhythm roles, `text-overline`, `Fact` / `FactList` and `StatCard` / `StatPair`.
  - The Tonight dashboard with seven focused pages, the finder chart and the plan editor.
- **Backend / API:** present. Astro routes on Cloudflare Workers (Workers Paid); the Open-Meteo forecast behind a Workers KV cache; full-plan gates in each page shell and again in the island loaders.
- **Data:** present. Supabase Postgres with per-user RLS tables, including `observing_milestones`, `session_plans` and the server-owned `account_plans`. Star files: the bundled stars to magnitude 4.5, and the server-only finder stars to 7.5.
- **Auth:** present. Supabase email and password, 30-day sessions, `next` after sign-in, free and full plans with the operator command. Partial:
  - a signed-in visitor still sees the auth forms (ui-auth D1);
  - sign-up drops `next` (D2).
- **Deploy / infra:** present. CI runs `ci`, `smoke`, `migrate` and `deploy` on main (main's run at 42ce808 passed all four).
- **Observability:** partial.
  - Present: Workers observability is on, and the deliberate logs are fixed, allowlisted lines.
  - Missing: an audit, alerting and a view of failures by flow.

## Foundations

None. Every layer M-4 touches is present. Observability is partial, and S-07 completes it as an operator-facing slice rather than as a foundation.

## Slices

### S-01: Dashboard tiles in the new rhythm

- **Outcome:** user can read the dashboard's tiles and the verdict's event line in the same spacing rhythm and icon language as the focused pages, with no icons on the tile headings.
- **Change ID:** ui-dashboard-tiles
- **PRD refs:** MS-01, FR-030, FR-043
- **Prerequisites:** —
- **Parallel with:** S-02, S-04, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** The first-screen spec, `VERDICT_MIN_HEIGHT_CLASS` and the skeleton must move together. The change is already running (`ui-refine` agent, branch `feat/ui-dashboard-tiles`). It is third in the cut order.
- **Status:** in-progress

### S-02: Tonight navigation and Progress as a destination

- **Outcome:** user can move between Tonight's focused pages in one tap through a sub-nav that replaces the back box, and reach Progress as the fourth destination in the tab bar and the top bar. The finder keeps its way back to where it was opened from.
- **Change ID:** ui-tonight-nav
- **PRD refs:** MS-01, FR-030, FR-039
- **Prerequisites:** —
- **Parallel with:** S-01, S-04, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - Whether four tabs fit at 320 px in Polish. — Owner: team. Block: no.
- **Risk:** Touches every focused page and the shared navigation. The skeleton must not jump, and the dashboard's first screen (`tonight-phone.spec.ts`) must stay untouched.
- **Status:** ready

### S-03: Log, progress and gear rows

- **Outcome:** user can see their progress as a bar over a quieter checklist, /gear's rows labelled with fact icons, and the Log header reduced to its own actions.
- **Change ID:** ui-log-progress-gear
- **PRD refs:** MS-01, FR-039, FR-007
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Waits for S-02, where the Progress link leaves the Log header. It is second in the cut order.
- **Status:** proposed

### S-04: Galaxies in a small telescope

- **Outcome:** user with a small telescope gets galaxy advice that agrees with itself:
  - a big bright galaxy such as M31 is not called "very faint" beside "bright for your 60 mm";
  - a faint, low-surface-brightness galaxy such as M101 is not ranked high in an 80 mm.
- **Change ID:** small-scope-galaxies
- **PRD refs:** MS-02, FR-038, FR-013 (also PRD Open Questions 5 and 17; GitHub #159 and #21 item 3)
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - Published small-scope sources for M31, M33, M81 and M101 under suburban skies, at least two per entry. They go into the reference fixtures before either rule changes. — Owner: team. Block: no.
- **Risk:** These are two rules over the same physics: the expectation's core term, and the ranking's surface-brightness penalty, which ignores aperture. They must move in one direction, which is why they share a slice. Judged against references, not an observer (lessons.md).
- **Status:** in-progress

### S-05: Evening showpieces and window edges

- **Outcome:** user can see the short evening showpieces (M13, M15, M57) ranked where beginners expect them, with each window opening on time and no reason line that distinguishes nothing. Tonight's top 5 is re-checked against a planetarium and an observation planner on 2-3 fixed nights.
- **Change ID:** evening-showpieces
- **PRD refs:** MS-02, FR-013, FR-015 (also PRD Primary criterion 2 and Open Questions 1 and 9; GitHub #21 items 1, 4 and 5)
- **Prerequisites:** S-04
- **Parallel with:** S-01, S-02, S-03, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - Which planner to use as the reference for ranking sanity (M-1 used Telescopius). — Owner: team. Block: no.
- **Risk:**
  - Retuning the duration term reorders every night, so `calibration.test.ts` and the beginner reference must stay green without being regenerated.
  - Waits for S-04, so the PRD re-check runs once, after both retunes. It also closes S-03's open calibration sign-off (Progress 2.5 of the deep-sky-beyond-messier archive).
- **Status:** proposed

### S-06: Auth loose ends

- **Outcome:** user who opens sign-in or sign-up while signed in lands on Tonight, and a visitor who signs up from a gated link continues to that page afterwards.
- **Change ID:** auth-loose-ends
- **PRD refs:** MS-04 (also PRD Access Control: "continues to the requested page afterwards"; ui-auth D1 and D2)
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Small. `safeNextPath` stays the one rule for a safe `next`, and the offline purge on sign-in or sign-up must keep working. It is first in the cut order.
- **Status:** ready

### S-07: Production error visibility

- **Outcome:** user (the operator) can see every failure in the critical flows with its cause: Tonight's islands, the save routes, the finder chart, plan edits and sign-in. They are alerted on it, and no coordinates, emails or keys appear in any report.
- **Change ID:** error-visibility
- **PRD refs:** MS-03 (also the coordinate-privacy NFR)
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:**
  - What the audit finds hidden: empty catches, failures turned into redirects or 200s, dropped causes. `/10x-observability-audit` writes the report, and the fixes go through the change chain. — Owner: team. Block: no.
- **Risk:**
  - The owner's limit is first-party tools only (Workers Logs, Cloudflare alerts), with no new third party.
  - A report must never carry private data (the NFR, and lessons.md on `no-console`).
  - The fixed log lines must keep their allowlist counts.
- **Status:** planning

## Backlog Handoff

| Roadmap ID | Change ID            | Suggested issue title                                         | Ready for `/10x-plan` | Notes                                                                 |
| ---------- | -------------------- | ------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------- |
| S-01       | ui-dashboard-tiles   | M-4 S-01 · Dashboard tiles in the new rhythm                  | in progress           | `ui-refine` agent, `feat/ui-dashboard-tiles` · GitHub #169            |
| S-02       | ui-tonight-nav       | M-4 S-02 · Tonight sub-nav and Progress as a destination      | yes                   | Run `/10x-ui` → `/10x-plan ui-tonight-nav` · GitHub #170              |
| S-03       | ui-log-progress-gear | M-4 S-03 · Log, progress and gear rows                        | no                    | After S-02 · GitHub #171                                              |
| S-04       | small-scope-galaxies | M-4 S-04 · Galaxies in a small telescope (#159, #21 item 3)   | yes                   | North star · Run `/10x-plan small-scope-galaxies` · GitHub #172       |
| S-05       | evening-showpieces   | M-4 S-05 · Evening showpieces, window edges, PRD re-check     | no                    | After S-04 · GitHub #173                                              |
| S-06       | auth-loose-ends      | M-4 S-06 · Auth loose ends (signed-in auth pages, sign-up next) | yes                 | First in the cut order · Run `/10x-plan auth-loose-ends` · GitHub #174 |
| S-07       | error-visibility     | M-4 S-07 · Production error visibility (first-party)          | yes                   | Run `/10x-observability-audit` first · GitHub #175                    |

## Open Roadmap Questions

1. **Judging advice without an observer** (carried from M-3). S-04 and S-05 are judged against source-cited references. The owner's own first nights, once they happen, are the first real check: sky-check tallies and log entries. — Owner: user. Block: none.
2. **ESA licence reply** for the Hipparcos-derived stars (PRD Open Question 21, request sent 2026-10-14). It is external and does not block M-4. A refusal opens its own change to switch to SAO before any payment. — Owner: user. Block: none for M-4.
3. **Carry-overs that are not slices:**
   - #19, the Stellarium fixtures, which need values the owner reads by hand;
   - S-12's manual rows (Delta Optical has no entries);
   - the moonlight post-merge checks, due after 2026-10-22;
   - a VoiceOver pass over the live sky;
   - the IAU MDC courtesy email.

   — Owner: user, or team. Block: none.
4. **PRD v4** opens with the next milestone that adds scope (payments or new observing features), not in M-4. — Owner: user. Block: none.

## Parked

- **Ready to charge** (payments, pricing, a custom domain, an email sender for password reset (FR-003) and email verification, terms of use, usage analytics) — Why parked: option B of the M-4 draft. It needs PRD v4 and PRD Open Questions 21 and 22 answered.
- **An external error tracker** — Why parked: the owner's limit for S-07 (first-party tools only). If S-07's audit shows a gap they cannot close, the choice goes through `/10x-infra-research`.
- **An admin interface for plans** — Why parked: PRD v3 Non-Goals; the operator uses one command.
- **Choosing your own finder** (finder type and field per telescope) — Why parked: the finder chart assumes a standard finder (PRD Open Question 13); option C.
- **Double stars (was M-2 S-04, `double-stars`, GitHub #68)** — Why parked: by the user, 2026-10-06; they need a redistributable data source and splitting rules with no calibration reference.
- **Comets and other transient objects** — Why parked: PRD v3 Non-Goals; they need a refreshed external feed.
- **A sky atlas or planetarium view** — Why parked: PRD v3 Non-Goals.
- **Offline logging and offline plan edits with later sync** — Why parked: logging and plan edits stay online-only (FR-044); option C.
- **Astrophotography** — Why parked: PRD §Non-Goals.
- **Hardware control** (GoTo mounts, telescope integration) — Why parked: PRD §Non-Goals.
- **Notifications** (push, email, "clear tonight" alerts) — Why parked: PRD §Non-Goals; they would need a custom email sender.
- **Social and sharing features, badges and leaderboards** — Why parked: PRD §Non-Goals; progress is private.
- **AI features** (planner chat, object descriptions, summaries) — Why parked: PRD §Non-Goals.
- **Modelling seeing, transparency or light pollution** — Why parked: PRD §Non-Goals.
- **Native mobile app** — Why parked: PRD §Non-Goals; the web app is installable (FR-032).
- **OAuth sign-in, a read-only demo account** — Why parked: PRD §Access Control, post-MVP.
- **Preview environments with a separate database** — Why parked: deferred until payments are on the table.
- **Forecast caching by grid cell shared between nearby users** — Why parked: only needed beyond the target scale.

## Milestone History

(Append-only. Carried forward verbatim into each successor milestone's roadmap; empty on the very first milestone.)

- **M-1: MVP night decision** (`mvp-night-decision`) — closed 2026-09-28. All 3 foundations and 10 slices shipped and deployed: a signed-in beginner gets tonight's go / marginal / no-go verdict and a ranked, explained Messier shortlist from their own site and kit, with onboarding, a seven-night planner, an observation log, light/dark/red themes, EN/PL, a 30-day session and continue-after-sign-in; password reset (FR-003) parked by cut-order #3.
- **M-2: First real nights** (`first-real-nights`) — closed 2026-10-07. All 11 slices shipped (S-01–S-03, S-05–S-12; S-04 double stars parked by the user): the Moon, the planets and bright non-Messier objects on Tonight, a redesigned look (Nightfall) and a Tonight dashboard of focused pages with a live sky, a session-plan timeline, an installable app that opens stored Tonight pages offline, the sky check with its verdict tally, "Use my location" and "Pick from map" for sites, and a gear catalogue of real telescope and eyepiece models.
- **M-3: Find it and keep going** (`find-it-and-keep-going`) — closed 2026-10-15. F-01 and all 8 slices shipped and deployed. Delivered:
  - a phone-first pass, then the owner's own UI list;
  - free and full plans, with the full plan granted by command;
  - full plan: finder charts that hop from a naked-eye star, and a what-to-expect line per target;
  - Messier and Caldwell progress with "not seen yet" marks and milestones;
  - 30 days of computed sky events;
  - full plan: an editable session plan, saved to the account and carried into the offline copy.

  Carried over: #159 (M31's core brightness at small apertures), ESA's licence reply (PRD Open Question 21), and the rest of the ui-refine split (`ui-dashboard-tiles`, `ui-tonight-nav`, `ui-log-progress-gear`).

## Done

(`/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived. Do NOT pre-populate. M-1's, M-2's and M-3's entries live in git history and in `context/archive/`.)
