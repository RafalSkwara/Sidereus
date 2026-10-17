<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Progress rewards (milestone badges, type-icon tile checklists)

- **Plan**: `context/changes/ui-progress-rewards/plan.md` (branch `feat/ui-progress-rewards`, b76157c)
- **Date**: 2026-10-17
- **Reviewer**: herdr agent `reviewer` (Opus, medium)
- **Phases**: 4
- **Findings**: 0 critical, 5 warnings, 5 observations
- **Overall**: NEEDS ATTENTION. Every finding is LOW impact and fixable in triage without re-planning; implementation can start once F1–F5 are patched in the plan.
- **change.md**: not touched. The orchestrator limited this run to this file, so `status: planned` → `plan_reviewed` is for the lead to set.

```
═══════════════════════════════════════════════════════════
  PLAN REVIEW: Progress rewards (S-11, #215)
  Phases: 4  |  Date: 2026-10-17
  Findings: 0 critical  5 warnings  5 observations
═══════════════════════════════════════════════════════════

  Claim Accuracy        WARNING ⚠️   (F5, F7)
  Substance             PASS    ✅
  Feasibility           WARNING ⚠️   (F1, F3, F6)
  Sequencing            WARNING ⚠️   (F4)
  Architecture Fit      PASS    ✅
  Scope Discipline      PASS    ✅
  Verifiability         WARNING ⚠️   (F2, F9, F10)
  Coverage              PASS    ✅   (F8, observation)

  ► Overall: NEEDS ATTENTION
═══════════════════════════════════════════════════════════
```

## What holds (checked against the repo)

- **Badges stay derived, no new data path.** `ChecklistItem.type` exists (`src/lib/progress/progress.ts:23,61`); `MILESTONES`, `MilestoneKey` and `MilestoneState.progress` match the plan (`src/lib/progress/milestones.ts:23-56`); `countState` caps at N (`:134-136`). `MilestoneBadge` takes `MilestoneState` data only. `FAMILY_OF`/`MILESTONE_GLYPHS` are display maps over existing types. No store, migration, island or client script is added. ✅
- **Six families cover all 12 `DEEP_SKY_TYPES`** (`src/lib/catalogue/index.ts:15-29`). Counts from the JSON: Messier galaxy 40, globular 29, open 26, planetary 4, nebula family 8, stars 3 (asterism, double, other); Caldwell has no `stars`. "1 / 40" in the e2e contract is correct. ✅
- **lucide 1.45.0** (in node_modules) exports `Galaxy`, `Moon`, `Check`, `Award` and `createLucideIcon(name, iconNode)`. ✅
- **Celebration consistency.** The medallion is at `MilestoneCelebration.astro:74-76` (`Award`, `action-*` tokens), as the plan says. The dialog sits in the `night-sky` scope, and the action tokens are defined for the light `.night-sky` (`global.css:168-169`) and pinned for `night` (`contrast.test.ts:134-140`), so reached badges in the dialog hold up in every theme. ✅
- **A11y basics of the grid**: `<ul aria-label>` + `<li>`, nothing interactive (no 171 tab stops), the visible number `aria-hidden`, and the sr-only sentence carries number, name, type and state. The Band headings keep the overall count ("Messier · 37 / 110"). ✅
- **Red mode, tiles**: seen = 2 px `#d00000` + `#2a0000` fill + semibold + check; not seen = 1 px `#3a0000`, no fill. State reads by shape, not hue (mockup `q4-grid-a-dense-red-390.png` confirms). ✅
- **Tokens only, no new token**: confirmed except F7 (one pair not pinned). EN+PL: copy contract complete, with `satisfies Messages` parity. ✅
- **`/design` anchors** `:672-689` and `:3307/3343/3371` exist. The `test:reference`, `test:guards`, `test:e2e`, `smoke` and `build` scripts resolve, and `npm run test:guards` ran green (52 tests). ✅
- **Test-diet rubric**: no unit test restating a map. The `Record`s are enforced by `astro check`, and the e2e cases are the only protection for the sr text, the legend count and the dialog badge. Consistent with lesson "Name the risk…". ✅

## Verdicts

