# Tonight's night skies in the light theme, and the panorama's pan cue: Plan Brief

> Full plan: `context/changes/ui-sky-light/plan.md`
> Research: `context/changes/ui-sky-light/research.md`

## What & Why

In the light theme, Tonight's sky is a pale day-blue band with its stars switched off, so the live sky looks empty even though it depicts the night the verdict is about. The panorama also scrolls sideways with no visible cue, so most users only ever see one slice of the horizon.

## Starting Point

The light theme has one sky token set (`--zenith`/`--horizon`), shared by Tonight and every other page's sky header. The stars are hidden by `hidden dark:block`. The scroller relies on a thin scrollbar that overlay-scrollbar platforms hide.

## Desired End State

- **Light theme:** Tonight's skies (`/tonight`, its skeleton, `/tonight/*`, from the Topbar to the silhouette) are a slightly brighter navy than the dark theme. They show the stars, the names and the markers in light ink.
- **Other views and the other themes:** unchanged.
- **Panorama:** a chevron button at each side pans it and hides at its end.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Which skies turn navy | Tonight skies only | Keeps the five views just redone (#102–#105) as they are | User (2026-10-05) |
| Scroll cue | Edge chevron buttons | Visible, clickable, doesn't hide the sky | User (2026-10-05) |
| Mechanism | A `[data-theme="light"] .night-sky` token scope plus a `night:` variant | Extends Nightfall without touching any theme's base tokens; CSS-only, so in-page theme switches work | Plan (delegated) |
| Topbar on Tonight | The sky-flow strip joins the scope; the popover keeps the page theme via `data-theme={theme}` | No pale-to-navy seam and no dark settings panel in the light theme | Plan (delegated) |
| Ground | `--background` isn't scoped | The silhouette and the slider row stay on the page's light ground | Plan (delegated) |
| Values | zenith `#0d1836`, horizon `#263d7a`, muted `#b4bccf` (plus dusk, surface, border) | Brighter than dark yet navy; every text pair ≥ 4.84:1 | Plan (contrast-checked) |
| Pan step | 60 % of the viewport; smooth unless reduced motion | Keeps some overlap so the user doesn't lose their place | Plan (delegated) |

## Scope

**In scope:**
- The night-sky scope and its contrast rows.
- `GearShell` sky-flow, `TonightSky` (`night` prop), the Tonight callers, `TonightSkyView`, and the `TopbarControls` popover.
- The chevrons, with EN/PL names and one e2e check.
- The `/design` specimen and the `CLAUDE.md` rule.

**Out of scope:**
- Other views' skies, dark and red looks, sky maths, drag-to-pan, a visible scrollbar.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Night-sky tokens | The scope block, derived tokens, `night:` variant, contrast guard | Derived tokens not re-declared on the scope |
| 2. Apply to Tonight | A navy band and Topbar strip, with stars, in the light theme | The popover or ground inheriting navy |
| 3. Pan chevrons | Two edge buttons with end states and an e2e pin | Buttons covering labels at 390 px |
| 4. States, gate, rule | Screenshots across themes and widths, `/design`, `CLAUDE.md` | None of note |

**Prerequisites:** local Supabase running, a forecast fixture, a throwaway user with a site.
**Estimated effort:** one session.

## Open Risks & Assumptions

- The exact navy shade and the chevron size are visual calls, listed in the PR for the user to judge.

## Success Criteria (Summary)

- A light-theme user sees a navy night sky on Tonight with its stars and every marker legible; the other views are unchanged.
- The panorama's chevrons make it obvious there is more sky to either side, and pan it.
