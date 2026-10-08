# The user's UI adjustments (M-3 S-02) — Plan Brief

> Full plan: `context/changes/ui-user-adjustments/plan.md`
> Research: `context/changes/ui-user-adjustments/research.md`

## What & Why

After S-01's mobile pass, the user listed their own look-and-feel fixes:

- notifications that never go away;
- a poster word that dominates Tonight;
- cramped data lines;
- clickables that don't look clickable;
- a Session plan bar nobody can read.

This change applies that list (verbatim in `change.md`) so the app feels calm and legible before the M-3 feature slices build on it.

## Starting Point

- **Notices** are server-rendered from URL params and stay until the next navigation. Tonight's notices are inside a server island.
- **The verdict** is a giant Go / Marginal / No-go word under three header lines.
- **The panorama** overlaps the verdict by 96 px and has boxed chevrons and a scrollbar.
- **Gear** is a muted link plus pills.
- **Data points** flow into " · " lines.
- **"Mark observed"** is coloured text only.
- **Each plan row** is an unexplained bar and dot.

## Desired End State

**Notices.**

- Success notices float as 10-second toasts with a close button and clean URLs.
- Informational notices stay put but can be closed.

**Tonight dashboard.**

- It leads with a large "● Cloudy" headline under the date.
- The slider shows the exact dark window and the time zone.
- The panorama marks the compass point you're facing, with no scrollbar.
- Site and Telescope sit in two cards with icons.

**Everywhere else.**

- Lists breathe, with one data point per line.
- Clickables carry a border, a tinted fill, an icon and the link colour.
- Subpage stars are dimmer.
- Each Session plan target reads "Best 22:40 · window 21:40–23:10 · SW, 45°" over a small altitude curve, explained by a legend.

## Key Decisions Made

| Decision                  | Choice                                                                                                                                                                  | Why (1 sentence)                                                                          | Source           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------- |
| Session plan presentation | Option B: text line + per-row altitude curve, legend                                                                                                                    | Answers in words and shows why the window is what it is.                                  | Plan (user)      |
| Gear card content         | Select for 2+ items (pills retired); name + "Manage" for 1                                                                                                              | Follows the user's spec and keeps a route to /gear.                                       | Plan (user)      |
| Phone first screen        | Accept the new fold: verdict and cards; the first target may need a scroll                                                                                              | The user prefers full-size cards; the 390×844 pin is relaxed.                             | Plan (user)      |
| Clickables                | Border + tinted fill + icon where standalone, plus link colour (except red); inline links underlined                                                                    | The user's rule; red mode relies on shape.                                                | Plan (user)      |
| Slider dark window        | Exact edges with times under them; zone muted after the current time                                                                                                    | Reads like a timeline.                                                                    | Plan (user)      |
| Second "targets" item     | Means /tonight/nights                                                                                                                                                   | User clarification.                                                                       | Research (user)  |
| Errors                    | Stay inline (`role="alert"` next to the form), not toasts                                                                                                               | They need the form beside them.                                                           | Plan (delegated) |
| URL params                | Removed with `replaceState` after the toast shows                                                                                                                       | A reload must not re-announce "Saved".                                                    | Plan (delegated) |
| Toast mechanism           | One non-live fixed region in `Layout` + one script that adopts `[data-toast]` notices, including late island ones                                                       | Fits the existing notice and page-state observer pattern.                                 | Plan (delegated) |
| Verdict size              | Headline at the `text-display` role; poster word, its keys and `text-verdict-*` deleted                                                                                 | Bigger than now, far smaller than the poster.                                             | Plan (delegated) |
| Compass marker            | Heading ink + semibold + short bar under the nearest point                                                                                                              | The user said "whatever seems best"; it works in red.                                     | Plan (delegated) |
| Stars                     | A `quiet` prop on `TonightSky`, passed only by the focused pages                                                                                                        | `--star` also drives the live sky.                                                        | Research         |
| Overlap                   | `-mt-16` / 64 px through the shared constants                                                                                                                           | The user's exact value; consumers follow the constant.                                    | change.md        |
| Clickable inventory       | `action` for standalone links (Mark observed, washed-out, back, Pager, confirm-email, tile cue); resting borders on ghost answers; Skip/All and inline links underlined | Every clickable gets a stated treatment; secondary actions stay quieter than the answers. | Plan review F3   |
| Zone on the slider        | Short server-formatted name ("CEST", else "GMT+2") after the current time                                                                                               | A raw IANA id squeezes the track at 320 px.                                               | Plan review F6   |
| Live-sky failure          | The static verdict keeps one dark-window + zone line                                                                                                                    | Nothing is lost when the slider is absent.                                                | Plan review F6   |
| Plan failure handling     | Curves computed inside the existing plan `try`; no new catch                                                                                                            | Follows the current failure path; adds no swallowed error.                                | Plan review F9   |
| Plan row wording          | "window 21:40–23:10" (above your minimum altitude while dark); the legend says so                                                                                       | "up" contradicted the curve.                                                              | Plan review F9   |

