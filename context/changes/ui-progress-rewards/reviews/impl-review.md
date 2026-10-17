<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Progress rewards (milestone badges, type-icon tile checklists)

- **Plan**: context/changes/ui-progress-rewards/plan.md
- **Scope**: Full plan (PR #224, `feat/ui-progress-rewards` at fb4ae23 against `origin/main`)
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-17
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 4 observations

Herdr reviewer mode: only this file was written. `change.md` was not stamped `impl_reviewed` (orchestrator rule: write
only the report); the lead stamps it. No source edits, no commits, no servers started (Astro 7's preview is a shared
daemon), so the e2e and smoke evidence is the PR's CI run plus the implementer's recorded counts.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS (two documented deviations, F7) |
| Scope Discipline | PASS (`Band.astro` `collapsed` is unplanned but safe, see below) |
| Safety & Quality | WARNING (F1, F3) |
| Architecture | WARNING (F2) |
| Pattern Consistency | WARNING (F4, F8) |
| Success Criteria | PASS (F6 is about evidence, not a failing check) |

## What was checked and holds

- **Data stays derived.** The badges and tiles read only `MilestoneState` and `ChecklistItem`. The arc share is
  display arithmetic in `MilestoneBadge`'s frontmatter, and the dialog gets the server's keys.
  `src/lib/progress/progress.ts`, `milestones.ts`, `global.css`, `src/sw.ts` and `src/lib/offline/` are not in the
  diff. There is no new token, island or table, and `/log/progress` and the new components add no `<script>` or
  `client:`.
- **Owner decisions are all implemented.**
  - P1: ring, arc and rich art.
  - P2: reached is a solid `action-border` ring (4.5) with a pip. Ahead is a dashed `control-border` ring (2.4) plus a
    solid `primary-strong` arc (6.5) when progress is above 0, using `pathLength=100`.
  - P3: the number plus a motif, with the tiers kept (1/2/3 pips under 10/25/50, laurels on 110 and 61).
  - P4 and P5: tiles in 2/4 columns, with `border-2 action-border` and `action-surface` plus a check when seen.
  - P6: a legend and no filters.
  - P7: lucide `Galaxy` plus 5 drawn icons, matching the plan's node specs exactly.
  - P8 A: Caldwell and both "Seen so far" lists start closed, and Messier is open.
  - The badges sit in the `night-sky` scope, so they stay navy in the light theme.
  - Round 1b is applied: `red:opacity-80` on the reached Moon body and on all five numerals, and
    `opacity-30 dark:opacity-40 red:opacity-60` on the ahead art.
- **Celebration consistency.** `MilestoneCelebration` renders the same `MilestoneBadge size="lg" reached` per key, the
  `Award` import is gone, and the dialog script is unchanged.
  - SVG ids: every gradient and clipPath carries the `idBase` prefix, and every `url(#…)` matches its id.
  - On `/log/progress` the list uses `progress-milestones-heading-<key>` and the dialog uses
    `milestone-celebration-<key>`, so the two can't collide. `/design` prefixes each row, the lg trio, each list and
    each celebration separately.
- **Accessibility.**
  - Badges are `aria-hidden` and the list item's text carries the meaning.
  - The 171 tiles form a `ul` with an `aria-label`. Each tile has one `sr-only` sentence (`data-tile-sr`), its visible
    parts are `aria-hidden`, and it has no controls.
  - The legend has its own list label.
  - Both summaries are `min-h-11` (44 px), with `focus-visible:outline-ring`, and their chevrons are `aria-hidden`.
  - The implementer's accessibility-tree probe reads `listitem: M31, Andromeda Galaxy, galaxy, seen`.
- **Red mode by shape.** Seen tiles differ by a 2 px vs 1 px border, a fill, the check and semibold text. Reached
  badges differ by a solid vs dashed ring, the pip and the wider solid arc. The one gap is F1.
- **Tokens only.** The grep over the changed source finds no hex, `rgb(`/`hsl(`/`oklch(`, arbitrary value or `style=`.
  The art uses `var(--…)` only, and `no-hardcoded-colors` and `red-theme` are green.
- **EN+PL.** `types` and `legendLabel` exist in both files with `satisfies Record<ObjectFamily, …>`. The Polish copy is
  correct, and "Zaobserwowane do tej pory · N" needs no plural form.
- **Phone fit.**
  - Badges: two at 112 px plus a 16 px gap need 240 of the 288 px column at 320 px.
  - Tiles: `min-w-0` and `line-clamp-2`; a seen tile adds `pr-3`, so the name clears the check.
  - `tonight-phone.spec.ts` already fails on sideways scroll on `/log/progress`.
  - Scroll at 390 px: 6,349 px with P8 A, against 5,945 px for the chips.
- **Weight.**
  - Badge art: 11 files, 73.0 KB source (20.5 KB gzip), rendered once each on `/log/progress`. The dialog renders only
    the reached keys.
  - Milestones band: 80.7 KB raw / 12.2 KB gzip measured.
  - Checklist markup: 103,758 raw / 4,926 gzip (1 seen), against a planned 95–110 KB. It is pinned at 114,000 in e2e,
    and the 37+6 log measures 111,318, so a real log stays under the budget.
  - Whole document: 234 KB / 27.8 KB gzip.
  - The evidence folder is 1.6 MB (the slimming was on purpose).
- **Hard rules (debugging).** The diff adds no `catch`, `.catch` or `.then(ok, fail)`.
- **e2e.** The spec diff only adds lines; no existing assertion was changed or weakened.
  - Steps 2, 3, 3b and 5 use an exact `toHaveText` on the tile sentence and on `[data-legend-count]` (0/40, 1/40,
    0/40, 0/40 + 1/29).
  - The dialog asserts `[data-milestone-badge="first-galaxy"]`.
  - The budget pin measures only the grids plus the sprite (plan-review F9).
- **Rhythm guard.** The six files are in `GUARDED` with empty allowlists. The break check (an `mt-4` in
  `ChecklistLegend`) went red.
- **Unplanned `Band.astro` `collapsed`.** It defaults to `false`, and the non-collapsed output is unchanged for its 24
  importers. Only the Caldwell band uses it, and `band.tsx` got a comment only.

## Automated verification (this review, worktree at fb4ae23, Node 24.21.0)

| Command | Result |
|---|---|
| `npx astro check` | pass: 0 errors, 0 warnings, 4 hints (2 in `evidence/badge-art/render.mjs`, unused `id`) |
| `npm run test:reference` | pass: 108 files, 761 passed, 1 skipped |
| `npm run test:guards` | pass: 14 files, 52 passed |
| `npx eslint --max-warnings 0 src tests/e2e/observing-milestones.spec.ts` | pass: exit 0 |
| `npm run build` | pass (sw precaches 63 files, 1123 KiB) |
| CI `ci` (run 39059303697: lint, astro check, `npm test`, build) | pass |
| CI `smoke` (db suite, smoke, whole e2e suite) | pass: db 9 files / 191 tests, "All smoke steps passed", e2e 63 passed (3.7 min, no flaky) |
| Hardcoded-value grep on the view's files | 0 hits (reviewer grep, matches implementation-notes) |

Manual Progress items are all `[x]`. 3.7, 3.8 and 4.7 rest on `implementation-notes.md` and the 9 committed WebP
files; the "compared with `evidence/before-*`" half of 4.7 has no artefact (F6).

## Findings

### F1 — The nested "Seen so far" chevron follows the Caldwell band, not its own `<details>`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (a11y, red by shape)
- **Location**: src/components/progress/SeenList.astro:31,42 inside src/components/ui/Band.astro:40,53
- **Detail**: Both disclosures use an unnamed `group` and `group-open:rotate-180`. In the build that compiles to
  `.group-open\:rotate-180:is(:where(.group):is([open],…) *)` (checked in `dist/client/_astro/*.css`), which matches
  any open `.group` ancestor, not the nearest one. The Caldwell SeenList sits inside the Caldwell `<details class="group">`.
  - The result: when the band is open and "Seen so far" is closed, the inner chevron points up (the "open" state).
  - In red mode the chevron's direction is the only visible state cue, so this breaks the "state by shape" rule.
  - Messier is unaffected, because its Band is not a `<details>`.
  - The screenshot gate didn't catch it: `caldwell-open-red-390.webp` shows the band open, and nothing records the
    inner chevron's state.
- **Fix**: Use named groups: `group/band` with `group-open/band:rotate-180` in `Band.astro`, and `group/seen` with
  `group-open/seen:rotate-180` in `SeenList.astro`. Re-check the open band in red at 390 px.
- **Decision**: PENDING

### F2 — The art generator lives in the change folder, and CLAUDE.md sends future agents there

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: CLAUDE.md:13 ("generated … by `context/changes/ui-progress-rewards/evidence/badge-art/port.mjs` (change
  `render.mjs` there and re-run, never by hand)"), and the header of each of the 11 `src/components/progress/badge-art/*Art.astro` files
- **Detail**: The 11 product components are generated output, but their generator (`render.mjs` 599 lines,
  `port.mjs`, the 11 source SVGs) lives under `context/changes/…/evidence/`. After `/10x-archive` that path becomes
  `context/archive/…`, and CLAUDE.md's first tripwire forbids writing there.
  - From then on, any art fix breaks either "never by hand" or "never write to `context/archive/`".
  - Every other generator here (`catalogue:build`, `stars:build`) lives under `scripts/` with an npm script.
  - `astro check` also type-checks `render.mjs` (2 of the 4 hints).
- **Fix A ⭐ Recommended**: Move `render.mjs`, `port.mjs` and the source SVGs to `scripts/badge-art/` (with an npm
  script such as `badge-art:port`). Update the 11 headers and CLAUDE.md, and keep only the rendered WebP sheets as
  evidence.
  - Strength: matches the repo's generator pattern (`scripts/`, tripwire-style "change the generator, re-run it"), and
    the rule stays valid after archiving.
  - Tradeoff: about 700 lines of tooling move into the product tree, and it's one more small commit before merge.
  - Confidence: HIGH — the tripwire conflict is mechanical, and `scripts/` already hosts generators.
  - Blind spot: whether `render.mjs` imports anything relative to the evidence folder (the paths need checking after
    the move).
- **Fix B**: Declare the ported `.astro` art the source of truth from now on: drop "generated … never by hand" from the
  headers and CLAUDE.md, and keep the scripts as a historical record in the change folder (later archived).
  - Strength: no tooling in the product tree; the art is static and rarely changes.
  - Tradeoff: later edits are hand-made on 100–400-line SVG files, and the trimmed-coordinates discipline (round 1c)
    is lost.
  - Confidence: MED — acceptable if the owner expects no art rounds after this one.
  - Blind spot: future badge additions (a new milestone needs new art) would have no generator.
- **Decision**: PENDING

### F3 — The Caldwell heading sits inside `<summary>`

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (a11y)
- **Location**: src/components/ui/Band.astro:42-56
- **Detail**: In collapsed mode the band's `<h2 id={headingId}>` is a child of `<summary>`. This is valid HTML, and the
  section's `aria-labelledby` still names the region.
  - But Safari with VoiceOver, and some Firefox and screen-reader combinations, expose `<summary>` as a button and
    flatten its children. "Caldwell · n / 61" can then drop out of heading navigation (H key, rotor), the main way a
    screen-reader user moves through this long page.
  - The implementer's probe checked the Playwright (Chromium) accessibility tree and the keyboard only, not VoiceOver.
  - It's a new pattern in a shared component. The only existing `<summary>` uses (onboarding "manual", NotSeenMark rows)
    hold no headings.
- **Fix A ⭐ Recommended**: Check the page with VoiceOver in Safari (rotor → headings). If "Caldwell" is missing, keep
  the `h2` outside the disclosure (in the band's heading row) and make the `<summary>` a short labelled toggle beside it
  (`aria-describedby` or text such as "Show the list"). If it's present, accept the pattern and say so in `Band`'s
  comment.
  - Strength: decides on evidence, and only changes markup if the risk is real.
  - Tradeoff: one manual VoiceOver pass. If it fails, a visual change in the band header goes to the owner (P8 A
    specified the heading as the summary).
  - Confidence: MED — the flattening is documented for WebKit, but its effect on rotor heading lists varies by version.
  - Blind spot: not verified by this review (no browser run).
- **Fix B**: Accept the pattern without testing (the region landmark keeps the name).
  - Strength: no work.
  - Tradeoff: a possible heading-navigation gap on the app's longest page.
  - Confidence: LOW — unverified.
  - Blind spot: VoiceOver behaviour.
- **Decision**: PENDING

### F4 — Step 3b allows a dialog that must not open

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency (tests)
- **Location**: tests/e2e/observing-milestones.spec.ts:208
- **Detail**: The step's own comment says that re-rating M31 back to 4 celebrates nothing, because "First galaxy" is
  already stored. But the step ends with `dismissCelebrationIfOpen(page)`, which accepts and closes a dialog if one
  opens.
  - A regression that celebrates a stored milestone a second time (the risk `reachedBySave`'s `newlyReached ∩ inserted`
    guards against) would pass silently here.
  - The same spec already has `expectNoCelebration` (`:92`) and uses it at `:262`, `:313` and `:340`.
  - Test-diet note: apart from this, 3b is the only step that covers the seen → not-seen transition caused by a
    re-rating. Step 5 covers removing the entry, so 3b earns its place.
- **Fix**: Replace `dismissCelebrationIfOpen(page)` at `:208` with `expectNoCelebration(page)`.
- **Decision**: PENDING

### F5 — The dialog stacks lg badges one per row at 320 px

- **Severity**: 💬 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (phone fit)
- **Location**: src/components/progress/MilestoneCelebration.astro:77-81
- **Detail**: The dialog's inner width at 320 px is about 238 px, so two 128 px badges plus `gap-3` (268 px) don't fit
  side by side.
  - Three reached milestones (the evidence state: First galaxy, 10 and 25 Messier) stack to about 410 px of badges
    before the label, the names and Continue.
  - At 390 px they sit two by one (`dialog-red-390.webp`), and the whole dialog fits.
  - At 320 px Continue is likely below the fold. The dialog scrolls, so nothing breaks, but the main action is hidden.
  - Several milestones at once are rare in practice (only a first save, or an import), and the owner fixed 128 px in
    the dialog.
- **Fix**: An owner item. Either keep `lg` (accept the scroll on a multi-milestone dialog at 320 px), or use `md`
  (112 px, which fits 2 per row) when two or more keys are passed.
  - Strength: keeps Continue in view on the smallest phones.
  - Tradeoff: departs from the owner's "128 px in the dialog".
  - Confidence: MED — the arithmetic, not a 320 px screenshot (none was committed for the dialog).
  - Blind spot: the dialog's actual `max-height` and padding at 320 px.
- **Decision**: PENDING

### F6 — The screenshot gate's "compared with `evidence/before-*`" has no artefact

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: plan.md Progress 4.7; context/changes/ui-progress-rewards/evidence/README.md
- **Detail**: Progress 4.7 still names `evidence/after/` (the files are in `evidence/impl/`; implementation-notes
  explains the rename).
  - The plan's gate says "compared with `evidence/before-*`", and the owner questions cite
    `before-c-milestone-list-*.png`. No `before-*` file is in HEAD, in any commit (`git log --all`), or on disk.
  - The README lists what was slimmed out (the owner-question mockups, the art sheets, the impl gate), but not
    before-shots.
  - The visual comparison may well have happened; it just can't be checked. This is not a request to re-add weight
    (the slimming was deliberate).
- **Fix**: Make Progress 4.7 read `evidence/impl/`, and add one README line saying whether before-shots existed and
  were left out, or the comparison was against `origin/main` live.
- **Decision**: PENDING

### F7 — Plan deviations recorded only in code, plus a stale CLAUDE.md sentence

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/progress/MilestoneBadge.astro:63-92; CLAUDE.md:13 (Observing milestones); src/pages/design.astro (forced-red badge rows)
- **Detail**:
  - (a) The plan's `badge-art/index.ts` with `MILESTONE_ART: Record<MilestoneKey, …>` became an exhaustive `switch`
    with a `never` default in `MilestoneBadge`. It gives the same compile-time guarantee. The reason (an `.astro`
    component value is untyped for the type-aware lint) is written only in `port.mjs:5-6`.
  - (b) CLAUDE.md's existing milestones paragraph still describes the dialog as "(Award, plural label, …)", which
    contradicts the new sentence "instead of the old Award".
  - (c) `/design` leaves out the forced-red badge rows on the light page, because the `night-sky` scope would override
    them. This is justified in a code comment and harmless.
- **Fix**: Add one line on (a) to `implementation-notes.md` (and the plan's epilogue if the lead keeps one), and change
  "Award" to "the reached milestones' badges" in CLAUDE.md's milestones paragraph.
- **Decision**: PENDING

### F8 — Small consistency nits in the new disclosure and imports

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/ui/Band.astro:43-48 vs src/components/progress/SeenList.astro:34-39; src/components/ui/band.tsx:7; src/components/progress/ChecklistLegend.astro:10, ObjectTypeSprite.astro:12; src/pages/design.astro (checklist matrix note)
- **Detail**:
  - The two summaries repeat the same class list (44 px, hover tint, focus ring), so the two disclosures can drift
    apart.
  - `band.tsx:7`'s comment line now runs well past the 120-column width.
  - `ChecklistLegend` and `ObjectTypeSprite` import `./progress-icons`, where the convention (and `design.astro`) uses
    `@/components/progress/progress-icons`.
  - The `/design` checklist matrix marks hover and focus-visible "N/A (not interactive)", but the new summaries have
    both. `Band collapsed` has no `/design` specimen (CLAUDE.md: "A new shared component gets its states there").
  - A few art paths keep long float coordinates (`Messier25Art.astro:33` "33.559999999999995") against round 1c's
    one-decimal rule. This is cosmetic, and part of F2's generator.
- **Fix**: Move the summary classes into one shared constant (for example a `DISCLOSURE_SUMMARY_CLASS` beside `Band`),
  rewrap the comment, use the `@/` alias, and add a collapsed-band specimen whose matrix note lists hover and
  focus-visible.
- **Decision**: PENDING
