<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Quieter per-item actions (ui-quiet-actions)

- **Plan**: context/changes/ui-quiet-actions/plan.md (branch feat/ui-refine at ff568f4, owner decisions D1/D2 recorded; `src` identical to main a98e77a)
- **Phases**: 3
- **Date**: 2026-10-14
- **Reviewer**: the "reviewer" agent (Opus), with two Opus subagents (claim verification; feasibility and S-07 interplay), independent of the plan's author
- **Verdict**: NEEDS ATTENTION. The plan is sound: the call-site list is exact, the `bare` size is the right fix for cva padding, the 44 px height comes from the base classes, Phase 2's removal is enforced by TypeScript, and no e2e spec locates by style. The warnings are about the edges the hierarchy moves: offline styling of the hairline, missing contrast pins, commands not runnable as written, S-07 anchors and evidence, and leftover docs. All are triage fixes, not a re-plan.
- **Findings**: 0 critical, 6 warnings, 4 observations
- **Owner answers taken as given**: D1 = new neutral grey `--control-border` ≥3:1 for the one per-item hairline; D2 = resting underline on text actions in red only.
- **change.md**: deliberately not stamped `plan_reviewed`. The orchestrator limited this review to writing this file, so the author flips the status.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Claim Accuracy | WARNING |
| Substance | WARNING |
| Feasibility | PASS |
| Sequencing | PASS |
| Architecture Fit | PASS |
| Scope Discipline | PASS |
| Verifiability | WARNING |
| Coverage | WARNING |

## Grounding

**Confirmed claims**
- **`action` variant.** Defined at `button.tsx:39-40` as described.
- **Call sites.** A full grep of `"action"` over src, tests and scripts finds exactly the 12 product call sites in 10 files the plan lists. `gear/index.astro:97` is `addClass`'s third branch, used at `:132`, `:167` and `:199`.
  - No `.tsx`, FinderContent or S-07 use.
  - `/design` uses it at `:187`, `:191`, `:193`, `:872`, `:882`, `:1715` and `:1745`.
- **Action tokens.** Only `RESTING_BORDER_CLASS`, `SkyAnswerForm`, `tile.ts:26`, the medallion, `/design` swatches and the contrast rows use them.
- **CLAUDE.md.** `CLAUDE.md:99` is the Clickables bullet, and `AGENTS.md` is a symlink to `CLAUDE.md`.
- **global.css.**
  - Custom variants at `:8`, `:11` and `:14`; Tailwind ^4.2.4.
  - The offline rule (`:550-562`) is **unlayered**, so it beats `red:underline` and `hover:underline` in the utilities layer. A quiet Manage link offline is muted with no underline, as the plan expects.
- **Test files.**
  - `contrast.test.ts` reads plain hex in `{themes, fg[], bg[], floor}` rows.
  - `red-theme.test.ts` reads the red blocks for values and the first `:root` for completeness.
  - `no-hardcoded-colors.test.ts` excludes `global.css`.
- **Tile cue and eyepiece names.**
  - `tile.ts:22-26` is the `size-6` chip.
  - The eyepiece spans are exactly at `ObjectDetails:50,55`, `PlanetCard:56`, `MoonCard:88,98` and `design:709`.
- **Heights.** `min-h-11` is in cva's base (`button.tsx:21`), so `bare` keeps 44 px. `GEAR_CARD_MIN_HEIGHT_CLASS` is `min-h-34 sm:min-h-37` (`sky-band.ts:30`).
- **e2e.**
  - No `toHaveScreenshot`, and no class or style assertion on these links. The only `getComputedStyle` / `toHaveCSS` checks are on the body background, the panorama chevron and the toast position.
  - `tonight-dashboard.spec.ts:62` is as described.
- **Evidence tooling.** `seed.mjs`, `capture.mjs`, `exp-a` and `exp-b` exist.
- **Candidate token values** (background / surface):
  - dark `#646e8a`: 3.90 / 3.68;
  - light `#808a9e`: 3.38 / 3.17;
  - red `#c80000`: 3.42 / 3.33.