| Dimension        | Verdict | Findings         |
| ---------------- | ------- | ---------------- |
| Claim Accuracy   | WARNING | F5, F7           |
| Substance        | PASS    |                  |
| Feasibility      | WARNING | F1, F3, F6       |
| Sequencing       | WARNING | F4               |
| Architecture Fit | PASS    |                  |
| Scope Discipline | PASS    |                  |
| Verifiability    | WARNING | F2, F9, F10      |
| Coverage         | PASS    | F8 (observation) |

## Findings

### F1 — The "110" numeral in the `lg` badge does not fit the 80 px medallion

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, narrow fix
- **Dimension**: Feasibility
- **Location**: plan.md "Phase 2 › 1. The badge" (`lg` = `size-20`, numeral `text-display`)
- **Detail**: `--text-display` is `clamp(2rem, …, 2.5rem)` (32–40 px, `global.css:723`), and `font-display` is Archivo at `wdth 125` (`:763`), semibold. Three expanded digits take about 2.1 em, so 67–84 px against a 76 px interior (80 px minus the 2 px border on each side). From `sm` up, "110" touches or overflows the ring. That is the dialog's largest reward (all of Messier). The `md` badge (`text-title` 22 px, about 46 px in 60 px) is fine.
- **Fix**: give the `lg` numeral `text-title` (or `text-title` for 3 digits and `text-display` for 2), and add a `lg` "110" specimen on `/design` (Phase 2 §4).
- **Decision**: ACCEPTED (orchestrator triage, 2026-10-17; applied in plan.md "Plan review triage")

### F2 — The e2e contract has an assertion that cannot fail, and a step the journey does not have

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, narrow fix
- **Dimension**: Verifiability
- **Location**: plan.md "Phase 4 › 2. e2e"
- **Detail**: (a) "its text contains … `progress.seen`" is always true: EN `notSeen` = "not seen" contains "seen", and PL "jeszcze nie zaobserwowano" contains "zaobserwowano" (`en.ts:1507-1508`, `pl.ts:1248-1249`). (b) "after re-rating to 1-2 it is back to 0 / 40": the journey in `observing-milestones.spec.ts:108-191` never re-rates M31 to 1-2. M31 goes from 2 to 4, then the entry is changed to M13 (step 5), then deleted (step 6).
- **Fix**: assert the exact sr text of the tile (`toHaveText` on the `sr-only` span, e.g. `"M31, Andromeda Galaxy, galaxy, seen"` built from the copy), or a regex anchored on `, seen$`. Put the legend checks on the real steps: step 3 galaxy `1 / 40`; step 5 galaxy `0 / 40` and globular `1 / 29`, with M31 without `data-seen`.
- **Decision**: ACCEPTED (orchestrator triage, 2026-10-17; applied in plan.md "Plan review triage")

### F3 — In red mode the progress arc differs from the dashed ring only by its shape, and the overlay geometry is not described

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, narrow fix
- **Dimension**: Feasibility
- **Location**: plan.md "Critical Implementation Details › The arc", "Phase 2 › 1. The badge"
- **Detail**: In red, the arc is `primary-strong` #ff0000 over the ring's `control-border` #c80000, a contrast of about 1.5:1 between them. All the difference has to come from solid vs dashed (and from stroke width). The plan draws the ring as a CSS `border-2 border-dashed` and the arc as an SVG circle "over the ring". A CSS border and an SVG stroke in viewBox units do not line up exactly (the radius and width scale differently), so at 64 px the arc can sit beside the dashes or half-cover them. The mockup (`q2-reached-ahead-red-390.png`, B) reads well because both are drawn the same way.
- **Fix**: on the `ahead` badge, draw the ring and the arc in one SVG (`viewBox 0 0 24 24` or 64): a dashed ring in `stroke-control-border`, and the arc solid, 1 unit wider, in `stroke-primary-strong` over it. No CSS border on `ahead`. `reached` keeps `rounded-full border-2`.
- **Decision**: ACCEPTED (orchestrator triage, 2026-10-17; applied in plan.md "Plan review triage")

### F4 — Between Phase 3 and Phase 4, `/design` shows tiles without icons

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, narrow fix
- **Dimension**: Sequencing
- **Location**: plan.md "Phase 3 › Changes Required" vs "Phase 4 › 1. /design"
- **Detail**: The `c-checklist` block (`design.astro:3307`) already renders `ChecklistGrid`. From Phase 3 the tiles reference `#progress-type-*`, but Phase 3 does not list `design.astro` (the sprite reaches `/design` only in Phase 4 §1). Phase 3 leaves `/design` with empty `<use>`, and its manual check covers only the page.
- **Fix**: add `ObjectTypeSprite` to `design.astro` in Phase 3 (one line, once per document). Phase 4 then only extends the specimens.
- **Decision**: ACCEPTED (orchestrator triage, 2026-10-17; applied in plan.md "Plan review triage")

