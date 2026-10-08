# The user's UI adjustments (M-3 S-02) Implementation Plan

## Overview

This plan applies the user's own list of look-and-feel fixes (`change.md`, 2026-10-08), covering:

- app-wide notifications as dismissible toasts;
- a calmer dashboard verdict and sky band;
- Site and Telescope cards;
- spacing, with data points on their own lines across Tonight's pages;
- clickable elements that look clickable;
- dimmer stars on the focused pages;
- a Session plan that explains itself with per-target altitude curves.

It is UI only: no engine logic, no migrations, no new routes.

## Current State Analysis

The full grounding is in `research.md` (sections A–H). In short:

- **Notices.** They are server-rendered `Notice` elements (`role="status"`) driven by URL params. They have no close button, no timer and no URL cleanup (`src/components/ui/Notice.astro:27`). On Tonight pages the shell bakes them into the server island's props (`src/lib/tonight/notice.ts:11-23`, `TonightContent.astro:172-182`). Offline notices are re-shown by `applyNotices` (`src/lib/offline/page-state.ts:50-57`).
- **Verdict.** A giant Go / Marginal / No-go word sits under three header lines (date, dark window, zone), above a `text-title` "● headline · reason" line (`VerdictCard.astro:64-98`). Sky heights are centralised in `sky-band.ts`. `VERDICT_MIN_HEIGHT_CLASS` was measured for the old layout.
- **Panorama.**
  - The overlap is `-mt-24` / 96 px (`sky-band.ts:38-39`), consumed at `TonightSkyView.tsx:226,251,308,311,458`.
  - The chevrons have a translucent zenith face with a border (`:85-92`).
  - The scroller shows a thin token-coloured scrollbar (`global.css:486-490`).
  - The slider knows the dark span only as 10-min frame indices and has no zone (`build.ts:949-954`).
- **Gear row.** A muted "site · telescope" link, then pills for 2-3 items or a dropdown for 4+ (`TonightContent.astro:184-215`, `gear-choice.ts:35-38`).
- **Tight spacing.** Data points flow into single " · " lines: `SessionTimeline.astro:55-71`, `PlanetCard.astro:27`, `ObjectCard.astro:37`, `NightStrip.astro:59-70`, `TonightPageSky.astro:23`. Details stack at `gap-y-1` (`TargetDetails.astro:32`).
- **Clickables.** "Mark observed" is a `link`-variant button with no resting underline, border or fill (`TargetDetails.astro:29`, `button.tsx:32`). There is no global link style. In red mode `primary`, `primary-strong` and `heading` are all `#ff0000`.
- **Stars.** The focused pages' symbolic stars are `TonightSky.astro:52-57` with `fill-star`, a token the live sky shares.
- **Session plan rows.** Each row draws an unexplained bar (the best window above the minimum altitude, inside the dark window) and a dot (the highest sample) on a shared axis (`SessionTimeline.astro:132-163`).

## Desired End State

**Notices.**

- Every success notice appears as a fixed toast: above the TabBar on phones, under the top navigation from `md`.
- It disappears after 10 s, closes earlier with an × button, and its URL param is removed.
- Informational notices (offline "prepared", "old forecast", "stale", the sign-in continue note, DatabaseMissing) stay in place and close with an × button. A closed offline notice stays closed.
- Errors stay inline.

**Dashboard.**

- The date, then a large "● Cloudy" headline (display size), then the reason on its own line. There is no poster word, no dark-window line and no zone line.
- The panorama sits `-mt-16` under the verdict, so the forecast line no longer covers stars.
- The chevrons are bare icons and the scrollbar is hidden.
- The compass point nearest the centre of the view is marked.
- The slider shows the current time plus the zone, and the dark stretch at its exact edges with those times beneath.

**Site and Telescope cards.**

- Side by side from `sm`, full width below.
- Each has a title line, a large icon bottom-left and, bottom-right, a select (2+ items) or the name plus "Manage" (1 item).
- The 390×844 first screen now ends at the cards.

**Spacing and data points.** Targets, Nights, Planets, Moon and the dashboard tiles show data points on their own lines with more vertical rhythm.

**Clickables.**

