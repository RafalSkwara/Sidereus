# Telescope Selector and Empty States Implementation Plan

## Overview

Roadmap S-08 (FR-019, FR-021). A user with two or more telescopes picks which one the Tonight ranking is for, and the ranking names it. Deleting any site, telescope or eyepiece leaves Tonight in an honest state: an empty state with a link for a missing site or telescope, and a ranking without eyepiece pairs, plus a short notice and link, when there are no eyepieces.

## Current State Analysis

Most of FR-021 already shipped with S-01/S-02/S-03. What is missing is the whole of FR-019's multi-telescope case and the no-eyepieces notice:

- Deletion is unguarded for all three gear kinds: `DeleteButton` on each `[id].astro` edit page posts to `/api/gear/<kind>/[id]/delete`, and `store.remove` just deletes (`src/lib/gear/store.ts:182`, `:243`, `:304`). No "last eyepiece" guard exists, so nothing needs removing.
- Observations keep their rows when gear goes: `site_id` / `telescope_id` are `on delete set null` (`supabase/migrations/20260926200000_observations.sql:19-20`). Showing those entries is S-07.
- Tonight's empty states exist: "no site and no telescope" → onboarding prompt; "no site" → add-site card; "no telescope" → add-telescope card (`src/components/tonight/TonightContent.astro:143-165`).
- With no eyepieces the ranking already renders without pair lines (`pair: null`, `src/lib/tonight/build.ts:72`; `ObjectCard.astro:51-61`) and `view.hasEyepieces` is computed (`build.ts:246`) but nothing reads it, so the pair lines just disappear without explanation.
- Tonight always uses the oldest site and oldest telescope (`TonightContent.astro:82-84`); the only place the telescope is named is the `site · telescope` line under the title (`:117-123`).
- `/tonight` is a server island: `pages/tonight.astro` renders the shell and `TonightContent` (`server:defer`) loads the data. Inside the island `Astro.url` is the island's own request and carries no page query (`pages/tonight.astro:11-13`), so a page query parameter must reach the island as a prop.
- Theme and language are remembered in one-year cookies whose names and rules live in `src/lib/preferences.ts` (`PREFERENCE_COOKIE_MAX_AGE`).
- The log form already takes `?telescope=<id>` and falls back to the oldest (`src/pages/log/new.astro:37`); `logHref` passes the ranking's telescope (`TonightContent.astro:103-112`).

## Desired End State

- Owning one telescope: Tonight looks as it does today, with no selector.
- Owning two or three: a row of pill links under the title, one per telescope, with the active one marked (`aria-current="page"`). Owning four or more: a native dropdown in a plain GET form with a "Show" button, which a small script turns into submit-on-change. In both cases the ranking heading carries a "For your <telescope>" line.
- Picking a telescope (`/tonight?telescope=<id>`) remembers it in a `sidereus-telescope` cookie, so later visits to plain `/tonight` (including the redirect after logging an observation) use it. A missing, deleted or foreign id falls back to the oldest telescope with no error.
- With no eyepieces (loaded successfully, zero rows), the ranking section shows a muted notice linking to `/gear/eyepieces/new`.
- Verify: unit tests for the choice helper, a Playwright spec walking add-second-telescope → switch by pill and by dropdown → remember → stale-cookie fallback → delete eyepieces → delete telescopes → delete site, and the manual checks below.

### Key Discoveries:

- Server island props are serialised (encrypted) into the island URL, so only the telescope id travels, never coordinates (`CLAUDE.md` tripwire "Coordinates never go into URLs or logs").
- `siteStore/telescopeStore/eyepieceStore.list` already filter per user (RLS) and order by `created_at` (`store.ts:145-146`, `:214-215`, `:275-276`), which satisfies the "filter and order every per-user list query" lesson. No new queries are needed.
- `eyepiecesError` is distinct from "zero eyepieces" (`TonightContent.astro:185-189`), so the new notice must key on `!view.hasEyepieces && !eyepiecesError`.
- The two e2e specs each carry a copy of the sign-up + onboarding helper (`tests/e2e/observation-log.spec.ts:37-58`, `tests/e2e/onboarding.spec.ts`), and a third spec would add a third copy.

## What We're NOT Doing

- Site switching or choosing a night (S-05). The ranking keeps the oldest site.
- Showing log entries whose site or telescope was deleted (S-07). The `on delete set null` FKs already keep the rows.
- Storing the telescope choice in the database or per account. The cookie is per device, like theme and language.
- Changing the delete flow, the confirm dialog or adding undo.
- Changing the post-log redirect: the cookie already carries the selection back to `/tonight`.
- Red night mode, or any new theme tokens.

