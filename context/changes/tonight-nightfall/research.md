---
date: 2026-10-04T15:31:29+02:00
researcher: Claude (Opus 5.5) for Rafał Skwara
git_commit: 103a95b
branch: feat/tonight-nightfall
repository: RafalSkwara/Sidereus
topic: "/10x-ui audit of /tonight against the Nightfall contract and the chosen canvas design"
tags: [research, ui, tonight, nightfall, server-island]
status: complete
last_updated: 2026-10-04
last_updated_by: Claude (Opus 5.5)
---

# Research: /tonight against Nightfall and the chosen canvas design

**Date**: 2026-10-04T15:31:29+02:00
**Researcher**: Claude (Opus 5.5)
**Git Commit**: 103a95b (main after #89 and #90)
**Branch**: feat/tonight-nightfall
**Repository**: RafalSkwara/Sidereus

## Research Question

The user wants `/tonight` to look like the Nightfall Tonight artboard they chose on the canvas (`NightfallDark` plus its light and red variants; https://claude.ai/artifact/8VZbxuqAVU1RntyMQ8u6vu). This research covers four things:

- **Audit.** Where does the view diverge from the Nightfall contract in `src/styles/global.css`, `src/components/ui/*` and the `GearShell` header slot?
- **Data.** Which existing view data feeds each canvas element?
- **Architecture.** What constrains putting island-rendered data inside the sky header?
- **History.** Which earlier decisions and e2e selectors bind a recomposition?

## Summary

- **Tonight predates the contract.**
  - Across 19 Tonight files the only shared component imported is `ServerError`, imported 3 times (`tonight.astro:7`, `TonightContent.astro:6`, `AllObjectsContent.astro:7`). Nothing comes from `src/components/ui/`.
  - The view is built from boxed cards and uppercase kickers, with 14 arbitrary-value hits and 0 literal colours.
  - No Tonight control uses the shared `focus-visible:outline-ring` focus style.
  - Several controls are under 44 px: GearSelector pills, the GearSelector select, the setup and add prompts, and the gear line.
- **The canvas maps onto existing data, with five gaps.**
  - **Verdict words.** There is no Go / Marginal / No-go wording. The app words the verdict as sky headlines. The user decided on 2026-10-04 to add Go / Marginal / No-go as the giant word, with the headline below it.
  - **Seeing.** "Steady air" is not modelled; the forecast fetches only cloud and humidity.
  - **Bar heights.** The seven-night strip has no numeric clear share for the bars.
  - **Moon.** The Moon has no "rises at" field and no rise direction.
  - **Planets.** There is no planets summary sentence and no opposition.
- **Architecture.** The verdict is only known inside the `server:defer` island, while GearShell's `header` slot is rendered by the page shell at page time.
  - Two islands would double every load and could let two "now"s disagree on one screen, contradicting a seven-night decision.
  - The clean option is one island that renders the sky band itself, under a shell mode where the Topbar sits on the zenith colour with no rule, so the band reads as one sky.

## Detailed Findings

### 1. Contract audit (view → source)

The hardcoded-value scan (the `/10x-ui` grep plus a broader `-[…]` sweep) found 14 hits across 10 of the 19 files, and no hex, rgb, oklch or palette colours.

| File | Hits |
| --- | --- |
| `pages/tonight.astro` | `:64` (tracking) |
| `TonightContent.astro` | `:102` (tracking) |
| `VerdictCard.astro` | `:41` |
| `MoonCard.astro` | `:26` |
| `SkyCheckCard.astro` | `:33`, `:41` |
| `NightStrip.astro` | `:33` |
| `AllObjectsContent.astro` | `:55`, `:66` |
| `MoonTimeSlider.tsx` | `:40`, `:49`, `:51` |
| `GearSelector.astro` | `:64` |
| `ObjectRow.astro` | `:26` |

The grep misses some other arbitrary utilities:

- `NightStrip.astro:29`: `grid-cols-[6.5rem_…]`.
- `AllObjectsContent.astro:55`: `transition-[…]`.
- Pseudo-element variants in `MoonTimeSlider.tsx:50-55` and `ObjectRow.astro:24`.

The copied patterns that shadow shared components:

- **Boxed cards** (`rounded-2xl border border-border bg-surface p-…`) at:
  - `TonightContent.astro:97` (used at `:137,145,153`)
  - `VerdictCard.astro:40`
  - `MoonCard.astro:24`
  - `SkyCheckCard.astro:38`
  - `SolarSystemSection.astro:33`
  - `PlanetCard.astro:21`
  - `ObjectCard.astro:20`
  - `NightStrip.astro:42`
- **Uppercase kickers** at:
  - `tonight.astro:64`
  - `TonightContent.astro:102`
  - `VerdictCard.astro:41`
  - `MoonCard.astro:26` (this one is the h2)
  - `SkyCheckCard.astro:41`
  - `NightStrip.astro:33`
- **A local `primaryLink`** at `TonightContent.astro:95-96`.
- **Hand-made buttons:**
  - the see-all box (`TonightContent.astro:248-250`)
  - `SkyCheckCard.astro:32-33`
  - the Moon's Now button (`MoonTimeSlider.tsx:37-41`)
  - the GearSelector pills (`GearSelector.astro:25-26`)
  - "Mark observed" (`TargetDetails.astro:46-49`)
- **A hand-made select** at `GearSelector.astro:58-71`.
- **Duplicate status notices** at `tonight.astro:35-41` and `:44-50`. They skip `Notice`'s announce-once script (`Notice.astro`).

Headings use `text-2xl` to `text-5xl` instead of the type roles, for example `TonightContent.astro:105`, `VerdictCard.astro:44` and `TonightSkeleton.astro:14`.

`TonightSkeleton.astro:13-68` hand-copies today's card layout: a kicker bar, an h1, two boxed cards, three object cards and a boxed strip. It will not match a new layout unless it is rewritten with the same primitives.

### 2. Canvas → data map

The view type is `TonightView`, built from `src/lib/tonight/build.ts:298-337` and filled at `:402-725`. Strings come from `src/lib/tonight/format.ts`.

| Canvas element | Existing source | Gap |
| --- | --- | --- |
| Date line ("Saturday 4 October, 23:00. Full darkness.") | `view.dateLabel` (`build.ts:707`, long date with year, `format.ts:159-165`); `view.darkWindow` `HH:mm` strings (`:712-715`); `view.darkStart` (`:319`) | No "now" and no darkness state on the view. Plan: show the date plus the dark window ("Dark 21:40–05:30") instead of a live "now". |
| Giant word | `view.verdict.level` (`engine/types.ts:92`) | No Go / Marginal / No-go copy exists. **User decision (2026-10-04): add it as the giant word.** |
| Line under it | `view.headline.text` (`format.ts:279-291`); `view.verdictText` (`format.ts:302-319`); `view.explanation` (`build.ts:469-485`); `view.forecastStatus.text` (`format.ts:367-376`) | The canvas sentence "Clear and dark from X until the Moon rises at Y" needs moonrise data that is not on the view. Plan: headline + verdict reason, as today's card does (`VerdictCard.astro:46-50`). |
| Cloud line ("8% cloud, steady air") | The cloud % is only inside `verdict.reason` (`engine/types.ts:98-119`) and `verdictText` | Seeing is not modelled (`forecast/open-meteo.ts:49`). Plan: drop "steady air"; the forecast-age line takes this slot. |
| Point here first | `view.ranking.entries[0..2]`: `bestTime`, name via `localCommonName` (`build.ts:76-101`, `ObjectCard.astro:17`); `clearedCount` (`build.ts:246`) | Ranking is in score order, not time order; planets and the Moon are not in it (`build.ts:496-507`). `ranking` is null on no-go or no-dark nights. A new caption message is needed. |
| The Moon | `moonCard.states[initialIndex].illuminatedFraction` / `.band`; `phaseText` (`build.ts:689`); `upText` (`:690`) | No separate rise field or direction. Plan: disc + % + `upText`. The disc renderer is private to `MoonTimeSlider.tsx:63-93`; it can be extracted over the pure `moonDiscPaths` (`src/lib/moon-disc/geometry.ts`). |
| Planets | `view.solarSystem.entries[]` (`build.ts:138-188`): name, `bestTime`, `reason` | No headline list and no summary sentence. Plan: headline = names joined with `Intl.ListFormat` (the private `listFormat` in `format.ts:186` needs exposing); sentence = the first entry's `reason`. Opposition is not modelled. |
| Next 7 nights | `view.nights[]` (`build.ts:284-296`): `label`, nights 1-3 `level` + `headline`, nights 4-7 `cloudText` | No numeric clear share. `CloudOutlook.meanCloudPct` exists in the engine (`engine/verdict.ts:154-159`) but only formatted text reaches the view. Plan: expose a clear share per night for the bar height. |
| Sky check | `SkyCheckCard` props `check`, `tonightDate` (`TonightContent.astro:81`); `SkyAnswerForm` posts `/api/log/sky/[id]` | The canvas shows 2 buttons; the model has 3 answers + Skip. Keep 3 (product rule, `verdict-check/plan-brief.md:24`). |
| Site in header | `GearSelector` (pills ≤ limit, otherwise an auto-submitting GET dropdown, `gear-choice.ts:35-38`); `gearLine` (`TonightContent.astro:91-93`) | No header dropdown. Plan: keep the selectors in-page under the sky, restyled to 44 px. |

Edge states the composition must keep are listed in `TonightContent.astro:100-162` and `tonight.astro:34-68`:

- signed out, or no Supabase
- `needsSetup`
- no site, or no telescope
- `sitesError`, `telescopesError`, `tonightError`
- forecast `none` or `fallback`
- no dark window
- weather no-go (`ranking` null)
- empty ranking
- `solarSystem` null or empty
- `moonCard` null, or `states` empty
- eyepiece, log and no-eyepiece notices
- the `?logged`, `?skyChecked` and `?error` notices
- the loading skeleton

### 3. Architecture: verdict in the sky

- **The band.** `GearShell.astro:15,20-28` renders the sky band from the `header` slot. `Topbar.astro:25` has no background of its own.
- **Server islands.** In Astro 7.3.2 (`node_modules/astro/dist/runtime/server/render/server-islands.js`):
  - `render()` places the island's fallback and script at the component's slot position (`:57-70`, `:177-191`).
  - Non-fallback slots are rendered at page time and sent to the island (`:115-138`).
  - Each island is its own request (`:150-170`).
- **No deduplication.** Per call, `loadTonight` (`src/lib/tonight/load.ts:88-140`) runs 5 Supabase reads, the forecast and `buildTonight`, with no memo.
- **Options:**
  - **(a) Two islands.** Doubles the loads, fires `skyCheckStore.record` twice (`TonightContent.astro:71-79`), and may compute two different "now"s (`:62`). That contradicts `context/archive/*seven-night-site-planner*/plan-brief.md:25`, where the verdict and night 1 come from one engine result.
  - **(b1) One island that renders the sky band itself.** GearShell gets a mode where the Topbar sits on `bg-zenith` with no rule and `<main>` has no top padding for this page, so the island's band continues the sky. One load, one `now`, and the content stays inside `<main>`, where the e2e specs scope. Recommended.
  - **(c) Static sky with the verdict overlaid.** Needs negative margins (arbitrary values) and a reserved height for verdict text that varies in length.
  - **(d2) A script that moves nodes.** Not recommended.
- **Notices.** The page-shell notices (`tonight.astro:34-56`) would sit between the Topbar and the sky under (b1). Move them below the island's sky, or pass them in as props.
- **Skeleton.** It must draw the same sky band and horizon so nothing jumps, honouring the user's no-jump decision in `context/archive/*server-latency*/plan-brief.md:23`.
- **View transitions.** Unaffected: `nav-current` and `tab-current` stay in the static Topbar and TabBar (`global.css:228-260`).

### 4. E2E selectors that bind the markup

From `tests/e2e/*.spec.ts`:

- **Tonight h1.** An h1 named `en.tonight.title` is awaited in `telescope-selector.spec.ts:69` and `seven-night-planner.spec.ts:39`. If the giant word became the h1, these specs would break. Keep "Tonight" as a visually hidden h1, or in the date line.
- **Verdict and sky-check hooks:**
  - `section[aria-labelledby="verdict-heading"]` in `moon-card:29` and `moon-as-target:32`.
  - `#verdict-heading [data-sky-headline]` with the level attribute and text "Clear", in `onboarding:51-53` and `landing-screenshot:75-77`.
  - `[data-sky-headline]` in `sky-checks:38` and `seven-night:25,112-121`.
  - `[data-sky-check]` in `sky-checks:32-39`.
- **Moon:** `section[aria-labelledby="moon-heading"]` with its h2, the slider, `[data-moon-time]`, `[data-moon-disc]`, Now, and the Mark-observed link and seen tag (`moon-card:19-67`, `moon-as-target:33-55`).
- **Planets:** `section[aria-labelledby="planets-heading"]`, the list named `planets.listLabel`, an h3 per card, Mark observed, and the "none" text (`planets-on-tonight:28-61`).
- **Ranking:** `section[aria-labelledby="ranking-heading"] ol > li`, the see-all links and `a[data-washed-out]`, used in:
  - `observation-log:26-63`
  - `onboarding:54-56`
  - `telescope-selector:17-123`
  - `tonight-all-objects:15-55`
- **Seven nights:** `section#nights`, with its h2, h3 group labels, `timesIn` and 7 `li` (`seven-night:26-156`).
- **Selectors:** the site-selector navigation, `aria-current`, and `form[data-gear-select]` (`seven-night:29-154`, `telescope-selector:83-110`).
- **Notices and `main`-scoped items:**
  - `role=status` notices (`moon-as-target:53`, `planets-on-tonight:57`, `observation-log:54`, `sky-checks:37`).
  - The gear line and the no-eyepieces prompt are scoped to `main` (`telescope-selector:84,131-135`).

## Code References

- `src/components/gear/GearShell.astro:15-36`: the sky-header slot and the `<main>` frame.
- `src/pages/tonight.astro:34-68`: page notices, the island and its fallback.
- `src/components/tonight/TonightContent.astro:56-269`: the load, record, layout and edge states.
- `src/lib/tonight/build.ts:298-337,402-725`: the `TonightView` type and its builder.
- `src/lib/tonight/format.ts:159-680`: wording and formatting (EN/PL).
- `src/components/tonight/MoonTimeSlider.tsx:63-93`: the private `MoonDisc` SVG renderer.
- `src/lib/engine/verdict.ts:154-159`: `CloudOutlook.meanCloudPct`.
- `src/components/tonight/TonightSkeleton.astro:13-68`: the hand-copied skeleton.

## Architecture Insights

- One shared `loadTonight` serves `/tonight` and `/tonight/all` (`context/archive/*tonight-all-objects*/plan-brief.md:27`). Do not fork it.
- The verdict wording is chosen by level and reason, and the same words appear everywhere (`context/archive/*moonlight-and-the-verdict*`). The new giant word is an addition by level; the sky headline stays the canonical "what kind of sky" word for the strip, the sky check and the log.
- Red mode is strictly red: zero green and blue, verdicts told apart by brightness only (`context/archive/*red-night-mode*/plan-brief.md:22-25`). The raster red filter applies to `img` only (`global.css:166`), so the inline SVG stars and horizon must use colour tokens.

## Historical Context (from prior changes)

- `context/changes/visual-redesign/plan.md:59,76,307-312`:
  - The sky header uses the static zenith and horizon tokens.
  - The band is rendered by GearShell around the Topbar.
  - The Topbar stays at most 64 px, with the pill, the tab bar and the transition names unchanged.
- `context/foundation/roadmap.md:167,170,182`:
  - The Nightfall direction is "the sky at this hour is the page; the horizon splits the answer from the detail bands".
  - The screenshot gate covers EN/PL × light/dark/red × phone/desktop.
  - The interactive sky is S-11.
- The moonlight-and-the-verdict archive has the user's Moon card choices: the slider in 10-minute steps, a Now button, and the faint-objects line. Its sky + Moon side-by-side layout is superseded by this design (user choice on 2026-10-04).
- `verdict-check` archive: the sky-check card sits below the verdict, asks about night 1 only, and has three sky words as answers (`plan-brief.md:24,28,33`).
- `planets-on-tonight` archive: planets get their own section above the Messier top five (`plan-brief.md:29`).
- `seven-night-site-planner` archive: the strip comes after the ranking, and the verdict card links to `#nights` (`plan-brief.md:23,25`).
- `server-latency` archive: the island with a no-jump skeleton was the user's pick (`plan-brief.md:15,23`).
- `context/foundation/lessons.md:19-25`: JavaScript is required inside the Tonight island.

## Charges

1. **C1 — The verdict has no sky (missing composition plus accidental architecture).**
   - Where: `src/pages/tonight.astro:57-61` puts the verdict inside an island in `<main>`, under a plain Topbar. `VerdictCard.astro:40-50` boxes it at `text-3xl`.
   - Effect on the user: the answer to "should I set up tonight?" is one box among five equal boxes, not the page's headline. The chosen design makes the sky and a giant verdict the first thing seen.
   - Fix: a GearShell sky-flow mode, plus a sky band rendered by the island, with decorative stars, a horizon silhouette and the giant verdict word.
2. **C2 — Boxed cards and kickers shadow `Band` and `PageHeader` (missing shared component).**
   - Where: the card strings at `TonightContent.astro:97`, `MoonCard.astro:24`, `PlanetCard.astro:21`, `ObjectCard.astro:20`, `NightStrip.astro:42` and `SkyCheckCard.astro:38`, and the kickers at `VerdictCard.astro:41`, `MoonCard.astro:26` and `NightStrip.astro:33`.
   - Effect on the user: every topic has the same weight, and the page reads as a different app from `/gear`.
   - Fix: summary bands as in the design, then detail Bands below them; type roles for the headings.
3. **C3 — Six hand-made button styles and sub-44 px controls (missing shared component).**
   - Where: `TonightContent.astro:95-96,248-250`, `GearSelector.astro:25-26,58-71`, `SkyCheckCard.astro:32-33`, `TargetDetails.astro:46-49`, `MoonTimeSlider.tsx:37-41`.
   - Effect on the user: inconsistent actions, three different focus treatments, and targets too small in the field with gloves.
   - Fix: `buttonVariants`, `NativeSelect`/`Label`, `Notice`, `focus-visible:outline-ring`, `min-h-11`.
4. **C4 — The data lacks what the design shows (missing view fields).**
   - What's missing: no Go / Marginal / No-go word, no clear share per night for the bars, no planets summary, no exported Moon disc. The canvas's cloud-line "steady air" is not modelled.
   - Effect on the user: the design can't be built honestly without new derived fields.
   - Fix: add message keys and view fields (verdict word by level, clear share for nights 1-7, planet names list); extract `MoonDisc`. Drop "steady air".
5. **C5 — The skeleton copies the old layout by hand (accidental architecture).**
   - Where: `TonightSkeleton.astro:13-68`.
   - Effect on the user: a new layout would load as boxes and then jump into a sky.
   - Fix: rebuild the skeleton from the same sky band and band primitives.

**Deferred:**

- **`/tonight/all` restyle.** `AllObjectsContent.astro`, `all.astro`: its own view and its own pass; only touched where shared components change.
- **Band pages** for each summary (user, 2026-10-04).
- **Real planet positions and the slider in the sky.** S-11.

## Related Research

- `context/changes/visual-redesign/research.md`: the Nightfall contract audit for `/gear`.

## Open Questions

- **Polish verdict words** for Go / Marginal / No-go. Proposed in the plan, confirmed at the screenshot gate.
- **"Point here first" with no ranking.** On a no-go night the band shows the explanation instead of targets. To be planned.