- Standalone clickables (Mark observed, back links, Manage, the washed-out link, the tiles' cue) have a border, a tinted fill, an icon and the link colour.
- Inline links are underlined and coloured.
- In red mode the shapes carry the difference.

**Focused-page stars** are dimmer. The dashboard's live sky and the landing page are unchanged.

**Session plan.**

- Sunset, dark and Moon are each on their own line.
- Each target row reads "Best 22:40 · window 21:40–23:10 · SW, 45°" above a small server-drawn altitude curve, with the minimum altitude dashed and a dot at best.
- A legend explains the curve.

**Verification:** unit, type, lint and e2e suites green on a local preview; screenshots at 360/390/640/1280 in EN/PL × dark/light/red reviewed by the agent; the landing PNG recaptured.

### Key Discoveries:

- Shells never store a page whose URL has `logged`, `skyChecked` or `error` (`src/lib/offline/copies.ts:34-35,127-130`). A param-driven toast can never resurface from an offline copy.
- The Topbar is not sticky (`Topbar.astro:28`) and the TabBar is `fixed z-40` below `md` (`TabBar.astro:21-60`). No z-index above 40 exists. The settings panel is `popover="auto"` (`TopbarControls.tsx:200`), so a toast must not be an auto popover.
- Notice surfaces are `color-mix(… transparent)` (`global.css:233-238`). A floating toast needs an opaque backing.
- `tonight.verdict.word` and `text-verdict-*` are used only by `VerdictCard` and `TonightSkeleton` (research B). No test asserts the word. `#verdict-heading [data-sky-headline]` is asserted by five specs and must stay.
- The island may only show server-formatted times (CLAUDE.md, "Tonight's live sky"). Exact dark-window times and the zone must arrive as strings on `SkyViewData` (`src/lib/sky-view/view.ts`, built at `build.ts:940-1005`).
- `objectTracks`, `planetTracks` and `moonTrack` (`src/lib/engine/objects.ts:43`, `planets.ts:52`, `moon.ts:141`) and `packTrack` (`build.ts:550`) already produce altitude series over the sunset–sunrise axis. The Session plan can reuse them with no engine change.
- `getByRole("status")` is used bare in 9 e2e places. The toast region must not add a second `role=status` element, and its × must be icon-only with an `aria-label`.

## What We're NOT Doing

- No engine, scoring, migration or route changes. `src/lib/engine/**` is untouched; the engine functions are only called.
- No changes to the log's night logic (`src/pages/log/new.astro` beyond notices, `src/lib/observations/store.ts`). The test-plan Phase 2 session owns those.
- Error messages (`?error=` → `ServerError` / `FieldError`, the config `Banner`) stay inline and are not toasts.
- No shared altitude chart (option C) and no hourly agenda (option D) for the Session plan.
- The landing page keeps its own `TonightSky` (no `quiet` stars) and verdict chips.
- No new gear routes and no change to how `?site=` / `?telescope=` are remembered (cookies stay).
- No client island for the Session plan. Its curves are static server SVG.

## Implementation Approach

Phases go from the shared parts outward:

1. **Clickable styles first**, so the gear cards' "Manage" and every later phase reuse them.
2. **Notices**, which touch every page.
3. **The sky band**, the riskiest for layout. It changes `sky-band.ts`, the skeleton and the re-measured heights together.
4. **Gear cards**, which depend on 1 and 3 and on the relaxed fold.
5. **Spacing.**
6. **The Session plan**, the only phase that adds server data.

Every phase ends with the agent's own screenshots on a local preview, per the user's standing "check on your own" preference. Manual rows the agent cannot verify are left for the joint check after Phase 6.

Local environment for this worktree: preview on port 4331 and forecast fixture on 4410, against local Supabase. Only `dist/server/.dev.vars` is patched after a build. Lint with `npx eslint . --ignore-pattern '.claude/**'`. Node from `$HOME/.nvm/versions/node/v24.21.0/bin`.

**Local e2e run** (every `npx playwright test …` line below means this recipe; never run against 4321, where the main checkout may serve another branch):

1. `npx supabase status` (start it with `npx supabase start` if needed) and note the local API URL and anon key.
2. `FIXTURE_PORT=4410 node tests/e2e/forecast-fixture.mjs` as a background task.
3. `npm run build`, then patch `dist/server/.dev.vars` with the local `SUPABASE_URL` / `SUPABASE_KEY` and `FORECAST_BASE_URL=http://127.0.0.1:4410`.
4. `ASTRO_PREVIEW_BACKGROUND=0 npx astro preview --port 4331 --ignore-lock` as a background task.
5. `BASE_URL=http://localhost:4331 SUPABASE_URL=<local> SUPABASE_KEY=<local> npx playwright test <specs>`.

Rebuild (steps 3-4) after every phase's changes before running its specs.

## Critical Implementation Details

- **Timing & lifecycle.** Tonight's notices arrive inside a server island after the shell has loaded. The toast script must pick up `[data-toast]` notices added later (MutationObserver, as `Notice.astro:41-69` and `page-state.ts:151-153` already do), not only those present at load. The URL param is removed with `history.replaceState` only after the toast is shown, keeping every other query param (`site`, `telescope`, `night`). The island has already been fetched by then, so this is safe.
- **State sequencing (offline notices).** `applyNotices` re-sets `hidden` on every DOM insertion. Closing an offline notice must set a dismissed marker that `applyNotices` honours before it decides visibility. Only setting `hidden` would be undone on the next mutation.
- **User experience spec.**
  - Toasts stack newest-last.
  - The region is not a live region. Each Notice keeps its own `role="status"` and announce-once script.
  - The × is a 44 px icon button with a localised `aria-label`.
  - The timer pauses while the toast has focus or hover, so a keyboard user can reach the ×.
  - Entry and exit motion is off under `prefers-reduced-motion`.

## Phase 1: Clickable affordance and quieter subpage stars

### Overview

Add one shared look for standalone clickables (border, tinted fill, icon, link colour) and underlined inline links. Apply it to every existing standalone link or action, and dim the focused pages' symbolic stars.

### Changes Required:

#### 1. Variants and tokens

**File**: `src/components/ui/button.tsx`, `src/styles/global.css`, `src/styles/contrast.test.ts`

**Intent**: Add an `action` variant for standalone links and per-item actions. It has a border in the link colour, a tinted surface fill, link-coloured text and room for a leading or trailing icon. It wraps (`whitespace-normal`), so long Polish labels never overflow. Make the `link` variant underlined at rest, so inline links read as links. The fill and border are opaque hex tokens, so the contrast test can pin them (it skips `color-mix` values, `contrast.test.ts:24-33`).

**Contract**:

- `buttonVariants` gains `variant: "action"`.
- The `link` variant gets a resting underline (`underline decoration-1 underline-offset-4`; hover thickens it).
- New base tokens `--action-surface` and `--action-border`, as plain hex, in the first `:root` block (dark), light, red (zero G/B; `red-theme.test.ts:72-75` requires them there) and the light `.night-sky` block, plus `--color-action-surface` / `--color-action-border` in the `@theme inline` block.
- `CHECKS` rows in `contrast.test.ts`: `primary-strong` on `action-surface` ≥ 4.5 in dark, light, red and night; `action-border` on `background`, `surface`, `zenith` and `horizon` ≥ 3 in every theme (BackLink sits on the sky headers and the night scope).
- The offline dashed-border rule (`global.css:479-484`) is extended from buttons to `a`, so an offline `action` link (Mark observed, Manage) reads disabled: muted, no fill, dashed border. Topbar and TabBar links have zero border width, so they are unaffected.

#### 2. Apply to standalone clickables

**File**: `src/components/tonight/TargetDetails.astro`, `src/components/tonight/MoonCard.astro`, `src/components/ui/BackLink.astro`, `src/components/ui/Pager.astro`, `src/components/ui/Tile.astro`, `src/pages/auth/confirm-email.astro`, `src/components/sky-checks/SkyAnswerForm.astro`, `src/pages/log/index.astro`

**Intent**:

Every clickable, by treatment (the inventory this phase must leave true):

| Clickable                                                           | Where                                                                                             | Treatment                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Mark observed                                                       | `TargetDetails.astro:29,49-54`                                                                    | `action` + lucide `Check` icon, no `-ml-3`                             |
| Washed-out link                                                     | `MoonCard.astro:31,47-50`                                                                         | `action`, keeps wrapping, no `-ml-3`                                   |
| Back links                                                          | `ui/BackLink.astro` (all call sites)                                                              | action look with its chevron                                           |
| Newer / older                                                       | `ui/Pager.astro:24`                                                                               | `action`                                                               |
| "Back to sign in"                                                   | `auth/confirm-email.astro:23`                                                                     | `action`                                                               |
| Tile cue                                                            | `ui/Tile.astro:9,29`                                                                              | the arrow sits in a bordered, filled icon chip                         |
| Sky-check answers (ghost)                                           | `sky-checks/SkyAnswerForm.astro:29-34`                                                            | resting border (outline look), so all three answers read as buttons    |
| /log "Sky checks" link                                              | `log/index.astro:71`                                                                              | resting border                                                         |
| Skip, All                                                           | `SkyCheckCard.astro:39,53-58`                                                                     | stay `link` (now underlined), quieter than the answers on purpose      |
| Inline links in sentences                                           | `inlineLink` in the `*PageContent` files, `EyepiecesPrompt`, auth switch links, skeleton "Reload" | stay `link` (now underlined)                                           |
| Targets `<summary>` rows, gear and log row links, Session plan rows | `ObjectRow.astro:26`, `gear/index.astro:95`, `log/index.astro:63`, `SessionTimeline.astro`        | unchanged: whole-row links with a chevron or arrow and a hover surface |
| Tonight gear link                                                   | `TonightContent.astro:126`                                                                        | unchanged here; Phase 4 replaces it                                    |

**Contract**: No change in hrefs, `aria-label`s, `data-needs-network` or `from`/`logHref`. A single `default` (primary) action per screen is kept.

#### 3. Dim the focused pages' stars

**File**: `src/components/tonight/TonightSky.astro`, `src/components/tonight/TonightPageSky.astro`, `src/components/tonight/TonightPageSkeleton.astro`

**Intent**: A `quiet` prop dims the symbolic star field with an opacity scale class. Only the focused pages and their skeleton pass it.

**Contract**: `TonightSky` gets the prop `quiet?: boolean`. The default is unchanged, so the dashboard and the landing page are unaffected. `--star` is not changed.

#### 4. Kitchen sink and docs

**File**: `src/pages/design.astro`, `CLAUDE.md`

**Intent**: Add `action` to the variant specimens (live, hover, focus, disabled, offline). Show the underlined `link`. Show a quiet versus a normal `TonightSky`. Add a CLAUDE.md "UI (Nightfall)" bullet: standalone clickables use `action`, inline links use `link`, and red mode differs by shape.

**Contract**: `/design` 7-state matrix for the new variant.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro sync && npx astro check`
- Unit tests pass, including the contrast, red-theme and no-hardcoded-colours tests: `npm test`
- Lint passes: `npx eslint . --ignore-pattern '.claude/**'`
- E2E specs touching Mark observed, back links and sideways scroll pass (local e2e run): `npx playwright test tonight-targets observation-log moon-as-target planets-on-tonight tonight-phone tonight-dashboard sky-checks`

#### Manual Verification:

- "Mark observed", back links and Pager links read as clickable in dark, light and red (agent screenshots at 390 and 1280 px).
- Inline links are underlined, and the offline state of `[data-needs-network]` still looks disabled.
- Focused-page stars are visibly dimmer; dashboard and landing stars are unchanged.

**Implementation Note**: Commit the phase and continue. Manual rows the agent verified by screenshot are ticked with that evidence. The rest wait for the joint check after Phase 6.

---

## Phase 2: Notifications as toasts

### Overview

Success notices become fixed, 10-second, closable toasts that clean their URL param. Informational notices gain a close button that sticks.

### Changes Required:

#### 1. Notice modes

**File**: `src/components/ui/Notice.astro`

**Intent**:

- Add a `toast` mode, which marks the notice with `data-toast` and is `position: fixed` from first paint (the `toast-region` utility), so a server-rendered toast never paints inline and then jumps.
- Add a `specimen` mode for `/design`: the toast look without `data-toast`, so the global script leaves it alone.
- Add a `dismissible` mode, an inline notice with an icon-only × button.
- The × label comes from a new catalogue key, read via `Astro.locals.locale`.
- A toast gets an opaque backing under its tinted surface.

**Contract**:

- Props become `tone`, `toast?: boolean` (implies dismissible), `dismissible?: boolean`, `specimen?: boolean`, and `param?: string`: the URL param(s) this toast clears, from a fixed set, never a value.
- Root keeps `role="status"`. `[data-notice-text]` keeps exactly the slot text, so `toHaveText` assertions still match.
- New i18n key `common.close` (EN "Close", PL "Zamknij"), with parity in `pl.ts`.

#### 2. Toast region and script

**File**: `src/layouts/Layout.astro`, `src/components/ui/ToastRegion.astro` (new), `src/styles/global.css`

**Intent**: One fixed, non-live container after `<slot/>`. One script:

- moves `[data-toast]` notices into it (stacking only; they are already fixed), now and when added later;
- starts a 10 s timer that pauses on hover or focus;
- closes on ×;
- removes the notice's `param` from the URL with `replaceState`.

The position comes from a `toast-region` utility:

- below `md`: bottom, above the TabBar when one is rendered (`:has()` on the TabBar's marker), else just above the safe area;
- from `md`: top, at the Topbar's bottom edge. The Topbar is not sticky, so after scrolling the toast floats at that offset; that is intended.

**Contract**:

- `z-50`; centred, max width in the content column.
- `ToastRegion` has no `role` and no `aria-live`.
- The TabBar gets a `data-tabbar` marker.
- New utilities live in `global.css` (no arbitrary values). Reduced motion turns the transition off.

#### 3. Switch every transient notice to toasts

**File**: `src/pages/gear/index.astro`, `src/pages/log/index.astro`, `src/pages/log/sky.astro`, `src/components/tonight/TonightContent.astro`, `src/components/tonight/TargetsPageContent.astro`, `MoonPageContent.astro`, `PlanetsPageContent.astro`, `NightsPageContent.astro`, `src/lib/tonight/notice.ts`

**Intent**: Success notices for `saved`, `deleted`, `updated`, `skyChecked` and `logged` render with `toast` and their `param`. Error branches (`role="alert"` + `ServerError`) are unchanged. The inline wrapper spacing that held the notice is removed, so nothing reserves room.

**Contract**: `pickTonightNotice` also returns the param name (`"logged"` or `"skyChecked"`) for the success case.

#### 4. Closable informational notices

**File**: `src/components/tonight/OfflineCopy.astro`, `src/lib/offline/page-state.ts`, `src/lib/offline/page-state.test.ts`, `src/pages/auth/signin.astro`, `src/components/gear/DatabaseMissing.astro`

**Intent**: Offline, continue and DatabaseMissing notices become `dismissible`. Closing an offline notice sets a dismissed marker on its wrapper. `applyNotices` keeps a dismissed wrapper hidden until the next page load.

**Contract**:

- A pure exported helper (for example `noticeHidden({ kind, wanted, dismissed })`, next to `noticeFor`) decides visibility; `applyNotices` reads `[data-dismissed]` on the wrapper and calls it.
- `page-state.test.ts` unit-tests the helper (Vitest runs in `node`, no DOM). The DOM behaviour is covered by `toasts.spec.ts`.

#### 5. Tests, design and docs

**File**: `tests/e2e/sky-checks.spec.ts`, `planets-on-tonight.spec.ts`, `tonight-targets.spec.ts`, `observation-log.spec.ts`, `observation-log-management.spec.ts`, `moon-as-target.spec.ts`, `seven-night-planner.spec.ts`, `gear-catalogue.spec.ts`, `site-map.spec.ts`, `telescope-selector.spec.ts`, `site-location.spec.ts`, `offline.spec.ts`, a new `tests/e2e/toasts.spec.ts`, `src/pages/design.astro`, `CLAUDE.md`

**Intent**:

- URL assertions that expected the param now expect it removed after the toast shows (the toast text is asserted first).
- `toasts.spec.ts` covers:
  - fixed position above the TabBar at 390 px and under the Topbar at 1280 px;
  - × closes the toast;
  - it is gone after 10 s (fake clock);
  - a reload does not re-show it;
  - a closed offline notice stays closed after a DOM change.
- `/design` shows toast and dismissible states.
- CLAUDE.md gets a bullet: success notices are toasts, info notices are dismissible, errors stay inline.

**Contract**: The existing status-role assertions keep a single `role=status` per toast.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro sync && npx astro check`
- Unit tests pass (including `page-state.test.ts`, `copies.test.ts`, i18n parity): `npm test`
- Lint passes: `npx eslint . --ignore-pattern '.claude/**'`
- The new toast spec passes (local e2e run): `npx playwright test toasts`
- The updated notice specs pass (local e2e run): `npx playwright test sky-checks planets-on-tonight tonight-targets observation-log observation-log-management moon-as-target seven-night-planner gear-catalogue site-map telescope-selector site-location offline`

#### Manual Verification:

- Saving a sky check on /tonight shows a toast above the TabBar on a phone and under the nav on desktop. It disappears after 10 s, the URL loses `skyChecked=1`, and a reload shows no toast.
- The offline "prepared" notice can be closed and stays closed while the page keeps updating.
- Toasts read well in dark, light and red, and do not cover the settings panel's actions.

**Implementation Note**: Commit the phase and continue (see Phase 1).

---

## Phase 3: The dashboard sky band

### Overview

The headline becomes the verdict and the poster word goes. The header shrinks to the date. The slider carries the exact dark window and the zone. The panorama moves up less, loses its chevron chrome and scrollbar, and marks the centre compass point.

### Changes Required:

#### 1. Verdict

**File**: `src/components/tonight/VerdictCard.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`, `src/styles/global.css`

**Intent**:

- Remove the giant word and its `verdictSize`.
- Render the headline (`data-sky-headline`, inside `#verdict-heading`) at the `text-display` role with a larger tone dot. The reason sits on its own line below, in `text-body` muted.
- Keep only the date line above.
- In the no-darkness case, `explanation.returnText` moves under the headline, with the cause text.
- Delete `tonight.verdict.word`, `card.darkFrom`, `card.darkTo`, `card.timesIn` (keys in both catalogues) and the `--text-verdict-*` tokens.

**Contract**:

- `VerdictCard` gains `withSlider: boolean`. With the live sky (`true`) it shows only the date above the headline. Without it (the static fallback when the sky view fails, `TonightContent.astro:147-166`) it keeps one muted line with the dark window and the short zone, so that information is never lost.
- Call sites to update: `TonightContent.astro:136,142,152,158` and `design.astro:316-328` (the spread `skies[].props`) and `:1445-1455`.

#### 2. Slider: exact dark window and zone

**File**: `src/lib/sky-view/view.ts`, `src/lib/tonight/build.ts`, `src/lib/tonight/build.test.ts`, `src/components/tonight/TonightSkyView.tsx`, `src/components/tonight/sky-band.ts`, `src/components/tonight/TonightSkeleton.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**:

- The server adds `dark: { from, to, startLabel, endLabel }`, the exact fractions of the axis with `HH:mm` strings, and `zoneLabel`, a short server-formatted zone name ("CEST"; a "GMT+2"-style offset where the zone has no abbreviation), to the sky view.
- The island draws the dark stretch from the exact fractions.
- The legend becomes a label row aligned to the track's own box (on phones the track is only the middle of the time / track / Now row, so the row is offset to match it). It holds up to four labels at their positions: sunset (start), dark start, dark end, sunrise (end).
- One collision rule over all four: a label that would overlap its neighbour is dropped, sunset and sunrise first. If dark start and dark end still collide, they merge into one "21:40–05:10" label centred under the span. Label widths are measured in the browser after render; positions come from the server's fractions, and the texts are always the server's.
- The zone sits muted right after `[data-sky-time]`, outside it, through a new key (`tonight.sky.zone`, a function of `{ zone }`).
- The slider row height constants (`SLIDER_ROW_CLASS`, the comment's arithmetic) and the skeleton follow, re-measured.

**Contract**:

- The interface is `TonightSkyView` in `src/lib/sky-view/view.ts:30-54` (`SkyViewData` is only the island's import alias). It gains `dark: { from: number; to: number; startLabel: string; endLabel: string } | null` (fractions in 0..1), which replaces how the track places `darkSpan`. `darkSpan` (frame indices) stays for the sky colour and the initial index.
- It also gains `zoneLabel: string`.
- `[data-sky-time]`, `[data-sky-start]` and `[data-sky-end]` keep their text contracts (`tonight-sky.spec.ts:85-130`).
- New hooks `[data-sky-dark-start]` and `[data-sky-dark-end]`.

#### 3. Panorama overlap, chevrons, scrollbar, compass marker

**File**: `src/components/tonight/sky-band.ts`, `src/components/tonight/TonightSkyView.tsx`, `src/styles/global.css`

**Intent**:

- `STRIP_OVERLAP_CLASS` becomes `-mt-16` and `STRIP_OVERLAP_PX` becomes 64. Every consumer follows the constants.
- `PAN_FACE_CLASS` loses its background, border and blur. It keeps a 44 px target, heading ink and a hover or focus emphasis.
- The scrollbar is hidden (`scrollbar-width: none` plus the WebKit pseudo-element) in place of `scrollbar-strip`.
- On scroll and resize, the compass point whose x is nearest `scrollLeft + clientWidth / 2` is marked: heading ink, semibold, and a short bar under the label, drawn in the SVG. State updates only when the nearest point changes.

**Contract**:

- `scrollbar-strip` is replaced by a `scrollbar-hidden` utility (no other users).
- The compass marker carries `data-sky-compass-current="<point>"` on its `<text>`. When the opposite point is drawn twice, the visible copy nearest the centre wins.

#### 4. Heights, skeleton, tests, docs

**File**: `src/components/tonight/sky-band.ts`, `src/components/tonight/TonightSkeleton.astro`, `tests/e2e/tonight-phone.spec.ts`, `tests/e2e/tonight-sky.spec.ts`, `src/components/tonight/TonightSkyView.test.ts`, `src/pages/design.astro`, `CLAUDE.md`, `public/landing/tonight.png`

**Intent**:

- Re-measure `VERDICT_MIN_HEIGHT_CLASS` on the EN go verdict at 360 and 640 px and record the date.
- The skeleton's bars match the new verdict (date bar, display headline bar, reason bar).
- `tonight-sky.spec.ts` gains:
  - the dark edge labels equal the server's dark-window times;
  - the zone is shown;
  - the compass marker moves when the strip scrolls;
  - no visible scrollbar (`scrollbar-width` computed `none`).
- CLAUDE.md drops the poster word, the three-line header and the "-mt-24 fixed" rule, and documents the headline, slider and compass marker.

**Contract**: `tonight-phone.spec.ts:137-150` stays green through the constants.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro sync && npx astro check`
- Unit tests pass (build sky view fields, i18n parity, import guard, contrast): `npm test`
- Lint passes: `npx eslint . --ignore-pattern '.claude/**'`
- Sky specs pass (local e2e run): `npx playwright test tonight-sky tonight-dashboard tonight-phone onboarding offline`
- No `tonight.verdict.word` or `text-verdict-` remains: `grep -rn "verdict.word\|text-verdict-" src tests` returns nothing

#### Manual Verification:

- The headline reads as the main answer, clearly bigger than before and far smaller than the old word, in EN and PL at 360, 640 and 1280 px.
- The overlap is the user's 64 px (`-mt-16`), and no verdict or forecast text sits inside the strip's labelled area; the star field may still show faintly behind the verdict's bottom padding.
- The chevrons are bare icons; no scrollbar shows in Chromium (agent); Safari and Firefox are part of the joint check; the compass marker follows the swipe.
- The dark stretch's edge times match `TonightView.darkWindow` (asserted in `build.test.ts`) and `/tonight/plan`'s dark line; the zone sits next to the current time; labels never overlap at 320 px in EN and PL; there is no skeleton jump on swap.

**Implementation Note**: Commit the phase and continue (see Phase 1).

---

## Phase 4: Site and Telescope cards

### Overview

Replace the gear link and pills with two cards. Each has a title, a large icon, and a select (2+ items) or the name plus "Manage" (1 item). They sit side by side from `sm` and stack below.

### Changes Required:

#### 1. Selector rule

**File**: `src/lib/tonight/gear-choice.ts`, `src/lib/tonight/gear-choice.test.ts`, `src/lib/tonight/load.ts` (consumer at `:172-173`, `!== "none"`, still valid)

**Intent**: Pills are retired. `selectorKind` returns `none` below 2 items and `select` from 2. `SELECTOR_PILL_LIMIT` is removed.

**Contract**: `selectorKind(count): "none" | "select"`.

#### 2. Gear card component

**File**: `src/components/tonight/GearCard.astro` (new), `src/components/tonight/GearSelector.astro` (removed or reduced to the select form), `src/components/tonight/GearSelectField.tsx`

**Intent**:

- A bordered, rounded, surface card:
  - top line: the title (`tonight.siteSelector.label` / `tonight.selector.label`);
  - bottom-left: a lucide `MapPin` or `Telescope` at `size-10` in a token colour;
  - bottom-right, with 2+ items: the GET select form (`data-gear-select`, submit on change, the hidden "Show" fallback);
  - bottom-right, with 1 item: the name and a "Manage" `action` link to `/gear`.
- The card title is the select's `<label>` (no second visible label; `GearSelectField` takes the label as visually hidden or the card passes the title's id).
- The Manage link is named per card ("Manage sites" / "Manage telescopes"), so two cards never give two identical link names.
- The Manage link keeps `data-needs-network`. The select form gains `data-needs-network`, and `applyControls` in `page-state.ts` is extended from `a[href], button` to also disable `select`, so the select is disabled offline.
- This is a deliberate exception to "Bands, not boxed cards", recorded in CLAUDE.md.

