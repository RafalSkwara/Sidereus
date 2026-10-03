---
date: 2026-10-03T08:33:21+02:00
researcher: Claude (Opus 5.5)
git_commit: 85e2a05
branch: feat/verdict-check
repository: RafalSkwara/Sidereus
topic: "S-07 verdict check: how to record the sky verdict Tonight showed, ask afterwards how the sky was, and tally the matches"
tags: [research, tonight, verdict, observations, supabase, rls, server-islands]
status: complete
last_updated: 2026-10-03
last_updated_by: Claude (Opus 5.5)
---

# Research: S-07 verdict check

**Date**: 2026-10-03T08:33:21+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 85e2a05
**Branch**: feat/verdict-check
**Repository**: RafalSkwara/Sidereus

## Research Question

Roadmap M-2 S-07 (GitHub #71): the user tells Sidereus, for a past night at one of their sites, whether the sky matched the verdict Tonight showed, and sees a running tally of how often verdicts matched. What does the codebase offer for (1) recording the verdict that was shown, per user, site and night, (2) asking the question on Tonight and in the log, and (3) storing answers and computing a tally, and which patterns must the plan copy?

## Summary

- **Nothing records a shown verdict today.** The verdict is computed on every Tonight render inside `buildTonight` and is thrown away (`src/lib/tonight/build.ts:435-438`, `:697-713`); the roadmap baseline says so too (`context/foundation/roadmap.md:79`). No GET path in the app writes to the database: the only DB writes are in POST routes under `src/pages/api/**` (gear, log, onboarding stores), and there is no upsert anywhere in `src/` or `supabase/migrations/`. Recording the verdict at view time is therefore a **new pattern**: a write from the Tonight server island during a GET.
- **The write has a natural home.** `TonightContent.astro` already has `Astro.locals.user`, the per-request RLS Supabase client (`src/components/tonight/TonightContent.astro:25-29`), `now`, and a `defer` that calls `cfContext.waitUntil` for the KV forecast write (`:48-59`), which is a precedent for post-response work. The returned `TonightView` carries `siteId`, `date` (site-local evening date) and the raw `verdict` (level + reason) (`build.ts:298-319`, `:697-705`). The dark window start is not on the view (only formatted strings), so a "before the dark window starts" rule needs the raw `Date` exposed.
- **The island is fetched by GET with a preload** (Astro 7.3.2, `node_modules/astro/dist/runtime/server/render/server-islands.js:147-162`; POST only when the encrypted props exceed the URL limit). `AllObjectsContent.astro:29` calls the same `loadTonight`. A write must be idempotent: an upsert on (user, site, night).
- **The stored value should be the headline id plus the internal level, not text.** The headline is chosen from level + reason by `skyHeadlineId` (`src/lib/tonight/format.ts:122-139`, not exported) over the closed set `go | marginal | no-go | humidityCap | fallbackCap | noForecast | noDarkness` (`format.ts:98-106`). Text is locale-dependent (EN + PL).
- **The join key matches the log.** `observations.night` is a `date` holding the site-local evening date of a noon-to-noon night, with nullable `site_id` (`on delete set null`) plus a `site_name` snapshot (`supabase/migrations/20260926200000_observations.sql:14-26`). A verdict row keyed by (user, site, night) joins the log exactly.
- **Unique key and site deletion.** Postgres is 17 (`supabase/config.toml:36`). A plain `unique (user_id, site_id, night)` (default NULLS DISTINCT) supports PostgREST `onConflict` for live sites and lets several deleted-site rows (site_id null) coexist; `nulls not distinct` would make deleting a second site with a shared night fail. A partial unique index cannot be targeted by PostgREST `on_conflict`. (Inference from Postgres semantics; no existing unique key in the repo to copy.)
- **"Last night" on Tonight is the night before Tonight's date only after civil dawn.** `tonightDateFor` keeps the night in progress as "tonight" until the Sun rises above the rollover altitude, then moves to the evening ahead (`src/lib/engine/sun.ts:101-105`, `src/lib/tonight/tonight-date.ts:9`). The day after a viewed night, the unanswered night is `< TonightView.date`.
- **The log groups by night only, not by site** (`src/pages/log/index.astro:36-46`, heading `:114-117`), so a per-night control needs a (night, site) key the heading does not carry. Entries are whole-row links, so a form cannot nest inside one.
- **There is no tally or stats UI anywhere** and no dismissible-prompt state (cookies only hold site, telescope, locale and theme). Both are new UI. A pure tally function would follow `src/lib/engine/log.ts` (`seenSummaries`).

## Detailed Findings

### The verdict and its sky words

- `verdict(darkWindow, forecast | null, { fallback })` (`src/lib/engine/verdict.ts:69-116`); thresholds in `src/lib/engine/parameters.ts:160-172` (go: 2 h run below 30% cloud; marginal: 1 h below 65%; humidity cap 90%).
- `VerdictLevel` is `"go" | "marginal" | "no-go"`; `VerdictReason` kinds are `clear-run`, `humidity-cap`, `fallback-cap`, `cloudy`, `no-weather-data`, `no-darkness` (`src/lib/engine/types.ts:92-123`).
- Headline mapping (`format.ts:122-139`):

  | Level / reason | Headline id | EN text |
  |---|---|---|
  | go, `clear-run` | `go` | Clear |
  | marginal, `clear-run` | `marginal` | Partly clear |
  | marginal, `humidity-cap` | `humidityCap` | Clear, but damp |
  | marginal, `fallback-cap` | `fallbackCap` | Clear (old forecast) |
  | marginal, `no-weather-data` | `noForecast` | No forecast |
  | no-go, `cloudy` with `minCloudPct` non-null | `no-go` | Cloudy |
  | no-go, `cloudy` with `minCloudPct` null | `noForecast` | No forecast |
  | no-go, `no-darkness` | `noDarkness` | No dark window |

- Consequence for matching: two headline ids (`noForecast`, `noDarkness`) make no checkable sky claim. Three (`marginal`, `humidityCap`, `fallbackCap`) all claim "mostly clear with a caveat". The PRD guardrail treats a false "go" as worse than a false "no-go" (`context/foundation/prd.md:71-73`), which the roadmap carries as "keep the direction" (`roadmap.md:188-190`).

### Where the verdict becomes known (Tonight)

- `src/pages/tonight.astro:37` renders `<TonightContent server:defer siteId telescopeId>`; only ids travel as props.
- `loadTonight` (`src/lib/tonight/load.ts:79-147`) reads sites, telescopes, eyepieces and the log, picks the site and telescope, fetches the forecast and calls `buildTonight`.
- `buildTonight`: `date = tonightDateFor(...)` (`build.ts:435`), `sevenNightOutlook(...)` (`:438`); the view returns `siteId` (`:697`), `verdict: tonight` (`:704`), `headline: skyHeadline(tonight)` (`:705`), `forecastStatus` (`:713`). User id is not on the view; it is `Astro.locals.user.id` in the island.
- Nights 2-3 of the seven-night strip carry a verdict from the same forecast (`src/lib/engine/outlook.ts`, `VERDICT_NIGHTS = 3` in `parameters.ts:189`), but `TonightNight` keeps only `level` and `headline`, not the reason. Recording night 1 only is the simple option; the night is recorded when it becomes "tonight".
- Forecast freshness: `FORECAST_FRESH_MS` = 1 h, KV TTL 7 days (`src/lib/forecast/service.ts:23,26`), refreshed on demand per request, no cron. "Old forecast" (`fallbackCap`) is not an age threshold: it means the fetch failed and a stored copy was used (`service.ts:152-154`, `verdict.ts:100-102`). The verdict for one night therefore changes during the evening as the user reloads.
- Dark window: `TonightView.darkWindow` exposes formatted strings only (`build.ts` `TonightDarkWindow`); the raw `DarkWindow` (`start`/`end` Dates or `kind: "none"`, `types.ts:36-57`) is `outlook` night 1's `darkWindow` inside `buildTonight`.

### The island as a write site

- `TonightContent.astro:25-29`: `supabase` is set only when `user` is (the island route is outside `PROTECTED_ROUTES`, so it guards itself).
- `:48-59`: `loadTonight({ ..., now: new Date(), defer: (task) => Astro.locals.cfContext.waitUntil(task) })`: the KV write runs after the response.
- GET-request island fetch with a `<link rel="preload" as="fetch">` (`server-islands.js:147-162`). Reloads, the preload and the all-objects page can each trigger a render; the write must be idempotent and must not fail the render.
- The Supabase auth cookies are written by `@supabase/ssr` with its defaults (no `sameSite` override in `src/lib/supabase.ts` or `src/lib/session-cookie.ts`), so cross-site subresource GETs carry no session; the write is self-derived data with no user input.

### Observations table and store (template)

- Migration template `20260926200000_observations.sql`: `id uuid pk`, `user_id ... default auth.uid() references auth.users on delete cascade`, `night date not null`, `site_id ... on delete set null`, `site_name` snapshot with a length check, `created_at`; indexes on `user_id`, `site_id`, `telescope_id` (`:28-30`); RLS on (`:30`); one policy per operation `to authenticated`, insert/update also require a non-null `site_id` owned by the caller (`:36-59`, needed because FK checks skip RLS).
- Store pattern `src/lib/observations/store.ts`: object of methods taking the typed client first; writes return `WriteResult = { ok: true } | { ok: false; message: MessageKey }` (`src/lib/gear/store.ts:23`); reads throw `new Error(<key>)`; uuid `22P02` maps to not found (`observations/store.ts:154-163`); list reads filtered and ordered ending in `id` (`:135-151`, `:248-259`), per lessons.md "Filter and order every per-user list query".
- POST route pattern `src/pages/api/log/index.ts:14-37`: formData → `NOT_CONFIGURED` check → zod `safeParse` → store → `context.redirect(path?error=<key>)`; success notices through `src/lib/observations/redirect.ts`. `/log` and `/api/log` are gated (`src/lib/protected-routes.ts:5-14`); a new top-level path needs adding.
- Night bounds: `create` rejects `night > tonightDateForSite(site, now)` (`observations/store.ts:116`); the log form defaults to `observingNightDateFor(now, tz)` (`src/pages/log/new.astro:47-52`).

### Tests and tooling

- `tests/db/isolation.test.ts:47-95`: `TABLES` entries `{ table, valid, change } satisfies TableCase<...>`; `valid` must insert with no fixtures (so `site_id: null` plus snapshots); `describe.each` (`:107-209`) generates seven isolation cases. Table-specific rules go in their own file (pattern: `tests/db/observations.test.ts`, incl. "outlives the site" `:141-162`).
- `npm run db:types` regenerates `src/lib/database.types.ts`; CI fails on drift (`.github/workflows/ci.yml:48-49`).
- `eslint.config.js:84-102` `gearConfig.files` already covers `src/lib/tonight/**`, `src/components/tonight/**`, `src/lib/observations/**`, `src/pages/api/log/**`, `src/pages/log/**`; a new `src/lib/<module>/**` or route that reads site records needs adding (lessons.md).
- e2e: Playwright against a production preview with `tests/e2e/forecast-fixture.mjs` (always clear, so Tonight is deterministically "Clear"); real clock, no `page.clock`; helpers `onboardInMadrid`, `waitForHydration` (`tests/e2e/helpers.ts`). Answering a *past* night in e2e needs a seeded verdict row or a store-level test, since the fixture user has no past night.
- Smoke (`scripts/smoke.mjs`) is a step list; a new POST route gets one step.

### Log page

- `src/pages/log/index.astro:36-46` groups consecutive same-night entries on the current page (50 per page, `observations/store.ts:33`); the `<h2>` shows only the date (`:114-117`); site and telescope are per entry (`:133`). A night can span several sites.
- No existing tally/stats component. Closest analogues: "Seen N times" (`seenSummaries`, `src/lib/engine/log.ts`; `ObjectRow.astro:33`) and the seven-night strip's tones (`src/components/tonight/verdict-tones.ts`).

## Code References

- `src/lib/engine/verdict.ts:69-116` - verdict computation
- `src/lib/engine/types.ts:92-123` - `VerdictLevel`, `VerdictReason`
- `src/lib/tonight/format.ts:98-106,122-139` - `SKY_HEADLINE_KEYS`, `skyHeadlineId` (unexported)
- `src/lib/tonight/build.ts:298-319,435-438,697-713` - `TonightView`, tonight date, verdict on the view
- `src/components/tonight/TonightContent.astro:25-59` - island locals, `loadTonight`, `waitUntil` defer
- `src/components/tonight/AllObjectsContent.astro:29` - second `loadTonight` caller
- `src/lib/engine/sun.ts:101-105`, `src/lib/tonight/tonight-date.ts:9` - tonight rollover at civil dawn
- `src/lib/forecast/service.ts:23,26,152-154` - freshness, KV TTL, fallback
- `supabase/migrations/20260926200000_observations.sql:14-65` - per-user table template
- `src/lib/observations/store.ts:20-53,101-259` - store pattern
- `src/pages/api/log/index.ts:14-37` - POST route pattern
- `src/pages/log/index.astro:36-46,114-133` - log grouping and heading
- `tests/db/isolation.test.ts:47-209` - isolation suite
- `eslint.config.js:84-102` - `gearConfig.files`
- `node_modules/astro/dist/runtime/server/render/server-islands.js:147-176` - island GET/POST choice

## Architecture Insights

- Engine stays pure: a tally (answers × recorded headlines → matches, misses by direction) fits a pure function next to `engine/log.ts`, or in `src/lib/<module>/` if it needs i18n; `purity.test.ts` guards engine modules.
- Store the headline id (and level) at record time, never translated text: copy is EN + PL and wording may change again.
- The recorded verdict drifts through an evening (hourly forecast refresh, rollover at civil dawn), so "which verdict counts" must be one rule applied at write time (e.g. overwrite only while `now < darkWindow.start`; keep the first record otherwise).
- Writes during the island GET must not block or break rendering: run them through the existing `defer`/`waitUntil` path and swallow errors (no logging of coordinates; no `?error=` possible from an island).

## Historical Context (from prior changes)

- `context/archive/2026-10-02-moonlight-and-the-verdict/frame.md:48` - the headline was kept a checkable cloud forecast explicitly so S-07 stays sound. Supported by current code (`format.ts:122-139`).
- `context/archive/2026-10-02-moonlight-and-the-verdict/plan.md:359` - roadmap S-07 note that matching compares against sky words. Present at `roadmap.md:188-190`.
- `context/archive/2026-09-26-log-observation-from-ranking/plan.md:164` - duplicate observation rows are allowed; counts are over distinct nights.
- `context/archive/2026-09-27-observation-log-management/plan-brief.md:21,42` - the log is grouped by night (user's choice); per-night controls were out of scope then.
- `src/lib/observations/store.ts:36` mentions "S-07" from M-1 numbering (log paging); unrelated to M-2 S-07.

## Related Research

Not applicable: no earlier research on recording verdicts.

## Open Questions

For `/10x-plan` (product choices the roadmap lists as candidates, `roadmap.md:186-191`):

1. **Which verdict counts** for a night: last shown before the dark window starts (roadmap candidate), and what if the user first opens Tonight after dark (record it anyway, flagged, or skip)?
2. **Answer vocabulary and match rule**: three answers (clear / partly cloudy / clouded out) against seven headline ids. Which headlines are excluded from the tally (`noForecast`, `noDarkness`), and do `humidityCap` / `fallbackCap` count as "Partly clear"?
3. **Where the question appears**: on Tonight the day after (for which nights: only the latest unanswered, or any within N days?) and next to log nights (the log heading has no site; a night with entries at two sites needs two questions).
4. **Dismissal**: "answering is always optional"; does the Tonight prompt need a "skip" that is stored (a column on the verdict row), or does it simply expire after a day?
5. **Where the tally lives**: a line on `/log`, a card on Tonight, or both; whether it shows misses by direction (too optimistic / too pessimistic).
6. **Recording only for signed-in views of night 1** (not nights 2-3 of the strip): assumed, to confirm in the plan.
