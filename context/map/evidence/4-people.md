# Evidence: people

Source: authorship in git history, per business capability. Window: 2026-09-15 .. 2026-10-27 (whole history, about 6 weeks, 7 ISO weeks W38-W44). No e-mail address appears in this file.

## How people were counted

- **humans_in_window = 1.** `Rafal Skwara` authors all 810 non-merge commits (two e-mail identities, folded into one person by name). The 184 merge commits carry the diacritic spelling `Rafał Skwara` (180, GitHub web merges, "Merge pull request #1 .. #243") and `Rafal Skwara` (4). All spellings are one human. This section is a **single-author baseline** (false-signal rule 6): no concentration figure below is a finding, and no bus-factor language is used.
- Filters: 8 mass commits dropped (`excluded-shas.txt`), leaving 802 counted commits; 0 bots; 0 agent-authored commits by author. Paths attributed only through `attribute.py` (noise paths dropped; 9 commits touch only noise paths and count for no capability); unattributed volume: **0 changes (0%)**. A commit counts once per capability it touches (contract rule); 98 counted commits touch more than 3 non-docs capabilities (cross-cutting, spillover rule 12), so per-capability commit counts overlap and do not sum to 802.
- **Agent trailers.** 297 of 810 commits carry (all 297 are among the 802 counted ones; none of the 8 mass commits has one) a Claude `Co-authored-by` trailer. By the contract these stay human commits; agents are not people. The trailer count is a **lower bound** of agent involvement: commits without a trailer may also be agent-written, and authorship cannot separate them (see "Agent co-authorship").
- `docs` (prose: plans, archive, handoff) is reported but never ranked (rule 8). It appears in 769 of 802 counted commits because every change ships its plan.
- Commit scopes are change ids (779 of 802 counted commits carry one), not capability names. The change-to-capability link below comes from the paths each change touched.

## People per capability

Every row has the same single human: **Rafal Skwara**. The "Period" and "Topics" columns are the evidence; "Topics" come from the most frequent commit scopes (change ids) and subject types among the commits touching the capability. "Written down" is the second "who": knowledge in files, found by command (archive folders listed under `context/archive/*-<change-id>/`, count = archived changes with at least 3 commits touching the capability).

Areas selected: all rated high or medium in the inventory (the top 5 by changes are among them). `sky-events` (low) is added for completeness.

| Capability (criticality) | Commits | Changes | Period (first .. last) | Topics (top change ids) | Written down (archived changes, with implementation notes) |
|---|---|---|---|---|---|
| tonight (high) | 152 | 656 | 09-17 .. 10-17 | ui-user-adjustments, moonlight-and-the-verdict, tonight-dashboard, ui-fact-rhythm | 30 (3) |
| engine (high) | 63 | 297 | 09-24 .. 10-26 | moonlight-and-the-verdict, verified-ephemeris-core, evening-showpieces, testing-ranking-invariants-and-calibration-oracle | 9 (3); `tolerance-report.md` in verified-ephemeris-core |
| forecast (medium) | 16 | 54 | 09-25 .. 10-19 | error-visibility, testing-forecast-honesty | 2 (1) |
| sky-view (medium) | 43 | 104 | 10-04 .. 10-17 | ui-user-adjustments, ui-sky-modes, ui-dashboard-tiles, interactive-sky | 7 (1) |
| finder (medium) | 20 | 72 | 10-13 .. 10-17 | finder-chart, test-suite-diet, star-source-switch | 3 (1); `esa-licence-request.md` in finder-chart |
| catalogue (medium) | 32 | 83 | 09-24 .. 10-19 | star-source-switch, deep-sky-beyond-messier, openngc-galaxy-magnitudes | 4 (0); `evidence.md`, `designation-check.md` in star-source-switch; `context/foundation/licensing/` |
| session-plan (high) | 45 | 124 | 09-30 .. 10-17 | adjustable-session-plan, session-plan-timeline | 6 (2) |
| sky-events (low) | 19 | 57 | 10-14 .. 10-17 | sky-events | 3 (1); `iau-mdc-request.md` in sky-events |
| observation-log (high) | 71 | 277 | 09-26 .. 10-20 | observing-progress, verdict-check, observation-log-management, sky-check-record-cause | 15 (3) |
| progress (medium) | 28 | 106 | 10-09 .. 10-17 | observing-milestones, ui-progress-rewards, observing-progress | 5 (3) |
| sites-gear (high) | 65 | 268 | 09-25 .. 10-19 | ui-user-adjustments, gear-catalogue, site-pick-from-map | 11 (2) |
| onboarding (medium) | 41 | 76 | 09-17 .. 10-19 | first-run-onboarding, ui-landing, ui-onboarding | 5 (2) |
| accounts (high) | 60 | 159 | 09-17 .. 10-26 | account-plans, auth-loose-ends, finder-chart (plan gate), error-visibility | 10 (2) |
| offline (medium) | 30 | 87 | 10-05 .. 10-27 | offline-night-plan, finder-chart (stored charts), adjustable-session-plan | 5 (1) |
| error-visibility (medium) | 38 | 105 | 09-26 .. 10-20 | error-visibility (16 commits), sky-check-record-cause | 4 (3); runbook `context/deployment/error-visibility.md`; `context/audits/observability/` |
| platform (high, bucket) | 91 | 199 | 09-16 .. 10-26 | error-visibility, test-suite-diet, testing-quality-gates-wiring, auth-loose-ends | 10 (2); `context/deployment/deploy-plan.md` |
| shared (medium, bucket) | 210 | 657 | 09-17 .. 10-19 | ui-* changes (ui-user-adjustments, ui-fact-rhythm, ui-progress-rewards, ui-sky-modes) | 39 (2) |

