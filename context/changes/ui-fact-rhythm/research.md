---
date: 2026-10-14T21:56:33+0200
researcher: Claude (herdr agent ui-refine)
git_commit: c650a8a
branch: feat/ui-fact-rhythm
repository: sidereus
topic: "Grouped, icon-led facts with a spacing rhythm on the Tonight focused pages: charges, contracts, tests and overlap"
tags: [research, ui, facts, stat-cards, spacing, icons, tailwind-theme, targets, planets, moon, events, nights]
status: complete
last_updated: 2026-10-14
last_updated_by: Claude (herdr agent ui-refine)
---

# Research: grouped, icon-led facts with a spacing rhythm (ui-fact-rhythm)

**Date**: 2026-10-14T21:56:33+0200
**Researcher**: Claude (herdr agent ui-refine)
**Git Commit**: c650a8a (main, with ui-quiet-actions #163 merged)
**Branch**: feat/ui-fact-rhythm (local, no upstream)
**Repository**: sidereus

## Research Question

The second change of the ui-refine split (`context/changes/ui-refine/audit.md`): findings 2, 4, 5, 8 and 9, and owner decisions 2, 3 and 5.

- Window and Best become two small stat cards (a caption label over a larger mono value), side by side in one row at every width.
- Every other fact stays one per line and follows 1A:
  - ruled bands, with no box around the whole target;
  - a hairline between "when" and "what and how";
  - more breathing room;
  - an icon on every fact (2B: facts only, never the dashboard tile headings).
- One shared icon map, which absorbs S-07's event-kind icons.

The research covers the /10x-ui two-way audit of the Tonight focused pages' fact lists, with its charges. It also covers:

- whether Tailwind v4 can publish the spacing and `text-overline` roles;
- the shape of the Fact / StatCard components;
- the tests and specimens that pin this markup;
- the data and copy behind each fact, including the Polish wording;
- the overlap with S-08 adjustable-session-plan.

## Summary

- **The view family has no literal colours or arbitrary values.** The hardcoded-value scan returned 0 hits over the 15 files of the five views (the 8 components plus their page contents, `SolarSystemSection` and `SeenTag`). Spacing is another matter: those same 15 files use **43 distinct** margin, padding, gap and space utilities (census below). The problem is missing roles and a missing component, not literals.
- **Five charges** (below): no Fact / StatCard component, no spacing rhythm roles, no section-label role, no icon vocabulary (with unlabelled planet facts), and the Nights page's per-night reason sentence. The last is partly deferred.
- **Tailwind 4.3.3 supports both roles.**
  - `--spacing-line|group|item` in `@theme inline` yields `gap-line`, `mt-group`, `py-item`, `space-y-line` and so on.
  - `--text-overline` with `--line-height`, `--letter-spacing` and `--font-weight` sub-properties yields a `text-overline` role, the same way `text-display` works.
  - No colour test is affected: `red-theme.test.ts` reads only `:root` blocks, and `@theme inline` is not one.
- **Tests are mostly safe.** No test reads `dl`/`dt`/`dd` or the Window/Best text, and there are no screenshot baselines. Seven locators are fragile and must be kept (Detailed findings, "Tests that pin this markup").
- **The experiment** (built, captured and reverted; `evidence/exp-stat-cards/`) shows the merged 1A plus 1B direction working in dark, light and red.
  - Three things to fix in the plan:
    - the stat pair is too wide on desktop;
    - slotted text can lose a space ("Do szczegółów:10 mm");
    - the Window card is shorter than Best.
  - The Targets page grows about 13% at 390 px (5196 to 5886 px at 2×). That is the room the owner asked for.
- **S-08 does not touch the fact components' data or keys.**
  - It adds `id="object-<id>" scroll-mt-4` to `ObjectRow`'s root `<li>` and to the washed-out `<li>`, and edits `design.astro` and `en.ts`/`pl.ts` in other namespaces.
  - Both changes edit `ObjectRow.astro`, `TargetsPageContent.astro`, `design.astro`, `en.ts`/`pl.ts`, `tests/e2e/tonight-phone.spec.ts` and `CLAUDE.md`.
  - The overlapping hunks sit apart, but the second change to merge must rebase carefully.

## Charges

Ranked by effect on the user. Each charge has its category, the evidence and the effect.

### C1. No shared Fact / StatCard: every view hand-builds its facts at one weight (missing shared component)

- **Evidence**:
  - `TargetDetails.astro:44-57`: Window and Best are a hand-built `<dl>` of `text-label` rows.
  - `TargetDetails.astro:59-61`: the slot wrapper is `mt-4 space-y-3`.
  - `ObjectDetails.astro:39-64`: the expect line, the eyepiece pair, none-fit and the reason are each a `<p class="text-label text-foreground">`. Only the expect line has an icon, in `text-primary-strong` (`:43`).
  - `PlanetCard.astro:37-41,54-62`: facts are bare mono lines, and the eyepiece, reason and note lines are plain `<p>`s.
  - `MoonCard.astro:85-108`: the same eyepiece markup is copied again.
  - `SkyEventList.astro:99-123`: the kind/when line, details, visibility, notes and safety are each a `text-label` paragraph. Only safety has an icon.
  - `NightStrip.astro:59-72`: the headline, reason and moon lines.
  - `FinderContent.astro:94-97`: a duplicate of the expect line, with its own Eye icon markup.
  - The CLAUDE.md "Each data point sits on its own line at every width" rule (`TargetDetails.astro:4`) has to change for Window and Best (decision 5).
- **Effect**: on Targets, Planets, the Moon and Events the user reads a wall of equal lines. "When" (window, best), "what you'll see" and "how" (eyepieces, why) cannot be told apart at a glance, and the newest beginner-relevant line (what to expect) looks like its neighbours (`evidence/before/targets-light.jpg`).
- **Fix**: two shared components in `src/components/ui/`.
  - A `StatCard` used in a pair (`<dl>`, `grid-cols-2`) for Window and Best.
  - A `Fact`: an icon, an optional muted label, then the value or sentence.
  - Every view composes these, so the internal rhythm lives in one place.

### C2. No spacing rhythm roles: 43 distinct spacing steps across the family (missing tokens)

- **Evidence**:
  - The census counts margin, padding, gap and space utilities over the 15 view files:
    - `mt-4` ×8, `gap-2` ×8, `space-y-6` ×6, `mb-4` ×6, `pt-8` ×5, `py-5` ×4, `mt-0.5` ×4, `mt-1` ×3, `gap-y-2` ×3, `gap-3` ×3;
    - then 33 more values used once or twice (`space-y-1.5`, `mt-5`, `mt-6`, `py-3`, `pb-5`, `gap-x-5` …).
  - One role, "between the lines of one group", is spelled `gap-y-2` (`TargetDetails.astro:44`), `space-y-3` (`:59`), `space-y-2` (`ObjectDetails.astro:48`), `space-y-1` (`PlanetCard.astro:37`), `space-y-1.5` (`SkyEventList.astro:71`) and `gap-2` (`NightStrip.astro:35`).
  - The rows between items are `py-5` (`ObjectCard.astro:38`, `PlanetCard.astro:29`, `SkyEventList.astro:65`, `NightStrip.astro:31`), with `mt-4`/`mt-5` for groups inside them (`TargetDetails.astro:44,59,63`).
- **Effect**: the gap between two lines and the gap between two groups are nearly the same size (8-12 px against 16-20 px), so groups don't read as groups. Adding whitespace per view would only add more one-off steps.
- **Fix**: three spacing roles in `@theme inline`:
  - `--spacing-line` (8 px, between the lines of one group);
  - `--spacing-group` (20 px, between the groups of one item, and the hairline's padding);
  - `--spacing-item` (32 px, between items that hold groups).
  - A one-group row (a night, a washed-out row) uses `py-group`.

### C3. No section-label role: four spellings of a group label (missing token)

- **Evidence**:
  - `NightStrip.astro:36,50`: `text-label font-semibold` plus `text-primary` for "Verdict".
  - `NightStrip.astro:82-90`: the same in `text-muted-foreground` for "Outlook — no verdict".
  - `SkyEventList.astro:58`: `text-label font-semibold text-primary` for "Night of …".
  - The tile heading (`ui/tile.ts:18-19`, the dashboard) and `SessionTimeline.astro:64-74` (the plan page) are outside this change.
- **Effect**: group labels inside a page are blue in some places and muted or white in others (`evidence/before/nights-phone-en-dark.jpg`, `events-phone-en-dark.jpg`). They compete with the row content at the same size as the facts.
- **Fix**: a `text-overline` type role (13 px, 600, tracking 0.04em; no forced uppercase, because Polish dates such as "Noc: środa, 21 października 2026" would shout). It goes in `text-muted-foreground` wherever it labels a group, on Nights and Events.

### C4. No icon vocabulary, and planet facts without labels (missing shared component plus copy)

- **Evidence**:
  - `SkyEventList.astro:29-36` defines its own `ICONS` per event kind.
  - `ObjectDetails.astro:4,43` imports `Eye` locally.
  - `PlanetCard.astro:24-41` has no icons or labels.
  - Planet facts are value strings with the label fused in or missing (`format.ts:560-575`):
    - EN `en.ts:600-605`: "mag −1.9", "34″", "62% lit", "rings tilted 7°";
    - PL `pl.ts:550-553`: "jasność −1,9 mag", "34″", "faza 62%", "pierścienie nachylone o 7°".
  - A bare "34″" means nothing to a beginner (audit finding 5).
- **Effect**: each feature picks icons ad hoc, so one concept could get two icons. On Planets the user cannot tell which number is which.
- **Fix**:
  - One map, `src/lib/ui/fact-icons.ts`, holding the fact icons and S-07's event-kind icons. `SkyEventList` imports the kinds from it.
  - Planet facts become labelled facts. This needs label keys plus value-only wording. The four `…Text` fields are read only by `PlanetCard.astro`, `design.astro:449-452` (empty literals) and `build.test.ts:745-766` (`magnitudeText`, `ringText`; `phaseText` is the Moon card's own field at `TonightTiles.astro:160`).

### C5. The Nights page repeats one reason sentence per night (accidental architecture; partly deferred)

- **Evidence**: `NightStrip.astro:71` renders `night.reasonText`, the dashboard verdict's full sentence ("12 h in a row with at most 0% cloud in the dark window", `format.ts:363-382`, key `tonight.verdictReason.clearRun`), under every verdict night. The dark window it names is already printed in the row's left column (`NightStrip.astro:56`).
- **Effect**: on a uniform forecast the three verdict rows read as the same sentence three times (`evidence/before/nights-phone-en-dark.jpg`, the all-clear fixture). With real weather the run length and cloud percentage differ per night, so the lines are not identical.
- **Fix in this change**: the reason and moon lines become muted Facts (a cloud icon and a moon icon), and the group labels take `text-overline`. The night's own facts then read as facts, not prose.
- **Deferred, with a reason**: a shorter per-night wording, or merging identical lines. The sentence comes from seven reason variants (`clearRun`, `humidityCap`, `fallbackCap`, `cloudy`, `noForecast`, `noWeatherData`, `missingHours`) shared with the dashboard verdict. A short form needs a parallel key family in two languages and the reason kind on `TonightNight` (`build.ts:331-349`). That is copy work beyond the visual rhythm, and it is the owner's call.

## Detailed Findings

### Tokens and Tailwind (global.css, Tailwind 4.3.3)

- `@theme inline` is the only theme block (`src/styles/global.css:634`).
  - The type roles are at `:649-661`: display is fluid, title has letter-spacing, and label, body and caption have only size and line-height.
  - No role sets a weight; weight comes from the call site.
  - No `--spacing-*` entry exists, so Tailwind's default `--spacing` base (0.25rem) is untouched.
- Spacing (`node_modules/tailwindcss/dist/lib.js`, minified):
  - gap, space, margin, padding, size and inset resolve a named key through `themeKeys` that include `--spacing` before they fall back to the numeric multiplier.
  - So `--spacing-line` gives `gap-line`, `mt-line`, `-mt-line`, `py-line`, `space-y-line`.
  - Side effect: `w-line`, `size-item` and so on also exist. That is harmless.
  - This is established from the source; no build output was inspected for it. The reverted experiment built with `py-item`, `mt-group`, `pt-group` and `space-y-line` and rendered the expected gaps (`evidence/exp-stat-cards/targets-light.jpg`), which confirms it in practice.
- `text-overline`: the text utility reads `--text-<name>` with `--line-height`, `--letter-spacing` and `--font-weight` sub-keys.
  - The colour lookup finds no `--color-overline`, so there is no clash.
  - The existing `overline` utility is a text decoration with a different name.
- Guards:
  - `no-hardcoded-colors.test.ts` fails on palette words, hex and `rgb()`; `text-overline`, `gap-line`, `py-item` and `mt-group` pass.
  - `red-theme.test.ts:14-32` matches only `:root {` and `[data-theme="red"] {` blocks, so tokens in `@theme inline` need no red value.
  - `contrast.test.ts` reads only hex colour tokens.
  - No test enumerates the type roles. The roles list lives in prose (`CLAUDE.md:98`, the UI "Tokens" bullet), which must gain the new roles.
- Calibration against the shared parts:
  - `Band` is `py-6 sm:py-8` with a `mb-3 sm:mb-4` heading (`ui/Band.astro:30,38`).
  - A tile is `py-4 sm:py-5` (`ui/tile.ts`).
  - Item (32 px) equals the band gap on desktop and exceeds it on phones (24 px). Rows sit inside bands, so a band boundary is still marked by its rule and heading.

### Data and copy behind each fact

- **Targets** (`TonightEntry`, `build.ts:113-142`):
  - The window, best time and best direction are structured strings.
  - `pair` holds the eyepiece lines.
  - `reason` is one pre-joined string, `reasonLine` (`format.ts:328-333`): two of the four score components, lead plus follow ("Up for 10 h 20 min of the dark window · bright for your 150 mm"; PL "Na niebie przez 10 godz. 20 min w oknie ciemności · jasny obiekt dla Twoich 150 mm"). Which two depends on the ranking, so splitting it needs view-model parts. This change keeps it as one muted "why" fact.
  - `expectation` is a separate prop (`TargetsPageContent`, full plan only).
- **Planets** (`TonightPlanetEntry`, `build.ts:181-213`): the four fact strings come from `planetFactsText` (`format.ts:560-575`). The `eyepiece` line reads "Detail with <name> (×)", the `reason` is placement plus timing ("High around 22:10 — best in the middle of the night"), and the `note` is a fixed per-planet "what you'll see" sentence.
- **Moon** (`TonightMoonCard`, `build.ts:240-269`; target `:148-178`):
  - `upText` and `faintText` render as `MoonTimeSlider` children (`MoonCard.astro:48-54`).
  - The target has `wholeDisc`/`detail` eyepieces (`partDisc` fuses the eyepiece name into a sentence), `reason` ("Highest 42° at 23:10 — …") and `note`.
- **Nights** (`TonightNight`, `build.ts:331-349`):
  - `label`, `darkText`, `moonText` ("Moon 18% · 9 h 46 min moon-free").
  - Verdict nights also have `headline` and `reasonText`; outlook nights have `cloudText` ("Cloud ~0%").
- **Events** (`TonightSkyEvent`, `sky-events.ts:23-81`):
  - `name`, `kindLabel`, `when`, `details[]` (each carries its own noun: "Partial phase 21:00–22:30", "1.8° apart").
  - `visibilityText` fuses "Best" with the time and direction ("Best 22:40 · SW, 45°"), or gives the not-visible reason.
  - `notes[]`, and `safety`, a boolean that adds the fixed line.
  - Events have no window/best fields, so they get facts, not stat cards.
- **Labels that exist**, EN / PL (`en.ts:529-532`, `pl.ts:496-499`):
  - `tonight.object.window` "Window" / "Widoczność";
  - `best` "Best" / "Najlepiej";
  - `findWith` "Find with" / "Do szukania:";
  - `detailWith` "detail with" / "do szczegółów:";
  - `planets.detailWith`, `moon.wholeDiscWith`, `moon.detailWith`;
  - `events.visible`/`notVisible`/`nightOf`;
  - `nights.verdictLabel`/`outlookLabel`/`timesIn`.
- **Labels missing for planet facts** (candidates; the owner reviews the Polish):

  | Fact | EN label | EN value | PL label | PL value |
  |---|---|---|---|---|
  | magnitude | Brightness | mag −1.9 (unchanged) | Jasność | −1,9 mag (was "jasność −1,9 mag") |
  | size | Apparent size | 34″ (unchanged) | Średnica kątowa | 34″ (unchanged) |
  | phase | Phase | 62% lit (unchanged) | Faza | 62% (was "faza 62%") |
  | rings | Rings | tilted 7° (was "rings tilted 7°") | Pierścienie | nachylone o 7° (was "pierścienie nachylone o 7°") |

### The reverted experiment (`evidence/exp-stat-cards/`)

Built on c650a8a, captured on a local preview (port 4331, forecast fixture 4401, local Supabase, a throwaway `ui-fact-…@example.com` user with the full plan, keys passed inline only), then reverted. The diff is `experiment.diff`, including the three new files. The before images come from the same run, in `evidence/before/`.

- **What it built**:
  - The three spacing roles and `text-overline` in `@theme inline`.
  - `src/lib/ui/fact-icons.ts`.
  - `ui/StatCard.astro`: `rounded-lg border border-border bg-surface px-3 py-2`, a `text-caption` muted label with a `size-3.5` icon, and the value in `font-mono text-body font-semibold text-heading`. Best's direction sits on a second muted line.
  - `ui/Fact.astro`: a `size-4` muted icon, an optional muted label, then the slot.
  - `TargetDetails` with the pair (`mt-group grid grid-cols-2 gap-3`), then the slot under `border-t border-border pt-group space-y-line`, then the actions at `mt-group`.
  - `ObjectDetails` and `PlanetCard` facts.
  - `ObjectCard` and `PlanetCard` rows at `py-item`.
- **What it showed**:
  - Dark, light and red read as intended (`targets-{dark,light,red}.jpg` against `../before/…`). The stat cards borrow the gear cards' bordered surface, so the card language is not new.
  - In red the card border is faint (`--border` #3a0000 on #080000), and the surface fill carries the shape. That is acceptable for a non-interactive container (no 3:1 requirement), and the label and value inks are the theme's own.
  - The Moon gets the pair for free through `TargetDetails` (`moon-phone-en-dark.jpg`).
  - **Desktop** (`targets-desktop-pl-light.jpg`): each card stretches to half of 720 px, so the values float in wide boxes. Cap the pair at about `max-w-md` from `sm`.
  - **Uneven heights**: Best has two lines (time, then direction) and Window one, so the grid stretches Window with empty room. That is accepted in the experiment. The alternative, "03:21, NNE, 87°" on one line, wraps at 320 px in a half-width card (about 114 px of text width).
  - **Whitespace gotcha**: the Polish planet eyepiece line rendered "Do szczegółów:10 mm Plössl" with no space when the sentence was slotted straight into `Fact` without a wrapping element (`planets-pl-dark.jpg`). Inside a `<p>` (the Targets pair) the space survived. Fact content must sit in its own element, and the plan needs a check for it.
  - The planet facts with icons but no labels still leave "34″" unexplained (the C4 labels are needed).
  - Page length: Targets at 390 px went from 5196 to 5886 px at 2× (about +13%).

### Tests that pin this markup

No test reads `dl`/`dt`/`dd`, "Window"/"Best" on these components, any planet or Moon fact text, the reason or the note. There are no Astro container tests and no `toHaveScreenshot` baselines.

- **Keep, or the spec breaks**:
  1. `what-to-expect.spec.ts:65-69,92-102,114-119`: the `[data-expect]` element's trimmed `textContent` must equal one phrase exactly (an icon svg is fine, a visible label is not), one per card, and `scrollWidth <= clientWidth`. The finder's own `[data-expect]` (`:134-140`) likewise.
  2. `sky-events.spec.ts:34-45,82-100,118-121`:
     - the name is the row's first `h4`;
     - `[data-event-visibility]` holds only the sentence;
     - `[data-event-visible-mark]` text is exactly "Visible", once per row;
     - `[data-event-when]` is non-empty;
     - `[data-event-safety]` appears on solar rows only;
     - `[data-events-night] h3` is visible.
  3. `seven-night-planner.spec.ts:28-29,126-144`:
     - the group `h3` is followed by its sibling `ol`, with exact label text;
     - `ol > li` counts 7, so no nested `ol`/`li` inside a row;
     - `[data-sky-headline]` text is exactly the headline;
     - outlook rows contain `/Cloud ~\d+%/`.
  4. `planets-on-tonight.spec.ts:31-34,67`: the cards are `getByRole("listitem")` in the labelled list, so a fact list must not render `<li>`s inside a card. A card is found by its heading name.
  5. `tonight-targets.spec.ts:32` (`> ol > li[data-object]`), `:60-63` (rank first in the summary text); `tonight-sky.spec.ts:160-177` (`li#object-…`, `li#planet-…` ids); `helpers.ts:211-226` (the finder link by `aria-label`).
  6. `onboarding.spec.ts:59-61,97-99`: `getByText(/25 mm/)` needs the eyepiece name in one element.
  7. `tonight-phone.spec.ts:119-145`: no sideways scroll at 320 and 375 px over every Tonight page in EN and PL. This is the main risk for the stat pair.
- **Weak, negative-only**: `telescope-selector.spec.ts:160-161` asserts the ranking does not contain "Find with" / `noneFit`. It would pass silently if the label vanished. Keep the label text in the DOM.
- **Unit**:
  - `build.test.ts:745-766` pins `magnitudeText` and `ringText` wording in both languages. It changes with C4, because the requirement (labelled facts) changed.
  - `runner-zone-guard.test.ts` and `no-console-guard.test.ts` scan new files and specimens.
  - `TonightSkyView.test.ts`'s import guard means the Fact component must never enter that island.
- **/design** (`src/pages/design.astro`):
  - Only `ObjectDetails` (via "What to expect", `:2548-2603`, with a sample that has no eyepiece pair and an empty reason, `:372-397`) and `SkyEventList` (`:2127-2170`) render.
  - There is no specimen for `TargetDetails` alone, `PlanetCard`, `MoonCard`, `NightStrip` or spacing.
  - The type roles are at `:715-737`.

### S-08 adjustable-session-plan overlap

The worktree is `.claude/worktrees/adjustable-session-plan`, branch `feat/adjustable-session-plan`, HEAD 9bf8043. Phases 1-3 are committed, Phase 4 is uncommitted and Phase 5 (the editor UI) is not started.

- **Same files, different hunks**:
  - `ObjectRow.astro`: S-08 adds `id="object-${entry.id}" class="scroll-mt-4"` on the root `<li>`. Keep it on a rebase, or the plan's `/tonight/targets#object-<id>` links break.
  - `TargetsPageContent.astro`: the same attributes on the washed-out `<li>`.
  - `design.astro`: `reachable: null` in the TonightView literal; Phase 5 adds plan specimens.
  - `en.ts`/`pl.ts`: only `tonight.pages.plan.*` and `errors.*`. Nothing in `tonight.object`, `planets`, `moon`, `events` or `nights`.
  - `tests/e2e/tonight-phone.spec.ts`: Phase 5 adds an editor check at 320/375 px.
  - `CLAUDE.md`: Phase 6.
- **Not touched by S-08**: `TonightEntry`, `TonightPlanetEntry`, `TonightMoonCard`, `TonightNight`, the sky-events types, `format.ts`, `global.css`, `TargetDetails`, `ObjectDetails`, `PlanetCard`, `MoonCard`, `SkyEventList` and `NightStrip`.
- **Off-limits here**: `SessionTimeline.astro`, `PlanPageContent.astro`, `TonightContent.astro` and the plan page's "Best … · window …" line (pinned by `tonight-dashboard.spec.ts:142`).

## Code References

- `src/components/tonight/TargetDetails.astro:44-77`: the Window/Best `<dl>`, the slot, the actions.
- `src/components/tonight/ObjectDetails.astro:39-64`: the expect, pair, none-fit and reason lines.
- `src/components/tonight/ObjectCard.astro:33-54`: the ranked row (`py-5`), the heading, the detail line.
- `src/components/tonight/ObjectRow.astro:29-68`: the expandable row (`pb-5 pl-10` body).
- `src/components/tonight/PlanetCard.astro:24-63`: the facts, eyepiece, reason, note.
- `src/components/tonight/MoonCard.astro:38-112`: the slider children, the target block.
- `src/components/tonight/SkyEventList.astro:29-36,50-133`: the kind icons and the rows.
- `src/components/tonight/NightStrip.astro:31-107`: the row classes and the group labels.
- `src/components/finder/FinderContent.astro:92-97`: the duplicated expect line.
- `src/lib/tonight/format.ts:328-333,363-382,560-575`: reason, verdict reason, planet facts.
- `src/i18n/messages/en.ts:529-532,600-606`, `pl.ts:496-499,550-554`: labels and planet fact wording.
- `src/styles/global.css:634-668`: `@theme inline`, type and font roles.
- `src/pages/design.astro:372-397,449-452,715-737,2127-2170,2548-2603`: samples and specimens.

## Architecture Insights

- The token contract holds: colour tokens, type roles and the radius scale are used everywhere in these files. What is missing is the next layer, roles for rhythm and for section labels, plus the components that apply them. This matches the audit's "missing roles" diagnosis (audit.md:16).
- `TargetDetails` already owns the spacing between its parts so that callers carry none (`TargetDetails.astro:4-6`). The new Fact / StatCard continue that pattern: callers pass content, the components own the rhythm.
- Red mode tells things apart by shape and weight, never hue (ui-quiet-actions). Icons are decorative (`aria-hidden`), and labels and values carry the meaning. A stat card's border may be faint in red, because its fill and position carry it.

## Historical Context (from prior changes)

- `context/changes/ui-refine/audit.md:46-56,64-71,73-84,106-119`: findings 2, 4, 5, 8 and 9 (supported by today's code, with one exception: finding 3, eyepiece names in link colour, is fixed by ui-quiet-actions).
- `context/changes/ui-refine/audit.md:227-238`: the owner's decisions 2, 3 and 5.
- `context/changes/ui-quiet-actions/plan.md:112`: "Facts, spacing, icons and stat cards" deferred to this change.
- Experiments A and B (`context/changes/ui-refine/evidence/exp-{a,b}/*.diff`):
  - A: icon-led rows with a fixed `w-32` label column, `Clock`/`Compass`/`Telescope`/`Timer`, the `border-t … pt-5` hairline, `py-8` rows.
  - B: stat chips `rounded-lg bg-background px-3 py-2` inside a boxed card. This change's experiment merges them per decision 2.

## Related Research

- `context/changes/ui-quiet-actions/research.md`: the button hierarchy this change sits beside (the action row under the facts).

## Open Questions

For the plan, not blocking it:

1. Polish copy for the planet labels and values (table above): the owner reviews.
2. Best's direction on a second line in its card (as in the experiment) or one line: the experiment favours the second line at 320 px.
3. The Nights short-reason wording (C5, deferred): the owner's call whether it is worth a copy change.