**Commands**
- `npm test`, `npm run lint`, `npx astro check`, `npm run build`, `npm run test:e2e` and `npm run smoke` all exist in `package.json`.
- `npx playwright test tonight-phone tonight-targets … finder-chart --list` resolves to 27 tests in 12 files. The `observation-log` filter also matches `observation-log-management`.
- `grep -rn 'variant: "action"' src` runs today and prints 17 lines.

**S-07 (feat/sky-events at 005d3d3, rebased onto a98e77a)**
- It adds no `action` call site, no `TILE_CUE_CLASS` use and no link colour on non-link text.
- Its inline link (`EventsPageContent.astro:48`, `link` + `px-0`, no icon) already follows the future rule.
- Its locators (`sky-events.spec.ts:58`, the `tonight-dashboard.spec` tile by role and name) do not depend on the action style or the cue chip.

**Sequencing**
- Phase 1 is additive.
- Phase 2's removal is caught by TypeScript, because cva's variant union fails on any leftover call.
- The rebase is trivial, since the branch only touches `context/`.

## Findings

### F1 — Offline, the hairline keeps a link-coloured icon and its dash is invisible in red

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Coverage
- **Location**: plan.md "Critical Implementation Details › Offline", Phase 1 §3 (`hairline`: "icons in `text-primary-strong`"); src/styles/global.css:550-562
- **Detail**:
  - **Icon colour.** The offline rule sets `color` on the `[data-needs-network]` element and on descendant `a`, `button` and `select` only.
    - Today "Mark observed"'s Check icon inherits the link colour, so offline it turns muted.
    - If the hairline paints its icon through its own utility (e.g. `[&_svg]:text-primary-strong`, needed because its label is `text-foreground`), the icon stays link-coloured offline and under `aria-disabled`. The plan's "do not add per-variant offline styles" then leaves a live-looking icon on a disabled control.
  - **Dash colour.** The dash uses `border-color: var(--border)`, which is 1.17:1 in red (`#3a0000` on `#080000`) and about 1.3-1.4 elsewhere.
    - So "Mark observed gets the dash" (manual check 2.7) is barely visible, and invisible in red.
    - This is inherited from `action`, but this plan introduces `--control-border` precisely because a <3:1 border does not read.
- **Fix**: Extend the offline rule rather than the variant: add `svg` to the colour reset (`:root[data-offline] [data-needs-network] svg { color: inherit }`), and dash in `var(--control-border)` instead of `var(--border)`. Show both in the `/design` offline specimen, and update the comment at `:543-549`.
  - Strength: one global rule keeps the plan's "no per-variant offline styles" and fixes every network-only control at once.
  - Tradeoff: the sky-check answer buttons and Topbar/TabBar entries also get the stronger dash colour, though the Topbar/TabBar links have no border width, so it never shows there. Check the sky-check card offline in red.
  - Confidence: MED. The cascade is confirmed (unlayered rule). The visual result of the stronger dash on the sky-check card has not been seen.
  - Blind spot: whether the owner wants offline controls to read as clearly bordered at all, or only as muted.
- **Decision**: APPLIED (owner): the dash stays `var(--border)`; the offline rule gains an `svg { color: inherit }` reset so the hairline's icon mutes (plan Phase 1 §2, Critical Implementation Details).

