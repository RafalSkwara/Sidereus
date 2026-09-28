# Seven-Night Planner and Site Switching — Plan Brief

> Full plan: `context/changes/seven-night-site-planner/plan.md`

## What & Why

Roadmap S-05 (US-03, FR-011, FR-012). A user deciding whether to drive to a darker site needs the week ahead, not only tonight: "marginal at home Thursday, go at the dark site Saturday". Tonight gains a seven-night strip for the selected site (verdict on nights 1-3, moon, darkness and a cloud outlook with no verdict on nights 4-7), and users with several sites can switch between them.

## Starting Point

Tonight always uses the oldest site (`TonightContent.astro:81-84`, "S-05 adds switching"). The engine already walks nights 2-3 for "next night worth a look" (`outlook.ts`), the verdict horizon is a named parameter (`VERDICT_NIGHTS = 3`), and S-08's telescope selector (`?telescope=` + cookie + island prop) is the pattern to reuse. The forecast request only reaches night 3 (`forecast_days=4`).

## Desired End State

Tonight shows a "Next 7 nights at <site>" section after the ranking: each night has its date, dark window and moon line; nights 1-3 a verdict chip that matches the verdict card, with its short reason, nights 4-7 "Cloud ~50%, down to 0%" under an "Outlook — no verdict" divider in neutral styling. The verdict card links down to the strip. With two or more sites a selector switches the verdict, ranking and strip together, in that site's time zone, and the pick is remembered on the device.

## Key Decisions Made

Decisions were delegated to the agent during planning and then confirmed or amended in `/10x-plan-review` (`reviews/plan-review.md`, F1-F8 all fixed).

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Where the strip lives | On `/tonight`, after the ranking (right after the verdict card on no-go nights), with a "Next 7 nights ↓" link in the verdict card | One page, one forecast fetch, one site switch; tonight's answer stays first and the week is one tap away (review F2). |
| Night numbering | Night 1 = the night Tonight shows (`tonightDateFor`), then +1 … +6 | Keeps the strip and the verdict card on the same night, including after midnight. |
| Night 1 source | Verdict card and strip night 1 come from one engine result | Two computations of the same night could disagree on one screen. |
| Invariant 5 | Enforced in the engine type (`kind: "verdict"` only for index ≤ 3) plus neutral styling | The UI cannot accidentally render a verdict for nights 4-7. |
| Moon data | Illumination % + moon-free dark time (Moon below 0° during the dark window) | The number a deep-sky observer plans around; illumination lets them judge a thin crescent. |
| Moon computation | `SearchAltitude` crossings of the centre-with-refraction horizon, not `SearchRiseSet` or dense sampling | Matches `moonState` exactly (SearchRiseSet's limb definition is off up to 26 min at Tromsø, review F1) and keeps CPU low. |
| Cloud outlook | Mean and clearest hour over the dark-window hours, rounded to 10%: "Cloud ~50%, down to 0%"; no cloud line without darkness | Plain numbers, not a verdict, and a clear spell is not averaged away (review F3, F6). |
| Nights 1-3 detail | Verdict level plus its short reason | A no-weather-data marginal must not look like a forecast one (review F4). |
| Forecast horizon | `forecast_days` 4 → 8, same single request, no cache-key bump | Night 7 ends on the morning of day +7; old cached copies expire within an hour and degrade honestly. |
| Site pick memory | `?site=<uuid>` + `sidereus-site` cookie, fallback to oldest | Mirrors the telescope pick; no DB change; id never carries coordinates. |
| Selector UI | One `GearSelector.astro` for sites and telescopes (pills ≤3, dropdown 4+) | One component and one rule set instead of two copies. |
| Choice helpers | Rename `telescope-choice.ts` → `gear-choice.ts` (`isGearId`, `chooseOwned`) | The existing helper is already generic; the name should say so. |

## Scope

**In scope:**
- Pure `sevenNightOutlook`, `moonFreeMinutes`, `cloudOutlook` in the engine, `OUTLOOK_NIGHTS = 7`
- Forecast request to 8 days; e2e fixture extended
- `TonightView.nights`, formatter wording (EN + PL), `NightStrip.astro`, skeleton placeholder
- Site selector, cookie, island prop, shared selector component, e2e spec, CLAUDE.md note

**Out of scope:**
- Side-by-side two-site comparison; ranking for nights 2-7
- Any verdict or "best night" highlight on nights 4-7; hourly cloud chart
- Moonrise/moonset times in the UI; a stored default site in the DB
- Site switching on the log or gear pages

## Architecture / Approach

Engine (`sevenNightOutlook` over the one cached forecast) → `buildTonight` formats seven `TonightNight`s in the site's time zone and takes the verdict card from night 1 → `TonightContent` renders `NightStrip` after the ranking. The page shell reads `?site=`, sets the cookie and passes the id to the server island, which resolves it with `chooseOwned` against the user's own sites.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Seven-night outlook in the engine | Pure outlook, moon-free time, cloud outlook, 8-day forecast | Altitude-crossing edge cases (Moon up all window, no crossing) |
| 2. Seven-night strip on Tonight | FR-011 for the current site, EN + PL, DST-correct | Mobile layout of seven nights; night 1 drifting from the card |
| 3. Site switching | FR-012 with remembered pick and fallback; e2e | Refactor of the S-08 selector silently weakening its spec (selectors updated per review F5) |

**Prerequisites:** S-01, S-02, F-03 (done); S-08 selector merged (done).
**Estimated effort:** ~2-3 sessions across 3 phases.

## Open Risks & Assumptions

- On phones the strip still sits below the ranking on a go night; the verdict card's jump link is the mitigation.
- Open-Meteo days 4-7 are low-skill forecasts; the "~" and the "no verdict" divider carry that message.
- CPU on the Workers Free plan: `/tonight` already runs 15-50 ms; the strip adds five dark windows and seven altitude-crossing searches, timed locally before merge and checked in production after merge.
- The site pick is per device (cookie), so a second device starts on the oldest site.

## Success Criteria (Summary)

- A user with a home and a dark site can read "marginal at home Thursday, go at the dark site Saturday" off two switches of the Tonight page.
- Nights 4-7 never show a verdict, and every time reads in the selected site's zone, including the 24-25 October 2026 night.
- Tonight for a single-site, single-telescope user is unchanged apart from the new strip.