**Contract**:

- Props: `kind: "site" | "telescope"`, `items`, `activeId`, `param`.
- The select keeps its label (`getByLabel(t.selector.label)` / `t.siteSelector.label`) and its `form[data-gear-select]` hook.
- New i18n keys `tonight.gear.manageSites` / `tonight.gear.manageTelescopes` (EN "Manage sites" / "Manage telescopes", PL "Zarządzaj miejscami" / "Zarządzaj teleskopami").
- Every card has the same minimum height, `GEAR_CARD_MIN_HEIGHT_CLASS` in `sky-band.ts`, shared with the skeleton.

#### 3. Dashboard row and skeleton

**File**: `src/components/tonight/TonightContent.astro`, `src/components/tonight/TonightSkeleton.astro`, `src/components/tonight/sky-band.ts`, `src/lib/offline/page-state.ts`

**Intent**: The gear row becomes `grid gap-3 sm:grid-cols-2` of the two cards, with load errors below. `gearLine` and `gearLink` are removed. The skeleton reserves two bars of `GEAR_CARD_MIN_HEIGHT_CLASS` with the same grid, so the swap does not jump whichever card variant arrives.

**Contract**: `GEAR_ROW_GAP_CLASS` stays the gap source shared with the skeleton.

#### 4. Tests, design, docs

