# Tonight in the Nightfall design: implementation plan

## Overview

Recompose `/tonight` to match the Nightfall Tonight artboard the user chose on the canvas: `NightfallDark`, plus its light and red variants (https://claude.ai/artifact/8VZbxuqAVU1RntyMQ8u6vu). Top to bottom, the page becomes:

- **Sky.** A tall sky with decorative stars and a horizon silhouette. The Topbar sits inside it, above the date line.
- **Verdict.** A giant **Go / Marginal / No-go** word, with the sky headline and its reason below.
- **Summary bands.** Ruled bands for Point here first, The Moon, Planets and Next 7 nights (as bars), then the sky check.
- **Detail.** The full detail stays below as ruled bands: the Moon slider, planet detail, the ranked objects with eyepieces and "Mark observed", and the full 7-night strip. Each summary band's chevron jumps to its detail until the band pages exist (deferred).

## Current State Analysis

From `research.md` (`## Charges` C1–C5):

- **Shell and island (C1).** Tonight renders in `GearShell` with a plain Topbar. Its data part is one `server:defer` island, `TonightContent`, which renders the title, the selectors, a boxed `VerdictCard` + `MoonCard` grid, the sky-check card, the planets, the ranking and the strip (`TonightContent.astro:100-269`).
- **Boxes and kickers (C2).** Every section is a boxed card with an uppercase kicker.
- **Hand-made controls (C3).** Six button styles, a hand-made select, sub-44 px controls, and no token focus ring.
- **Missing data (C4).** No Go / Marginal / No-go copy exists. Nights carry no numeric clear share. There is no planet-names summary. The Moon disc is private to `MoonTimeSlider.tsx:63-93`.
- **Skeleton (C5).** `TonightSkeleton.astro:13-68` hand-copies the boxed layout.
- **Where the verdict lives.** The verdict is only known inside the island, while GearShell's `header` slot is rendered at page time (Astro 7.3.2 `server-islands.js:115-138`). Two islands would double `loadTonight` and could disagree on "now".

## Desired End State

In dark, light and red, at 390 and 1280 px, in EN and PL, a signed-in user with gear opens `/tonight` and sees:

- **Sky.** One continuous night sky from the Topbar down to a horizon silhouette. Over it:
  - the date and dark window;
  - the giant verdict word (Go / Marginal / No-go; PL Tak / Może / Nie);
  - the sky headline with its reason;
  - the forecast-age line.
- **Summary bands.** Ruled, unboxed, each heading followed by a chevron that jumps to its detail:
  - **Point here first:** the best three objects, listed by best time, with "{N} targets tonight".
  - **The Moon:** disc, %, phase and when it is up.
  - **Planets:** the names, plus the best one's reason.
  - **Next 7 nights:** seven bars. Height is the clear share; colour is the verdict for nights 1–3 and neutral after.
- **Sky check:** when a night is pending, the sky question with its three answers.
- **Detail bands:** Moon (with the slider), planets, ranked objects and the full strip. All controls are at least 44 px and use the shared components and the ring focus.

Edge states keep working:

- setup and add prompts;
- load errors;
- forecast none or fallback;
- no dark window;
- weather no-go (no ranking; the band says why);
- no planets;
- no Moon card;
- the `?logged`, `?skyChecked` and `?error` notices;
- missing database.

The skeleton paints the same sky, so nothing jumps. The 12 other `GearShell` pages render exactly as before.

### Key Discoveries:

- **GearShell.** `GearShell.astro:15-36` renders the sky band only from the `header` slot. `Topbar.astro:25` has no background, so it can sit on a zenith strip.
- **One shared load.** `loadTonight` (`src/lib/tonight/load.ts:88-140`) serves `/tonight` and `/tonight/all`. Do not fork it; add fields in `build.ts` instead.
- **Numbers to expose.** `CloudOutlook.meanCloudPct` exists in the engine (`src/lib/engine/verdict.ts:154-159`) but reaches the view only as text (`format.ts:474-482`). The private `listFormat` lives at `format.ts:186`.
- **E2E selectors to keep** (research §4):
  - Moon: `section[aria-labelledby="moon-heading"]` with `[data-moon-disc]`, `[data-moon-time]`, the slider and Now.
  - Planets: `planets-heading`.
  - Ranking: `section[aria-labelledby="ranking-heading"] ol > li`, the see-all links, `a[data-washed-out]`.
  - Nights: `section#nights` with h3 groups and 7 `li`.
  - Selectors: the site-selector navigation and `form[data-gear-select]`.
  - Verdict and sky check: the h1 named "Tonight", `#verdict-heading [data-sky-headline]`, `[data-sky-check]`.
  - The `role=status` notices.
- **Red mode.** The raster red filter applies to `img` only (`global.css:166`). Stars and the horizon must be inline SVG filled from tokens.

## What We're NOT Doing

- **Band pages.** No dedicated pages per band; they come later (user, 2026-10-04). Chevrons link to in-page anchors.
- **The dashboard and the interactive sky.** No S-11 dashboard move, no real planet positions, no time slider in the sky. The stars are decorative (user, 2026-10-04).
- **"Steady air".** Seeing is not modelled (research §2), so this line is dropped.
- **Moonrise in the summary.** No "until the Moon rises at …" sentence and no moonrise direction. That needs data the view does not carry; the Moon band uses the existing `upText`.
- **Opposition.** No opposition wording for planets.
- **`/tonight/all`.** No restyle there, beyond what shared-component changes reach.
- **The sky check stays three answers.** It is not cut to two (verdict-check product rule).
- **No new dependency, no second island, no `toHaveScreenshot` baselines.**
- **Topbar and nav stay as they are.** No site dropdown in the Topbar; the site and telescope selectors stay in-page, restyled.

## Implementation Approach

Follow the `/10x-ui` order:

1. **Data and copy (Phase 1).** The view gains what the design shows, before any markup changes.
2. **The sky (Phase 2).** It owns the architectural change: GearShell gets a sky-flow mode, and one island renders the sky band. That keeps one load and one "now". Content stays inside `<main>`, where the e2e specs scope.
3. **Bands (Phases 3–4).** Summary bands come first, then the existing detail is restyled into Bands.
4. **States, gate and rule (Phase 5).**

Each phase leaves `/tonight` building and its e2e suite green, with spec edits named per phase.

## Critical Implementation Details

- **Sky-flow layout.**
  - In sky-flow mode, GearShell puts the Topbar on a `bg-zenith` strip with no bottom rule, and renders `<main>` full width with no top padding.
  - Tonight's island then renders the sky band full-bleed (zenith to horizon, ending in the horizon silhouette), and wraps everything below in the usual `mx-auto max-w-3xl px-4` container.
  - The visual result is one sky from the top of the page. No negative margins and no arbitrary values.
- **Notices move into the island.**
  - The `?logged`, `?skyChecked` and `?error` values can only be read in the page shell, because the island's `Astro.url` is its own request (`tonight.astro:18-20`).
  - The shell resolves them to translated text and passes `{ tone, text }` props to `TonightContent`, which renders a `Notice` (or `ServerError`) under the sky.
  - Props must be plain strings; never pass raw query values.
- **Headings for e2e and a11y.**
  - The page keeps an h1 named "Tonight", visually hidden.
  - `#verdict-heading` contains the giant word and the `[data-sky-headline]` element, and keeps its level attribute.
  - Detail sections keep their `aria-labelledby` ids and gain `id` anchors (`moon`, `planets`, `ranking`, `nights`) for the summary chevrons. Summary bands must not reuse those ids.

## Phase 1: Data and copy

### Overview

Add the view fields and messages the design needs, and extract the Moon disc. No visible change yet.

### Changes Required:

#### 1. Verdict word and summary copy

**File**: `src/i18n/messages/en.ts`, `src/i18n/messages/pl.ts`

**Intent**: Add the copy the design needs. Go / Marginal / No-go is a new vocabulary used only as the giant word; the sky headline stays the canonical wording everywhere else.

**Contract**:

- New keys, with `satisfies Messages` parity:
  - `tonight.verdict.word.{go,marginal,no-go}`: EN "Go" / "Marginal" / "No-go"; PL "Tak" / "Może" / "Nie".
  - `tonight.summary.targets`: the band heading, "Point here first".
  - `tonight.summary.targetsCaption`: a plural over `{count}`, "Each at the time it stands highest. {count} targets tonight."
  - `tonight.summary.moon`, `tonight.summary.planets`, `tonight.summary.nights`: band headings.
  - `tonight.summary.nightsCaption`: "Height is clear sky. Colour is the verdict for the next three nights."
  - `tonight.summary.noTargets`: used when the ranking is null.
  - `tonight.summary.seeDetail`: the chevron's accessible label.
- Write natural Polish for every key.

#### 2. View fields

**File**: `src/lib/tonight/build.ts`, `src/lib/tonight/format.ts`

**Intent**: Expose the numbers and lists the bands render, in one place that `/tonight/all` shares unchanged.

**Contract**:

- `TonightNight` gains `clearPct: number | null`:
  - the value is 100 minus the mean cloud cover over that night's dark-window hours, rounded;
  - "dark-window hours" are the same hours `CloudOutlook` averages, applied to all 7 nights;
  - `null` when the night has no forecast hours or no darkness.
- The formatter exports `listOf(names: string[]): string` (locale `Intl.ListFormat`, conjunction), wrapping the private `listFormat`.
- `TonightView` gains `summaryTargets`: the best three ranking entries (by rank), sorted by `bestAt` ascending. Empty when `ranking` is null.
- No other view field changes, so `/tonight/all` is unaffected.

#### 3. Static Moon disc

**File**: `src/components/tonight/MoonDisc.tsx` (new), `src/components/tonight/MoonTimeSlider.tsx`

**Intent**: Move the private `MoonDisc` out of the slider so the Moon summary band can render the disc too.

**Contract**:

- The props match today's internal component (a `MoonDiscState` and a size).
- The slider imports it, and its behaviour and `[data-moon-disc]` are unchanged.
- The component is renderable server-side from Astro without hydration.

#### 4. Unit tests

**File**: `src/lib/tonight/build.test.ts` (or the existing nearest test file), `src/lib/tonight/format.test.ts`

**Intent**: Pin `clearPct` and `summaryTargets` order, keeping the tests modest.

**Contract**:

- `clearPct`: one night with known hours gives the expected rounded clear share; a night without hours gives `null`.
- `summaryTargets`: three entries come out in `bestAt` order.
- `listOf`: EN joins with "and", PL with "i".

### Success Criteria:

#### Automated Verification:

- Unit tests pass, including the new ones and i18n parity: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build succeeds: `npm run build`

#### Manual Verification:

- `/tonight` still renders exactly as before (no visible change in this phase), at 390 px in dark

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: The sky

### Overview

One continuous sky from the Topbar to the horizon, holding the date, the giant verdict and its explanation. The skeleton and the missing-database path paint the same sky.

### Changes Required:

#### 1. Sky-flow shell mode

**File**: `src/components/gear/GearShell.astro`

**Intent**: Let a page whose sky depends on island data still read as one sky under the Topbar (research §3, option b1).

**Contract**:

- A new optional prop, `skyFlow`.
- When it is set:
  - the Topbar row sits on `bg-zenith` with no bottom rule;
  - `<main>` is full width with no top padding;
  - TabBar is unchanged.
- Without the prop, and with the `header` slot, the output stays byte-identical to today's two modes.

#### 2. The sky band

**File**: `src/components/tonight/TonightSky.astro` (new)

**Intent**: The design's sky: decorative stars, a horizon silhouette, and a content slot, drawn from tokens so red mode stays pure red.

**Contract**:

- **Band.** A full-bleed zenith→horizon band ending in an inline-SVG horizon silhouette filled with `--background`.
- **Stars.** A fixed, seeded field of small inline-SVG stars filled with `--star`, hidden in the light theme (as in the design). Each star sits in a plain `<svg aria-hidden>`.
- **Content.** The slot is padded inside the shared `max-w-3xl px-4` container.
- **No arbitrary values.** Sizes come from the type roles and spacing scale. Add a type role (e.g. `--text-verdict`) in `@theme inline` if the giant word needs one; never a one-off value.

#### 3. The verdict in the sky

**File**: `src/components/tonight/VerdictCard.astro` (becomes the sky content), `src/components/tonight/TonightContent.astro`, `src/pages/tonight.astro`

**Intent**: Put the answer where the design puts it, and keep everything in one island.

**Contract**:

- `tonight.astro` uses `GearShell skyFlow`, keeps a visually hidden h1 "Tonight", and passes the resolved notice (`{ tone, text } | null`) to `TonightContent`.
- The no-Supabase path renders `TonightSky` with the title and `DatabaseMissing`.
- `TonightContent` renders `TonightSky` first. Over the sky, in this order:
  - the date line: `dateLabel` plus the dark window, or the no-dark-window text;
  - the giant word, from `tonight.verdict.word[level]`, using the expanded display type;
  - `#verdict-heading` containing the word and `[data-sky-headline]`, keeping its level attribute;
  - the headline with `verdictText` and the explanation (next clearer night / no darkness), as today's card does;
  - the forecast-status line, emphasised when it is none or fallback.
- Under the sky: the notice, then the setup, add-site and add-telescope prompts and errors. The prompts are now `buttonVariants` links in Bands.

#### 4. Skeleton

**File**: `src/components/tonight/TonightSkeleton.astro`

**Intent**: Load into the same sky, so nothing jumps (server-latency decision).

**Contract**:

- The skeleton draws `TonightSky` with placeholder bars where the date, word and lines go.
- Below the sky, ruled placeholder bands replace the boxed cards.
- The skeleton keeps the visually hidden h1 "Tonight" that the specs await.

#### 5. Specs

**File**: `tests/e2e/*.spec.ts` (only those whose selectors change in this phase)

**Intent**: Keep the suite on stable hooks.

**Contract**:

- Update only selectors that moved: the h1 wait, `#verdict-heading` scope and notice placement.
- No new spec.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build succeeds: `npm run build`
- Hardcoded-value scan on `tonight.astro`, `GearShell.astro`, `TonightSky.astro`, `VerdictCard.astro`, `TonightContent.astro` and `TonightSkeleton.astro` returns 0 arbitrary values and 0 literal colours
- e2e suite passes against local preview: `npm run test:e2e`

#### Manual Verification:

- At 390 and 1280 px in dark, light and red, the Topbar and the sky read as one band with stars (none in light), the horizon silhouette, the giant word and the explanation. The skeleton paints the same sky with no jump. Red has no G or B channel above 8.
- `/gear` and another `GearShell` page render as before

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Summary bands

### Overview

The design's ruled summary bands under the sky, each linking to its detail.

### Changes Required:

#### 1. Summary bands

**File**: `src/components/tonight/TonightSummary.astro` (new), `src/components/tonight/TonightContent.astro`

**Intent**: Answer "what do I point at, what's the Moon doing, which planets, how's the week" at a glance, as the design does.

**Contract**:

- Each band is a full-width link (44 px plus) with its heading, a chevron, `focus-visible:outline-ring`, `hover:bg-accent`, and `href` to its detail anchor.
- **Point here first:**
  - `summaryTargets` as rows of localized name and `bestTime`, tabular figures;
  - the caption with `clearedCount`;
  - with no ranking, the band shows `noTargets` with the explanation's next clearer night.
- **The Moon:**
  - `MoonDisc` at the page-load state;
  - the illuminated % in the expanded display type;
  - the phase name and `upText`;
  - omitted when `moonCard` is null.
- **Planets:**
  - `listOf(names)` as the band value, and the first entry's `reason` as the sentence;
  - `noneText` when the entries are empty;
  - omitted when `solarSystem` is null.
- **Next 7 nights:**
  - seven bars with height from `clearPct` (a `null` night draws a hairline) and colour from `go`/`marginal`/`no-go` tokens for nights 1–3, `muted` for nights 4–7;
  - day labels from `label`, plus the caption;
  - the bars are decorative (`aria-hidden`), and the band's accessible text summarises the three verdict nights.
- No summary band reuses the detail sections' ids.

#### 2. Sky check as a band

**File**: `src/components/tonight/SkyCheckCard.astro`, `src/components/sky-checks/SkyAnswerForm.astro`

**Intent**: The design's "looking back" band, keeping all three answers.

**Contract**:

- `[data-sky-check]` and the form posts are unchanged.
- The card becomes a Band with the existing title and "we said" line.
- The answers use `buttonVariants`: the matching answer `outline`, the others `ghost`. There is no primary fill here, so the page keeps at most one primary action.
- Skip and All stay as `link` or `ghost`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build succeeds: `npm run build`
- Hardcoded-value scan on `TonightSummary.astro`, `SkyCheckCard.astro` and `SkyAnswerForm.astro` returns 0
- e2e suite passes against local preview: `npm run test:e2e`

#### Manual Verification:

- The summary matches the canvas in spirit at 390 and 1280 px in all three themes
- Each chevron lands on its detail
- A no-go night (fixture) shows the no-targets text and the next clearer night
- The bars read correctly in red (brightness only)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Detail as bands

### Overview

Restyle the existing detail sections into ruled Bands with the shared components, without changing what they do.

### Changes Required:

#### 1. Moon, planets, ranking, strip

**File**: `src/components/tonight/MoonCard.astro`, `MoonTimeSlider.tsx`, `SolarSystemSection.astro`, `PlanetCard.astro`, `ObjectCard.astro`, `ObjectDetails.astro`, `TargetDetails.astro`, `NightStrip.astro`, `TonightContent.astro`

**Intent**: Address charges C2 and C3 for the detail.

**Contract**:

- **Bands and headings.** Each section is a `Band`, with its existing `aria-labelledby` heading id, plus `id` anchors (`moon`, `planets`, `ranking`, `nights`). Headings use the type roles, and uppercase kickers are gone.
- **No boxes.** Items are rows separated by rules, not boxes. The "Seen" chip is one shared markup (a tiny local component if needed).
- **Actions.**
  - "Mark observed", "See all", "See all N", the washed-out link, the add-eyepieces link and Now use `buttonVariants`, or the link style with `min-h-11`.
  - The slider and Now keep their behaviour and `[data-moon-*]` hooks.
  - Focus is `focus-visible:outline-ring` everywhere.
- **Strip.** `NightStrip` keeps `section#nights`, its h3 groups and 7 `li`, loses its arbitrary `grid-cols-[…]`, and moves to type-role text.
- **No arbitrary values.** Remove the 14 arbitrary-value hits in these files. Pseudo-element variants on the range input may stay if no shared utility covers them; list any that remain.

#### 2. Selectors and prompts

**File**: `src/components/tonight/GearSelector.astro`, `src/components/tonight/TonightContent.astro`

**Intent**: 44 px controls in the field, and a single field style.

**Contract**:

- Pills become 44 px `buttonVariants` links with `aria-current`. The active pill is `outline`, never the `default` fill, so it isn't read as a primary action.
- The dropdown is `NativeSelect` + `Label`; `form[data-gear-select]` and the site-selector navigation name are unchanged.
- The gear line is a 44 px link.
- The local `primaryLink` and `promptCard` strings are gone.

#### 3. Specs

**File**: `tests/e2e/*.spec.ts` (only those whose selectors change in this phase)

**Intent**: Follow any markup moves; selectors stay role and id based.

**Contract**: Only the selectors that moved change; no new spec.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build succeeds: `npm run build`
- Hardcoded-value scan on all `src/components/tonight/*` and `src/pages/tonight.astro` returns 0 arbitrary values and 0 literal colours, down from 14 (pseudo-element variants listed if kept)
- e2e suite passes against local preview: `npm run test:e2e`
- Smoke walk passes against local Supabase: `npm run smoke`

#### Manual Verification:

- No boxed cards remain on `/tonight`; detail reads as ruled bands in all three themes at 390 and 1280 px
- Every control on `/tonight` is at least 44 px with a visible ring focus (measured)
- The Moon slider, "Mark observed" and the selectors work as before

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: States, visual gate and the rule

### Overview

Show the new Tonight pieces in their states, capture the screenshot gate for the user's approval, and update the agent rule.

### Changes Required:

#### 1. Kitchen sink

**File**: `src/pages/design.astro`

**Intent**: Add the Tonight specimens to the dev-only kitchen sink.

**Contract**:

- **Sky.** `TonightSky` with the verdict in each of go, marginal, no-go, forecast none and no dark window.
- **Summary.** A summary band in default, hover, focus-visible and empty states.
- **Bars.** The bars with null nights.
- **Skeleton.** The skeleton sky.
- **Sizing.** These specimens use static sample data and keep 0 arbitrary values.

#### 2. Screenshot gate

**File**: a scratch Playwright script in the session scratchpad (not committed)

**Intent**: The before/after gate the user approves.

**Contract**:

- `/tonight` before and after, in these states:
  - go, marginal and no-go (forecast fixture variants);
  - a pending sky check;
  - setup needed;
  - a notice;
  - the skeleton.
- Matrix: EN/PL × dark/light/red × 390/1280.
- Red shots pass the pixel audit: no G or B channel above 8.
- Published as a review page for the user.

#### 3. Agent rule

**File**: `CLAUDE.md` (`AGENTS.md` is a symlink)

**Intent**: Keep the next agent on the contract.

**Contract**: The "## UI (Nightfall)" block gains one line:

- the sky-flow mode, for a page whose sky depends on island data;
- `TonightSky` as the sky band;
- the giant verdict word as Tonight's only Go / Marginal / No-go use.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm test`
- Lint passes: `npm run lint`
- Type check passes: `npx astro check`
- Build succeeds: `npm run build`
- `CLAUDE.md` and `AGENTS.md` stay identical: `diff CLAUDE.md AGENTS.md`

#### Manual Verification:

- `/design` shows the Tonight specimens in dark, light and red
- The screenshot matrix for `/tonight` is approved by the user
- Red-mode screenshots pass the pixel audit (no G or B channel above 8)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `clearPct` (one known night, one null night), `summaryTargets` order, and `listOf` in EN and PL. Modest, per the user's earlier preference.
- i18n parity covers the new keys. The colour, red and contrast guards cover any new token.

### Integration Tests:

- The existing e2e suite, kept green phase by phase, with only selector updates. It covers onboarding, the seven-night planner, the Moon card, planets, the observation log, sky checks, the telescope selector and Tonight's all-objects page.
- `npm run smoke` at Phase 4.

### Manual Testing Steps:

1. Open `/tonight` on a go night at 390 px in dark: one sky, a giant "Go", bands, then detail.
2. Repeat in PL ("Tak"), in light (no stars) and in red (pure red).
3. Tap each summary band and land on its detail.
4. Use the Moon slider and "Mark observed", then answer the sky check. Each notice appears under the sky.
5. Load with a cold cache: the skeleton sky shows first, with no jump.

## Performance Considerations

There is still one island and one `loadTonight` per view. The stars and horizon are a few hundred bytes of inline SVG. No new requests.

## Migration Notes

No data changes. Rollback is a revert of the change's commits.

## References

- Research and charges: `context/changes/tonight-nightfall/research.md`
- Design: https://claude.ai/artifact/8VZbxuqAVU1RntyMQ8u6vu (`NightfallDark`, `NightfallSpec`)
- Contract: `context/changes/visual-redesign/plan.md`, `CLAUDE.md` "## UI (Nightfall)"
- Prior Tonight decisions: the moonlight-and-the-verdict, verdict-check, seven-night-site-planner, planets-on-tonight, server-latency and tonight-all-objects archives

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data and copy

#### Automated

- [x] 1.1 Unit tests pass, including the new ones and i18n parity — d8f4d3f
- [x] 1.2 Lint passes — d8f4d3f
- [x] 1.3 Type check passes — d8f4d3f
- [x] 1.4 Build succeeds — d8f4d3f

#### Manual

- [x] 1.5 /tonight still renders exactly as before at 390 px in dark — d8f4d3f

### Phase 2: The sky

#### Automated

- [x] 2.1 Unit tests pass — 9ebe554
- [x] 2.2 Lint passes — 9ebe554
- [x] 2.3 Type check passes — 9ebe554
- [x] 2.4 Build succeeds — 9ebe554
- [x] 2.5 Hardcoded-value scan on the sky files returns 0 — 9ebe554
- [x] 2.6 e2e suite passes against local preview — 9ebe554

#### Manual

- [x] 2.7 One sky with stars, horizon, giant word and explanation in all themes at 390 and 1280; skeleton without jump; red audit — 9ebe554
- [x] 2.8 /gear and another GearShell page render as before — 9ebe554

### Phase 3: Summary bands

#### Automated

- [x] 3.1 Unit tests pass — 5222798
- [x] 3.2 Lint passes — 5222798
- [x] 3.3 Type check passes — 5222798
- [x] 3.4 Build succeeds — 5222798
- [x] 3.5 Hardcoded-value scan on the summary and sky-check files returns 0 — 5222798
- [x] 3.6 e2e suite passes against local preview — 5222798

#### Manual

- [x] 3.7 Summary matches the canvas in spirit at 390 and 1280 in all themes — 5222798
- [x] 3.8 Each chevron lands on its detail — 5222798
- [x] 3.9 No-go night shows the no-targets text and next clearer night — 5222798
- [x] 3.10 Bars read correctly in red — 5222798

### Phase 4: Detail as bands

#### Automated

- [x] 4.1 Unit tests pass
- [x] 4.2 Lint passes
- [x] 4.3 Type check passes
- [x] 4.4 Build succeeds
- [x] 4.5 Hardcoded-value scan on all Tonight files returns 0 (pseudo-element variants listed)
- [x] 4.6 e2e suite passes against local preview
- [x] 4.7 Smoke walk passes against local Supabase

#### Manual

- [x] 4.8 No boxed cards remain; detail reads as ruled bands in all themes at 390 and 1280
- [x] 4.9 Every /tonight control is at least 44 px with a visible ring focus
- [x] 4.10 Moon slider, Mark observed and the selectors work as before

### Phase 5: States, visual gate and the rule

#### Automated

- [ ] 5.1 Unit tests pass
- [ ] 5.2 Lint passes
- [ ] 5.3 Type check passes
- [ ] 5.4 Build succeeds
- [ ] 5.5 CLAUDE.md and AGENTS.md stay identical

#### Manual

- [ ] 5.6 /design shows the Tonight specimens in dark, light and red
- [ ] 5.7 Screenshot matrix for /tonight approved by the user
- [ ] 5.8 Red-mode screenshots pass the pixel audit