## Implementation Approach

A small pure helper decides which telescope is chosen and which selector to show. The page shell reads `?telescope=`, validates its shape, stores it in a cookie and passes the requested id (the query first, then the cookie) to the island as a prop. The island resolves it against the user's own telescopes and renders the selector. Phase 2 adds the eyepiece notice and an end-to-end spec over the deletion paths.

## Critical Implementation Details

- **Timing & lifecycle**: set the cookie in `pages/tonight.astro` frontmatter (the shell), not in the island. The shell's response starts before the island request, and the island has no access to the page query. Only a value that passes the UUID shape check is written. Whether the id belongs to the user is decided in the island against `telescopeStore.list`; a stale cookie then just falls back to the oldest telescope.

## Phase 1: Telescope selector

### Overview

Choose, remember and name the telescope the ranking is for.

### Changes Required:

#### 1. Choice helper

**File**: `src/lib/tonight/telescope-choice.ts` (new), `src/lib/tonight/telescope-choice.test.ts` (new)

**Intent**: One pure, island-safe place for the cookie name, the id shape check, the resolution rule and the pills-vs-dropdown threshold, so the shell, the island and the tests agree.

**Contract**: exports `TELESCOPE_COOKIE = "sidereus-telescope"`; `isTelescopeId(value: unknown): value is string` (lower- or upper-case UUID); `chooseTelescope<T extends { id: string }>(telescopes: readonly T[], requestedId: string | undefined): T | undefined`, which returns the requested one when present, else `telescopes[0]`, else `undefined`; `selectorKind(count: number): "none" | "pills" | "dropdown"`, which gives `none` below 2, `pills` for 2–3 and `dropdown` from 4 (`SELECTOR_PILL_LIMIT = 3`). The cookie max-age reuses `PREFERENCE_COOKIE_MAX_AGE` from `@/lib/preferences`.

#### 2. Page shell: read, remember, pass on

**File**: `src/pages/tonight.astro`

**Intent**: Turn `?telescope=` into a remembered preference and hand the requested id to the island.

**Contract**: if `?telescope=` passes `isTelescopeId`, `Astro.cookies.set(TELESCOPE_COOKIE, id, { path: "/", maxAge: PREFERENCE_COOKIE_MAX_AGE, sameSite: "lax", httpOnly: true, secure: Astro.url.protocol === "https:" })`. The requested id is the valid query value, else the valid cookie value, else `undefined`. It is passed as `<TonightContent server:defer telescopeId={requested}>`.

#### 3. Island: resolve and render

**File**: `src/components/tonight/TonightContent.astro`

**Intent**: Use the chosen telescope instead of `telescopes.at(0)`, show the selector for 2+ telescopes and name the telescope on the ranking.

**Contract**: `Astro.props.telescopeId?: string`; `telescope = chooseTelescope(telescopes, telescopeId)`. When a site exists and `selectorKind(telescopes.length) !== "none"`, render `TelescopeSelector` between the title block and the cards (also when `view` is null, e.g. on `tonightError`). With 2+ telescopes the line under the title shows only the site name (still linking to `/gear`); with one it stays `site · telescope`. Under the ranking heading, with 2+ telescopes: `t.rankingFor({ telescope: telescope.name })`.

#### 4. Selector component

**File**: `src/components/tonight/TelescopeSelector.astro` (new)

**Intent**: Pills for 2–3 telescopes, a dropdown for 4+, both plain HTML that works without JavaScript. No React island: the dropdown only needs one `change` handler, not client state (plan review F1).

**Contract**: props `{ telescopes: { id; name }[]; activeId: string; locale }`. In pills mode it renders `<nav aria-label={t.selector.label}>` with one `<a href="/tonight?telescope=<id>">` per telescope, the active one with `aria-current="page"`. Pills use theme tokens only (for example `bg-primary text-primary-foreground` active, `border-border bg-surface` idle) and cap long names with `truncate` + `title`. In dropdown mode it renders `<form method="get" action="/tonight" data-telescope-select>` with a labelled `<select name="telescope">` (active option `selected`) and a visible `t.selector.show` submit button. A small Astro `<script>` in the same component enhances every `[data-telescope-select]` form: it submits on `change` (`form.requestSubmit()`) and hides the button. If the script never runs inside the server island, the visible button still works.

#### 5. Copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: New keys for the selector and the ranking line; PL keeps parity.