**File**: `tests/e2e/telescope-selector.spec.ts`, `tests/e2e/seven-night-planner.spec.ts`, `tests/e2e/tonight-phone.spec.ts`, `src/pages/design.astro`, `CLAUDE.md`

**Intent**:

- The selector specs expect:
  - with 1 item: the name plus a Manage link and no select;
  - with 2 or 4 items: a select (no navigation pills) whose pick navigates to `?telescope=` / `?site=`.
- The telescope name is read from the card instead of the split gear link.
- `tonight-phone.spec.ts`: the first-screen test asserts the verdict and both cards above the TabBar at 390×844. The "first target above the fold" check is dropped (user decision, 2026-10-08). Sideways-scroll checks at 320/375 stay.
- `/design` gear specimens: 1 item, 2+ items, focus, offline.
- CLAUDE.md "Phone first" is updated.

**Contract**: None beyond the above.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro sync && npx astro check`
- Unit tests pass (including `gear-choice.test.ts`): `npm test`
- Lint passes: `npx eslint . --ignore-pattern '.claude/**'`
- Gear and phone specs pass (local e2e run): `npx playwright test telescope-selector seven-night-planner tonight-phone tonight-dashboard offline`

#### Manual Verification:

- Cards sit side by side at 640 and 1280 px and stack at 360 and 390 px, with long names truncated and no sideways scroll, in EN and PL.
- The large icons read clearly in dark, light and red; "Manage" looks clickable.
- Switching site or telescope from the select reloads Tonight for the pick.

**Implementation Note**: Commit the phase and continue (see Phase 1).

---

## Phase 5: Spacing and data points on their own lines

### Overview

Give Tonight's lists room to breathe, and split flowing " · " data lines into separate lines.

### Changes Required:

#### 1. Shared details and tiles

**File**: `src/components/tonight/TargetDetails.astro`, `src/components/tonight/ObjectDetails.astro`, `src/components/tonight/SeenTag.astro`, `src/components/ui/Tile.astro`, `src/components/ui/tile.ts`, `src/components/tonight/TonightTiles.astro`

**Intent**:

- The details `dl` drops `sm:grid-cols-2`, so every data point is on its own line at every width, with a larger row gap.
- The eyepiece sentence splits into "Find with …" and "Detail with …" lines.
- The `mt-*` steps between the details, the reason and the action grow.
- The dashboard tiles (Session plan, Moon, Planets) get more padding and gaps between their lines, especially below `sm`.

**Contract**: Spacing comes from scale classes in the shared parts, not per view.

#### 2. Targets, Planets, Nights, context line

**File**: `src/components/tonight/ObjectCard.astro`, `src/components/tonight/ObjectRow.astro`, `src/components/tonight/PlanetCard.astro`, `src/components/tonight/SolarSystemSection.astro`, `src/components/tonight/MoonCard.astro`, `src/components/tonight/NightStrip.astro`, `src/components/tonight/TonightPageSky.astro`, `src/components/tonight/TonightPageSkeleton.astro`

**Intent**:

- Each data point under a title gets its own line:
  - the target's constellation or Caldwell line;
  - the planet facts (one per line, no " · " join);
  - the Moon target's "Find with … · Detail with …" line (`MoonCard.astro:79-85`), split like the targets' eyepiece sentence;
  - the night row's date, dark window, headline, reason and Moon, with gaps between them.
- More `py` between rows.
- The focused pages' context line stacks the date and site · telescope on phones.
- The skeleton's generic rows follow the new rhythm.

**Contract**: Hash-scroll anchors (`object-<id>`, `planet-<key>`, `scroll-mt-4`) are unchanged.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro sync && npx astro check`
- Unit tests pass: `npm test`
- Lint passes: `npx eslint . --ignore-pattern '.claude/**'`
- Focused-page specs pass, including no sideways scroll (local e2e run): `npx playwright test tonight-targets planets-on-tonight moon-as-target seven-night-planner tonight-phone`