## Scope

**In scope:**

- toasts and closable notices app-wide;
- the verdict, header and slider;
- the panorama overlap, chevrons, scrollbar and compass marker;
- the gear cards;
- spacing on the dashboard tiles, Targets, Nights, Planets and Moon;
- the clickable style;
- quiet subpage stars;
- Session plan option B;
- the matching `/design` specimens, e2e updates and CLAUDE.md rules.

**Out of scope:**

- engine, scoring, DB and route changes;
- the log's night logic (owned by test-plan Phase 2);
- errors as toasts;
- plan options A, C and D;
- landing-page stars and chips;
- a Session plan island.

## Architecture / Approach

Shared parts come first, so later phases reuse them:

1. the `action` button variant and underlined `link`;
2. `Notice` toast and dismissible modes plus a `Layout` toast region.

Then:

3. The sky band changes go through `sky-band.ts`, `SkyViewData` and the skeleton together.
4. The gear cards use a new `GearCard.astro`.
5. Spacing changes go into the shared detail parts.
6. The Session plan reuses the engine's existing altitude tracks on the server and draws static SVG curves.

## Phases at a Glance

| Phase                       | What it delivers                                                                                  | Key risk                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1. Clickables + quiet stars | `action` variant, underlined links, dimmer subpage stars                                          | New tokens need contrast rows in all themes                           |
| 2. Toasts                   | Fixed 10 s closable toasts, clean URLs, closable info notices                                     | ~12 e2e URL assertions change; offline notices re-shown by page-state |
| 3. Sky band                 | Headline verdict, exact dark window and zone on the slider, -mt-16, bare chevrons, compass marker | Re-measuring heights; four-label collisions on phones                 |
| 4. Gear cards               | Two cards with icons and selects                                                                  | Pills retired; selector specs and fold pin rewritten                  |
| 5. Spacing                  | One data point per line, more rhythm                                                              | Sideways scroll at 320 px in Polish                                   |
| 6. Session plan B           | Text line + altitude curve + legend, roomier rows, landing PNG recaptured                         | Server cost of tracks; legibility in red                              |

**Prerequisites:**

- The worktree `.claude/worktrees/ui-user-adjustments` with deps installed.
- Local Supabase running, preview on port 4331 and the fixture on 4410.

**Estimated effort:** about 3-4 sessions across 6 phases.

## Open Risks & Assumptions

- Removing the word and the header lines frees about 120 px on a phone, and the cards take more. The first target will usually sit below the 390×844 fold, as accepted.
- "Session plan, the moon and planets sections" under /tonight is read as the dashboard tiles. Their focused pages get the spacing pass anyway.
- If plan tracks noticeably slow `/tonight/plan`, the dashboard reuses its sky view tracks.
- Test-plan Phase 2 runs concurrently. It touches only tests and log logic, but `src/lib/tonight/build.ts` is shared reading ground, so rebase before the PR.

## Success Criteria (Summary)

- No notification lingers: toasts vanish in 10 s or on ×, and info notices close on demand.
- Tonight's answer reads at a glance as "● Cloudy". The sky, slider and gear cards look as the user described.
- Every clickable looks clickable in dark, light and red. The Session plan explains itself.
