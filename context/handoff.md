# Handoff — 2026-10-15 (M-3 closed, M-4 opened)

What Sidereus looks like now, and what the next session should do. Read this first. The sections below the first one are older context, and their "next steps" are superseded.

## Update 2026-10-20 (sky-check-record-cause, #235)

**Shipped:** the bare `tonight.sky-check-record failed` line now carries its cause: PR #235 merged (main `a257f6c`), archived in `context/archive/2026-10-20-sky-check-record-cause/`. A request that never completed logs `code: request`, a response with a status and no PostgREST body logs `code: http` and its status, a class 22/23 result keeps its code; only `skyCheckStore.record` threads the response. **#233 stays open** (the same hole in the other 35 call sites, 9 files). **Owner lookups pending, they settle why the record took about 6 s** (nothing proves the 5 s fetch guard yet): Supabase Dashboard -> Logs -> API Gateway for `POST /rest/v1/rpc/record_sky_verdict` on 2026-10-20 08:45:01-08:45:07 UTC (and the Postgres logs of that minute), and the 7-day Workers Logs count of `sidereus: tonight.sky-check-record failed` against the `TonightContent` loads; after the deploy a later occurrence should carry a `code`. The archived plan's manual rows 3.3-3.6 are left unchecked on purpose.

## Update 2026-10-20 (error-visibility, S-07 #175)

