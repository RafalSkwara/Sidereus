# Log views in Nightfall — Plan Brief

> Full plan: `context/changes/ui-log/plan.md`
> Research: `context/changes/ui-log/research.md`

## What & Why

The log views (`/log`, `/log/new`, `/log/[id]`, `/log/sky`) were built feature by feature before the Nightfall contract existed. They use the colour tokens but none of the composition, so moving from Gear or Tonight into the Log feels like another app, buttons are 36 px, focus is faint and the form differs from the gear forms. This is the log part of S-10 (#86).

## Starting Point

0 literal colours, 6 arbitrary values, 56 raw type sizes, 11 boxed cards, no `PageHeader` / `Band`, local link-button strings and a copied pager; the observation form re-implements select, label, error and focus ring.

## Desired End State

Every log page has the sky header (back link on sub-pages), ruled bands, `buttonVariants` link-buttons with one primary per screen, a shared `Pager`, and a form built from the shared field primitives. Dead ends (unknown object, deleted entry) offer a way forward.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Tokens | No new token, no `global.css` edit | The existing roles cover every case; fewer merge conflicts with three parallel passes | Plan |
| Pager | New `ui/Pager.astro`, `link` variant | Removes the copy between `/log` and `/log/sky` | Research C2 |
| Common name | Moves to the `PageHeader` subtitle; the intro leads the form band | `PageHeader` takes a string title; e2e reads the h1 | Plan |
| Empty log primary | "Go to Tonight"; "Add entry" turns outline | Tonight is the main way to log; one primary per screen | Plan |
| Rating radios | Selected fill + `--ring` outline focus | Same look as the pressed sky answer and every button | Plan |
| Unknown object | Offer manual entry (reuse `log.manualTitle`) | No new key, no dead end | Research C5 / delegated D4 |
| Routes and status codes | Unchanged | Markup-only change | Delegated D1 |
| Tests | No new tests; existing log e2e green | User wants modest tests; screenshots carry the visuals | Delegated D3 |

## Scope

**In scope:** the four pages, `ObservationForm`, `TargetPicker`, `SkyTally`, new `Pager` + its `/design` block, 2 new and 1 removed i18n key, one CLAUDE.md line.

**Out of scope:** `SkyAnswerForm` and `DeleteButton` (shared, already on contract), tokens, routes, new tests, a screenshot baseline.

## Architecture / Approach

Contract first (Pager, copy), then form primitives, then the pages (mirroring `gear/sites/[id].astro` and `gear/index.astro`), then states, the screenshot gate and the rule.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Shared additions | `Pager`, its `/design` states, i18n keys | `/design` merge conflict with parallel passes (append-only block) |
| 2. Form primitives | Form and picker on `Label` / `NativeSelect` / `FieldError` / `fieldClass` | e2e selectors on labels and radios |
| 3. Pages | Sky header, bands, link-buttons, Notice, Pager, dead-end fixes | e2e h1 / section / status assertions |
| 4. States and gate | 7-state screenshots EN/PL × 3 themes × 2 widths, CLAUDE.md rule | Seeding enough data for every state |

**Prerequisites:** local Supabase running (shared), preview on 4325, fixture on 4400.
**Estimated effort:** one session, four phases.

## Open Risks & Assumptions

- Parallel passes may also append to `/design`, `en.ts`/`pl.ts` and CLAUDE.md; edits are kept small and in distinct places.

## Success Criteria (Summary)

- The log looks and behaves like a sibling of Gear and Tonight in all three themes and both languages at 390 px and desktop.
- 0 hits from the hardcoded-value scan on the log files; lint, check, unit and log e2e green.
