# Nav Motion and Theme Cycle — Plan Brief

> Full plan: `context/changes/nav-motion-theme-cycle/plan.md`

## What & Why

Two follow-ups from the user's review of the new navigation. The red-only eye button was unclear, so it becomes a theme button that cycles Dark → Light → Red and shows the current theme. Switching pages should feel alive: the active indicator should travel from the old page to the new one.

## Starting Point

The eye toggles red ↔ a remembered day theme (`sidereus-theme-return` cookie). The pill marks the current page with an amber fill; the tab bar marks it with heading ink and an amber icon. Every page change is a full load.

## Desired End State

The theme button's icon is the current theme and one tap moves to the next. On desktop the amber segment slides to the page you clicked; on phones an amber bar glides along the top of the tab bar and the new icon bounces. Pressing any of them gives a small squeeze. Reduced motion turns it all off; Firefox switches instantly.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Eye behaviour | Cycle Dark → Light → Red, icon = current theme | Clearer than a red-only toggle | User |
| Nav motion | Sliding indicator (desktop pill, phone bar + icon bounce), press squeeze | Shows where you went; feels native | User |
| Mechanism | Cross-document View Transitions in CSS | Pages are full loads; no router or script needed | Delegated |
| Page swap | Instant (root animation off); only the indicator moves | Keeps the effect focused and short | Delegated |
| Return-theme cookie | Removed | The cycle makes it unnecessary | Delegated |

## Scope

**In scope:** `nextTheme` + tests, theme button, copy, updated red-mode spec; view-transition CSS, named pill/tab elements, mobile indicator bar, press feedback.

**Out of scope:** client router, page-content transitions, JS fallback for Firefox, settings controls.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Theme cycle | Cycling theme button, cookie removed | Spec churn only |
| 2. Sliding indicator | View-transition motion on pill and tab bar, press squeeze | Label stretching mid-morph; browser support |

**Prerequisites:** none. **Estimated effort:** one short session.

## Open Risks & Assumptions

- Cross-document view transitions need Chrome 126+ / Safari 18.2+; others get an instant switch (acceptable).

## Success Criteria (Summary)

- One tap on the theme button always shows what you'll get next and gets there.
- Changing page visibly moves the indicator to where you went, in about a quarter of a second.