Other places where knowledge is written down (found by command, file names only):
- `context/handoff.md` (current state), `CLAUDE.md` (103 lines: dated per-change sections for observing-progress, observing-milestones, sky-events, finder-chart, what-to-expect, adjustable-session-plan, plus Architecture paragraphs for Request flow, Auth surfaces, Data access, Location picking, Gear catalogue, Engine, Catalogue, Layout, Offline, Copy and formatting; and Tripwires), and `context/foundation/lessons.md` (133 lines, 14 lessons: e.g. coordinates under no-console, per-user list queries, server-island plan checks, service-worker offline tests, swallowed catches, e2e clock pinning, naming the risk a test protects).
- 69 archived change folders under `context/archive/`; 6 have `implementation-notes.md` (error-visibility, evening-showpieces, sky-check-record-cause, small-scope-galaxies, test-suite-diet, ui-progress-rewards). Every archived change except 2 holds `plan.md` (the 2 without: bootstrap-verification, ui-sky-mode-trigger); 3 hold a `frame.md` and 2 a `checkpoint.md`; so decisions of the other changes live in `plan.md`, commit subjects and PR #1 .. #243.
- Not in git: the forge (PR discussions) and any ownership file. `CODEOWNERS` was not looked for here (not needed for one human; see Unknowns).

## Concentration

- **Small team: concentration is the baseline.** 100% of commits in every capability come from one human, so nothing is "concentrated" in a way that differs from the team. No capability is flagged.
- Capabilities touched by only one person, ever: **all 18** (trivially). This says nothing about risk; it says the only "who" is Rafal Skwara.
- What does differentiate capabilities (evidence): breadth of work history. `shared` (210 commits), `tonight` (152), `platform` (91), `observation-log` (71) have the longest records; `forecast` (16), `sky-events` (19), `finder` (20) the shortest. `finder` and `sky-events` were built in 5 days each (10-13 .. 10-17), so their knowledge is concentrated in time as well as in person.
- Cross-cutting change ids touch many capabilities at once (`error-visibility`, `test-suite-diet`, `ui-user-adjustments`, `finder-chart`, `ui-fact-rhythm`); their history is spread over several rows above (false-signal rule 4, 12: one cause counted in several capabilities).

## Agent co-authorship

Context only, never a filter. `Co-authored-by` trailers: Claude Opus 5.5 (255), Claude (32), Claude Sonnet 5.5 (6), Claude Opus 5 (4).

| Capability | Commits | With agent trailer | Share |
|---|---|---|---|
| sites-gear | 65 | 37 | 57% |
| observation-log | 71 | 40 | 56% |
| onboarding | 41 | 23 | 56% |
| tonight | 152 | 83 | 55% |
| shared | 210 | 110 | 52% |
| sky-view | 43 | 21 | 49% |
| accounts | 60 | 28 | 47% |
| session-plan | 45 | 20 | 44% |
| platform | 91 | 36 | 40% |
| offline | 30 | 12 | 40% |
| forecast | 16 | 6 | 38% |
| engine | 63 | 22 | 35% |
| catalogue | 32 | 7 | 22% |
| sky-events | 19 | 4 | 21% |
| error-visibility | 38 | 4 | 11% |
| progress | 28 | 2 | 7% |
| finder | 20 | 0 | 0% |
| docs (bucket, prose) | 769 | 287 | 37% |
| all counted commits | 802 | 297 | 37% |