### F2 — Contrast pins: quiet text on the ground and the surface is not pinned at 4.5, and the red numbers are off

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Claim Accuracy
- **Location**: plan.md "Key Discoveries" (red 5.20 / 5.07), Phase 1 §4; src/styles/contrast.test.ts:81, :97, :124
- **Detail**:
  - **The pins are incomplete.** Quiet actions lose their `action-surface` fill, so their text sits directly on the ground or the surface. Manage sits in the `bg-surface` GearCard; Pager, Finder chart, the washed-out link, "Back to sign in" and the /log/progress empty link sit on the ground.
    - Today `primary-strong` as text is pinned at 4.5 only on `background`, and only in dark and light (`:81`).
    - Red has only a 3:1 icon row (`:97`); its text is held at 4.5 indirectly through the `action-surface` row (`:124`).
    - No row pins `surface` at 4.5 in any theme. Current values pass (dark 12.99 / 12.26, light 8.61 / 8.08, red 5.20 / 5.07), but nothing guards them.
  - **Wrong red figures.** The plan's red "5.20 / 5.07 (zenith / horizon)" are the background / surface values. On red zenith `#000000` / horizon `#240000` the real values are 5.25 / **4.89**, a 0.39 margin. Light zenith is 4.90.
  - **Thin red border margin.** The smallest pure red `--control-border` that clears 3:1 on red background and surface is `#bb0000`, at 3.0035 on surface. "Around `#c80000`" is fine; anything below about `#c00000` is too thin.
  - **Hairline on a sky header.** `--control-border` on the light zenith is only 1.92, so a hairline must never sit on a sky header.
- **Fix**:
  - In Phase 1 §4, add a row `primary-strong` on `background` + `surface` ≥4.5 for dark, light and red.
  - Correct the red figures.
  - Fix the red `--control-border` at ≥ `#c00000`.
  - State in the rule that a hairline never sits on a sky header (or pin it there).
- **Decision**: APPLIED: pins for `primary-strong` on background+surface and on zenith+horizon at 4.5 (dark, light, red), red figures corrected, red `--control-border` ≥ `#c00000`, "never on a sky header" in the rule.

### F3 — The e2e success criteria are not runnable as written, and the spec list misses users of the moved links

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Verifiability
- **Location**: plan.md Phase 2 "Automated Verification" (2.4, 2.5), Progress 2.5 (no command), Phase 3 (3.2, 3.3)
- **Detail**:
  - **Defaults don't match the plan's ports.** `playwright.config.ts` has no `webServer` and defaults to `http://localhost:4321`. The forecast fixture defaults to `FIXTURE_PORT ?? 4400`. Nothing in the repo defines 4331 or 4401 except `ui-refine/evidence/seed.mjs:9` and `capture.mjs:8`.
  - **Missing prerequisites.** Phase 2's lines need:
    - `BASE_URL=http://localhost:4331`;
    - a preview started with `--port 4331`;
    - `FIXTURE_PORT=4401`;
    - `FORECAST_BASE_URL` in `.dev.vars`, then a rebuild (`dist/server/.dev.vars`);
    - local Supabase;
    - for `finder-chart`, `SUPABASE_URL` / `SUPABASE_SECRET_KEY` inline.
  - **Progress 2.5 has no command at all.**
  - **Specs missing from the 2.5 list:**
    - `finder-offline` and `what-to-expect`, which use the Finder link through `helpers.ts:212-219`;
    - `moon-card`, the washed-out link;
    - `red-night-mode`, the theme whose look changes most;
    - after the rebase, `sky-events`, which uses the quiet back link on `/tonight/events`.
- **Fix**: Spell out the full command line with its environment in Phase 2 and in Progress 2.4/2.5, with the ports as parameters (other agents hold ports), and add `finder-offline`, `what-to-expect`, `moon-card`, `red-night-mode` and `sky-events` to the list.
- **Decision**: APPLIED: full commands with ports 4331/4401, `.dev.vars` rewrite after build and keys inline; `finder-offline`, `what-to-expect`, `moon-card`, `red-night-mode`, `sky-events` added.

