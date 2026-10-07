# Handoff — 2026-10-07 (S-09 "Pick from map" planned and plan-reviewed; ready for /10x-implement)

What Sidereus looks like now, and exactly what the next session (possibly the **other Claude account**) should do. Read this first. Everything needed to implement S-09 is in this file plus `context/changes/site-pick-from-map/plan.md`. **Do not redo research or planning**: they are done, reviewed and fixed. To save tokens, read only what each step below names.

## State of play

- **Milestone M-2 "First real nights"** is down to its last slice, **S-09 `site-pick-from-map`** (GitHub #73). Every other slice is done and archived (S-01–S-03, S-05–S-08, S-10–S-12; S-04 parked). Archive PR #117 is merged.
- **S-09 so far (2026-10-07, work account):**
  1. The user settled the privacy question: map tiles only after explicit consent. Clicking "Pick from map" **is** the consent, mirroring "Use my location" (roadmap.md S-09 Unknowns, change.md Notes).
  2. Commit `840b68f` unblocked the roadmap entry and opened the change folder.
  3. `/10x-research` wrote `research.md`.
  4. `/10x-plan` wrote `plan.md` and `plan-brief.md`, with 3 phases. The user answered the 3 UI questions; everything else was delegated and recorded.
  5. `/10x-plan-review` found NEEDS ATTENTION (0 critical, 8 warnings, 2 observations). The user chose "apply all", so all 10 findings are **FIXED in plan.md**. Report: `reviews/plan-review.md`.
  6. `change.md` status is **`plan_reviewed`**. The roadmap S-09 status is **`planning`** (At-a-glance row and body). The board card for #73 is **planning**.
  7. All of this is committed on `feat/site-pick-from-map` and pushed (see "Git state" below). There is **no PR yet**, and none is needed until implementation.
- **Not started:** no product code is written. Every Progress row in plan.md is `[ ]`.

## The user's decisions for S-09 (do not re-ask)

| Topic | Decision | Source |
| --- | --- | --- |
| Consent | The "Pick from map" click is the consent. Before it: no tile request, no map JS or CSS | User, 2026-10-07 |
| Map look | Light: normal OSM tiles. Dark: inverted and dimmed via CSS filter. Red: red-only | User (plan Q) |
| Layout | Inline panel inside the picker (`h-80`), with "Place pin at map centre" and "Close map" | User (plan Q) |
| Pin | Tap to drop, drag to adjust; each drop updates the form fields immediately (rounded 0.01°) | User (plan Q) |
| Plan review | Apply all 10 findings | User |
| Library and tiles | Leaflet **1.9.4** (pinned) + `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, no key | Delegated |
| Everything else | See plan-brief.md › Key Decisions | Delegated |

## Next step: implement S-09 (3 phases)

Start the session **from `~/projects`** (the cwd where the shared project skills in `~/projects/.claude/skills/` load: `10x-implement`, `10x-impl-review`, `10x-archive`, …). Then:

```
cd sidereus && git checkout feat/site-pick-from-map && git pull
/10x-implement site-pick-from-map phase 1
```

How the user wants the run:
- Run all three phases without stopping, committing each phase with your own Conventional Commit message and no approval prompt.
- Decide mismatches yourself and record each decision in the plan.
- Leave manual rows the user must eyeball for the end, but run every manual check you can yourself (preview plus Playwright screenshots) and tick it with evidence.
- Push the feature branch after each phase (pre-approved).
- Never commit to `main` and never merge without the user's case-by-case OK.
- Send a `PushNotification` before any question and when finished.
- After phase 3: run `/10x-impl-review site-pick-from-map`, then open a PR ("Closes #73"), and wait for the user's merge. After the merge: `/10x-archive` on a `chore/archive-site-pick-from-map` branch with a PR, flip the board card to done, then **close M-2** with `/10x-roadmap` (the user decides the next milestone).

### Token-saving reading list per phase

Read `plan.md` once fully, about 470 lines; it is self-contained. Then read only these:

- **Phase 1:**
  - `src/lib/location/locate.ts` and `locate.test.ts`, whose fake-object test style you copy;
  - `src/lib/gear/coordinates.ts`;
  - `scripts/build-sw.mjs` (about 75 lines);
  - the `location` block of `src/i18n/messages/en.ts:291-311` and `pl.ts:275-296`;
  - `context/foundation/prd.md:1-17,63-67,375-380`.
- **Phase 2:**
  - `src/components/location/LocationPicker.tsx` (about 280 lines, the whole file);
  - `src/components/gear/SiteForm.tsx:25-160`;
  - `src/components/onboarding/OnboardingWizard.tsx:50-60,100-110,145-160,230-250,410-490`;
  - `src/styles/global.css:200-290`, for tokens and the red filter block;
  - `src/layouts/Layout.astro:60-90`, for the `#red-only` filter and the offline description;
  - `src/lib/offline/page-state.ts:60-110`;
  - `src/lib/gear/catalogue/load.ts`, the lazy-import pattern.
- **Phase 3:**
  - `tests/e2e/helpers.ts`;
  - `tests/e2e/site-location.spec.ts`, the template for the new spec;
  - the "Location picking" paragraph in `CLAUDE.md`.

### Phase cheat sheet (details and contracts are in plan.md)

1. **Map foundation:**
   - `npm i leaflet@1.9.4 -E` and `npm i -D @types/leaflet@^1.9`. Add `--registry https://registry.npmjs.org` if the Nexus mirror fails.
   - New `src/lib/location/map-view.ts` (`NEUTRAL_VIEW` 50/15/z4, `POINT_ZOOM` 11, `DEVICE_RECENTRE_TIMEOUT_MS` 3000, `parseCurrent`, `initialMapView`, `pickFromMap`) with tests.
   - `geolocationAlreadyGranted()` in `locate.ts`, with tests.
   - `build-sw.mjs`: `globIgnores: ["_astro/map-panel.*", "_astro/leaflet*"]`, plus a guard that reads the written `dist/client/sw.js` and exits 1 on `/map-panel|leaflet/`. `injectManifest` returns no entry list.
   - 10 new `location.*` i18n keys in EN and PL (exact copy is in the plan).
   - PRD guardrail and NFR amendment with honest wording. Add `updated: 2026-10-07` to the PRD frontmatter. Cite "roadmap S-09 / GitHub #73", never a bare S-09.
2. **Map in the picker:**
   - **First** record the e2e baseline to `evidence/e2e-baseline.txt`.
   - New `src/components/location/map-panel.tsx`. It is the **only** Leaflet importer, loaded by `import("./map-panel")` on click. CSS comes via `leaflet/dist/leaflet.css?url` + an injected `<link>`, awaited before `L.map`. One map per open panel (`[]` effect, `useEffectEvent` for `onPick`). It also has the divIcon `map-pin`, `keyboard: false` on the marker, an attribution link with `target="_blank" rel="noopener noreferrer"`, `setPrefix(false)`, a `tileerror` hint and a ResizeObserver.
   - `LocationPicker`: `{kind:"map"}`, props `current` and `closeSignal`, `data-needs-network="map-source"` only on the open button. "Close map" must work offline.
   - Edit all **four** host branch points: SiteForm `pickLocation` and summary; Onboarding `pickLocation` and `whereSummary` at `:418-424`. Undo bumps `closeSignal`.
   - global.css: unlayered `[data-theme]`-prefixed Leaflet overrides. In `Layout.astro`, add a `#red-night-map` `feColorMatrix` filter. The tile `img` filter is `none`.
   - `build-sw.mjs`: the chunk exists, and no shared CSS contains `.leaflet-`.
3. **Verification and docs:**
   - `tests/e2e/site-map.spec.ts` with a `stubMapTiles` helper. Test 1: zero tile and map-chunk requests before the click, a tap pin saves 2-decimal values. Test 2: the Madrid edit flow, with Undo closing the map.
   - Screenshots for EN and PL × dark, light and red × 390 and 1280, plus WebKit red, plus a channel check (G = B = 0 in red). Save them under `evidence/`.
   - Update the "Location picking" paragraph in CLAUDE.md.

### Known gotchas for S-09 specifically

- **The build emits one site-wide CSS file** (`_astro/TopbarControls.*.css`). A plain `import "leaflet/dist/leaflet.css"` could merge into it, which is why `?url` is used plus the build guard.
- **Filter order:** a child's CSS filter runs before its parent's. With the global `[data-theme="red"] img { filter: url(#red-only) }` left on tiles inside an inverted pane, red comes out **cyan**. So tiles get `filter: none` and the pane carries the whole filter.
- **leaflet.css is unlayered and loads last.** It beats Tailwind utilities and same-specificity global.css rules. Its defaults show as white, grey and blue in dark and red. The colour guard tests **cannot** see them (`node_modules`), so only screenshots catch them.
- **Widening `source.kind`** fails the type check in only 1 of 4 places, so edit all four explicitly. A `switch` with a `never` default is preferred.
- `roundedCoordinate()` in onboarding returns a **string**, so parse it with `parseCurrent`.
- The e2e "edit" flow uses the **Madrid** site from `onboardInMadrid` (40.42, −3.7). There is no saved Kraków site.
- `data-needs-network` sets `aria-disabled` and swallows clicks; it does not set `disabled`. Never put it on "Close map".
- The lint rule for coordinates already covers `src/components/location/**` and `src/lib/location/**`, so no `eslint.config.js` change is needed.
- `src/lib/location/map-view.ts` is island code: no server-only imports. Leaflet touches `window`, so never import it at module top level anywhere except `map-panel.tsx`.

## Git state (end of this session)

- Branch `feat/site-pick-from-map`, pushed to origin. Commits:
  - `840b68f` docs(roadmap): unblock S-09 …;
  - `af4202b` docs(site-pick-from-map): research, plan and plan review (research.md, plan.md, plan-brief.md, reviews/plan-review.md, change.md → plan_reviewed, roadmap → planning, this handoff).
- Untracked and **never committed**: `.mcp.json` and `.claude/` (the user's choice).
- `main` is at the archive-PR merge `c26f93b`. Nothing on main is pending.

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
  - Ask only for permissions and UI decisions. Decide non-UI choices yourself and record them as delegated. **Exception seen in S-06:** for a big architectural slice the user asked for *more* questions than proposed, including technical ones. So offer a higher question budget on HIGH-complexity plans.
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
