# Evidence: discussion

Sources: `gh` read-only on `RafalSkwara/Sidereus` (183 PRs, 62 issues, whole history 2026-09-17 .. 2026-10-27, one call each with `--limit 300`, no limit hit) + git (`.work/git-log.txt`, 802 counted commits; first-parent merges for PR → file mapping) + planning artefacts (`context/archive/` 70 folders, `context/changes/ui-refine`, 126 review files) + `context/foundation/{roadmap,lessons}.md`, `context/handoff.md`, `context/audits/observability/2026-10-15_…md`. Window = whole history (~6 weeks). Raw data: `.work/disc-*.{json,txt,tsv}`, scripts `.work/disc_analyze.py`, `.work/disc_tables.py`.

How PRs were attributed: 177 first-parent merge commits (`Merge pull request #N`), files = merge vs first parent (`git log -m --first-parent --name-only`), paths through `attribute.py`. 6 PRs have no first-parent merge on HEAD: 5 were merged into non-main bases (#131, #200, #201, #203, #204 — stacked; their files reach main through a later PR) and #245 was merged after HEAD. 71 PRs touch only `docs`/noise (plans, archives, roadmap).

How review rounds were counted: forge review objects (`reviews` field) on all 183 PRs = **0**. PR comments = 2, both posted under the owner's account but written as agent status notes (#165 flake root-cause note, #158 follow-up note) — counted as agent, not human review (false-signal rule 7, inference from wording). Review in this repo happens **before** the PR, in agent-written files `reviews/plan-review*.md` (54) and `reviews/impl-review*.md` (72) produced by the `10x-plan-review` / `10x-impl-review` skills. Those are **agent-run reviews**, not human review. The human signal is the owner's triage of them (74 of 126 files mention owner decisions or triage) and the owner's merge (180 web merges). PR open-to-merge median 0.19 h, p90 2.6 h, max 134.7 h — consistent with "review already happened on the branch" (evidence).

## Buzz per capability

Counting rules from the scan contract: a PR/commit counts for every capability it touches; "x-cut" = touches > 3 business capabilities. Issues attributed by title vocabulary (`.work/disc-issue-map.tsv`, inference). Plans: each change folder attributed to the business capability with most code-file changes in its commits (scope = change id) and its PRs (head branch / title = change id) — `primary`; `touched` = every business capability it changed. Review findings = `### F<n>` headings summed over plan + impl reviews of primary changes.

| capability | PRs (x-cut) | commits | fix commits (x-cut) | reverts | issues (open / open bug) | follow-up issues | plans primary / touched | plans since 10-15 | agent reviews / findings / critical | REJECT or REVISE verdicts | prose changes on its plans |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tonight | 57 (39) | 152 | 41 (5) | 0 | 14 (0/0) | 1 | 21 / 45 | 3 | 44 / 316 / 9 | 5 | 533 |
| engine | 33 (21) | 63 | 17 (2) | 0 | 6 (1/0) | 3 | 8 / 28 | 3 | 14 / 111 / 3 | 2 | 254 |
| forecast | 12 (9) | 16 | 4 (1) | 0 | 0 | 0 | 1 / 8 | 0 | 1 / 2 / 0 | 0 | 14 |
| sky-view | 20 (14) | 43 | 14 (2) | 0 | 2 (0/0) | 1 | 5 / 15 | 3 | 6 / 45 / 0 | 0 | 68 |
| finder | 12 (10) | 20 | 3 (1) | 0 | 1 (0/0) | 0 | 1 / 7 | 0 | 2 / 22 / 1 | 1 | 41 |
| catalogue | 14 (8) | 32 | 9 (1) | 0 | 3 (1/1) | 1 | 2 / 10 | 2 | 4 / 26 / 0 | 0 | 69 |
| session-plan | 24 (21) | 45 | 9 (3) | 0 | 2 (0/0) | 0 | 1 / 21 | 0 | 2 / 20 / 0 | 0 | 31 |
| sky-events | 9 (9) | 19 | 3 (0) | 0 | 1 (0/0) | 0 | 1 / 5 | 0 | 2 / 17 / 1 | 1 | 32 |
| observation-log | 32 (21) | 71 | 19 (3) | 0 | 3 (0/0) | 0 | 6 / 24 | 1 | 10 / 63 / 0 | 1 | 123 |
| progress | 10 (9) | 28 | 7 (1) | 0 | 3 (0/0) | 0 | 2 / 8 | 1 | 4 / 37 / 0 | 0 | 74 |
| sites-gear | 32 (22) | 65 | 15 (4) | 0 | 5 (0/0) | 0 | 6 / 26 | 0 | 9 / 66 / 0 | 1 | 130 |
| onboarding | 28 (17) | 41 | 6 (2) | 0 | 1 (0/0) | 0 | 3 / 20 | 0 | 2 / 14 / 0 | 0 | 50 |
| accounts | 34 (23) | 60 | 10 (4) | 0 | 3 (0/0) | 0 | 5 / 27 | 1 | 10 / 31 / 0 | 1 | 106 |
| offline | 14 (10) | 30 | 9 (3) | 0 | 2 (0/0) | 0 | 2 / 12 | 1 | 3 / 26 / 3 | 1 | 35 |
| **error-visibility** | 18 (13) | 38 | 13 (3) | 0 | **8 (7/0)** | **4** | 2 / 12 | 1 | 8 / 65 / 2 | **3** | 114 |
| platform (bucket) | 52 (22) | 91 | 12 (2) | 0 | 2 (0/0) | 1 | 0 / – | 0 | 0 | 0 | 0 |
| shared (bucket) | 75 (38) | 210 | 50 (5) | 0 | 6 (0/0) | 0 | 3 / – | 0 | 5 / 9 / 0 | 0 | 36 |

Closed-without-merge PRs: **0 of 183** in every capability (all `MERGED`). Reverts: **0** commits matching `revert|Revert|hotfix|roll back|re-land` (evidence). Human forge reviews: **0** everywhere.

Totals across all changes (evidence): agent plan reviews 54 (398 findings, 17 critical; verdicts: 2 REJECTED, 12 REVISE, 9 NEEDS ATTENTION, 11 clean, 20 with no verdict line); agent impl reviews 72 (472 findings, 2 critical; 2 REJECTED, 41 NEEDS ATTENTION, 28 clean).

## Friction

- **error-visibility is the only capability with open, unresolved discussion** (evidence): 7 of the 9 open issues are its follow-ups (#189 release identity, #190 failure UI / 404/500, #191 GDPR of Workers observability data, #230 inlined-script reports, #232 alerting, #233 status through store faults, #244 throws after streaming starts; ages 0–11 days). Its change ran 9 phases over 6 PRs (#183, #194, #226, #228, #231, #234) and is the only change with fix commits **after** its first merge (6 of 7, 2026-10-16..19). Its reviews: plan REVISE (phases 7–9), impl phase 7 **REJECTED** (1 critical). The 2026-10-15 observability audit behind it listed 33 findings — 4 critical: F1 forecast (Open-Meteo outage invisible), F2 tonight (`load.ts` bare catch), F3 accounts (middleware drops `getClaims` error → auth outage looks like mass sign-out), F4 save routes (sites-gear, observation-log, onboarding, session-plan). Parked in the roadmap: "An external error tracker" (owner's first-party-only limit). PR #245 (stream-error-boundary, for #244) merged today, after HEAD.
- **Open bug / long-open items** (evidence): #178 catalogue — OpenNGC V magnitudes too faint for 12 galaxies (bug, open 12 days; a follow-up change `openngc-galaxy-magnitudes` shipped, issue kept open as "a rule decision", roadmap Parked). #19 engine — Stellarium moon/object fixture values, 6 `test.todo` tests (open 32 days, oldest open item).
- **Second attempts on the same model, via follow-up chains** (evidence from issue titles + change ids): engine/catalogue — #21 ranking calibration (open 24 days) → #159 M31 at 60 mm → `small-scope-galaxies` (#172, roadmap "north star") → #178 → `openngc-galaxy-magnitudes`; the galaxy-brightness rule took 4 changes and is still open. Catalogue licensing — `star-source-switch` (ESA decision; 4 fix commits in one day, 3 PRs) replaced the HYG source; ESA authorisation still pending (handoff 2026-10-26). Sky view — `interactive-sky` → `compass-labels` → `ui-sky-light` → `ui-sky-modes` → `ui-sky-mode-trigger` (5 changes, UI iteration). Observation-log — `verdict-check` → `sky-check-record-cause` (follow-up on the sky-check record).
- **Fix commits are mostly review rounds, not production fixes** (evidence): of 88 `fix` commits, 69 name a review round or finding (`impl review F1-F9`, `Phase 7 impl review`), 23 are `ui-*` scopes (overlapping), only 15 are neither. Same-scope fix bursts (≥ 3 in days): error-visibility 7, ui-user-adjustments 6 (all one day, pre-merge), star-source-switch 4 (one day), testing-forecast-honesty 3 (forecast: "no go on a partial forecast" — a real defect found by the test rollout). Apart from error-visibility, only `tonight-dashboard` and `testing-ranking-invariants…` have one fix each after their first merge.
- **Flakes that changed process** (evidence): #45 (bug) e2e flakes under parallel load → change `parallel-e2e-flakes`; #165 comment: session-plan smoke flake from service-worker activation → lessons "Wait for the service worker with `ready`", "A red `ci` on main blocks the deploy". Attributed to platform/offline; mechanical for capability risk (rule 5).
- Largest PRs (additions+deletions, includes generated/recorded data — size is partly mechanical): #193 star-source-switch 19.9k, #20 F-01+S-02 tonight 19.3k, #161 sky-events 19.1k, #1 bootstrap 14.1k, #155 finder-chart 12.8k.

## Planning attention

- Every change ships a plan: 67 `plan.md`, 64 `plan-brief.md`, 40 `research.md`, 3 `frame.md` across 70 folders (evidence). Planning volume therefore tracks delivery volume (rule 4, shared cause) — it says where work went, not where trouble is.
- **tonight** dominates: 21 primary plans, touched by 45 of 69 changes, 316 review findings, 9 critical plan-review findings (moonlight-and-the-verdict rev1: 2, tonight-verdict-and-ranking, seven-night-site-planner, tonight-dashboard, testing-forecast-honesty, ui-mobile-pass, interactive-sky 2). Inference: much of this is UI re-passes (`ui-user-adjustments` 276 code changes / 58 prose / 4 impl reviews; `ui-fact-rhythm`, `ui-quiet-actions`, `ui-dashboard-tiles`, `ui-tonight-nav`, in-flight `ui-refine`) on the hub page, not defects in the verdict logic.
- **engine**: 8 primary plans, 3 of them test-rollout phases (`testing-night-and-date-boundaries`, `testing-ranking-invariants-and-calibration-oracle`, `testing-access-and-entitlement-boundary`) plus `test-suite-diet` (13 PRs, touches 15 capabilities — primary=engine only by file count; mechanical spillover). Plan-review criticals: ranking-invariants 2, verified-ephemeris-core reviewed NEEDS ATTENTION.
- **Hard-gate verdicts** (REJECTED by the agent rubric): `testing-quality-gates-wiring` plan (error-visibility/platform), `finder-chart` plan (finder, 15 findings), `sky-events` impl (critical: close pairs), `error-visibility` impl phase 7. `offline-night-plan` plan: REVISE with 3 critical findings.
- Recent attention (plans dated ≥ 2026-10-15, M-4): tonight 3, engine 3, sky-view 3, catalogue 2, accounts/observation-log/progress/offline/error-visibility 1 each. No M-5 is open (handoff 2026-10-26).
- Roadmap Parked (evidence): payments/"ready to charge", external error tracker, admin for plans, own finder, double stars (#68, no data source), offline logging with sync, preview environments, shared forecast cache, gear/log row icons (`ui-log-progress-gear`, #171 dropped). Lessons (15) cluster on error-visibility/logging (4: no-console, swallowed catch needs a line), offline/service worker (2), e2e/clock (3), accounts plan gating (1).

## Debt markers

`TODO|FIXME|HACK|XXX` (word-boundary, upper case) over every tracked non-docs, non-noise file at HEAD: **0 in all 17 capabilities** (0 per 1000 lines; `rg -c` confirms no hits in `src tests scripts supabase .github .claude public`). Debt is not kept in code comments here: it lives in GitHub issues (9 open), roadmap Parked, `follow-ups/` folders (7 files in 7 changes) and `test.todo` placeholders (`src/lib/engine/sun.test.ts` → #19). A guard test (`src/lib/e2e-clock-guard.test.ts`) forbids `test.skip`/`fixme` in e2e (evidence). Lines at HEAD for normalisation are in `.work/disc-analysis.json` (`debt`).

## Mechanical signals

- PR and commit counts for tonight, shared, platform: hub page / design system / CI touched by most changes (39 of 57 tonight PRs and 38 of 75 shared PRs are cross-cutting) — rule 4/2.
- Fix share everywhere: 73 of 88 fix commits are agent-review rounds or UI polish applied before merge — rule 5; not evidence of broken capabilities.
- Plan count and prose churn (533 for tonight, 254 engine): every change ships plan + reviews by workflow — rule 8 and rule 4; reported as discussion, never as hot code.
- `test-suite-diet` (13 PRs, 476 code changes, 15 capabilities) and `fix(ui-quiet-actions): implementation review F1-F9` (144 files): single cross-cutting efforts that inflate PR/fix counts of small capabilities — rule 12.
- error-visibility's busy-ness (18 PRs, 13 fixes, 8 issues) shares a cause: it was being built in 9 phases in M-4 and every phase got an agent impl review — rule 4. What survives the demotion: 7 open follow-ups and the audit's critical findings, which sit in other capabilities (forecast, tonight, accounts, save routes).
- Primary attribution of UI-wide changes leans to tonight by file count (e.g. `ui-foundation` → sites-gear, `planets-on-tonight` → observation-log) — attribution artefact, inference.

## Unknowns

- No human code review is recorded anywhere (0 forge reviews, 0 human comments identifiable as review). Whether the owner reads diffs before merging is not observable; the owner's triage of agent reviews is the only human review signal.
- Production error tracking: first-party only (Workers Logs + `/api/client-error`, per `context/deployment/error-visibility.md`, audit, roadmap Parked "external error tracker"). Live production errors and alert history are not visible to this scan.
- Issue → capability mapping is by title (inference); the 7 open error-visibility issues are cross-cutting work whose fixes land in other capabilities' files.
- Owner checks still open outside the forge (handoff 2026-10-26: S-07 6.5–6.7, iPhone Safari swipe/VoiceOver, #178 data checks, ESA answer, IAU MDC email) — not counted as issues.
- `context/changes/ui-refine` (in flight) has no reviews yet; its PR attribution (#163, #164) comes from title matching and belongs to `ui-quiet-actions` — counted for both.

Commands run: `gh pr list --state all --limit 300 --json …,reviews,comments,…`; `gh issue list --state all --limit 300 --json …`; `git log --merges -m --first-parent --name-only HEAD`; `python3 -I .work/attribute.py` (via `disc_analyze.py`); `grep` over `git-log.txt` subjects for revert/hotfix/fix; `find`/`grep` over `context/archive/*/reviews/*.md` for Verdict/Findings/`### F`; `awk` over the observability audit findings table; `rg -c 'TODO|FIXME|HACK|XXX'`; `grep -nE '^#'` over lessons, roadmap, handoff.