### F4 — What must be re-checked after S-07 merges

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Coverage
- **Location**: plan.md "Current State Analysis › S-07", Phase 1 §1, Phase 1 §5, Phase 2 §5, Phase 3 §1-§2, "What We're NOT Doing"
- **Detail**:
  - **Line anchors move after the rebase.** S-07 edits `design.astro` and CLAUDE.md:
    - `design.astro`: 187-193 → about 190-196, 195-196 → 198-199, 709 → 717, 866-887 → 874-895, 1009 → 1017, 1063 → 1071, 1715 → 1787, 1745 → 1817;
    - the select's `offlineAction` 1773 → 1845, and the tile specimens 1861-1905 → about 1933-1977;
    - `CLAUDE.md`: Clickables 99 → 101, Gear cards → 103, Finder paragraph 15 → 17.
  - **New S-07 surfaces the change reaches automatically.** They need checking, not editing:
    - the events tile (`EventsTile.astro` via `Tile`) gets the bare arrow, and its `/design` specimens (default, hover, focus, around line 2053) need recapturing;
    - the `/tonight/events` back link (`TonightPageSky` → `BackLink`, in `.night-sky`) becomes quiet and red-underlined;
    - `tonight-phone.spec` already covers `/tonight/events` for sideways scroll in PL at 320/375.
  - **Attribution links.** `Attribution.astro:10-12`, plus two S-07 credit links, are hand-styled with a `decoration-border` underline. In red that underline is 1.17:1, so these links read as muted text, the very problem D2 solves for quiet actions. The plan neither moves them nor names them under "What We're NOT Doing".
  - **Evidence.** The matrix (Desired End State :75, Phase 3 §2) omits `/tonight/events`, the six-tile dashboard, the finder page (Finder chart's own back link), `/log/sky` (Pager), confirm-email and the milestone dialog.
    - The verdict's event line depends on the real clock, so its evidence must come from the `/design` VerdictCard event specimens.
    - `capture.mjs` hard-codes `BASE` to 4331, and its ROUTES lack `/tonight/events` and `/design`. `/design` is dev-only, so it needs a different base URL.
- **Fix**: Add a "Re-check after S-07" sub-step to Phase 1 §1:
  - re-anchor every line reference after the rebase;
  - list the events tile, the `/tonight/events` back link and the EventsTile/VerdictCard specimens as checks;
  - decide the Attribution links (move them to `quiet`/`link`, or name them under NOT Doing);
  - make `capture.mjs`'s base URL a parameter;
  - add `/tonight/events`, the finder page, `/log/sky`, confirm-email, the milestone dialog and the `/design` event specimens to the matrix.
  - Strength: the plan already gates on S-07's merge; this turns "rebase" into a concrete checklist so nothing from S-07 escapes the evidence.
  - Tradeoff: Phase 3's capture grows by about six views.
  - Confidence: HIGH. Every item was checked against `git diff a98e77a..005d3d3`.
  - Blind spot: S-07 may still change before it merges (its impl-review fixes landed at 005d3d3), so the anchors are a snapshot.
- **Decision**: APPLIED after the rebase onto main 1389bc1 (S-07 merged): anchors re-taken; S-07 re-check list in Phase 1 §1; credit links (Attribution, onboarding) get `red:decoration-current` as plain sentence links (owner); capture grows by events, finder, /log/sky, confirm-email and the /design specimens.

### F5 — Docs and comments that still prescribe `action` are not all in Phase 3, and its grep check misses them

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md Phase 3 §1 and check 3.4; CLAUDE.md:15 (17 after S-07), :99, :101
- **Detail**:
  - **CLAUDE.md places the plan's check misses.** `grep -n 'variant: "action"' CLAUDE.md` catches only `:99`. It misses:
    - the Finder chart paragraph ("Finder chart" **action link**, `:15`);
    - the offline sentence in the Clickables bullet ("an `action` link with `data-needs-network` turns muted with a dashed border");
    - the Gear cards text at `:101` ("a `Manage sites/telescopes` `action` link").
  - **Code comments still describing the action look:**
    - `Tile.astro:3` ("arrow in a bordered chip");
    - `TargetDetails.astro:21,38-39`;
    - `MoonCard.astro:32`;
    - `gear/index.astro:85-87`;
    - `global.css:40` and `:546`;
    - `design.astro:190-193`, `:1652` and `:1784` (Manage's hover is "the action variant's");
    - `en.ts:1054`.
  - **Naming collisions with the new `quiet` variant:**
    - `Band.astro:4` and `band.tsx:8` say the band's slot holds "one quiet action", but /gear's will hold a hairline;
    - `SkyCheckCard.astro:39` has a local `quietAction`, which is the `link` variant.
- **Fix**:
  - Add these files to Phase 3 §1.
  - Replace 3.4 with `grep -nE '`action`|action link|tinted|bordered chip' CLAUDE.md src` reviewed by hand, the action tokens' own lines excepted.
  - Rename `SkyCheckCard`'s `quietAction` (e.g. `inlineAction`).
- **Decision**: APPLIED: every CLAUDE.md mention and comment listed in Phase 3 §1; the grep check widened and reviewed by hand; `SkyCheckCard` `quietAction` → `inlineAction`.

### F6 — `/design`: the generic loops need the `bare` size, and the Manage specimens must move, not be deleted

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Substance
- **Location**: plan.md Phase 1 §5, Phase 2 §5; src/pages/design.astro:190-196 (`sizeOf`, focus filter), :1715, :1745 (Manage specimens)
- **Detail**:
  - **`sizeOf`.** It maps a variant to its size for the focus and disabled loops. Without `quiet → "bare"` (and `hairline → "sm"`), the loops render quiet at the default size with `px-5`, so the specimen is not what the views ship.
  - **Manage specimens.** Phase 2 §5 says to delete `action` from the specimens at `:1715` / `:1745`. Those are the GearCard Manage specimens, which must migrate to `quiet` / `bare`, not disappear.
  - **Hover mirror.** The quiet hover specimen should mirror `red:decoration-2` too.
  - **Disabled specimen.** A disabled link is only ever the offline `aria-disabled` state; say so beside the `<button disabled>` specimen.
- **Fix**: In Phase 1 §5, map `sizeOf` (quiet → bare, hairline → sm) and include both in the focus filter. In Phase 2 §5, migrate the Manage specimens to quiet instead of deleting them.
- **Decision**: APPLIED: `sizeOf` maps quiet → bare, hairline → sm, focus filter includes both; Manage specimens migrate, not deleted; quiet hover mirrors `red:decoration-2`; disabled-link note.

### F7 — Red mode: `outline` and the hairline nearly merge, and a quiet action equals an inline link

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Coverage
- **Location**: plan.md "Desired End State › Red mode", Phase 3 manual 3.6; src/components/ui/button.tsx (`outline`, `link`)
- **Detail**: Measured in red against `#080000`.
  - **Clear separations:**
    - quiet vs body text: underline, icon and weight (the colours differ only 1.10:1);
    - hairline vs quiet: box vs underline;
    - suggested sky answer vs hairline: `border-2`;
    - tile vs quiet: the muted arrow (3.31) plus row layout.
  - **What flattens:**
    - `outline` (border `#ff0000`) vs hairline (`#c80000`) differ by only 1.52:1. "Show the other … objects" (outline) and "Mark observed" (hairline) look alike, and so do /gear's empty-band Add (outline) and filled-band Add (hairline).
    - A quiet action is identical to an inline `link` (both underlined at rest). Only the icon and position separate them.
    - The hairline's hover in red is weak: accent about 1.08, border step 1.52.
    - In **dark**, quiet vs body text is also only 1.18 apart (a pale tint), so the icon carries it.
  - The plan's manual 3.6 checks only "findable without hue" in red.
- **Fix**: Extend 3.6:
  - add dark mode;
  - add the dashboard;
  - add the outline-vs-hairline pairs ("Show the other objects" next to "Mark observed"; /gear empty vs filled Add);
  - let the owner judge them on the screenshots.

  Have the rule say that a quiet action always carries its icon, which is what separates it from an inline link.
  - Strength: the owner judges the one real flattening on evidence, without a new token.
  - Tradeoff: if the owner finds outline and hairline too close, `outline` or the hairline needs a red-only tweak, which is more scope.
  - Confidence: MED. Contrast figures computed; the perceptual call is the owner's.
  - Blind spot: not seen on a real phone at night.
- **Decision**: APPLIED: manual 3.6 covers red and dark and the dashboard, and the F7 pairs are captured as crops for the owner; the rule says a quiet action always carries its icon.

### F8 — No automated guard for D2 or the offline mute

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Verifiability
- **Location**: plan.md "Testing Strategy › Integration Tests" ("No new e2e spec")
- **Detail**: The owner's D2 decision (underline at rest in red only) and the offline mute (no underline) are checked only by eye. Both are cheap to pin, and `red-night-mode.spec.ts` already exists with `getComputedStyle` checks. Without a pin, a later variant edit or a cascade change (the unlayered offline rule) can silently undo an owner decision.
- **Fix**: Add one assertion to `red-night-mode.spec.ts`: in red, a back link has `text-decoration-line: underline`, and in dark it has `none`.
- **Decision**: APPLIED: Phase 2 §5 adds a `red-night-mode.spec.ts` test on the signed-out confirm-email page (underline in red, none in dark).

### F9 — Two explanations in the plan and research are inaccurate, with harmless conclusions

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Claim Accuracy
- **Location**: plan.md "Key Discoveries" (:79, :83); research.md §4; "Testing Strategy" (tonight-phone)
- **Detail**:
  - **The `bare` explanation.** `BackLink`, `Pager` and the inline links do merge through `cn()` (twMerge). The real clash is `sm`'s `has-[>svg]:px-2.5`: its `:has()` selector out-ranks `px-0`, and twMerge does not treat the two as conflicting. The `bare` size is still the right call.
  - **Research's `--border` range.** "1.17-1.78:1" cannot be reproduced; the real range is about 1.14-1.57. The conclusion that it is below 3:1 holds.
  - **What `tonight-phone.spec` guards.** It does not measure the gear cards against `GEAR_CARD_MIN_HEIGHT_CLASS`, and it checks Polish only for sideways scroll at 320/375, not wrap height. "The card's height must not change" stays a manual check (2.8).
- **Fix**: Correct the Key Discovery wording and the research figure, and say in Testing Strategy that the card height is manual (2.8).
- **Decision**: APPLIED: the `bare` explanation corrected (`has-[>svg]:px-2.5`), the `--border` range corrected in research and plan, the card height named as manual check 2.8.

### F10 — The landing screenshot and the "link colour only on links" wording

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Coverage
- **Location**: plan.md Phase 3 §1 (rule text) and §2; CLAUDE.md "Landing"; `public/landing/tonight.png`
- **Detail**:
  - **Landing screenshot.** CLAUDE.md asks to recapture `public/landing/tonight.png` (`CAPTURE_LANDING=1 … npx playwright test landing-screenshot`) after a Tonight redesign. The tile arrows and the Manage link change on the dashboard, but no phase mentions the recapture.
  - **Rule wording.** The planned "link-colour text only on links" must say **text**. Several non-link icons stay link-coloured on purpose:
    - Eye at `ObjectDetails:43` and `FinderContent:96`;
    - the GearCard icons;
    - `NotSeenMark` / `NotSeenLegend`;
    - the Notice and confirm-email icons.
- **Fix**: Add the landing recapture (or an explicit "not needed" judged from the image) to Phase 3 §2. Word the rule as "link-colour text only on links; icons may keep it".
- **Decision**: APPLIED: the landing image is judged and recaptured if needed in Phase 3 §2; the rule says link-colour text only on links, icons may keep it.
