<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Session plan timeline

- **Plan**: context/changes/session-plan-timeline/plan.md
- **Scope**: Phase 2 of 3
- **Reviewed phases**: 2
- **Date**: 2026-10-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 4 observations
- **Reviewers**: drift (Sonnet), safety & patterns (Sonnet, superseded by an Opus re-run at the user's request)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Tick labels overlap on long nights

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/SessionTimeline.astro:29, 65–77
- **Detail**: Thinning is fixed (every other hour below sm). On a 16 h winter night the label gap is ~45 px against ~32 px labels (edge labels anchored inward reach a full width); a 24 h polar axis overlaps everywhere. The October screenshots could not show it.
- **Fix**: Stride from ticks.length (all ≤12, every 2nd ≤18, every 3rd above; one step coarser below sm); add a winter/24 h case to the screenshot check.
  - Strength: Readable at any night length; pure arithmetic.
  - Tradeoff: Fewer labels on long nights.
  - Confidence: HIGH — gaps measured by the reviewer.
  - Blind spot: none significant.
- **Decision**: FIXED — stride from the tick count (all ≤13, every 2nd ≤19, every 3rd beyond; half as many on phones); checked with 66°N and 87°N (24 h axis) screenshots

### F2 — "Moon up all night" when the Moon rises in the last 10 minutes

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/tonight/build.ts:1018–1028
- **Detail**: up.kind "part" with no rise/set strictly inside the axis falls through to moonAll.
- **Fix**: For "part" with no events, use up.upAtStart ? moonAll : moonNever.
- **Decision**: FIXED — a "part" Moon with no inner event reads moonAll only when up at the axis start

### F3 — Timeline is not in a Band; doubled gap under the sky

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/PlanPageContent.astro:45, 92
- **Detail**: Nightfall wants content in ruled Bands; the page jumps from h1 to an unheaded list; an empty pt-8 div plus another pt-8 doubles the gap.
- **Fix**: Wrap SessionTimeline in <Band headingId="plan-heading" heading={t.summary.plan} headingHidden>; render the message div only when it has content.
- **Decision**: FIXED — timeline in a Band with a hidden "Session plan" h2; the message column renders only with content

### F4 — Dark window drawn brighter than the night in dark and red

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/components/tonight/SessionTimeline.astro:36–37
- **Detail**: bg-border on bg-surface is darker only in light; in dark and red the dark window is the brightest stretch and the track barely shows.
- **Fix A ⭐ Recommended**: New dark-window token, darker than the track in every theme (red with zero G/B).
  - Strength: Right metaphor everywhere.
  - Tradeoff: New tokens in 3 themes plus contrast/red tests.
  - Confidence: HIGH.
  - Blind spot: Light theme is already right.
- **Fix B**: Keep the colours; correct the comment.
  - Strength: No token churn.
  - Tradeoff: Metaphor stays inverted in dark/red.
  - Confidence: HIGH.
  - Blind spot: None.
- **Decision**: FIXED via Fix A — new --plan-twilight / --plan-night tokens in dark, light and red (red zero G/B), contrast pairs added

### F5 — Sunset and sunrise are computed but not shown

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/tonight/build.ts (axisStart/axisEnd)
- **Detail**: Only whole hours are labelled; the night's ends are unreadable.
- **Fix**: Add sunset and sunrise times to the text line.
- **Decision**: FIXED — "Sunset 19:26 · … · Sunrise 08:41" in the text line (sunsetText/sunriseText replace axisStart/axisEnd; null on a polar axis)

### F6 — Moon event labels can collide above ~58°N

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/tonight/SessionTimeline.astro:89–111
- **Detail**: Rise and set labels are placed independently.
- **Fix**: Drop the second label a line when two events are within ~0.1 of the axis.
- **Decision**: FIXED — a Moon event within 0.12 of the previous one drops a line (container grows to h-20)

### F7 — Polish empty-state line is stiff

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/i18n/messages/pl.ts (tonight.pages.plan.empty)
- **Detail**: "Dziś nie ma polecanego celu, więc nie ma czego rozrysować."
- **Fix**: "Dziś nic nie polecamy, więc nie ma planu na tę noc."
- **Decision**: FIXED (user wording) — "Brak polecanych obiektów na dzisiejszą noc."
