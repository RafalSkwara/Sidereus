# Tonight in the Nightfall design: plan brief

> Full plan: `context/changes/tonight-nightfall/plan.md`
> Research: `context/changes/tonight-nightfall/research.md`

## What & Why

The user wants the existing `/tonight` page to look like the Nightfall Tonight design they chose on the canvas. They will use it, then decide whether S-11's dashboard move is still needed. The `visual-redesign` change only shipped the contract and `/gear`; Tonight kept its boxed cards.

## Starting Point

Tonight is a `GearShell` page whose data streams in through one `server:defer` island, `TonightContent`. It shows boxed cards with uppercase kickers: verdict and Moon side by side, the sky check, planets, the ranked objects and the 7-night strip. Shared components are barely used, and several controls are under 44 px. The Nightfall tokens and components already exist.

## Desired End State

A tall night sky runs from the Topbar to a horizon silhouette, with decorative stars (none in light). Over it sit the date and dark window, a giant **Go / Marginal / No-go** (PL **Tak / Może / Nie**), the sky headline with its reason, and the forecast line. Below come the ruled summary bands, each linking down to its detail:

- **Point here first:** the best 3, by time.
- **The Moon:** disc and %.
- **Planets.**
- **Next 7 nights:** bars.

The sky check follows, with three answers. The full detail continues as ruled bands: Moon slider, planets, ranked objects with "Mark observed", and the full strip. It works in EN/PL, dark/light/red, on phone and desktop.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Scope | Restyle Tonight itself; no dashboard or band pages now | The user wants to try the design before committing to S-11 | User (change.md) |
| Sky content | Decorative stars only | Real positions and the slider belong to S-11's interactive sky | User |
| Detail | Stays on the page below the summary; chevrons jump to it | Nothing is lost until the band pages exist | Plan (user: pages later) |
| Giant word | Go / Marginal / No-go, with the sky headline below | Exactly like the picture; the headline stays the canonical sky word | User |
| PL words | Tak / Może / Nie | Short enough for giant type at 390 px | User |
| Point here first | Best 3 by rank, listed by best time | Reads as a plan for the night, as in the design | User |
| Sky + island | GearShell sky-flow mode; one island renders the sky | Two islands would double every load and could disagree on "now" | Research §3 |
| Bars | Height = clear share of the dark window; colour = verdict for nights 1–3 | Matches the design's legend, from data the engine already has | Research §2 |
| Steady air, moonrise sentence, opposition | Dropped | Not modelled; no invented data | Research §2 |
| Sky check | Three answers kept | Product rule from verdict-check | Research / archive |

## Scope

**In scope:**

- `/tonight` page, island, skeleton and components.
- GearShell sky-flow mode.
- New view fields: `clearPct`, `summaryTargets`, `listOf`.
- Messages in EN and PL.
- An extracted `MoonDisc`.
- e2e selector updates.
- `/design` specimens.
- The screenshot gate and the `CLAUDE.md` rule.

**Out of scope:**

- Band pages and the S-11 dashboard.
- Real sky positions.
- Seeing.
- The `/tonight/all` restyle.
- New dependencies, a second island, screenshot baselines.

## Architecture / Approach

`tonight.astro` uses `GearShell skyFlow`: the Topbar sits on a zenith strip with no rule, and `<main>` is full width. `TonightContent`, still the single island, renders `TonightSky` (stars, horizon, verdict) full-bleed, then the summary bands and detail Bands in the usual container. The shell passes the `?logged`, `?skyChecked` and `?error` notices into the island as translated text, so they render under the sky. The skeleton and the missing-database path reuse `TonightSky`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data and copy | Verdict words, `clearPct`, `summaryTargets`, `listOf`, shared `MoonDisc` | Clear-share definition for no-darkness nights |
| 2. The sky | Sky-flow shell, `TonightSky`, verdict in the sky, matching skeleton, notices under the sky | Shell mode leaking into other pages; e2e h1 and verdict hooks |
| 3. Summary bands | Point here first, Moon, Planets, 7-night bars, sky-check band | Edge states (no-go, no Moon, no planets) |
| 4. Detail as bands | Moon, planets, ranking, strip and selectors in Bands with shared components, 44 px | Many e2e selectors; slider behaviour |
| 5. States, gate, rule | `/design` specimens, approved screenshot matrix, CLAUDE.md line | Red audit on stars and bars |

**Prerequisites:** the `visual-redesign` contract is in `main` (done), plus a local Supabase and forecast fixture for e2e.

**Estimated effort:** about one long session across 5 phases.

## Open Risks & Assumptions

- **Notices inside the island.** `Notice`'s announce script may not run inside a server island. The text stays visible either way; checked at Phase 2.
- **Giant PL word fit.** "Może" fits at 390 px; the expanded display type may need a dedicated size role.
- **No-go nights.** The design never showed one; the "Point here first" band falls back to the explanation.

## Success Criteria (Summary)

- `/tonight` reads like the chosen canvas design in every theme and language, phone and desktop.
- Nothing Tonight did before is lost, and every e2e flow still passes.
- The user approves the screenshot gate.