**Contract**: `tonight.selector.label` ("Telescope" / "Teleskop"), `tonight.selector.show` ("Show" / "Pokaż"), `tonight.rankingFor: (p: { telescope: string }) => string` ("For your {telescope}" / "Dla: {telescope}").

### Success Criteria:

#### Automated Verification:

- Unit tests for `chooseTelescope`, `isTelescopeId` and `selectorKind` pass (requested found; requested missing or undefined → oldest; empty list → undefined; non-UUID rejected; counts 0, 1, 2, 3, 4): `npm test`
- i18n parity test passes with the new keys: `npm test`
- Type check passes: `npx astro sync && npx astro check`
- Lint passes, including the no-hardcoded-colours test: `npm run lint && npm test`
- Production build succeeds: `npm run build`

#### Manual Verification:

- With two telescopes, `/tonight` shows two pills with the oldest active; clicking the other re-ranks and the heading says "For your <name>"
- Reloading plain `/tonight` keeps the last pick; `/tonight?telescope=<random uuid>` falls back to the oldest with no error
- With four telescopes the dropdown appears and switching submits on change; with JS disabled the "Show" button works
  (Impl review F2: with JS off the `TonightContent` server island never loads, so the no-JS half is unreachable; the button only covers a failed enhancement script. The scripted path is covered by the e2e spec.)
- With one telescope nothing changes versus today; pills read well in dark and light themes, EN and PL

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: No-eyepieces notice and deletion coverage

### Overview

Explain missing eyepiece pairs, and pin every FR-019/FR-021 path with an end-to-end spec.

### Changes Required:

#### 1. No-eyepieces notice

**File**: `src/components/tonight/TonightContent.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: When the eyepieces loaded fine but there are none, say why the pair lines are missing and link to adding one, in the style of the other empty states but muted (the ranking is still useful).

**Contract**: inside the ranking section, before the list, when `!view.hasEyepieces && !eyepiecesError`: one `text-muted-foreground` line with `t.noEyepiecesPrompt` ("Add eyepieces to get a finding and detail pair for each object") and a link `t.addEyepieces` → `/gear/eyepieces/new`. PL equivalents.

#### 2. Shared e2e helper

**File**: `tests/e2e/helpers.ts` (new), `tests/e2e/observation-log.spec.ts`, `tests/e2e/onboarding.spec.ts`

**Intent**: Stop copying the sign-up + onboarding-in-Madrid steps into every spec.

**Contract**: exports `waitForHydration(page, selector)` and `onboardInMadrid(page, emailPrefix)` (the geocoding stub included); the two existing specs import them, and their behaviour is unchanged.

#### 3. Selector and empty-state spec

**File**: `tests/e2e/telescope-selector.spec.ts` (new)

**Intent**: One user walks every FR-019/FR-021 path against the all-clear forecast fixture.

**Contract**: onboard in Madrid (one telescope → no selector nav) → add a second telescope through `/gear/telescopes/new` → Tonight shows two pills and the oldest is `aria-current` → click the second → "For your <second>" is visible and the pill is current → `goto("/tonight")` keeps the second (cookie) → add a third and a fourth telescope → Tonight shows the dropdown instead of pills → choosing the third in the select navigates to `?telescope=<third>` and names it → delete the third and fourth → Tonight falls back to the oldest telescope (its pill is `aria-current`, the page shows no error) → delete every eyepiece through its edit page (accepting the confirm dialog via `page.on("dialog")`) → ranking still has cards, no "Find with" text, the no-eyepieces link is present → delete the second telescope → no selector nav → delete the last telescope → the add-telescope prompt links to `/gear/telescopes/new` → delete the site → the onboarding set-up prompt shows. It asserts no ranking positions (the real clock varies them, as in `observation-log.spec.ts`).

#### 4. Docs

**File**: `CLAUDE.md`

**Intent**: Keep the project summary accurate.

**Contract**: the Project paragraph's Tonight description mentions the telescope selector (`?telescope=`, remembered in the `sidereus-telescope` cookie, resolved in `src/lib/tonight/telescope-choice.ts`).

### Success Criteria:

#### Automated Verification:

- Unit, parity and colour tests pass: `npm test`
- Type check and lint pass: `npx astro sync && npx astro check && npm run lint`
- All e2e specs pass against a production preview on local Supabase with the forecast fixture: `BASE_URL=http://localhost:4321 npm run test:e2e`
- CI (`ci` and `smoke` jobs) is green on the PR

#### Manual Verification:

- After deleting all eyepieces, Tonight shows the ranking without pairs and the notice links to the add-eyepiece form; after adding one, the pairs return and the notice is gone
- Deleting the last telescope, then the site, shows the matching empty states; nothing errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `telescope-choice.test.ts`: resolution (found / missing / undefined / empty list), UUID shape check (valid, uppercase, junk, empty), `selectorKind` at 0–4.
- Existing `build.test.ts` already pins `hasEyepieces: false` with no pairs; no change.

### Integration Tests:

- `tests/e2e/telescope-selector.spec.ts` as above, covering pills and the 4+ dropdown; CI's `smoke` job runs it with the other specs.

### Manual Testing Steps:

1. Sign in with two telescopes, switch, reload, and check that the choice is kept and named.
2. Add two more telescopes and check the dropdown, with JS on and off.
3. Delete eyepieces, then telescopes, then the site, and check each empty state in EN/PL and dark/light.

## Performance Considerations

None: no new queries. The island already loads all telescopes; the choice is an in-memory lookup.

## Migration Notes

None: no schema change. Existing users without the cookie get the oldest telescope, as today.

## Review Addendum

Impl review F1 (2026-09-27, found in manual verification): before local noon, Tonight showed the night that had just ended, because of S-02's noon-to-noon rule. Fixed in this change at the user's choice. The new pure engine function `tonightDateFor(site, instant, thresholdDeg)` (`src/lib/engine/sun.ts`) returns the night in progress until its dark window has ended, then the coming evening; nights without a dark window keep the noon rule. `src/lib/tonight/tonight-date.ts` (`tonightDateForSite`) applies it to site records. Tonight (`buildTonight`), the log form's latest night (`pages/log/new.astro`) and the store's future-night check (`observationStore.create`) all use it. A log entry opened without a prefill still defaults to the noon-rule night, the one most likely being logged. Tests: `sun.test.ts` (`tonightDateFor`), `build.test.ts` (morning case), `tests/db/observations.test.ts` (evening ahead accepted in the morning).

## References

- Roadmap item: `context/foundation/roadmap.md` (S-08)
- PRD: FR-019, FR-021 (`context/foundation/prd.md`)
- Prior decisions: `context/archive/2026-09-25-tonight-verdict-and-ranking/plan-brief.md` ("Oldest of each, named on the page")
- Similar pattern: preference cookies `src/lib/preferences.ts`; empty-state cards `src/components/tonight/TonightContent.astro:143-165`
- E2E pattern: `tests/e2e/observation-log.spec.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Telescope selector

#### Automated

- [x] 1.1 Unit tests for `chooseTelescope`, `isTelescopeId` and `selectorKind` pass (requested found; requested missing or undefined → oldest; empty list → undefined; non-UUID rejected; counts 0, 1, 2, 3, 4): `npm test` — 916f6df
- [x] 1.2 i18n parity test passes with the new keys: `npm test` — 916f6df
- [x] 1.3 Type check passes: `npx astro sync && npx astro check` — 916f6df
- [x] 1.4 Lint passes, including the no-hardcoded-colours test: `npm run lint && npm test` — 916f6df
- [x] 1.5 Production build succeeds: `npm run build` — 916f6df

#### Manual

- [x] 1.6 With two telescopes, `/tonight` shows two pills with the oldest active; clicking the other re-ranks and the heading says "For your <name>" — 916f6df
- [x] 1.7 Reloading plain `/tonight` keeps the last pick; `/tonight?telescope=<random uuid>` falls back to the oldest with no error — 916f6df
- [x] 1.8 With four telescopes the dropdown appears and switching submits on change; with JS disabled the "Show" button works — 916f6df
- [x] 1.9 With one telescope nothing changes versus today; pills read well in dark and light themes, EN and PL — 916f6df

### Phase 2: No-eyepieces notice and deletion coverage

#### Automated

- [x] 2.1 Unit, parity and colour tests pass: `npm test` — ab7a6da
- [x] 2.2 Type check and lint pass: `npx astro sync && npx astro check && npm run lint` — ab7a6da
- [x] 2.3 All e2e specs pass against a production preview on local Supabase with the forecast fixture: `BASE_URL=http://localhost:4321 npm run test:e2e` — ab7a6da
- [x] 2.4 CI (`ci` and `smoke` jobs) is green on the PR — ab7a6da

#### Manual

- [x] 2.5 After deleting all eyepieces, Tonight shows the ranking without pairs and the notice links to the add-eyepiece form; after adding one, the pairs return and the notice is gone — ab7a6da
- [x] 2.6 Deleting the last telescope, then the site, shows the matching empty states; nothing errors — ab7a6da
