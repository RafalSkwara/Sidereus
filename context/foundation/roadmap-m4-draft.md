---
project: Sidereus
status: draft-awaiting-owner
created: 2026-10-15
prd_version: 3
proposed_milestone_id: finished-and-trustworthy
proposed_milestone_seq: 4
---

# M-4 draft: what comes after "Find it and keep going"

> This is a proposal, not the roadmap. M-3 closed on 2026-10-15 (`roadmap.md`, Milestone History). Once the owner has decided the outcome and the list of slices, this draft is rewritten as `context/foundation/roadmap.md` with M-4 open. That rewrite carries `## Milestone History` forward verbatim and deletes this file. No GitHub issues or board cards exist for M-4 until then.

## What is left to build (checked 2026-10-15)

- **PRD v3 functional requirements:** every FR from FR-001 to FR-046 is delivered, except FR-003 (password reset, parked under cut order #3). Taking the next tranche from the same PRD therefore yields nothing new. New feature scope needs PRD v4.
- **PRD questions without an answer:**
  - Open Questions 1-9 (scoring weights, thresholds, penalties, ephemeris tolerance) are still uncalibrated candidates.
  - 12: the geocoding terms.
  - 15-17: the naked-eye limit, hop length and what-to-expect wording, none of them tried by an observer.
  - 21: commercial licences. ESA has not yet replied about Hipparcos. Open-Meteo, the geocoding service and the OpenStreetMap tiles are used on non-commercial terms.
  - 22: pricing.
- **The PRD's own success criterion that was never re-run:**
  - Primary criterion 2: tonight's top 5 cross-checked against a planetarium and an observation planner on 2-3 nights.
  - It was found "sane" at M-1's checkpoint, with the refinements listed in #21. The S-03 calibration sign-off is still open: Progress 2.5 in `context/archive/2026-10-06-deep-sky-beyond-messier/`.
- **Carried over from M-3:**
  - #159 (M31 at 60 mm);
  - ESA's licence reply;
  - the rest of the ui-refine split (`context/changes/ui-refine/audit.md`): `ui-dashboard-tiles`, `ui-tonight-nav`, `ui-log-progress-gear`.
- **Older follow-ups:**
  - #21, items 1, 3 and 4 (calibration);
  - #19 (Stellarium fixtures, which need values read by hand in Stellarium);
  - ui-auth D1 (a signed-in visitor still sees the auth forms) and D2 (sign-up does not carry `next`);
  - S-12's 12 manual rows (Delta Optical has no catalogue entries);
  - the moonlight post-merge checks, due after 2026-10-22;
  - a VoiceOver pass over the live sky;
  - the IAU MDC courtesy email.
- **Parked or Non-Goals that could become a milestone:**
  - Payments: checkout, pricing, a commercial forecast plan.
  - Going public: a custom domain, preview environments, usage analytics.
  - Accounts: password reset and email verification, both of which need a custom email sender.
  - Choosing your own finder.
  - Double stars.
  - Offline logging with sync.
  - Notifications.
  - AI features.
- **Deadline:** the PRD's frontmatter still has `hard_deadline: 2026-11-04`.

## Baseline delta since 2026-10-07

What M-3 added to the baseline:

- **Auth:** account plans (free and full) and the operator command.
- **Data:**
  - new tables: `account_plans`, `observing_milestones`, `session_plans`;
  - a second, server-only star file down to magnitude 7.5.
- **Observability:** still partial.
  - Workers observability is on, and the deliberate logs are fixed, allowlisted lines.
  - There is no error tracker and no alerting.
  - No observability audit has been run (there is no `context/audits/`).

## Three possible outcomes for M-4

### A. Finished and trustworthy (recommended)

**Outcome:** finish the look the owner asked for on 2026-10-14, make the advice agree with itself and with published references, and make production failures visible to the operator. This comes before any new feature or payment.

- **Source:** the owner's description (the anchors below) plus PRD v3 references. No PRD bump is needed.
- **Why it is the recommendation:**
  - The UI split was the owner's own request and is half done.
  - #159 is a contradiction a user can see today.
  - Primary criterion 2 has not been re-checked since the M-2 and M-3 scoring changes.
  - The app has no error tracking even though it now holds paid features.
  - The milestone fits before 2026-11-04 without growing the PRD.

### B. Ready to charge

**Outcome:** a stranger can sign up on a real domain, pay for the full plan and recover their password.

- **Source:** PRD v4.
- **What it needs:**
  - Open Question 21 answered: a commercial forecast and geocoding plan, the tile terms, and ESA's reply or a switch to SAO.
  - Open Question 22: pricing and a payment provider.
  - A custom email sender, so password reset and email verification can work.
  - Terms of use and a privacy policy.
  - Error tracking.
- **Why it is not the recommendation now:** it is blocked from outside (ESA has not replied, and commercial terms need money and decisions). It also widens the PRD a few weeks before its deadline.

### C. New observing features

**Outcome:** the next "what to do at the eyepiece" features.

- **Candidates:** choosing your own finder, double stars, logging offline with sync, "clear tonight" notifications, AI object descriptions.
- **Source:** PRD v4. Most of these are Non-Goals today, and double stars were parked by the owner.
- **Why it is not the recommendation:** it adds scope while the advice that exists is still uncalibrated (`top_blocker: skills`). It would also leave the half-finished UI split behind.

## Option A in roadmap shape (the proposed slice list)

### Framing (proposed)

- **Sequencing goal:** `quality` (unchanged from M-3). Correctness and finish come before new reach.
- **North star:** S-04. A north star is the smallest slice whose delivery proves the milestone's claim, so it goes first.
  - S-04 is a beginner with a small telescope getting galaxy advice that agrees with itself and with published observations.
  - The persona's typical scope is 60-150 mm, and today that is where the advice contradicts itself.
- **Main risk:** `skills`. Every number in S-04 and S-05 is judged without an observer, so they are judged against source-cited references (lessons.md, "Judge advice that no observer can check").
- **Investment:**
  - Deep in the engine's reference fixtures (S-04, S-05) and in observability (S-07).
  - Light in the UI changes, which reuse the existing Nightfall contract.

### Milestone charter (proposed)

**M-4: Finished and trustworthy** (`finished-and-trustworthy`)

Scope anchors:

- MS-01: Finish the UI refinement the owner asked for on 2026-10-14: separate the data more visibly, make the buttons quieter, update the navigation. These are changes 3-5 of `context/changes/ui-refine/audit.md`, under the owner's decisions 1-5 recorded there.
- MS-02: The advice agrees with itself and with published references: the what-to-expect line and the ranking for galaxies in small telescopes (#159, #21 item 3), evening showpieces and window edges (#21 items 1, 4 and 5), and PRD Primary criterion 2 re-run.
- MS-03: The operator sees production failures in the critical flows, with their cause, and is alerted. No coordinates, emails or keys appear in any report.
- MS-04: Loose ends a user can hit in the auth flow: a signed-in visitor opening sign-in or sign-up goes on to Tonight, and sign-up continues to the page that was asked for (PRD Access Control, ui-auth D1 and D2).

### At a glance (proposed)

| ID   | Change ID             | Outcome (user can …)                                                                                                       | Prerequisites | Source refs                                 | Status   |
| ---- | --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------- | -------- |
| S-01 | ui-dashboard-tiles    | read the dashboard's tiles and the verdict's event line in the same rhythm and icon language as the focused pages           | —             | MS-01, FR-030, FR-043                       | ready    |
| S-02 | ui-tonight-nav        | move between Tonight's focused pages in one tap, and reach Progress as a fourth destination                                 | —             | MS-01, FR-030, FR-039                       | ready    |
| S-03 | ui-log-progress-gear  | see progress as a bar over a quieter checklist, and gear and log rows labelled with icons                                   | S-02          | MS-01, FR-039, FR-007-FR-009                | proposed |
| S-04 | small-scope-galaxies  | get galaxy advice in a small telescope that agrees with itself: big bright galaxies not called "very faint", faint ones not ranked high | —      | MS-02, FR-038, FR-013, #159, #21 (3), OQ5, OQ17 | ready    |
| S-05 | evening-showpieces    | see short evening showpieces (M13, M15, M57) ranked where beginners expect them, with windows that open on time, in a top 5 re-checked against references | S-04 | MS-02, FR-013, FR-015, #21 (1, 4, 5), OQ1, OQ9, Primary criterion 2 | proposed |
| S-06 | auth-loose-ends       | open sign-in or sign-up while signed in and land on Tonight; sign up from a gated link and continue to that page           | —             | MS-04, Access Control                       | ready    |
| S-07 | error-visibility      | (operator) see every failure in the critical flows with its cause, and be alerted, without any private data in the reports | —             | MS-03, NFR coordinate privacy               | ready    |

There are no foundations. The baseline covers every layer M-4 touches; observability is partial, and S-07 completes it as an operator-facing slice.

### Slices (proposed, short form)

- **S-01 ui-dashboard-tiles**
  - Scope: audit finding 4 on `/tonight`. The tile content moves onto the rhythm roles, and the verdict's event line gets its leading fact icon. Tile headings get no icons (decision 3).
  - Risk: the first-screen spec, `VERDICT_MIN_HEIGHT_CLASS` and the skeleton must move together. The slice is small enough to fold into S-02 if its plan finds it too thin.
  - Parallel with: S-02, S-04, S-06, S-07.
- **S-02 ui-tonight-nav**
  - Scope: decision 4. The Tonight sub-nav replaces `BackLink` on the focused pages; the finder keeps its way back to where it was opened from. Progress joins `NAV_ITEMS`.
  - Unknown: whether four tabs fit at 320 px in Polish. Owner: team. Block: no.
  - Risk: the first-screen spec and the skeleton must not jump.
  - Parallel with: S-01, S-04, S-06, S-07.
- **S-03 ui-log-progress-gear**
  - Scope: audit findings 8 and 10. Prerequisite S-02, because the Progress link leaves the Log header there.
  - Parallel with: S-04, S-05, S-06, S-07.
- **S-04 small-scope-galaxies (north star)**
  - Scope: add published small-scope references for M31, M33, M81 and M101 (at least two sources each) to the reference fixtures first. Then make sourced changes to the expectation core term and to the ranking's surface-brightness penalty, which today ignores aperture.
  - Risk: these are two rules over the same physics, and they must move in one direction. Keeping them in one slice is the point.
  - Unknowns: which published sources to use. Owner: team. Block: no.
  - Parallel with: S-01, S-02, S-03, S-06, S-07.
- **S-05 evening-showpieces**
  - Scope:
    - #21 item 1: cap the duration term at a fixed useful span.
    - #21 item 4: interpolate the window edges.
    - #21 item 5: drop the cosmetic second reason.
    - Then re-run Primary criterion 2 on 2-3 fixed nights against a planetarium and a planner, and sign off S-03's calibration Progress 2.5.
  - Prerequisite S-04: the re-check must see both retunes, and the two slices share the scoring parameters.
  - Parallel with: S-01, S-02, S-03, S-06, S-07.
- **S-06 auth-loose-ends**
  - Scope: ui-auth D1 and D2. One small vertical change through the middleware and the auth pages, with `safeNextPath` as the one rule.
  - Parallel with: everything.
- **S-07 error-visibility**
  - Scope: run `/10x-observability-audit` over the critical flows first (Tonight islands, saves, finder, plan edits, sign-in). Then fix what hides errors and add reporting and alerting, through the usual change chain.
  - Unknown: whether a first-party setup is enough or an external error tracker is needed (owner question 3). Owner: user. Block: no, because the default is first-party.
  - Risk: a report must never carry coordinates, an email or a key (an NFR, and lessons.md on `no-console`).
  - Parallel with: everything.

### Streams (proposed)

| Stream | Theme                   | Chain           | Note                                                                         |
| ------ | ----------------------- | --------------- | ---------------------------------------------------------------------------- |
| A      | Navigation and the log  | `S-02` → `S-03` | The owner's UI request; can run beside the north star.                       |
| B      | The dashboard           | `S-01`          | Small; may fold into S-02 at planning.                                       |
| C      | Advice you can trust    | `S-04` → `S-05` | The north star first; the PRD's re-check closes the stream.                  |
| D      | Auth loose ends         | `S-06`          | Standalone and small.                                                        |
| E      | Seeing production       | `S-07`          | Standalone; it makes the other streams' post-merge checks observable.        |

### Open roadmap questions (proposed)

1. **Judging advice without an observer** (carried from M-3, question 1). S-04 and S-05 are judged against source-cited references. The owner's own first nights, once they happen, are the first real check: sky-check tallies and log entries. Owner: user. Block: none.
2. **ESA licence reply** (PRD Open Question 21). External, and it does not block M-4. A refusal opens its own change to switch to SAO before any payment. Owner: user.
3. **Carry-overs that are not slices:**
  - #19, the Stellarium fixtures, which need values the owner reads by hand;
  - S-12's manual rows;
  - the moonlight post-merge checks after 2026-10-22;
  - a VoiceOver pass;
  - the IAU MDC email.

  Owner: user, or team. Block: none.

### Parked (additions for M-4)

- **Payments, a custom domain, email sending (password reset, verification) and terms of use.** Why parked: this is option B, kept together for a later "ready to charge" milestone after PRD Open Questions 21 and 22.
- **New observing features** (choosing your own finder, double stars, offline logging with sync, notifications, AI). Why parked: this is option C, and it needs PRD v4.

## Technical choices recorded (made by the roadmap agent)

- The ui-refine changes 3-5 become M-4 slices under their existing change IDs. The `ui-refine` umbrella stays the place for the audit and the owner's decisions, and it is archived with the last of them. `ui-fact-rhythm` (merged in #167) is archived on its own, outside M-4.
- #159 and #21 item 3 are one slice (S-04). They are the same physics in two rules, and splitting them would let the rules drift apart.
- S-05 waits for S-04, so Primary criterion 2 is re-run once, after both retunes.
- #19 stays a carry-over rather than a slice, because it needs the owner's hand-read Stellarium values.
- Observability starts with the audit skill. Any vendor choice goes through `/10x-infra-research`, never inside an implementation plan.
- Option A needs no PRD bump. Its slices trace to `MS-01`-`MS-04` and to PRD v3 references. PRD v4 opens with option B or C.
- GitHub issues and Projects board cards are created only after the owner answers.

## Questions for the owner

See the agent's report (in Polish). Once they are answered, this draft becomes `roadmap.md` (M-4 open), and the issues and board cards follow.
