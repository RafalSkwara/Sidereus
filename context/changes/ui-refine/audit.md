# UI refinement audit: data-dense views, button weight, navigation

Date: 2026-10-14 · Branch `feat/ui-refine` off main a98e77a (what-to-expect merged) · S-07 sky-events read from its worktree (`feat/sky-events` c050bd2, implemented, not merged) · Method: /10x-ui charges (missing tokens, missing shared component, accidental architecture), source → views and view → source. **Audit only, no product code changed.** Two local experiments were built, captured and reverted (diffs kept under `evidence/`).

## The owner's request

> "there are plenty of new data points on many screens, we should separate them visually more visibly, more whitespace, more icons; also buttons are too visible now and take too much of the user's attention. Let's perform a UI audit again. We might need to consider a navigation update too."

This splits into four themes: **grouping and whitespace**, **icons**, **button weight**, and **navigation**. Each theme has its findings below, then 2-3 visual directions, then a proposed split into changes.

## How the evidence was made

- Local production preview on port 4331 with the forecast fixture on 4401 (all clear, so every view is at its densest), local Supabase, and one throwaway user `ui-refine-<uuid>@example.com` onboarded in Madrid with the default kit, six log entries (M31, M13, M57, the Moon, Jupiter, NGC 7000, all rated 4) and the full plan (granted with `account:plan`; the key was passed inline only). Scripts: `evidence/seed.mjs`, `evidence/capture.mjs`.
- The matrix was captured in full: 10 views × EN/PL × dark/light/red × 390 px phone (2×) / 1280 px desktop, which is 120 full pages plus folds, about 30 MB. A curated, downscaled set is committed under `evidence/before/`. Re-run `capture.mjs` against a preview to regenerate the rest.
- In full-page phone shots the fixed TabBar appears mid-page. That is a screenshot artifact: Playwright stitches the page while the bar stays fixed. It is not a layout bug.
- The hardcoded-value scan (the /10x-ui grep) over `src/components/{tonight,progress,finder,ui}`, `src/pages/log`, `src/pages/gear/index.astro`, `Topbar`, `TabBar` found **0** literal colours, palette classes or arbitrary values. The earlier UI passes held. The problems this time are not literals. They are **missing roles**: no spacing rhythm, no "fact" component, no quiet action tier, no icon vocabulary, no sibling navigation.

| View | Phone EN dark | Phone PL light | Other |
|---|---|---|---|
| /tonight | `before/tonight-phone-en-dark.jpg` (+ `-fold`) | `before/tonight-phone-pl-light.jpg` (+ `-fold`) | `before/tonight-phone-pl-red.jpg`, `before/tonight-desktop-en-dark.jpg` |
| /tonight/targets | `before/targets-phone-en-dark.jpg` | `before/targets-phone-pl-light.jpg` | `before/targets-phone-pl-red(-fold).jpg`, `before/targets-desktop-{en-dark,pl-light}.jpg`, `before/targets-rows-crop-{light,red}.jpg` |
| /tonight/plan | `before/plan-phone-en-dark.jpg` | `before/plan-phone-pl-light.jpg` | |
| /tonight/moon | `before/moon-phone-en-dark.jpg` | `before/moon-phone-pl-light.jpg` | |
| /tonight/planets | `before/planets-phone-en-dark.jpg` | `before/planets-phone-pl-light.jpg` | `before/planets-phone-en-red.jpg` |
| /tonight/nights | `before/nights-phone-en-dark.jpg` | `before/nights-phone-pl-light.jpg` | |
| /tonight/finder | `before/finder-phone-en-dark.jpg` | `before/finder-phone-pl-light.jpg` | |
| /log | `before/log-phone-en-dark.jpg` | `before/log-phone-pl-light.jpg` | `before/log-desktop-en-dark.jpg` |
| /log/progress | `before/progress-phone-en-dark.jpg` | `before/progress-phone-pl-light.jpg` | |
| /gear | `before/gear-phone-en-dark.jpg` | `before/gear-phone-pl-light.jpg` | |

## Ranked findings

Ranked by effect on the user: how often the screen is used × how much the problem costs there. Each finding has its category, the evidence (file:line) and the effect.

### 1. Every per-item action is a bordered, tinted, link-coloured box, so actions outshout the data (button weight)