**Read this as a lower bound** (inference, supported by the time pattern):
- Trailer share by ISO week: W38 4/5, W39 57/80, W40 101/116, W41 87/243, W42 41/313, W43 2/36, W44 5/9. The share falls from about 87% to about 13% while commits per week rise, although the owner states that most code was written by Claude Code sessions throughout. A drop that sharp is more likely a change in how commits were made (e.g. trailers not added) than a change in who wrote the code. Cause: `unknown`.
- Before 2026-10-10: 247 of 440 commits carry a trailer (56%); from 2026-10-10: 50 of 362 (14%).
- Consequence: low-share capabilities (finder 0%, progress 7%, error-visibility 11%) were mostly built late (10-09 .. 10-20), in the low-trailer period; their share does **not** mean "written by hand". High-share capabilities were mostly built early. The share tells when a capability was built, not who wrote it.
- 154 of the 365 commits that touch code (non-docs capabilities) carry a trailer (42%).

## Implications

- **Whom to ask:** Rafal Skwara for every capability. Before a change, ask which Claude session or change id produced it: most code came from agent sessions, so the decision record is in the change folder, not in a remembered conversation.
- **Read before changing, per capability (the second "who"):**
  - tonight / session-plan / sky-view / shared (UI): the archived `ui-*` change plans (`ui-user-adjustments`, `ui-fact-rhythm`, `ui-sky-modes`, `ui-quiet-actions`) and the dated `CLAUDE.md` sections.
  - engine: `verified-ephemeris-core` (with `tolerance-report.md`), `evening-showpieces`, `small-scope-galaxies`, `testing-ranking-invariants-and-calibration-oracle` and their implementation notes.
  - catalogue / finder: `star-source-switch` (`evidence.md`, `designation-check.md`), `finder-chart` (`esa-licence-request.md`) and `context/foundation/licensing/`.
  - accounts: `account-plans`, `auth-loose-ends`, `testing-access-and-entitlement-boundary`, and the lessons "Check the full plan in the island loader".
  - error-visibility / platform: `error-visibility` (implementation notes), `context/deployment/error-visibility.md`, `context/audits/observability/`, `testing-quality-gates-wiring`.
  - observation-log / progress: `verdict-check`, `sky-check-record-cause`, `observing-progress`, `observing-milestones`, `ui-progress-rewards`.
  - offline: `offline-night-plan` plus the service-worker lessons.
- **PRs to read:** the 180 GitHub merges ("Merge pull request #N", #1 .. #243) are the whole review trail; the forge is outside this evidence.
- **Change ids that already tried things:** a change that touches many capabilities at once (`test-suite-diet`, `error-visibility`, `ui-user-adjustments`) is the likely prior attempt for cross-cutting work.

## Unknowns

- `unknown`: whether anyone besides the owner will work on the repo. Formal ownership (CODEOWNERS, team assignments) was not checked and does not change the one-person baseline.
- `unknown`: the true share of agent-written code. Authorship cannot separate it (trailer lower bound; the trailer share dropped from W41 onward for an unestablished reason).
- `unknown`: the review content of the 180 merged PRs (forge not read here); who reviewed besides the owner, and whether agent reviews (impl-review, code-review) exist on the PRs.
- `unknown`: who "asked" in the sense of a Claude session identity; sessions are not recorded in git beyond the trailer model name.
- `inference`: the change-id to capability link comes from touched paths, not from a declared mapping. Cross-cutting changes (98 commits touch more than 3 non-docs capabilities) overlap rows.

## Commands run

- `python3 -I context/map/.work/people.py` (reads `.work/git-log.txt`, drops `excluded-shas.txt`, attributes each path through `attribute.py`, writes `.work/people-commits.json`).
- `python3 -I context/map/.work/people-stats.py` (per-capability commits, agent trailers, period, subject types, change ids; weekly trailer share) -> `.work/people-stats.txt`.
- `python3 -I context/map/.work/people-changes.py`, `people-docs.py` (archive change ids per capability, implementation notes) -> `.work/people-changes.txt`, `.work/people-docs.txt`.
- `awk` over `git-log.txt` field 2 (author names: one), `git log --merges --format=%s` (180 "Merge pull request", #1 .. #243).
- `ls context/archive`, `ls context/foundation`, `ls context/deployment context/audits`, `grep -n '^#' context/foundation/lessons.md`, `grep -n` of CLAUDE.md section headings.