**Shipped:** M-4 S-07 is done: nine phases merged and deployed (#183, #194, #226, #228, #231; main `7e9d65b`), archived in `context/archive/2026-10-20-error-visibility/`. The roadmap's S-07 row is `done`; the milestone is not closed here (the orchestrator closes M-4 with the owner). Runbook: `context/deployment/error-visibility.md`.

**Owner's production checks, 2026-10-20** (live Worker version `6aa032a5`, `wrangler tail`):

- 7.8 PASS: the rate-limit binding exists (30 requests/60s); a hand-posted valid report left exactly one warn line `sidereus: client.island.geocode noted`, no `config.rate-limit` line, no Issue; a chunked upload cut off client-side never reached the Worker.
- 7.9 answer NO: a saved Workers Logs query cannot alert. Recorded in runbook section 8 and D13: **no automatic alert for client-side reports; the owner reviews the saved query `sidereus: client.` (Count) by hand once a week.** Cloudflare's custom alerts (beta) are untested: follow-up #232.
- 8.7 PASS (Chrome, simulated storage quota): one `sidereus: client.sw.island-commit noted` line; the worker's POST answered 204, same-origin, not cancelled; an offline reload sent nothing.
- 9.7 PASS (live console): a rejected promise left exactly one `client.island.unhandled-rejection noted {name}` line with no message text; a thrown error typed in the console left none.

**Open owner to-dos** (archived plan rows, left unchecked on purpose): 6.5 create the Issues automation (a deliberate forecast failure reaches the target as an Issue, a second step is its own Issue, a stale-id update leaves a warn line and no Issue); 6.6 one line per flow and a console line's own metadata hold no coordinate, email, key or form value; 6.7 if a line does not become an Issue, use the fallback query and record the gap.

**Open follow-ups:** #189 (release identity in logs, D6), #190 (failure UI: island fallback, 404/500, plan-unknown, finder eyepiece notice, D7), #191 (GDPR position of Workers traces), #230 (errors from Astro-inlined scripts), #232 (alert on client reports via Cloudflare custom alerts, beta).

**Found by the live tail during the checks:** a bare `tonight.sky-check-record failed` line. It is being fixed in the separate change `sky-check-record-cause` (branch `fix/sky-check-record-cause`).

---

## Update 2026-10-19 (openngc-galaxy-magnitudes, #178)

**Shipped:** PR #227 merged and deployed (main `dd58f55`), archived in `context/archive/2026-10-19-openngc-galaxy-magnitudes/`. Twelve galaxies (M58, M61, M88, M91, M98, M106, IC 342, NGC 4449, NGC 5005, NGC 4565, NGC 6822, NGC 4039) had an impossible V (B−V below 0.2: OpenNGC's V is HyperLEDA's `vt`, or the generator copied B). `catalogue:build` now sets `V = B − the median B−V of the catalogue's own credible galaxies of the same Hubble group` (no new source), and lists each correction as an `overrides` entry (`vMagColour`) in the two metas; pins and a no-galaxy-below-0.2 guard keep it honest. The four engine oracles were not edited. The `KNOWN_DIVERGENCES` cap went 3 → 4 for one new entry (M106 at 150 mm / Bortle 6), by the owner's permission.

**#178 stays open, the owner decides whether to close it:**

- M106 at 150 mm / Bortle 6 (the issue's own case) is still `faint`: the deficit is 1.61 against the 1.5 edge, the brightness credit stays at 0.1, and its rank and total did not move. At Bortle 5 it is now `smudge` (rank 60 → 42 on 2026-10-10). The published V (8.4) would give 1.45 and the rule gives 8.56.
- #178 asks for galaxy references at 150 mm / Bortle 5-6; only M106 was added. M61 has no source that settles `galaxySmudge` against `galaxyFaint`.
- The NGC 4449 and NGC 4565 corrections rest on a B that may itself be about 0.5 and 0.4 mag too bright (NED's magnitude is fainter); the metas say so.

**Open owner checks** (archived plan rows, left unchecked on purpose): 1.5 the six published V values against their SEDS and SIMBAD pages; 2.8 and 2.9 the 12 `vMagColour` entries and the `LICENSE-DATA.md` paragraph; 3.6 the new M106 references and the divergence cap log; 3.7 M106's line on `/tonight/targets` at 150 mm, Bortle 5 (April evening) and Bortle 6 (2026-10-10).

---

## Update 2026-10-17 (owner polish)

- S-09 `ui-sky-modes` merged (#212, GitHub #213) and archived; S-12 app-icon merged (#217, GitHub #216) and archived; S-10 `ui-quick-nav` merged (#220, GitHub #214) and archived; S-11 `ui-progress-rewards` merged (#224, GitHub #215) and archived. All four owner UI requests (S-09 to S-12) are done. The badge-art generator lives in `scripts/badge-art/` (`npm run badge-art:port` ports the art into `src/components/progress/badge-art`, `npm run badge-art:render` renders it).

### Open owner checks

- ui-quick-nav, iPhone Safari swipe (archived plan rows 3.4, 3.5): each bottom sheet follows the finger, snaps back, closes on a flick; the quick-nav list scrolls without moving the sheet and a drag from its top closes it; with Reduce motion on, no follow and a long swipe closes at once.
- ui-quick-nav, VoiceOver (archived plan row 2.7): "Szybka nawigacja", collapsed and expanded, "bieżąca strona" on the current row.
- ui-progress-rewards (S-11), on devices: red mode at night on a phone (badges and tiles told apart by shape); VoiceOver on a tile and on the new Caldwell heading and its toggle; the live celebration dialog after a real save, including the smaller names in a multi-milestone dialog; and the open question whether a tile with no common name should show its type as its name.

---

## Update 2026-10-17 (test-suite-diet, supersedes the test-running lines below)

**The test suite was cut and re-organised (`context/changes/test-suite-diet`, PRs #197-#207 and the Phase 7 and 8 PRs).** Read `implementation-notes.md` there for the per-phase counts, the pin ledger and the break proofs; `context/foundation/test-plan.md` §6.6 has the before and after.

- **Two Vitest projects.** `npm run test:reference` (fast, 108 files / 761 tests, about 4 s; what the end-of-turn hook runs) and `npm run test:guards` (the static guards, the e2e clock guard and the catalogue provenance pins, CI only); `npm test` runs both (122 files / 813). Unit tests went from 3,056 to 813; e2e from 88 to 56 tests; db named tests from 118 to 100; smoke from 45 to 64 steps.
- **E2E on a pinned clock.** No e2e or smoke step reads the real hour or date: every spec imports `test` from `tests/e2e/helpers.ts`, whose automatic fixture pins the browser and the server (the loopback-only cookie `sidereus-test-now`, `src/lib/clock.ts`) to a moment of `tests/e2e/clock-scenarios.mjs` (default `evening`; `E2E_CLOCK=deepNight|civilDawn|...` changes the default; the service worker specs and `site-map` stay real, with reasons). Smoke takes `SMOKE_CLOCK`. `src/lib/e2e-clock-guard.test.ts` enforces it. Never add a date-conditional skip.
- **Owner-accepted gaps** (test-plan §7): the compass mapping, `Accept-Language` negotiation, a longitude echo in a schema message, the committed catalogue JSON's shape (the generators assert it at regeneration). `agent-hooks.test.ts` keeps the EPIPE regression pin (PR #156).
- **Local runs** the way CI does them: a fresh `npm run build`, the forecast fixture (`node tests/e2e/forecast-fixture.mjs`, port via `FIXTURE_PORT`), the preview, local Supabase, the keys inline on the command (never exported); the lessons name the rest.
- **One open S-06 note:** the auth smoke steps assert only the `?next=` continuation and the off-site refusal; whichever of S-06 (`feat/auth-loose-ends`) and these lands second rebases.

---

## Update 2026-10-16 (S-05 evening-showpieces, supersedes the S-05 line below)

**S-05 `evening-showpieces` (#173) is implemented on `feat/evening-showpieces` through Phase 4 and awaits the reviewer's `/10x-impl-review`. There is no PR yet.** Plan: `context/changes/evening-showpieces/plan.md`; what each phase did and every edited pin: `implementation-notes.md` there.

What changed:

- **Window edges.** A deep-sky window opens and closes at the true crossing of the minimum altitude (`refinedWindow` in `objects.ts`), not at the 10-minute sample; planet and Moon windows are unchanged. Scores still read the grid samples, so no rank moved. A Skyfield + DE421 fixture (`scripts/deep-sky-reference.py`, all 171 objects on Warsaw 2026-04-15, 07-15, 10-15) and `window-reference.test.ts` hold every edge within 5 min and 1°, and the final top 5 of each night too (PRD criterion 2, ephemeris leg).
- **Duration** saturates at a useful span: `min(1, windowMinutes / 120) × mean placement` (`DURATION_USEFUL_SPAN_MINUTES`, named candidate). Oracle overlap is 3 to 4 on all four calibration nights, the AF check is green.
- **Reasons.** The moon and sky reasons appear only when the listed entries differ on them (`REASON_MIN_SPREAD` = 0.05), and a component is named only when the entry is at or above the list mean; a reason line may carry one phrase.
- **Docs.** CLAUDE.md Engine paragraph, PRD Open Questions 1 and 9 (dated notes), the fixtures README.

**Known divergence OD-1 (owner decision, 2026-10-16):** in October M13 ranks about #31, M15 #19 and M57 #46, outside the top 5. The structural penalty is gone, and a rank-only bonus for globular clusters and planetary nebulae is not part of this change.

**Owner's remaining checks:**

- Sign off S-03 item 2.5 (Messier bonus and the four top-10 snapshots) from `context/changes/evening-showpieces/evidence/calibration-after-s05.md`.
- Read `context/changes/evening-showpieces/evidence/prd-criterion-2.md` (rules, agreement summary, the OD-1 divergence).
- First-nights spot check: M13 and M57 windows on `/tonight/targets` match your planetarium, and no reason line mentions moonlight on a new-Moon night.

**Next:** `/10x-impl-review evening-showpieces`, then the PR (the lead runs the whole e2e suite and smoke first).

---

## Update 2026-10-15 (supersedes every next step below)

**M-3 "Find it and keep going" is closed.** S-08 adjustable-session-plan (#165) was the last slice. The closure check against PRD v3 is in the roadmap's Milestone History, and three new rules are in `lessons.md`.

**M-4 "Finished and trustworthy" is open** (`context/foundation/roadmap.md`, owner's decisions of 2026-10-15). It brings no PRD change. Main goal: quality. North star: S-04.

| Slice | Change ID                                                          | Issue | Board status |
| ----- | ------------------------------------------------------------------ | ----- | ------------ |
| S-01  | `ui-dashboard-tiles`                                               | #169  | in-progress  |
| S-02  | `ui-tonight-nav`                                                   | #170  | ready        |
| S-03  | `ui-log-progress-gear`                                             | #171  | proposed     |
| S-04  | `small-scope-galaxies` (#159 + #21 item 3)                         | #172  | ready        |
| S-05  | `evening-showpieces` (#21 items 1, 4, 5 + PRD Primary criterion 2) | #173  | proposed     |
| S-06  | `auth-loose-ends` (ui-auth D1, D2)                                 | #174  | ready        |
| S-07  | `error-visibility` (first-party only)                              | #175  | ready        |

- The PRD's hard deadline of **2026-11-04** still holds. **Cut order** (owner): drop S-06 first, then S-03, then S-01.
- **S-07 uses first-party tools only:** Workers Logs, Cloudflare alerts and `/10x-observability-audit`. No new third party.

**Running now:** S-01 `ui-dashboard-tiles` (`ui-refine` agent, branch `feat/ui-dashboard-tiles`, umbrella `context/changes/ui-refine/`). `ui-fact-rhythm` is merged (#167) but its archive is still pending.

**Next:** `/10x-plan small-scope-galaxies` (S-04, the north star), with S-02 `ui-tonight-nav` through `/10x-ui` in parallel.

**Owner to-dos (unchanged):**

- ESA's answer to the follow-up on direct use of Hipparcos V1 (PRD Open Question 21; the owner sent it 2026-10-16);
- the IAU MDC courtesy email;
- the moonlight post-merge checks after 2026-10-22.

---

## Earlier: Handoff — 2026-10-14 (S-04 and S-07 shipped)

## Update 2026-10-14 (supersedes every next step below)

**Shipped** (check the post-merge `ci` on main before trusting a deploy):

- **S-04 what-to-expect** (#125): merged as #158, archived in #160 (`context/archive/2026-10-14-what-to-expect/`). Follow-up **#159** (open): M31 at 60 mm reads "very faint" beside "bright for your 60 mm" (core brightness).
- **S-07 sky-events** (#128): merged as #161 (main 1389bc1), archived in the `chore/archive-sky-events` PR, which closes #128 and carries this handoff (`context/archive/2026-10-13-sky-events/`). It covers the next 30 nights from the pure engine:
  - eclipses, Mercury and Venus elongations, Mars, Jupiter and Saturn oppositions;
  - close pairings (≤5°, topocentric);
  - 8 meteor showers.

  The events show on `/tonight/events` (stored offline), on the dashboard's second tile, and as a muted line under the verdict on event nights. A solar eclipse stays on Tonight until its partial phase ends ("Today/Tomorrow, 11:22").

**Owner to-dos:**

- **ESA licence** for the Hipparcos stars (PRD OQ21): ESA replied on 2026-10-16 (it cannot authorise HYG-derived files; it can assess direct use of Hipparcos V1), and the owner sent the follow-up the same day, including the RAhms/DEdms sentence for the ten stars without an astrometric solution. V1 direct is in place (S-08 `star-source-switch`, `LICENSE-DATA.md`). No payment before ESA authorises in writing; SAO is the reverse path if ESA refuses.
- **IAU MDC courtesy email**: still the owner's to send (draft `context/archive/2026-10-13-sky-events/iau-mdc-request.md`).

**Next:**

- **UI refinement**: the audit and its split live on `feat/ui-refine`, not yet on main. Next comes `ui-quiet-actions`, whose plan is under review.
- **M-3 S-08 adjustable-session-plan** (#129) is not started.
- Leftover local branch `feat/ui-auth`: `-D` only with the owner's OK.

**Lesson from S-07** (in the roadmap's Done entry): a coarse sampling grid misses short visibility windows (twilight pairings, impl review F1). Pin a scan against a brute-force reference over fixed windows.

---

## Earlier: Handoff — 2026-10-13 evening (S-06 and S-03 shipped; S-07 planned and plan-reviewed)

## Update 2026-10-13 evening (supersedes every next step below)

**Shipped and live** (production https://sidereus.sidereus.workers.dev, deployed by main CI run 38412547105):

- **S-06 observing-milestones** (#127): merged as #153, archived in #154 (`context/archive/2026-10-11-observing-milestones/`). 11 milestones in the `observing_milestones` table (RLS; self-only inserts accepted and pinned), celebrated once at save in a modal dialog (variant C), listed on `/log/progress`. e2e saves rated 3+ must call `dismissCelebrationIfOpen` (`tests/e2e/helpers.ts`).
- **S-03 finder-chart** (#124): merged as #155. `/tonight/finder?object=…` behind the full plan (page and island both gated), Hipparcos stars to mag 7.5 (server-only; HYG v4.1 until S-08 `star-source-switch` replaced it), offline charts, zenith edge arrow. The owner did every manual check on 2026-10-13.
- **EPIPE flake fix**: #156. `src/lib/agent-hooks.test.ts` `run()` now ignores EPIPE on `child.stdin`; a deterministic test pins it.

**Awaiting the owner's merge:** **#157** `chore/archive-finder-chart`, the S-03 archive. It closes #124 and carries this handoff. After it merges, `git checkout main && git pull` in the main checkout and delete that branch.

**Next: S-07 sky-events (#128), ready to implement.**

- Worktree `.claude/worktrees/sky-events`, branch `feat/sky-events` (local only, not pushed), on main 998b30f. The plan is `context/changes/sky-events/plan.md`, plan-reviewed (`reviews/plan-review.md`, F1–F7 applied), last commit 5d81fc0. `change.md` is `plan_reviewed`.
- Rebase onto origin/main first (#157 is docs only), run `npm ci` there, then `/10x-implement sky-events` phase by phase. Ports: preview 4333, forecast fixture 4400.
- The owner's decisions, all recorded in the plan:
  - meteor data is a hand-written fact list of about 10 showers: peak night and rate from NASA (public domain), radiant and speed from IAU MDC, peak λ computed by our engine. The optional IAU MDC email draft (`iau-mdc-request.md`) is the owner's to send;
  - a close pairing is ≤5°, topocentric, at the closest moment when both bodies are visible;
  - events are visible from 10°, eclipses from 2° (labelled "low, needs an open horizon");
  - notable = every visible event except penumbral eclipses, with no Uranus or Neptune oppositions;
  - the events tile goes straight after the Targets tile, and a muted line sits under the verdict on event nights only. The owner accepts the one-line layout shift. `tonight-phone.spec` must not depend on the date.
- The plan's eclipse tests use future eclipses only (2027-08-02 solar, 2028-12-31 and 2027-02-20 lunar).

**Still open beyond M-3's slices:**

- ESA's answer to the owner's follow-up on direct use of Hipparcos V1 (PRD OQ21; ESA replied 2026-10-16, the follow-up draft is `context/foundation/licensing/esa-reply-2026-10-16-draft.md`). The star files already come from V1 direct (S-08). No payment before ESA authorises in writing; SAO is the reverse path if ESA refuses.
- M-3 S-04 what-to-expect (#125) and S-08 adjustable-session-plan (#129) are not started.
- A local branch `feat/ui-auth` is left behind: its worktree is removed and its commits are in main, but `git branch -d` refused because of a stale upstream. Delete it with `-D` only with the owner's OK.

**Lessons from this run** (also in `context/foundation/lessons.md`):

- Before any PR, run the WHOLE e2e suite and smoke locally, the way CI does. #153 failed smoke because an older spec met the new modal dialog.
- A red `ci` on main means **no deploy**: always check the post-merge run. #155 sat undeployed until #156's run.
- Fix a flake with a failing-first test in its own change, never with retries.
- Never put the owner's email or other personal data in requests to external services (User-Agent included); use the repo URL as the contact.

**Working setup** (herdr orchestrator plus agents; details in the orchestrator's memory):

- herdr agents: `finder-chart` (w2), `sky-events` (w3), `reviewer` (w4, Opus), all idle. A fresh session may restart them.
- `~/projects/.claude/settings.json` allows `herdr agent *`, `herdr notification *` and localhost curl; `curl *` is no longer an ask rule. Running agent sessions pick that up only after a restart.
- The owner wants decisions asked through interactive question batches (≤4 per call), in Polish for plan, research and review questions.

---

## Earlier: Handoff — 2026-10-09 night (test rollout Phase 4 merged and archived)

## Update 2026-10-09 night (supersedes every next step below)

- **Test rollout Phase 4** ("Access and entitlement boundary", Risks #5 and #6) is **done**: merged as **#147** (2026-10-09 19:41 UTC) and archived to `context/archive/2026-10-09-testing-access-and-entitlement-boundary/`. The archive PR (branch `chore/archive-testing-access-and-entitlement-boundary`) also points test-plan §3 Phase 4 at the archive. **It awaits the owner's merge.**
- What landed:
  - `tests/db/structure.test.ts` reads the catalogs over `DB_URL` and fails on any unclassified `public` table, a per-user table without RLS or its four policies, a server-owned table with more than `authenticated` SELECT (column grants included), a view without `security_invoker`, a materialized view or foreign table, and a definer, `search_path`-less or anon/PUBLIC-executable function.
  - `tests/db/tables.ts` holds `TABLES` and `SERVER_OWNED`; isolation covers anon writes and pins cross-user inserts and hand-overs to `42501`.
  - `no-console` is an error in all of `src`; `src/lib/no-console-guard.test.ts` proves it per file and allowlists disables by file, count and reason.
  - Smoke pins the invalid-latitude redirects exactly. Test-plan §6.4 is the recipe for the next table, RPC or full-plan route (S-03's first route brings the HTTP refusal test).
- **Open follow-up (impl review F3):** client `<script>` blocks in `.astro` files are not linted at all: the type-aware parser fails on the plugin's virtual file and the error is dropped. Recorded in CLAUDE.md, test-plan §6.4 and the guard header. The fix is planned in the archived `follow-ups/review-fixes.md`; open it as its own change (or fold it into test rollout Phase 5).
- **Next:** test rollout Phase 5 ("Quality-gates wiring") via `/10x-test-plan`, or the M-3 slices; S-05 work runs in parallel in `.claude/worktrees/observing-progress`.
- Local smoke runs need `.env`/`.dev.vars` pointed at local Supabase. Ask the owner (or the orchestrator) before switching them; they point at hosted.

---

## Earlier: Handoff — 2026-10-09 evening (test rollout Phase 3 merged and archived; Phase 4 research partial)

What Sidereus looks like now, and exactly what the next session (possibly the **other Claude account**) should do. Read this first, then `context/changes/testing-access-and-entitlement-boundary/research.md`. To save tokens, read only what each step names.

## Update 2026-10-09 late evening (supersedes the Phase 4 next steps below)

- Phase 4 research is **complete**: the Risk #6 sweep was re-run and found no live lint gap or URL leak. It also found that `warn` is unenforced in CI, and it recommends a repo-wide `no-console: error` plus a guard test that reads the resolved config (see `research.md`). `change.md` is `preparing`, and test-plan §2 (Risk #5/#6 guidance) is backported.
- Owner decisions: the self-only direct writes are **accepted for now, to revisit later**, and **Phase 4 waits for F-01 `account-plans`**. Test-plan §3 Phase 4 reads `researched (waits for F-01)`.
- **Next:** F-01 `account-plans` (roadmap, GitHub #121) via `/10x-new`. Its plan must not add an owner-writable `plan` column: it needs column grants, a trigger or a separate table. After F-01, resume Phase 4 at `/10x-plan testing-access-and-entitlement-boundary`.

## State of play

- **Test rollout Phase 3** ("Ranking invariants and calibration oracle"):
  - Merged as **#142**, then archived to `context/archive/2026-10-08-testing-ranking-invariants-and-calibration-oracle/`.
  - The **archive PR #143** (branch `chore/archive-testing-ranking-invariants-and-calibration-oracle`) also sets test-plan §3 Phase 3 to `complete`. **It awaits the owner's merge.**
  - #21 got the short-window comment, posted with the owner's OK.
- **Test rollout Phase 4** ("Access and entitlement boundary", Risks #5 and #6):
  - Branch `feat/testing-access-and-entitlement-boundary`, cut from the archive branch, so its diff shows #143's commits until #143 merges.
  - Change folder `context/changes/testing-access-and-entitlement-boundary/`: `change.md` (status `new`) and **`research.md` with `status: partial`**.
  - Test-plan §3 Phase 4 is `change opened`.
  - **No PR yet** for this branch; it is pushed.
- **What the research found** (details and anchors in `research.md`):
  - **Account plans (roadmap F-01) don't exist in code.** The plan half of Risk #5 is speculative today: "can't change own plan" and "free refused on full-plan routes".
  - **Cross-user isolation holds** and is mostly tested in `tests/db/isolation.test.ts`, with positive controls.
  - **Gaps:**
    - anon INSERT/UPDATE/DELETE are untested;
    - cross-user writes are asserted as "an error", not `42501`;
    - no structural check that every table has RLS and four policies;
    - no column-level grants anywhere, so owners can directly rewrite server-decided fields in their own rows: `sky_checks` headline, `dark_start` and answered rows; `record_sky_verdict` takes a caller-chosen `dark_start`; `observations` future nights. All of this is self-only, and verdict-check accepted anti-tamper as out of scope.
  - This matters for F-01: a `plan` column on a user-writable table would be owner-writable by default.
  - **Risk #6 is only partly grounded.** The no-console scope is still a hand-kept glob list (`eslint.config.js:84-109`). The code sweep that lists coordinate-touching modules outside it was **stopped unfinished**.

## Next steps

Start the session **from `~/projects`** (where the shared `/10x-*` skills load).

1. `cd sidereus && git fetch && git checkout feat/testing-access-and-entitlement-boundary && git pull`. If #143 has merged, `git merge origin/main` (or rebase) first.
2. **Finish the research.** Re-run only Open Question 1 of `research.md` (the Risk #6 code sweep) with one Opus worker. Then append its findings and set `status: complete`. Don't redo the Risk #5 or history work.
   - The brief: trace modules that receive `SiteRecord` / `Site` / coordinates by type and import; list those outside `gearConfig.files`; audit every redirect and URL construction and the tests that pin `?error=` keys; assess an automatic check (module graph ⊆ lint scope, or a repo-wide error default with listed exceptions). Never grep for "lat".
3. **Ask the owner** (send a PushNotification first), in Polish since these are research and plan questions:
   - Open Question 2: keep the self-only direct writes as accepted and pinned, or harden them with column grants or a trigger (a product change)?
   - Open Question 3: run Phase 4 now for isolation plus coordinates and defer the plan half to F-01, or wait for F-01?
4. Run the post-research backport to test-plan §2 (Risk #5: the plan half depends on F-01; add the column-privilege challenge). Run `node <10x-research skill dir>/scripts/metadata-guard.mjs mark-researched …`, then set §3 to `researched`.
5. `/10x-plan testing-access-and-entitlement-boundary`, then `/10x-plan-review`, then `/10x-implement`, run like Phases 1–3:
   - delegate each phase to a Sonnet subagent with high effort and the `nvm use` prefix;
   - keep the gates, break checks and commits in the main session; commit without approval;
   - finish with `/10x-impl-review` using Opus agents;
   - the tests/db suite needs Docker plus `npx supabase start`.

## Git state (end of this session)

- `main` is at baa1b1a (#142 merged).
- `chore/archive-testing-ranking-invariants-and-calibration-oracle` (PR #143) has 3e50b4f (the archive) and the test-plan §3 Phase 3 commit.
- `feat/testing-access-and-entitlement-boundary` has 6d65ac2 (the folder and §3 `change opened`), plus the partial research and this handoff.
- `stash@{0}` ("Auto stash before checking out origin/main") is old and was left alone.
- Untracked and **never committed**: `.mcp.json` and `.claude/`.
- Five old worktrees under `.claude/worktrees/` (the S-02 one and four `agent-*` ones) can be removed, but only with the owner's OK.

## Also still open (unchanged from before)

- S-03 calibration sign-off (Progress 2.5 of `context/archive/2026-10-06-deep-sky-beyond-messier/`), #21 calibration work.
- S-12: 12 manual rows and the phase 4–5 impl review were never done. Delta Optical has no catalogue entries.
- moonlight-and-the-verdict post-merge checks after 2026-10-22 (`context/archive/2026-10-02-moonlight-and-the-verdict/follow-ups/review-fixes.md`).
- ui-auth deferred: D1 (signed-in visitors see the auth forms) and D2 (sign-up doesn't carry `next`).
- Roadmap Open Question 1: whether to bump the PRD to v3. S-09's phase 1 adds only a dated amendment, not v3.

**Hard constraints (all UI work):**

- Colours only from tokens (`no-hardcoded-colors.test.ts`). A new token needs a value in every theme block, and the red theme has zero green and blue (`red-theme.test.ts`).
- WCAG AA contrast in all three themes, with focus visible everywhere.
- EN and PL copy: Polish runs longer, and every string goes through the i18n catalogue.
- Phone first (390 px).
- Coordinates never go into URLs or logs.
- Tonight's pages are server islands and need JavaScript (lessons.md).

## Things a new session should know

- **How the user works** (also in the auto-memory):
  - Ask only for permissions and UI decisions. Decide non-UI choices yourself and record them as delegated. **Exception seen in S-06:** for a big architectural slice the user asked for _more_ questions than proposed, including technical ones. So offer a higher question budget on HIGH-complexity plans.
  - Send a `PushNotification` before every question.
  - Keep new tests modest ("we've got loads of them already", S-08): pin only what screenshots can't show.
  - Run manual checks yourself (a local preview against local Supabase, plus Playwright screenshots in EN/PL, dark/light/red, phone/desktop) and tick them with evidence.
  - Never commit to `main` or merge without case-by-case approval. Feature-branch pushes and PRs are pre-approved. Close-out and archive commits go on a `chore/archive-<change-id>` branch with a PR.
  - Mirror progress on GitHub Projects board #1. Check `gh auth status` first; the token needs the `project` scope.
- **Subagents:**
  - Give them the prefix `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use >/dev/null &&`.
  - Check their footprint after about 5 minutes. A heavy Opus phase may write nothing for 10+ minutes while it reads. Check its transcript size is still growing before calling it stalled.
  - Forbid git-state changes; the main agent stages and deletes files itself. Don't use `rm -rf` in commands: the user's permission rules refuse it.
- **Build:** always `npm run build`, never `npx astro build` alone. The `postbuild` step bundles `dist/client/sw.js`.
- **Local e2e recipe** (CI does the same in `.github/workflows/ci.yml`):
  1. `npx supabase start`.
  2. `FIXTURE_PORT=4400 node tests/e2e/forecast-fixture.mjs &`.
  3. `npm run build`, then write the local `SUPABASE_URL` / `SUPABASE_KEY` (from `npx supabase status -o env`: `API_URL`, `ANON_KEY`) and `FORECAST_BASE_URL=http://127.0.0.1:4400` into **`dist/server/.dev.vars` only**. Preview reads that copy, so the repo's `.env` / `.dev.vars` stay untouched. Every build overwrites the copy, so rewrite it after each rebuild.
  4. `npx astro preview --port 4321`. Astro 7's preview detaches as a daemon; stop it with `npx astro preview stop`. Rebuild after any source change.
  5. `SUPABASE_URL=$API_URL SUPABASE_KEY=$ANON_KEY BASE_URL=http://localhost:4321 npm run test:e2e`. The sky-checks and offline specs need the Supabase variables.
- **Testing offline:** Playwright 1.55's `context.setOffline` does **not** reliably cut the service worker's own fetches. To be truly offline, stop the preview (`npx astro preview stop`) for manual checks; the e2e closes a proxy in `tests/e2e/offline.spec.ts`. Always assert `html[data-from-device]` before trusting an offline result (lessons.md).
- **Scratch Playwright scripts:**
  - Scripts for manual screenshots can live in the scratchpad if they load Playwright with `createRequire(process.cwd() + "/package.json")` and run from the repo root.
  - Scripts that import `@/` modules or `tests/e2e/helpers` must sit under `tests/e2e/`. Delete them after use.
  - `onboardInMadrid` uses English labels, so set the Polish cookie only after onboarding.
- **Background processes stop after 2 hours.** Start the forecast fixture inside the same foreground command as the tests (`node tests/e2e/forecast-fixture.mjs & FIX=$!; …; kill $FIX`) rather than as a long-lived background task.
- **Tonight is a server island**, and so is each `/tonight/*` page. Wait for `[data-sky-headline]`, `section[aria-labelledby="verdict-heading"]`, `[data-offline-copy]` or the page's own section before asserting on island content in e2e; a skeleton already renders the title and back link.
- **Port 4321 must be free before `astro preview`.** A leftover `astro dev` (or an old preview daemon from an earlier session) on 4321 serves the wrong build. Check with `npx astro preview status` / `lsof -iTCP:4321 -sTCP:LISTEN`.
- **CI:**
  - **`smoke` setup flake:** the job's `supabase/setup-cli` sometimes fails with "rate limit exceeded". Re-run only the failed job: `gh run rerun <id> --failed`.
  - **Slow runners:** a PR run can take 40 minutes on a slow runner (`npm ci` 6 min, local Supabase 12 min) without anything being wrong.
  - **Supabase CLI pin:** the CLI is pinned in `ci.yml`, now **2.119.0** (#111). On 2026-10-06 the pinned 2.117.0 started failing `migrate` at `supabase link` with "FGA Authentication Error. Unauthorized", even with a new full-access token. Bumping the pin fixed it. If `migrate` fails on auth again with a valid token, try the latest stable CLI before anything else.
- **Hosting:** Workers Paid since 2026-09-30. Production is https://sidereus.sidereus.workers.dev.
- **Untracked `.mcp.json`:** leave it out of commits (the user's choice).
- **Docker must be running** for `npx supabase start`, `test:db`, smoke and e2e. On 2026-10-06 it was down, so the S-03 review fixes were verified by unit tests and CI only.
- **Lint:** `npm run lint` can run out of memory. `npx eslint . --ignore-pattern '.claude/**'` is equivalent. There are 3 known `no-console` warnings in engine test files; they are intentional (budget logs and the calibration snapshot).
- **Background `astro preview`** looks like a hung task to the user. Stop it as soon as the screenshot or e2e step ends, and say that the task is the server.

## Open issues worth knowing

- **#21:** ranking calibration. Items 1, 3 and 4 are open. The sky-check tally and the S-03 calibration snapshot are the evidence so far.
- **#19:** Stellarium fixtures. The Moon and planets use Skyfield references instead.
- **#73:** S-09, the last M-2 slice: unblocked 2026-10-07, planned and plan-reviewed, board = planning. The board's Stream field has no option for S-10's stream E, so #86 has no Stream value.
- **A real VoiceOver pass** over the live sky is still with the user; names were checked through Playwright.