- **Category**: accidental architecture (a rule invites it) plus a missing token tier.
- **Evidence**:
  - `buttonVariants` `action` (`src/components/ui/button.tsx:39-40`: `border-action-border bg-action-surface text-primary-strong`) is mandated by the CLAUDE.md **Clickables** rule for every standalone link and per-item action.
  - Users: `TargetDetails.astro:40-41,63-76` (Mark observed and Finder chart on every target, planet and the Moon), `BackLink.astro:20`, `GearCard.astro:73` (Manage), `MoonCard.astro:33` (washed-out link), `pages/gear/index.astro:92,132,167` (Add …), `pages/log/index.astro:71-75` (Progress, Sky checks), `Pager.astro`.
  - The tile cue chip copies the same border and fill (`ui/tile.ts:25`).
- **Count on a phone**: /tonight/targets shows **11** action boxes (back link plus 5 × 2), then an outline "Show the other 118 objects". /tonight/planets also shows 11. The dashboard shows 2 Manage boxes, 5 cue chips (6 with S-07) and the outline "Now".
- **Effect**: the eye lands on the "Mark observed / Finder chart" pairs, not on the object, the best time or the what-to-expect line. In red mode the boxes are the brightest shapes on the screen (`before/targets-phone-pl-red-fold.jpg`). In Polish the pair ("Zapisz obserwację", "Mapka znajdująca") spans the whole row at 390 px.
- **Root cause**: there is no **quiet tier**. The weights in use are `default` (filled), `outline`, `action` (border plus fill), `ghost`, `link` (underlined) and `destructive`. Everything that is "not primary" became `action`.

### 2. A target's 7-9 facts sit at one size, weight and colour, with no grouping (grouping, whitespace)

- **Category**: missing shared component.
- **Evidence**: `TargetDetails.astro:44-61`, `ObjectDetails.astro:42-64`, `PlanetCard.astro:37-62`, `MoonCard.astro:84-106`.
  - Every line is `text-label` in `text-foreground`: window, best, the what-to-expect line, find-with, detail-with, the reason line.
  - The dl's labels are a different colour, but its values carry no separation from the slot's sentences below.
  - The rows are `py-5` (`ObjectCard.astro:38`) with only a 1 px rule between objects.
- **Effect**: on Targets, Planets and the Moon the user reads a wall of equal lines (`before/targets-rows-crop-light.jpg`).
  - **When** (window, best), **what you'll see** (the new what-to-expect line, the planet's note) and **how** (eyepieces, why it ranks) are not separable at a glance.
  - The what-to-expect line, the newest and most beginner-relevant data point, has an icon but otherwise looks like its neighbours.
- **Missing component**: a `FactList` / `Fact` (an icon, a label and a value, or an icon and a sentence) with fixed internal rhythm. Today `TargetDetails` hand-builds the dl, `ObjectDetails` and `PlanetCard` hand-build the sentences, and `MoonCard` copies `ObjectDetails`' eyepiece markup.

### 3. Eyepiece names are in the link colour but are not links (button weight, false affordance)

- **Category**: missing token use (wrong role).
- **Evidence**: `ObjectDetails.astro:50,55`, `PlanetCard.astro:56`, `MoonCard.astro:88,98`: `font-semibold text-primary-strong` on plain text.
- **Effect**: every target carries two more "clickable-looking" spans (`before/targets-desktop-pl-light.jpg`). It adds to the loudness of finding 1, and a tap does nothing. Emphasis should use `text-heading` plus weight, and the link colour should mean only "link".

### 4. Spacing is invented per file: about 30 distinct vertical steps and no rhythm roles (whitespace)

- **Category**: missing tokens.
- **Evidence**: the scan over the audited views counts `mt-1/2/3/4/5/6`, `mb-2/3/4/6`, `py-2/3/5/6/8`, `pt-4/6/8`, `space-y-1/1.5/2/3/6`, `gap-1.5/2/3/4`, `gap-y-2`: about 30 values.
  - The tiles alone use `mt-4` (Targets), `mt-3` (Plan, Moon, Planets) and `mt-5` (Nights) for the same "content under the heading" slot (`TonightTiles.astro:114,143,150,164,175`).
  - Rows use `py-5` (targets, planets), `py-3` (milestones), `py-4 sm:py-5` (tiles); bands use `py-6 sm:py-8` (`Band.astro:30`).