#### Manual Verification:

- Targets, Nights, Planets, Moon and the dashboard tiles read as clearly separated lines at 360 and 390 px, EN and PL, in all three themes.

**Implementation Note**: Commit the phase and continue (see Phase 1).

---

## Phase 6: Session plan with altitude curves (option B)

### Overview

Each Session plan row becomes a sentence line plus a small server-drawn altitude curve. A legend explains it. Sunset, dark and Moon move onto their own lines.

### Changes Required:

#### 1. Plan data

**File**: `src/lib/tonight/build.ts`, `src/lib/tonight/build.test.ts`, `src/lib/tonight/altitude-curve.ts` (new), `src/lib/tonight/altitude-curve.test.ts` (new)

**Intent**:

- When `withSessionPlan` is set, each plan row carries its altitude series over the sunset–sunrise axis. It reuses `objectTracks`, `planetTracks` and the shared `skyAxisWithMoon()` Moon track, packed like the sky view's, altitude only.
- Each row also carries the numeric peak altitude.
- The plan carries `minAltitudeDeg`.
- The tracks are computed inside the existing Session plan `try` (`build.ts:~1012-1137`): no new `catch`. A failure means no plan, exactly as any other plan failure does today; there is no separate "rows without a curve" path.
- The curve's geometry (time → x, altitude → y, the path, the minimum line, the window segment) is a pure module, `src/lib/tonight/altitude-curve.ts`, with its own unit test.