### F5 — The rhythm allowlist for `progress.astro` will not be empty: the plan misses `gap-y-1`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision, narrow fix
- **Dimension**: Claim Accuracy
- **Location**: plan.md "Phase 3 › 4. The page" (`:69,71,84,110`), "Phase 4 › 3. Rhythm guard" ("expected empty")
- **Detail**: `src/pages/log/progress.astro:84` (the Firsts row) also has `gap-y-1`, which `VERTICAL_SPACING` counts (`rhythm-roles.test.ts:43`). The plan replaces only `py-3 first:pt-0 last:pb-0` there. With the allowlist "expected empty", Phase 4 fails on that line. The rewritten `MilestoneList` drops its `gap-y-1` anyway.
- **Fix**: in Phase 3 change `gap-y-1` to `gap-y-line` (4 → 8 px only when the row wraps), or give `progress.astro` `{ "gap-y-1": 1 }` with the reason "the wrap gap between name and date in a Firsts row", as `SkyEventList` does.
- **Decision**: ACCEPTED (orchestrator triage, 2026-10-17; applied in plan.md "Plan review triage")

### F6 — The corner check may overlap the centred type icon at 320 px

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, narrow fix
- **Dimension**: Feasibility
- **Location**: plan.md "Phase 3 › 2. The tiles"
- **Detail**: At 320 px, 6 columns with `gap-line` make a tile about 41 px wide. The `size-5` icon centred in the column (x ≈ 10–30 px, y ≈ 8–28 px in `h-14`) and the `size-3` check at `top-1 right-1` (x ≈ 25–37, y ≈ 4–16) share a corner. Today's chip deliberately puts the number low and the icon in the corner (`ChecklistGrid.astro:1-5`).
- **Fix**: add "the check does not cover the icon at 320 px" to the Phase 3 manual check and the `/design` specimen. If it does, nudge the icon down (`justify-end` plus the number's padding) or make the check `size-2.5`.
- **Decision**: ACCEPTED (orchestrator triage, 2026-10-17; applied in plan.md "Plan review triage")

### F7 — "Every pair is already pinned": one pair is not, and the island guard is narrower than its description

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, narrow fix
- **Dimension**: Claim Accuracy
- **Location**: plan.md "Key Discoveries" (`contrast.test.ts…`, `island-imports.test.ts:52`), Phase 1 Automated Verification
- **Detail**: (a) The seen tile's number is `text-heading` on `action-surface`. That pair is not in `CHECKS` (`contrast.test.ts:132` pins only `primary-strong` on `action-surface`). It passes today (red ≈ 4.8:1, dark and light far above), but nothing holds it. (b) `FACT_FAMILY` only checks `MoonTimeSlider`, `TonightSkyView` and `sky-view/*` (`island-imports.test.ts:44-50`), so `progress-icons` there protects 3 islands, not every one. That is enough, because nothing on `/log/progress` is an island. (c) `island-imports.test.ts` runs in `test:reference`, not `test:guards` (`vitest.config.ts:5-20`); the Phase 1 label "Guards pass (island imports…)" is inaccurate. Both suites run, so nothing goes unchecked.
- **Fix**: in Phase 2 add `heading` to the `fg` of the `action-surface` row (`contrast.test.ts:132`), and correct the description of the Phase 1 line.
- **Decision**: ACCEPTED (orchestrator triage, 2026-10-17; applied in plan.md "Plan review triage")

### F8 — "First nebula" counts planetary nebulae, but the legend's "Nebulae" leaves them out

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, narrow fix
- **Dimension**: Coverage
- **Location**: plan.md "Phase 1 › 1. Type families" vs `milestones.ts` `NEBULA_TYPES`
- **Detail**: `NEBULA_TYPES` (owner decision 1) includes `planetary-nebula`, while `FAMILY_OF` gives planetaries their own family. After logging M57 alone, the user sees the "First nebula" badge reached (cloud glyph) next to the legend's "Nebulae 0 / 8". This is correct by both rules but reads as a contradiction.
- **Fix**: accept as is and add one sentence to the CLAUDE.md rule (Phase 4 §4) saying the families are a display grouping and that "first nebula" follows `NEBULA_TYPES`. Changing either rule is out of scope.
- **Decision**: ACCEPTED (orchestrator triage, 2026-10-17; applied in plan.md "Plan review triage")

### F9 — The HTML budget in e2e measures the whole document

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, narrow fix
- **Dimension**: Verifiability
- **Location**: plan.md "Phase 3 › Automated" (measurement), "Phase 4 › 2. e2e" (budget +10 %)
- **Detail**: The budget is measured with 37 + 6 seen objects, while the e2e journey has 0–1 seen, so its body is smaller and the margin is effectively larger than 10 %. At the same time, any change to the Topbar, TabBar or GearShell (other changes) moves the result. The pin is loose for this change's risk and coupled to the rest of the app.
- **Fix**: measure and pin the size of the two `[data-checklist-grid]` blocks plus the sprite (`outerHTML.length` in the browser, or the slice of the response), in the e2e state itself, with the measurement in `implementation-notes.md`. This follows the lesson "measure budgets on the real encoding" without coupling to the shell.
- **Decision**: ACCEPTED (orchestrator triage, 2026-10-17; applied in plan.md "Plan review triage")

### F10 — The existing guard against sideways scroll is not in the Phase 2/3 checks

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision, narrow fix
- **Dimension**: Verifiability
- **Location**: plan.md "Phase 2/3 › Automated Verification"
- **Detail**: `tests/e2e/tonight-phone.spec.ts:51` already has `/log/progress` in `APP_PAGES` and fails on sideways scroll at 320/375 px. That covers exactly the Phase 2 risk named in the plan brief ("long Polish names in a 3-column grid at 320 px") and the legend's wrapping in Phase 3. The plan runs it only in Phase 4 (the whole suite).
- **Fix**: add `tests/e2e/tonight-phone.spec.ts` to the Playwright commands in Phase 2 and Phase 3.
- **Decision**: ACCEPTED (orchestrator triage, 2026-10-17; applied in plan.md "Plan review triage")

## Owner questions (P1–P7): the reviewer's view

- **P1 (badge style)**: ⭐ A, medallion. Agreed. It is the same component as the dialog, `rounded-full` with no shape SVG, and it reads well in red (mockup q1). A hexagon (B) is a new shape in Nightfall with no reason behind it.
- **P2 (reached vs. ahead)**: ⭐ B, dashed ring + arc + text. Agreed, on condition F3: in red the arc is only 1.5:1 against the ring, so it has to differ by stroke continuity and width, drawn in one SVG with the ring. C drops out, because faded badges in red are nearly invisible (mockup q2).
- **P3 (glyph on the count badges)**: ⭐ A, the number. Agreed: the number says "how many" and is distinct for each badge, and `Award` already means Progress. Condition F1: the `lg` badge numeral for "110" must be smaller than `text-display`.
- **P4 (grid layout)**: ⭐ A, dense tiles 6/10 in catalogue order. Agreed. All of Messier fits in about two phone screens, the "holes" are visible, and names are covered by the SeenList and the sr text. B is about 55 rows of scrolling; C breaks finding an object by its number. Check F6 at 320 px.
- **P5 (seen state)**: ⭐ B, action fill + 2 px + check. Agreed. Today's A in red is a bright block (glare at night), and C produces noise from a hundred dashed frames. B shares its tokens with the medallion, so the page has one visual language.
- **P6 (legend and filters)**: ⭐ A, legend with counts, no filters. Agreed. The page is network-only, so every filter would mean a request, a new state and tests. The legend also explains the icons, which the grid needs anyway. Filters can be a separate change if the owner misses them.
- **P7 (type icons)**: ⭐ B, `Galaxy` + 5 drawn icons. Agreed. lucide's stand-ins (`Grip`, `CloudFog`, `Disc`) suggest other things, and the good ones (`Sparkles`, `Cloud`, `CircleDot`) already have a meaning in the app ("one concept, one icon"). Five icons on a 24-unit grid through `createLucideIcon` is a small maintenance cost. Legibility at 16 px is checked by the Phase 1 manual check.

## Triage summary

Not run: the orchestrator forbade AskUserQuestion. Every finding stays `Decision: PENDING`. Resume with `/10x-plan-review context/changes/ui-progress-rewards/reviews/plan-review.md`.