- **Effect**: there is no consistent "group gap" versus "line gap", so groups don't read as groups. Adding whitespace per view would add more one-off values.
- **Missing**: three rhythm roles that the views must use, namely line (inside a group), group (between groups of one item) and item (between items). They could be Tailwind spacing tokens (`--spacing-line`, `--spacing-group`, `--spacing-item`) published through `@theme`, or a `Stack` component with `gap="line|group|item"`. Either one beats per-file `mt-*`.

### 5. Icons are sparse and have no shared vocabulary (icons)

- **Category**: missing shared component.
- **Evidence**:
  - In the audited views lucide appears only in `ObjectDetails` (Eye), `TargetDetails` (Check, Crosshair), `NotSeenMark`/`Legend`, `GearCard` (MapPin, Telescope), `Tile` (ArrowRight), `ChecklistGrid`/`MilestoneList` (check, award) and the page header buttons of /log and /gear.
  - None in `TonightTiles` headings, `PlanetCard` facts, `NightStrip`, `SessionTimeline` rows, `MoonCard`'s facts or `/gear` meta rows.
  - S-07's `SkyEventList.astro:10` brings its own set (Eclipse, Orbit, CircleDot, Sparkle, TriangleAlert …) per event kind.
- **Effect**:
  - The dashboard's tiles are told apart only by a small muted heading (`before/tonight-phone-en-dark.jpg`).
  - Planets' facts are bare mono lines ("mag −1.9", "34″", "rings tilted 7°"); "34″" means nothing to a beginner without a label or an icon.
  - Each new feature picks icons ad hoc, so the same concept could get two icons (Moon, a planet, a target kind).