**Contract**:

- `TonightSessionPlanRowInput` (`build.ts:332-347`) gains `track: number[]` (altitude in tenths of degrees per 10-min step from the axis start) and `peakAltitudeDeg: number`.
- `TonightSessionPlan` (`build.ts:354-385`) gains `minAltitudeDeg: number`.
- No new `catch` anywhere in this phase.

#### 2. Plan rendering

**File**: `src/components/tonight/SessionTimeline.astro` (or a new `SessionPlanRow.astro` + `AltitudeSpark.astro`), `src/components/tonight/PlanPageContent.astro`, `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`, `src/styles/global.css`

**Intent**:

- The top text becomes separate lines: Sunset, Dark, Moon, Sunrise. The shared top axis drawing is dropped.
- Each row is the link with:
  - the name;
  - "Best 22:40 · window 21:40–23:10 · SW, 45°" (the existing `bestTime`, `windowText` and `bestDirection` strings);
  - an inline SVG curve on the shared axis width, with the dark window shaded (`--plan-night` over `--plan-twilight`), the minimum altitude as a dashed line, the best window drawn stronger, a dot at best, and sparse hour labels.
- A legend under the top lines: line = height above the horizon; dashed = your minimum altitude (N°); thicker stretch = the window (above your minimum altitude while dark); dot = best time.
- Rows get more vertical padding and a clear gap between rows, especially below `sm` (the user's "not enough breathing room between listed objects").

**Contract**:

- Rows keep `[data-session-plan-row]` and their accessible name (`rowLabel`). The top text keeps `[data-session-plan-text]`.
- The curve is `aria-hidden`.
- Shapes, not hue alone, separate the minimum line (dashed) and the best window (thicker), which red mode needs.
- New i18n keys under `tonight.pages.plan` (`rowLine`, `legendLine`, `legendMin`, `legendBest`), EN and PL.

#### 3. Tests, design, docs

**File**: `tests/e2e/tonight-dashboard.spec.ts`, `src/pages/design.astro`, `CLAUDE.md`, `tests/e2e/landing-screenshot.spec.ts`, `src/components/Welcome.astro`, `public/landing/tonight.png`

**Intent**:

- The dashboard/plan spec asserts the legend and that each row shows its "Best …" line and a curve.
- `/design` shows a row with a long window, a short window, an all-night planet, and in red.
- CLAUDE.md's Session plan description is updated.
- After Phases 3-6 have settled the dashboard, recapture `public/landing/tonight.png` (`CAPTURE_LANDING=1 … npx playwright test landing-screenshot`), re-measuring the clip and updating its size in both `landing-screenshot.spec.ts` and `Welcome.astro`.

**Contract**: None beyond the above.

### Success Criteria:

#### Automated Verification:

- Type check passes: `npx astro sync && npx astro check`
- Unit tests pass (plan rows carry tracks and peak altitude; `altitude-curve.test.ts`): `npm test`
- Lint passes: `npx eslint . --ignore-pattern '.claude/**'`
- Plan and phone specs pass (local e2e run): `npx playwright test tonight-dashboard tonight-phone offline`
- Production build passes with the service worker: `npm run build`

#### Manual Verification:

- Each target's curve rises and falls plausibly, its dot sits at the stated best time, and the dashed line sits at the site's minimum altitude (spot-check two targets against the Targets page).
- The legend makes the drawing understandable without prior knowledge (user check after Phase 6).
- Curves stay legible at 360 px and in red mode.
- Plan rows have clearly more room between them than before at 360 and 390 px.

**Implementation Note**: After this phase, run the full e2e suite and push. Then hand the joint manual check to the user.

---

## Testing Strategy

### Unit Tests:

- `page-state.test.ts`: the pure visibility helper keeps a dismissed offline notice hidden.
- `altitude-curve.test.ts`: time → x and altitude → y mapping, the minimum line and the window segment.
- `build.test.ts`:
  - `skyView.dark` fractions and labels match the dark window, and `zoneLabel` is the site zone;
  - plan rows carry `track` and `peakAltitudeDeg`, and the plan carries `minAltitudeDeg`;
  - a polar or no-dark night gives `dark: null`.
- `gear-choice.test.ts`: `none` for fewer than 2 items, `select` from 2.
- The contrast, red-theme, no-hardcoded-colours and i18n parity tests cover the new tokens and keys.

### Integration Tests:

- `toasts.spec.ts`: position, ×, 10 s, URL cleanup, reload, offline notice stays closed.
- `tonight-sky.spec.ts`: dark edge labels, zone, compass marker, hidden scrollbar.
- Selector specs: cards with 1, 2 and 4 items.
- `tonight-phone.spec.ts`: the new first screen (verdict and cards), plus no sideways scroll.

### Manual Testing Steps:

1. Save a sky check on /tonight: a toast appears and is gone in 10 s; the URL is clean; a reload shows no toast.
2. Swipe the panorama: the compass marker follows; no scrollbar; bare chevrons.
3. Switch telescope from the card select at 390 px and 1280 px.
4. Open /tonight/plan: read the legend; check one target's curve against /tonight/targets.
5. Cycle dark, light and red on Targets: Mark observed and the back link look clickable in each.

## Performance Considerations

Plan tracks add about 75 numbers per row (up to about 13 rows), computed by functions the sky view already runs. They are computed only for `withSessionPlan` (the dashboard and `/tonight/plan`). The dashboard already computes the same tracks for its sky view, so if the cost shows in the dashboard's server time, reuse those packed tracks when both options are set.

## Migration Notes

None. No data or schema changes. The removed i18n keys and tokens have no other users (research B).

## References

- Research: `context/changes/ui-user-adjustments/research.md`
- User list and decisions: `context/changes/ui-user-adjustments/change.md`, `plan-brief.md`
- Prior pattern: `context/archive/2026-10-07-ui-mobile-pass/` (sky-band constants, phone pin), `context/archive/2026-10-05-session-plan-timeline/plan-brief.md` (plan rows)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Clickable affordance and quieter subpage stars

#### Automated

- [x] 1.1 Type check passes: `npx astro sync && npx astro check` — d319ffc
- [x] 1.2 Unit tests pass, including the contrast, red-theme and no-hardcoded-colours tests: `npm test` — d319ffc
- [x] 1.3 Lint passes: `npx eslint . --ignore-pattern '.claude/**'` — d319ffc
- [x] 1.4 E2E specs touching Mark observed and back links pass — d319ffc

#### Manual

- [x] 1.5 Mark observed, back links and Pager links read as clickable in dark, light and red — d319ffc
- [x] 1.6 Inline links underlined; offline state of data-needs-network still looks disabled — d319ffc
- [x] 1.7 Focused-page stars dimmer; dashboard and landing stars unchanged — d319ffc

### Phase 2: Notifications as toasts

#### Automated

- [x] 2.1 Type check passes: `npx astro sync && npx astro check` — 354bee6
- [x] 2.2 Unit tests pass (including page-state, copies, i18n parity): `npm test` — 354bee6
- [x] 2.3 Lint passes: `npx eslint . --ignore-pattern '.claude/**'` — 354bee6
- [x] 2.4 The new toast spec passes — 354bee6
- [x] 2.5 The updated notice specs pass — 354bee6

#### Manual

- [x] 2.6 Sky-check toast positioned per breakpoint, gone after 10 s, URL cleaned, no toast on reload — 354bee6
- [x] 2.7 Offline "prepared" notice closes and stays closed — 354bee6
- [x] 2.8 Toasts read well in dark, light and red without covering the settings panel's actions — 354bee6

### Phase 3: The dashboard sky band

#### Automated

- [x] 3.1 Type check passes: `npx astro sync && npx astro check`
- [x] 3.2 Unit tests pass (build sky view fields, i18n parity, import guard, contrast): `npm test`
- [x] 3.3 Lint passes: `npx eslint . --ignore-pattern '.claude/**'`
- [x] 3.4 Sky specs pass
- [x] 3.5 No tonight.verdict.word or text-verdict- remains

#### Manual

- [x] 3.6 Headline reads as the main answer at 360, 640 and 1280 px, EN and PL
- [x] 3.7 Overlap is 64 px and no verdict text sits in the strip's labelled area
- [x] 3.8 Bare chevrons, no scrollbar (Chromium; Safari and Firefox in the joint check), compass marker follows the swipe
- [x] 3.9 Dark edge times match the dark window; zone beside the current time; no label overlap at 320 px; no skeleton jump

### Phase 4: Site and Telescope cards

#### Automated

- [ ] 4.1 Type check passes: `npx astro sync && npx astro check`
- [ ] 4.2 Unit tests pass (including gear-choice): `npm test`
- [ ] 4.3 Lint passes: `npx eslint . --ignore-pattern '.claude/**'`
- [ ] 4.4 Gear and phone specs pass

#### Manual

- [ ] 4.5 Cards side by side from 640 px, stacked at 360/390 px, no sideways scroll, EN and PL
- [ ] 4.6 Large icons clear in all themes; Manage looks clickable
- [ ] 4.7 Switching from the select reloads Tonight for the pick

### Phase 5: Spacing and data points on their own lines

#### Automated

- [ ] 5.1 Type check passes: `npx astro sync && npx astro check`
- [ ] 5.2 Unit tests pass: `npm test`
- [ ] 5.3 Lint passes: `npx eslint . --ignore-pattern '.claude/**'`
- [ ] 5.4 Focused-page specs pass, including no sideways scroll

#### Manual

- [ ] 5.5 Targets, Nights, Planets, Moon and dashboard tiles read as separated lines at 360/390 px in all themes

### Phase 6: Session plan with altitude curves (option B)

#### Automated

- [ ] 6.1 Type check passes: `npx astro sync && npx astro check`
- [ ] 6.2 Unit tests pass (plan rows carry tracks and peak altitude; layout helper): `npm test`
- [ ] 6.3 Lint passes: `npx eslint . --ignore-pattern '.claude/**'`
- [ ] 6.4 Plan and phone specs pass
- [ ] 6.5 Production build passes with the service worker: `npm run build`

#### Manual

- [ ] 6.6 Curves plausible, dot at the stated best time, dashed line at the site's minimum altitude
- [ ] 6.7 Legend makes the drawing understandable (user check)
- [ ] 6.8 Curves legible at 360 px and in red mode
- [ ] 6.9 Plan rows have clearly more room between them at 360 and 390 px
