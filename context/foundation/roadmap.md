---
project: Sidereus
version: 4
status: draft
created: 2026-09-30
updated: 2026-10-20
prd_version: 3
main_goal: quality
top_blocker: skills # advice judged without an observer; the owner kept it for M-4 (2026-10-15)
milestone_id: finished-and-trustworthy
milestone_seq: 4
milestone_status: done
---

# Roadmap: Sidereus

> Derived from the owner's description of M-4 (MS-01 to MS-04, 2026-10-15) with PRD v3 references (`context/foundation/prd.md`), plus a codebase baseline re-checked on 2026-10-15. There is no PRD change: every PRD v3 functional requirement is delivered except FR-003, which stays parked.
> **M-4 closed 2026-10-20.** No next milestone is open: the owner will decide later (for example after ESA's answer, about the end of November 2026). Edit-in-place; archive when superseded. M-3's closure check is in git history (commit 9a2cdc6) and in Milestone History below.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-4: Finished and trustworthy** — Status: done (closed 2026-10-20)

- **Intent:** Finish the look the owner asked for on 2026-10-14, make the advice agree with itself and with published references, and let the operator see production failures, before any new feature or payment.
- **Source materials:**
  - the owner's decisions of 2026-10-15, relayed by the orchestrator: outcome A of the M-4 draft, all seven slices, and S-07 on first-party tools only;
  - PRD v3 references;
  - `context/changes/ui-refine/audit.md`, including the owner's decisions 1-5 recorded there.
- **Done when:** every S-NN below is `done`, or cut by the cut order below, or moved to Parked by the owner.
- **Cut order (owner, 2026-10-15):** the PRD's hard deadline of 2026-11-04 still holds. If time runs short, drop **S-06** first, then **S-03**, then **S-01**. The cut order lists what to drop first, not a priority label. **S-03 is dropped** (owner, 2026-10-17): its progress part moves to S-11 and the rest goes to Parked. The owner's slices of 2026-10-17 (S-09 to S-12) are outside the cut order until the owner places them.
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
  - MS-05 (owner, 2026-10-16): The app is ready to take payments as far as star data goes. ESA cannot authorise HYG-derived files but offers to assess Hipparcos V1 used directly, so the star files come from V1 directly (S-08, PRD Open Question 21). No payment until ESA authorises.
  - MS-06 (owner, 2026-10-17): Four owner slices of UI polish and identity:
    - the live sky can be dragged with a mouse and shown hidden, as today or expanded, remembered per viewer (S-09);
    - Tonight's focused pages are one tap away from every screen (S-10);
    - progress rewards: milestone badges and Messier / Caldwell tile checklists on /log/progress (S-11, superseding the progress part of S-03);
    - an app icon chosen by the owner from three proposals (S-12).

### Closure check (2026-10-20)

Every S-NN is `done` except S-03, which the owner dropped on 2026-10-17 (the milestone's own "Done when" allows it). Their GitHub issues #169, #170, #172 to #175, #185 and #213 to #216 are closed; #171 (S-03) is still open. Main's last full run, at 7e9d65b, passed `ci`; main at a257f6c (#234 and #235 merged) passed `ci`, `smoke`, `migrate` and `deploy`.

- **The intent, clause by clause:**
  - Finish the look the owner asked for on 2026-10-14: S-01 (#177), S-02 (#182), S-10 quick nav (#220), S-09 sky modes (#212), S-11 progress rewards (#224) and S-12 app icon (#217). S-03's gear and log row icons were dropped and parked.
  - The advice agrees with itself and with published references: S-04 (#179) and S-05 (#188, 4-night top-5 oracle overlap 3 to 4 and a Skyfield + DE421 window check on 171 objects). **PRD Primary criterion 2 re-run:** done inside S-05; known divergence OD-1 kept (October M13, M15, M57 outside the top 5). #178 left M106 at 150 mm / Bortle 6 still `faint` (see placement).
  - Operators see production failures with their cause: S-07 (#183, #194, #226, #228, #231; archive #234; sky-check fix #235). Server-side failures reach Workers Logs and Issues with a fixed message and a shaped cause; client-side reports arrive as warn-level `noted` lines through a rate-limited endpoint. Owner's live checks of 2026-10-20 passed (7.8, 8.7, 9.7). **Not met as written:** "and be alerted" holds for the server side only (Issues automation, 6.5, is still the owner's to create); client-side reports have no automatic alert (7.9 answered no), only a weekly manual review of a saved query.
  - Auth loose ends: S-06 (#211).
  - Star data ready for payment: S-08 (#193, #195) switched the star files to Hipparcos V1 directly. ESA's authorisation is still pending.
- **PRD v3:** no PRD change in M-4 and no FR was added. Coverage of the guardrails and criteria:
  - Primary criterion 1 (landing to a top 5 in under a minute): untouched by M-4, and its e2e path stayed green.
  - Primary criterion 2 (cross-check of the top 5): re-run in S-05, see above.
  - Guardrail "coordinates stay private": held. Every client report is a step and a shaped name only; the endpoint refuses a coordinate, message or URL by schema, and Workers invocation events are off because they stored `request.cf` (IP-derived location). **Open:** Workers traces still carry city-level geo attributes by platform design (owner kept them on, 2026-10-16); the GDPR position is research #191.
  - Guardrail "never the physically impossible": held (S-05's true window edges, pinned against Skyfield).
  - Guardrail "forecast outage degrades, never blanks": held; M-4 added logging to those paths, not behaviour.
  - FR-003 (password reset) stays parked.
- **What M-4 leaves open** (placement decided by the owner, 2026-10-20):
  - Owner to-dos, not issues: S-07 6.5 (create the Issues automation and prove a deliberate failure reaches it), 6.6 and 6.7; the sky-check lookups (judging advice without an observer, Open Roadmap Question 1); ESA's answer (about the end of November 2026; no payment before it, and one lawyer check of its wording); the moonlight post-merge checks (due after 2026-10-22; done by the owner 2026-10-26); the IAU MDC courtesy email; the device checks of the 2026-10-17 handoff (iPhone Safari bottom-sheet swipe, VoiceOver on quick nav and on the progress tiles, red mode at night on a phone and the live celebration dialog (both done by the owner 2026-10-26), tiles without a common name); S-12's manual rows (Delta Optical has no entries).
  - **Placement of the open issues (owner, 2026-10-20):**
    - **#171** (S-03, dropped 2026-10-17): closed as not planned; its content is already in Parked.
    - **#178** (M106 at 150 mm / Bortle 6 still `faint`, deficit 1.61 against the 1.5 edge): parked, kept open as a known divergence; it needs an owner decision on the rule, not a data fix.
    - **#189** (release identity in logs, D6): carried to the next milestone; it makes post-deploy checks faster, a cheap enabler.
    - **#190** (failure UI: island fallback, 404 and 500 pages, plan-unknown state, finder eyepiece notice): carried to the next milestone as a user-visible slice; it needs a design pass.
    - **#191** (GDPR position of Workers observability data): carried; it must be answered before payments or any wider launch.
    - **#230** (reports from Astro-inlined scripts): parked; low volume, revisit if a field gap shows up.
    - **#232** (custom alerts for client reports, beta): parked; the weekly manual review is the recorded decision, and the feature is beta.
    - **#233** (response status through 36 store call sites): carried as a small hygiene slice with #189; it removes the remaining empty log lines.
    - **#19** (Stellarium fixtures): parked; it needs values the owner reads by hand and has been open since F-01.

## Vision recap

A beginner with a first telescope can't tell whether tonight is worth setting up for, or what to point at. Sidereus answers both from their own site and kit, and since M-3 it also helps them find each target, says what it will look like, tracks their progress, flags sky events and lets them shape the night's plan. M-4 adds no new promise. It makes the existing one hold:

- the advice must not contradict itself;
- the look must be finished;
- failures must be visible before anyone else relies on the app.

## North star

**S-04: Galaxies in a small telescope.** The north star is the smallest slice whose delivery proves the milestone's main claim, so it goes as early as its prerequisites allow. Here the claim is that the advice can be trusted. Today a beginner with a 60 mm telescope is told M31 is "very faint" in the same place it is called "bright for your 60 mm" (#159), and the persona's typical telescope is a small one.

## At a glance

| ID   | Change ID            | Outcome (user can …)                                                                                                                                | Prerequisites | PRD refs                    | Status      |
| ---- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------- | ----------- |
| S-01 | ui-dashboard-tiles   | read the dashboard's tiles and the verdict's event line in the same rhythm and icon language as the focused pages                                   | —             | MS-01, FR-030, FR-043       | done        |
| S-02 | ui-tonight-nav       | move between Tonight's focused pages in one tap, and reach Progress as a fourth destination                                                         | —             | MS-01, FR-030, FR-039       | done        |
| S-03 | ui-log-progress-gear | see progress as a bar over a quieter checklist, and gear and log rows labelled with icons                                                           | S-02          | MS-01, FR-039, FR-007       | dropped     |
| S-04 | small-scope-galaxies | get galaxy advice in a small telescope that agrees with itself: big bright galaxies are not called "very faint", and faint ones are not ranked high | —             | MS-02, FR-038, FR-013       | done        |
| S-05 | evening-showpieces   | see short evening showpieces ranked where beginners expect them, with windows that open on time, in a top 5 re-checked against references           | S-04          | MS-02, FR-013, FR-015       | done        |
| S-06 | auth-loose-ends      | land on Tonight when opening sign-in or sign-up while signed in, and continue to the requested page after signing up from a gated link              | —             | MS-04                       | done              |
| S-07 | error-visibility     | (operator) see every failure in the critical flows with its cause, and be alerted, with no private data in the reports                              | —             | MS-03                       | done        |
| S-08 | star-source-switch   | (operator) ship star files that come from Hipparcos V1 directly, with designations from CC0 and IAU sources, so ESA's authorisation can cover them  | —             | MS-05, PRD Open Question 21 | done        |
| S-09 | ui-sky-modes         | drag the live sky with a mouse, and show it hidden, as today or expanded to the screen, with every star in its true place and the choice remembered | —             | MS-06, FR-030, FR-025       | done        |
| S-10 | ui-quick-nav         | reach any of Tonight's focused pages from every screen through one icon button in the top bar                                                       | S-02          | MS-06, FR-030               | done        |
| S-11 | ui-progress-rewards  | see each milestone as a badge and the Messier and Caldwell lists as tile checklists on the progress page                                            | —             | MS-06, FR-039, FR-041       | done        |
| S-12 | app-icon             | recognise Sidereus by an app icon the owner picked from three proposals, on the home screen, the browser tab and the install prompt                 | —             | MS-06, FR-032, FR-036       | done        |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                | Chain                          | Note                                                                                                                                                                                                   |
| ------ | -------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A      | UI refinement        | `S-01`, `S-02` → `S-03`        | The `ui-refine` umbrella. `S-01` stands alone (already running); `S-03` follows `S-02`. The board has four Stream options. S-03 is dropped (owner, 2026-10-17); its progress part is S-11 in Stream F. |
| B      | Advice you can trust | `S-04` → `S-05`                | The north star first. The PRD's re-check closes the stream.                                                                                                                                            |
| C      | Seeing production    | `S-07`                         | Standalone; it makes the other streams' post-merge checks observable.                                                                                                                                  |
| D      | Auth loose ends      | `S-06`                         | Standalone and small; first in the cut order.                                                                                                                                                          |
| E      | Star data licensing  | `S-08`                         | Standalone; owner-mandated 2026-10-16, outside the cut order. The board has no Stream E option, so its Stream is blank.                                                                                |
| F      | Owner polish         | `S-09`, `S-10`, `S-11`, `S-12` | The owner's slices of 2026-10-17, independent of each other; S-10 builds on S-02's sub-nav. The board may have no Stream F option.                                                                     |

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
- **Status:** done

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
- **Status:** done

### S-03: Log, progress and gear rows

- **Outcome:** user can see their progress as a bar over a quieter checklist, /gear's rows labelled with fact icons, and the Log header reduced to its own actions.
- **Change ID:** ui-log-progress-gear
- **PRD refs:** MS-01, FR-039, FR-007
- **Prerequisites:** S-02
- **Parallel with:** S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Waits for S-02, where the Progress link leaves the Log header. It is second in the cut order.
- **Status:** dropped (owner, 2026-10-17): the progress part is superseded by S-11 `ui-progress-rewards`; the gear and log rows are in Parked.

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
- **Status:** done

### S-05: Evening showpieces and window edges

- **Outcome:** user can see the short evening showpieces (M13, M15, M57) ranked where beginners expect them, with each window opening on time and no reason line that distinguishes nothing. Tonight's top 5 is re-checked against a planetarium and an observation planner on 2-3 fixed nights.
- **Change ID:** evening-showpieces
- **PRD refs:** MS-02, FR-013, FR-015 (also PRD Primary criterion 2 and Open Questions 1 and 9; GitHub #21 items 1, 4 and 5)
- **Prerequisites:** S-04
- **Parallel with:** S-01, S-02, S-03, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - Which planner to use as the reference for ranking sanity (M-1 used a Skyfield recompute and published lists: Telescopius is JavaScript-only and key-gated, see the change's research). — Owner: team. Block: no.
- **Risk:**
  - Retuning the duration term reorders every night, so `calibration.test.ts` and the beginner reference must stay green without being regenerated.
  - Waits for S-04, so the PRD re-check runs once, after both retunes. It also closes S-03's open calibration sign-off (Progress 2.5 of the deep-sky-beyond-messier archive).
- **Status:** done

### S-06: Auth loose ends

- **Outcome:** user who opens sign-in or sign-up while signed in lands on Tonight, and a visitor who signs up from a gated link continues to that page afterwards.
- **Change ID:** auth-loose-ends
- **PRD refs:** MS-04 (also PRD Access Control: "continues to the requested page afterwards"; ui-auth D1 and D2)
- **Prerequisites:** —
- **Parallel with:** S-01, S-02, S-03, S-04, S-05, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Small. `safeNextPath` stays the one rule for a safe `next`, and the offline purge on sign-in or sign-up must keep working. It is first in the cut order.
- **Status:** done

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
- **Status:** done (2026-10-20; GitHub #175; PRs #183, #194, #226, #228, #231; follow-ups #189, #190, #191, #230, #232)

### S-08: Star source switch

- **Outcome:** user (the operator) can ship star files that come from the Hipparcos Catalogue, Version 1 (ESA, 1997; VizieR I/239, `hip_main.dat`) directly instead of through HYG, with Bayer, Flamsteed and proper-name designations from CC0 and IAU sources and the constellation computed, so that ESA's authorisation can cover the files and no third party's compilation of ESA's data is in the app. Charts and the live sky behave as before.
- **Change ID:** star-source-switch
- **PRD refs:** MS-05 (owner decision 2026-10-16: the app must be ready to take payments), PRD Open Question 21 (star paragraph)
- **Prerequisites:** —
- **Parallel with:** S-03, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - ESA's answer on the direct use of Hipparcos V1 (assessment aimed at the end of November 2026; ESA may attach conditions or a fee). — Owner: user. Block: no. This slice does not wait for it: V1 is CC BY-NC 3.0 IGO, fine while the app is free.
  - Whether the Wikidata and IAU designation sources cover the 3,342 stars that HYG names today, and how many stars ≤ 7.5 the V1 file yields (the assessment estimates about 25,713 against 25,791). — Owner: team. Block: no; the research settles it.
- **Risk:**
  - Both star pairs, the count guards, `stars.test.ts` and `finder-stars.test.ts` provenance assertions, the fixtures, `Attribution.astro` (new i18n keys in `en.ts` and `pl.ts`), `LICENSE-DATA.md` and the CLAUDE.md star tripwires all move together; the files stop being CC BY-SA and become NC under ESA's terms. (Note 2026-10-17, test-suite-diet Phase 5: `stars.test.ts` and `finder-stars.test.ts` now hold only the provenance and licence pins and run in the `guards` project; the shape and count checks are the generators'.)
  - The positions are J1991.25 and must be propagated to J2000 with the proper motions; the bright file is expected to stay unchanged (in the end it went from 925 to 921 stars).
  - If ESA refuses or prices it out, the files revert or migrate to SAO in a change of their own.
  - **No payment is taken until ESA authorises in writing.** Outside the cut order: the owner mandated it on 2026-10-16.
- **Status:** done

### S-09: Sky modes and drag to pan

- **Outcome:** user can drag the live sky sideways with a mouse (touch, keyboard and the chevrons keep working, and a drag never opens a marker), and switch it between hidden (the verdict still readable), as today, and expanded (the whole phone screen, most of a desktop screen), with every star and planet in its true place at every size and the choice remembered on the device without a flash.
- **Change ID:** ui-sky-modes
- **PRD refs:** MS-06, FR-030, FR-025 (the remembered-on-the-device pattern) (owner decision 2026-10-17)
- **Prerequisites:** —
- **Parallel with:** S-06, S-07, S-10, S-11, S-12
- **Blockers:** —
- **Unknowns:**
  - Where the mode control sits, what hidden shows, the expanded height on a desktop and the expanded field of view: the owner's questions in the change's plan (`context/changes/ui-sky-modes/plan.md`, with mockups). — Owner: user. Block: no; the plan carries a recommended default for each.
- **Risk:**
  - The phone first screen (`tonight-phone.spec.ts`, 33 px of slack) must hold in the default mode, and the skeleton must reserve the right height in every mode (`sky-band.ts`).
  - The projection must be recomputed for each size, never stretched; the expanded view stays the horizon panorama, not an atlas (Parked: "A sky atlas or planetarium view").
  - Outside the cut order: the owner mandated it on 2026-10-17.
- **Status:** done

### S-10: Quick navigation to Tonight's pages

- **Outcome:** user can open any of Tonight's focused pages (targets, events, plan, Moon, planets, nights) from every screen through a new icon button at the top right of the Topbar, which opens a popover menu of those pages.
- **Change ID:** ui-quick-nav
- **PRD refs:** MS-06, FR-030 (owner decision 2026-10-17)
- **Prerequisites:** S-02
- **Parallel with:** S-06, S-07, S-09, S-11, S-12
- **Blockers:** —
- **Unknowns:**
  - Whether the button shows on the Tonight pages too, beside the sub-nav, and how it fits the Polish Topbar at 320 px. — Owner: user. Block: no.
- **Risk:**
  - The Topbar's right-hand cluster is tight at 320 px (the theme button already hides there when signed out), and the popover sits in the `night-sky` scope, so it carries `data-theme`.
  - The links keep `?site=` and `?telescope=` and the offline rules of `TONIGHT_PAGES`; the menu must not duplicate `TONIGHT_NAV`.
  - Outside the cut order: the owner mandated it on 2026-10-17.
- **Status:** done

### S-11: Progress rewards

- **Outcome:** user can see each of the 11 milestones as a badge (reached or still ahead) and the Messier and Caldwell lists as tile checklists on `/log/progress`. It supersedes the progress part of S-03 (`ui-log-progress-gear`, #171).
- **Change ID:** ui-progress-rewards
- **PRD refs:** MS-06, FR-039, FR-041 (owner decision 2026-10-17)
- **Prerequisites:** —
- **Parallel with:** S-06, S-07, S-09, S-10, S-12
- **Blockers:** —
- **Unknowns:**
  - The badge artwork (lucide icons in a medallion or drawn badges) and whether the tiles show a thumbnail or only the label. — Owner: user. Block: no.
- **Risk:**
  - Badges stay private progress, never shared or ranked (Parked: social features, badges and leaderboards).
  - `observingProgress` and `withStored` stay the one rule; the page must not count differently from the celebration.
  - Red mode needs every badge state told apart by shape, not colour alone.
  - Outside the cut order: the owner mandated it on 2026-10-17.
- **Status:** done

### S-12: App icon

- **Outcome:** user can recognise Sidereus by an app icon the owner picked from three proposals, used for the favicon, the installed app's icon and the install prompt.
- **Change ID:** app-icon
- **PRD refs:** MS-06, FR-032, FR-036 (owner decision 2026-10-17)
- **Prerequisites:** —
- **Parallel with:** S-06, S-07, S-09, S-10, S-11
- **Blockers:** —
- **Unknowns:**
  - Which of the three proposals the owner picks. — Owner: user. Block: yes, for the build.
- **Risk:**
  - Every size the manifest and `apple-touch-icon` need comes from one source through the existing PWA assets config (`pwa-assets.config.mjs`), and the service worker's precache list follows.
  - The icon must read on light and dark home screens; the in-app red mode does not apply to it.
  - Outside the cut order: the owner mandated it on 2026-10-17.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID            | Suggested issue title                                               | Ready for `/10x-plan` | Notes                                                                               |
| ---------- | -------------------- | ------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| S-01       | ui-dashboard-tiles   | M-4 S-01 · Dashboard tiles in the new rhythm                        | done                  | Merged in #177, archived · GitHub #169                                              |
| S-02       | ui-tonight-nav       | M-4 S-02 · Tonight sub-nav and Progress as a destination            | done                  | Done: #182 merged, archived · GitHub #170                                           |
| S-03       | ui-log-progress-gear | M-4 S-03 · Log, progress and gear rows                              | dropped               | Dropped (owner, 2026-10-17): progress → S-11, rows → Parked · GitHub #171           |
| S-04       | small-scope-galaxies | M-4 S-04 · Galaxies in a small telescope (#159, #21 item 3)         | done                  | North star · Done: #179 merged, archived · GitHub #172 (follow-up #178)             |
| S-05       | evening-showpieces   | M-4 S-05 · Evening showpieces, window edges, PRD re-check           | no                    | After S-04 · GitHub #173                                                            |
| S-06       | auth-loose-ends      | M-4 S-06 · Auth loose ends (signed-in auth pages, sign-up next)     | yes                   | First in the cut order · Run `/10x-plan auth-loose-ends` · GitHub #174              |
| S-07       | error-visibility     | M-4 S-07 · Production error visibility (first-party)                | yes                   | Run `/10x-observability-audit` first · GitHub #175                                  |
| S-08       | star-source-switch   | M-4 S-08 · Star source switch: Hipparcos V1 direct (ESA decision)   | done                  | Done: #193 + #195 merged, archived · GitHub #185                                    |
| S-09       | ui-sky-modes         | M-4 S-09 · Live sky: drag to pan, hidden / default / expanded modes | done                  | Done: #212 merged, archived · GitHub #213 |
| S-10       | ui-quick-nav         | M-4 S-10 · Quick navigation to Tonight's pages from every screen    | done                  | Done: #220 merged, archived · GitHub #214                                          |
| S-11       | ui-progress-rewards  | M-4 S-11 · Progress rewards: milestone badges, tile checklists      | done                  | Done: #224 merged, archived · GitHub #215                                          |
| S-12       | app-icon             | M-4 S-12 · App icon: three proposals, owner picks                   | yes                   | Proposals first, then the owner's pick · Done: #217 merged, archived · GitHub #216                               |

## Open Roadmap Questions

1. **Judging advice without an observer** (carried from M-3). S-04 and S-05 are judged against source-cited references. The owner's own first nights, once they happen, are the first real check: sky-check tallies and log entries. — Owner: user. Block: none.
2. **ESA's assessment of the direct use of Hipparcos V1** (PRD Open Question 21). ESA replied about 2026-10-16: it cannot authorise HYG or files derived from it, Tycho-2 is not its product, and it offers to assess Hipparcos Version 1 used directly, together with the commercial-use framework it aims to finish by the end of November 2026. The owner sends the reply (draft in `context/foundation/licensing/esa-reply-2026-10-16-draft.md`); S-08 switches the star files meanwhile. External; does not block M-4. A refusal reverts or migrates the files to SAO, in a change of its own, before any payment; no payment before ESA authorises in writing, and one lawyer check of its wording before the first. — Owner: user. Block: none for M-4.
3. **Carry-overs that are not slices:**
   - #19, the Stellarium fixtures, which need values the owner reads by hand;
   - S-12's manual rows (Delta Optical has no entries);
   - ~~the moonlight post-merge checks, due after 2026-10-22~~ done by the owner 2026-10-26;
   - a VoiceOver pass over the live sky;
   - the IAU MDC courtesy email.

   — Owner: user, or team. Block: none.

4. **The next milestone (M-5) is not opened** (owner, 2026-10-20). Candidates carried from M-4: #189 (release identity), #190 (failure UI), #191 (GDPR position of Workers observability data), #233 (store faults carry the response status). The owner decides the scope later, for example after ESA's answer (about the end of November 2026). — Owner: user. Block: none.
5. **PRD v4** opens with the next milestone that adds scope (payments or new observing features), not in M-4. — Owner: user. Block: none.

## Parked

- **Ready to charge** (payments, pricing, a custom domain, an email sender for password reset (FR-003) and email verification, terms of use, usage analytics) — Why parked: option B of the M-4 draft. It needs PRD v4 and PRD Open Questions 21 and 22 answered, and the star source settled: S-08 done and ESA's written authorisation in hand (or SAO instead).
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
- **Social and sharing features, badges to share and leaderboards** — Why parked: PRD §Non-Goals; progress is private.
- **AI features** (planner chat, object descriptions, summaries) — Why parked: PRD §Non-Goals.
- **Modelling seeing, transparency or light pollution** — Why parked: PRD §Non-Goals.
- **Native mobile app** — Why parked: PRD §Non-Goals; the web app is installable (FR-032).
- **OAuth sign-in, a read-only demo account** — Why parked: PRD §Access Control, post-MVP.
- **Preview environments with a separate database** — Why parked: deferred until payments are on the table.
- **Forecast caching by grid cell shared between nearby users** — Why parked: only needed beyond the target scale.
- **Gear and log rows labelled with fact icons, and the Log header's last link (the rest of S-03 `ui-log-progress-gear`, #171)** — Why parked: the owner dropped S-03 on 2026-10-17; its progress part became S-11.
- **Open issues parked by M-4's close (owner, 2026-10-20), kept open:** #178 (M106 at 150 mm / Bortle 6 still `faint`: a rule decision), #230 (reports from Astro-inlined scripts), #232 (alert on client reports via Cloudflare custom alerts, beta), #19 (Stellarium fixtures, values read by hand) — Why parked: low volume or needs an owner decision; revisit when a field gap shows up.

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
- **M-4: Finished and trustworthy** (`finished-and-trustworthy`) — closed 2026-10-20. All 11 remaining slices shipped and deployed (S-01, S-02, S-04 to S-12; S-03 dropped by the owner and parked). Delivered:
  - the finished look: dashboard tiles, Tonight's sub-nav, a quick nav on every screen, sky modes (hidden, default, expanded; mouse drag), progress badges and tile checklists, the owner's app icon;
  - advice that agrees with itself: galaxies in small telescopes, evening showpieces, true window edges, the top 5 re-checked against references;
  - auth loose ends: signed-in visitors skip sign-in and sign-up, sign-up continues to the page asked for;
  - production error visibility on first-party tools only: Workers Logs and Issues for the server side, a rate-limited client report endpoint, a runbook, and a guard test against silent catches;
  - star files from Hipparcos V1 directly, pending ESA's written authorisation.

  Carried over: see the closure check above (owner to-dos; issues #189, #190, #191, #233 carried to the next milestone, which is not open yet; #178, #230, #232 and #19 parked and kept open; #171 closed).

## Done

(`/10x-archive` appends an entry here — and flips that item's `Status` to `done` — when a change whose `Change ID` matches the item is archived. Do NOT pre-populate. M-1's, M-2's and M-3's entries live in git history and in `context/archive/`.)

- **S-04: user with a small telescope gets galaxy advice that agrees with itself: a big bright galaxy such as M31 is not called "very faint" beside "bright for your 60 mm"; a faint, low-surface-brightness galaxy such as M101 is not ranked high in an 80 mm.** — Archived 2026-10-15 → `context/archive/2026-10-15-small-scope-galaxies/`. Lesson: —.
- **S-01: user can read the dashboard's tiles and the verdict's event line in the same spacing rhythm and icon language as the focused pages, with no icons on the tile headings.** — Archived 2026-10-15 → `context/archive/2026-10-15-ui-dashboard-tiles/`. Lesson: —.
- **S-02: user can move between Tonight's focused pages in one tap through a sub-nav that replaces the back box, and reach Progress as the fourth destination in the tab bar and the top bar.** — Archived 2026-10-15 → `context/archive/2026-10-15-ui-tonight-nav/`. Lesson: —.
- **S-05: user can see the short evening showpieces (M13, M15, M57) ranked where beginners expect them, with each window opening on time and no reason line that distinguishes nothing. Tonight's top 5 is re-checked against a planetarium and an observation planner on 2-3 fixed nights.** — Archived 2026-10-16 → `context/archive/2026-10-16-evening-showpieces/`. The owner's manual rows 1.6, 2.5, 3.3, 4.5 (including the M39 July P3 non-pass, a twilight-definition difference) and 4.6 were covered by the owner's merge of PR #188. Known divergence kept: October M13/M15/M57 rank outside the top 5 (OD-1, duration saturation only). Lesson: —.
- **S-08: user (the operator) can ship star files that come from the Hipparcos Catalogue, Version 1 directly instead of through HYG, with designations from CC0 and IAU sources, so ESA's authorisation can cover them.** — Archived 2026-10-17 → `context/archive/2026-10-16-star-source-switch/`. The owner's manual rows were covered by the owner's merge of PRs #193 and #195. F1 accepted: reference positions cite SIMBAD only. F5: the Gould numbers were dropped from the Flamsteed values. ESA's authorisation is still pending: no payments are taken until it arrives in writing. Lesson: —.
- **S-06: user who opens sign-in or sign-up while signed in lands on Tonight, and a visitor who signs up from a gated link continues to that page afterwards.** — Archived 2026-10-17 → `context/archive/2026-10-17-auth-loose-ends/`. The owner's manual rows 1.4, 1.5, 2.4-2.7 and 3.6 were covered by the owner's merge of PR #211. Lesson: —.
- **S-07: user (the operator) can see every failure in the critical flows with its cause, and is alerted on it for the server side, with no private data in the reports.** — Archived 2026-10-20 → `context/archive/2026-10-15-error-visibility/`. Lesson: —.
- **S-09: user can drag the live sky sideways with a mouse and show it hidden, as today or expanded, with every star in its true place and the choice remembered on the device.** — Archived 2026-10-17 → `context/archive/2026-10-17-ui-sky-modes/`. The owner's manual rows 1.5, 1.6, 2.4, 3.3, 3.4, 4.5, 4.6, 5.3 and 5.4 were covered by the owner's merge of PR #212 (GitHub #213). Lesson: —.
- **S-10: user can open any of Tonight's focused pages from every screen through one icon button in the top bar, and swipe down to close every bottom sheet.** — Archived 2026-10-17 → `context/archive/2026-10-17-ui-quick-nav/`. The owner's manual rows 1.5, 2.5, 2.6, 4.3, 4.4 and 4.5 were covered by the owner's merge of PR #220 (GitHub #214); rows 2.7, 3.4 and 3.5 (VoiceOver, iPhone Safari swipe) stay open and are carried to `context/handoff.md`. Lesson: —.
- **S-12: user can recognise Sidereus by an app icon the owner picked from three proposals, used for the favicon, the installed app's icon and the install prompt.** — Archived 2026-10-17 → `context/archive/2026-10-17-app-icon/`. The owner's manual row 3.3 (the post-deploy PWA icon check) was covered by the owner's merge of PR #217 (GitHub #216). Lesson: —.
- **S-11: user can see each of the 11 milestones as a badge (reached or still ahead) and the Messier and Caldwell lists as tile checklists on `/log/progress`.** — Archived 2026-10-17 → `context/archive/2026-10-17-ui-progress-rewards/`. PR #224 merged (GitHub #215); the owner's device checks (red mode at night and the live celebration dialog done 2026-10-26; VoiceOver and tiles without a common name still open) are carried to `context/handoff.md`. Lesson: —.