- **Missing**: one icon map (for example `src/lib/ui/icons.ts`: the destination and tile icons, the fact icons (window → Clock, best → Compass, expect → Eye, eyepiece → Telescope, reason → Timer or Info, magnitude, size), the target kinds and S-07's event kinds), plus the `Fact` component from finding 2 taking an icon.

### 6. The focused Tonight pages have no sibling navigation, only a loud back box (navigation)

- **Category**: accidental architecture.
- **Evidence**:
  - `TonightPageSky.astro:30` renders `BackLink` (an `action` box) as the only way off a focused page.
  - The pages are `/tonight/{targets,plan,moon,planets,nights}`, plus `/tonight/finder` (reached only from a row) and S-07's `/tonight/events`: **7** spokes on one hub.
  - `navigation.ts:5-9` has three destinations; the focused pages are not in any nav.
- **Effect**:
  - Going from Targets to the Session plan takes back, scroll and tile: two taps, a scroll and two island loads. At the telescope, with gloves and red mode, that is costly.
  - The back box sits above the title and is the loudest thing in the sky header (`before/moon-phone-en-dark.jpg`).
  - S-07 adds a seventh spoke and a sixth tile, which makes the dashboard longer and the hub more central.

### 7. Progress and Sky checks live as buttons in the Log header (navigation)

- **Category**: accidental architecture.
- **Evidence**: `pages/log/index.astro:71-79`: two `action` links and the primary "Add entry" in the sky header (`before/log-phone-en-dark.jpg`). `/log/progress` is otherwise unreachable from the nav, and it is the app's motivational view (milestones, the checklists).
- **Effect**:
  - Three buttons in the header pull attention away from the log itself.
  - Progress is two levels deep, while S-06 milestone celebrations point users at it ("See your progress").

### 8. Repeated sentences and unlabelled facts inflate the long lists (grouping)

- **Category**: accidental architecture (copy laid out per feature).
- **Evidence**:
  - `/tonight/nights`: every verdict night repeats the full reason "12 h in a row with at most 0% cloud in the dark window" (`NightStrip.astro:71`; `before/nights-phone-en-dark.jpg`).
  - `/tonight/targets`: every row repeats "Up for 10 h 20 min of the dark window · bright for your 150 mm" (`ObjectDetails.astro:64`).
  - `/gear` meta rows run unlabelled values together ("40.42, -3.70   Bortle 6   Min 15°", `pages/gear/index.astro:102`).
- **Effect**: the long lists get longer without adding information. A beginner can't tell which number is which on /gear.

### 9. Group labels and small headings have no type role (missing token)

- **Category**: missing tokens.
- **Evidence**: `NightStrip.astro:36,50` (`text-label font-semibold` plus `text-primary`), S-07 `SkyEventList.astro:58` (`text-label font-semibold text-primary`), the Session plan's lines and legend (`SessionTimeline.astro:64-74`), and the tiles' muted heading (`ui/tile.ts:18-19`). These are four spellings of a "section label".
- **Effect**: sections inside a page are labelled inconsistently: blue in some places, muted or white in others. A shared `text-overline` role (or a `SectionLabel`) gives every group the same quiet header, which directions A and B rely on.

### 10. The /log/progress checklists are a field of 171 equal boxes (density)

- **Category**: missing shared component.
- **Evidence**: `ChecklistGrid.astro:26`: every cell is bordered (`grid-cols-6 gap-1.5`), and seen cells are filled white (`before/progress-phone-en-dark.jpg`, about 7,000 px tall at 2×).
- **Effect**: progress (3 / 110) is visually drowned by the 107 empty bordered cells. A progress bar plus unbordered empty cells (or a collapsed grid) would show the progress first.

### 11. Desktop keeps the phone's single column (whitespace)

- **Category**: accidental architecture (deferred candidate).
- **Evidence**: `max-w-3xl` content with every fact on its own line at every width (ui-user-adjustments decision, `TargetDetails.astro` header comment). See `before/targets-desktop-pl-light.jpg`.
- **Effect**: on desktop a target is the same tall stack with wide empty margins. A two-column fact grid from `sm` would halve the height. It needs the owner, because it reverses "one data point per line at every width".

### 12. Raw type sizes in the nav (missing tokens, minor)

- **Evidence**: `Topbar.astro:49` `text-sm`, `TabBar.astro:37` `text-xs`, `Attribution.astro` `text-xs`.
- **Effect**: none visible today. These are the only type values outside the roles, and a nav redesign should move them onto `text-label` / `text-caption`.

### S-07 sky-events, on top of which this lands

Read from `context/changes/sky-events/plan.md` and its implementation (`EventsTile.astro`, `SkyEventList.astro`, the `VerdictCard` diff):

- **Events tile** (`EventsTile.astro:24-27`): a sixth `Tile` straight after Targets, one `text-body font-semibold` line. It inherits findings 1 (cue chip), 4 (`mt-3`) and 5 (no icon). The dashboard grows to six tiles, so tile identity icons matter more.
- **Verdict event line** (`VerdictCard.astro:93`, S-07): `mt-1 text-label font-medium text-muted-foreground` under the reason makes a fourth text line in the verdict block (date, headline, reason, event). It is quiet enough, but it reads as a continuation of the reason. Proposal: a leading Sparkle or kind icon from the shared map, so it reads as its own fact, with no height change (the line already exists on event nights only).
- **/tonight/events** (`SkyEventList.astro`):
  - Kind icons per row are good: they are the precedent for finding 5's vocabulary and should move into the icon map.
  - The night headings use the `text-primary` label (finding 9).
  - Rows run 4-6 lines with visibility, best time, notes and the safety line, so they need the same `Fact` rhythm as Targets.
  - No action buttons there, which is good.
  - It is the seventh spoke (finding 6), so the sub-nav must include it.

## Visual directions

Each theme has 2-3 directions. "Experiment A" and "Experiment B" are real local builds, captured and then reverted. Their diffs are `evidence/exp-a/experiment-a.diff` and `evidence/exp-b/experiment-b.diff`; they are experiment code, not plan code (one `any`, one `w-32`). The other directions are mockups.

### Theme 1: grouping and whitespace

**1A: Fact rows with icons, ruled bands kept (Experiment A).** Window and Best become icon-led label/value rows with aligned values. A hairline separates **when** from **what and how**, the sentences get leading icons, the row padding goes from `py-5` to `py-8`, and Nightfall's unboxed bands stay.
Before / after: `before/targets-rows-crop-light.jpg` → `exp-a/targets-rows-crop-light.jpg` (red: `…-crop-red.jpg`; fold: `exp-a/targets-phone-en-dark-fold.jpg`).

**1B: A boxed card per target with stat chips (Experiment B).** Each target sits in a bordered `bg-surface` card. Window and Best become two stat chips (caption label, large mono value) side by side, and the sentences sit below. The separation is the strongest of the three, but it breaks the "ruled bands, not boxed cards" rule, making it a second boxed exception after the gear cards, and it costs more height.
Before / after: `before/targets-rows-crop-light.jpg` → `exp-b/targets-rows-crop-light.jpg` (red `exp-b/targets-rows-crop-red.jpg`).

**1C: Summary first, details on demand (mockup).** Each row shows the name, "Best 03:01 · N 73°" and the what-to-expect line. Window, eyepieces and the reason sit behind a "Details" disclosure (the all-objects rows already use `<details>`). This gives the shortest lists, but one tap more at the telescope.

```
 1. NGC 869 / 884 · Double Cluster  ✧
    ◷ Best 03:01 · N, 73°
    👁 A loose group of stars, clearly separate against the sky.
    ✓ Mark observed     ⌖ Finder chart          Details ▾
 ─────────────────────────────────────────────────────────
```

### Theme 2: icons

**2A: Identity plus facts (Experiment A).** Every tile heading gets its icon (Targets ⌖, Session plan ≔, Moon ☾, Planets ◎, Nights ▦, Events ✧), and every fact label and sentence gets one (Clock, Compass, Eye, Telescope, Timer). All of them come from one icon map, in `text-muted-foreground` for facts and `text-primary-strong` for tile identity.
Before / after: `before/tonight-phone-en-dark.jpg` → `exp-a/tonight-phone-en-dark.jpg`; light `before/tonight-phone-pl-light.jpg` → `exp-a/tonight-phone-en-light.jpg`.

**2B: Facts only.** Icons on fact rows (Theme 1) and none on tile headings. The dashboard stays text-led and the icon count stays low.

**2C: Status only (today plus a little).** Only the what-to-expect Eye, the not-seen mark, the S-07 event kinds and the planet facts' labels. This is the least change, and it would not meet the owner's "more icons".

### Theme 3: button weight

**3A: Text actions (Experiment A).** `action` loses its border and fill: link-colour label plus icon, a hover tint, the 44 px target kept (negative inline margin, so the icon aligns with the text column). The tile cue becomes a bare arrow.
Before / after: `before/targets-phone-en-dark.jpg` → `exp-a/targets-phone-en-light.jpg` and `exp-a/targets-phone-en-red.jpg`.
Risk: **in red mode a text action is told apart from body text only by weight and icon** (`exp-a/targets-rows-crop-red.jpg`). Acceptable if the icon always leads; safer with a resting underline in red only.

**3B: Hairline neutral (Experiment B).** A transparent fill, the neutral `--border` hairline, the label in `text-foreground` with only the icon in the link colour, and a hover that tints with `accent`. Still a clear button, but no longer the loudest shape.
Before / after: `before/targets-rows-crop-light.jpg` → `exp-b/targets-rows-crop-light.jpg`; red `exp-b/targets-rows-crop-red.jpg`.

**3C: Hierarchy, recommended (mockup, built from 3A and 3B).** Rank the actions instead of styling them all alike:

| Action | Today | 3C |
|---|---|---|
| Mark observed (per item) | action box | hairline (3B): the one per-item button |
| Finder chart (per item) | action box | text action (3A) |
| BackLink | action box above the title | chevron plus label in muted text (or replaced by the sub-nav, 4A) |
| Manage sites / telescopes (gear card) | action box | text action |
| /gear Add … | action box | hairline, or a `+` icon button beside the band title |
| /log Progress, Sky checks | action boxes in the header | out of the header (nav 4B), or text actions |
| Tile cue | bordered chip | bare arrow |
| Primary (Add entry, Save) | filled | unchanged: at most one per screen |

This needs a new `quiet` variant (or `action` redefined, plus a `text` variant), the Clickables rule in CLAUDE.md rewritten, and the action-token contrast pins updated (`--action-surface` may retire).

### Theme 4: navigation

**4A: Tonight sub-nav on the focused pages (Experiment A).** A horizontally scrolling segmented row under the top bar on every `/tonight/*` page: Tonight · Targets · Session plan · Moon · Planets · Nights · Events, with the current page selected (`bg-selected`, like the Topbar pill). It replaces the BackLink box, so sibling pages are one tap apart.
Screenshot: `exp-a/targets-phone-en-dark-fold.jpg` (the chips cut off at the right edge is the intended scroll cue; a fade or chevron is still to design).
Constraints: it lives in `TonightPageSky` and `TonightPageSkeleton` (no jump), never on the dashboard (so `tonight-phone.spec`'s first screen is untouched). The finder chart keeps a back link to its origin (Targets or Planets).

**4B: Four destinations (mockup).** Tonight · Log · Progress · Gear in the TabBar and the Topbar pill (`navigation.ts`). Sky checks stays under Log, and Log's header keeps only "Add entry".

```
 ┌──────────┬──────────┬──────────┬──────────┐
 │    ☾     │    ▤     │    🏅    │    🔭    │
 │ Tonight  │   Log    │ Progress │  My gear │
 └──────────┴──────────┴──────────┴──────────┘
```

Risk: four tabs at 320 px in Polish ("Dziś w nocy", "Dziennik", "Postępy", "Mój sprzęt") need a check, but they fit at about 80 px each.

**4C: Keep the hub, quiet the spokes (mockup).** The BackLink becomes a muted chevron text, and each focused page ends with a "Next: Session plan →" link in the dashboard's order. This is the smallest change, but sibling jumps stay sequential.

**Recommended combination:** 4A plus 4B. 4A fixes the hub-and-spoke cost that S-07 makes worse; 4B lifts Progress out of the Log header, which also removes two of finding 1's boxes.

## Owner decisions (2026-10-14)

1. **Button weight: 3C, the hierarchy.** "Mark observed" is the one per-item button, as a hairline (3B). "Finder chart", "Manage sites/telescopes", the washed-out link and the back link become text actions (3A). The tile cue becomes a bare arrow. The filled primary stays at most one per screen.
2. **Grouping: a merge of 1A and 1B.**
   - Window and Best become two small stat cards (1B's chips: a caption label over a larger mono value), side by side in one row.
   - Everything else follows 1A: ruled bands, no boxed card around the whole target, the hairline between "when" and "what and how", more breathing room.
   - 1A's icons go on every fact that still lacks one.
3. **Icons: 2B, on facts only.** No icons on the dashboard tile headings.
4. **Navigation: 4A plus 4B.**
   - The Tonight sub-nav replaces the back box on the focused pages.
   - Progress becomes a fourth destination in the TabBar and the Topbar.
5. **Desktop: only Window and Best sit side by side.** They are the two stat cards in one row, at every width. Every other fact stays one per line in a single column, so finding 11 is resolved by decision 2, not by a two-column layout.

## Proposed split into changes

Each is one /10x-ui change (one view family plus global tokens). Implementation starts after S-07 merges, so each change builds on its tile, verdict line and events page; docs (research, plan) may run earlier. The order puts the global contract first, so later views inherit it.

1. **`ui-quiet-actions`** (global; findings 1, 3, the tile cue; decision 1).
   - A quiet tier in `buttonVariants`: hairline for "Mark observed", text for every other per-item action.
   - Applied to `TargetDetails`, `BackLink` (everywhere it is still used; on the Tonight focused pages change 4 replaces it), `GearCard`, `MoonCard`, `/gear` "Add …", the `/log` header links, `Pager` and the tile cue.
   - Eyepiece names off the link colour.
   - The Clickables rule rewritten, the action-token contrast pins, the `/design` matrix and the e2e locators checked.
2. **`ui-fact-rhythm`** (Targets, Planets, the Moon, S-07 Events, Nights; findings 2, 4, 5, 8, 9; decisions 2, 3, 5).
   - Spacing rhythm roles (`line` / `group` / `item`) and a `text-overline` section-label role.
   - The `StatCard` pair for Window and Best (one row at every width) and the `Fact` / `FactList` component with an icon (the fact icon map, absorbing S-07's event-kind icons).
   - Then Targets' rows (merged 1A/1B), Planets with labelled facts, MoonCard, SkyEventList and the Nights page reasons.
3. **`ui-dashboard-tiles`** (/tonight; finding 4, plus the S-07 verdict line).
   - The tile content uses the rhythm roles. No tile heading icons (decision 3).
   - The S-07 verdict event line gets its leading fact icon (it is a fact, not a heading).
   - The phone-first spec, the `VERDICT_MIN_HEIGHT_CLASS` re-measure and the skeleton stay in step.
   - Small. It may fold into change 2 if the plan finds it too thin.
4. **`ui-tonight-nav`** (navigation; findings 6, 7, 12; decision 4).
   - The Tonight sub-nav replaces `BackLink` on `TonightPageSky` / `TonightPageSkeleton`; the finder keeps its way back to its origin.
   - Progress joins `NAV_ITEMS` as the fourth destination, and the Log header drops its Progress link.
   - The nav type sizes move onto roles, and the sub-nav order is shared with `TONIGHT_PAGES`.
5. **`ui-log-progress-gear`** (findings 8 for /gear, 10, what is left of the /log header).
   - The progress page (a progress bar plus a quieter grid), /gear's labelled meta rows with fact icons, and the Log header's remaining Sky checks link.

Finding 11 (desktop) is resolved by decision 5: no two-column fact layout.
