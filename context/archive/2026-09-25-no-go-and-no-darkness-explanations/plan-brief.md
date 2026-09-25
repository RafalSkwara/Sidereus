# No-go and No-darkness Explanations — Plan Brief

> Full plan: `context/changes/no-go-and-no-darkness-explanations/plan.md`

## What & Why

Roadmap S-04 (US-02, FR-020, FR-023, NFR forecast outage). On the nights when Tonight has nothing to rank, it must explain why and say when to try next. There are three such nights: a weather no-go, a site with no dark window this season, and a forecast outage. In an autumn build these are the states the reference user meets most evenings, and a verdict with nothing after it is the worst outcome for a beginner.

## Starting Point

S-02 already hides the ranking on no-go nights and on nights with no dark window, and shows only the verdict card. The engine's `darkWindow` already returns the sun's minimum altitude for a night with no darkness. The forecast service already falls back to a KV copy up to 7 days old, but it doesn't say so, and the page drops the forecast's age. Two defects feed straight into this slice:
- missing forecast hours count as cloudy, so a data gap reads as a weather no-go;
- the 3-day request stops before the end of night 3.

## Desired End State

Tonight shows, depending on the night:
- **Weather no-go:** the verdict and reason, with no ranking, plus "Next night worth a look: …" (nights 2–3 only) or "No clear night in the forecast through …".
- **No darkness:** "At 70° N at this time of year the sun only sinks 4° below the horizon, short of the 18° your Bortle 3 sky needs", plus the date the dark window returns with its times.
- **Every night:** a forecast line reading "Forecast updated 20 min ago", "Weather service unreachable — showing the forecast from 5 h ago", or "No weather data…". None of these states ever produces an error page.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Change ID | Folder renamed to the roadmap's `no-go-and-no-darkness-explanations` | Roadmap, board card #8 and archive sync by exact Change ID. |
| Nights 2–3 all no-go | "No clear night in the forecast through ‹night 3›" | Honest about where the forecast stops; nights 4–7 carry no verdict (invariant 5), and the strip belongs to S-05. |
| What counts as "next night" | Only nights judged from forecast data; if data runs out, say where it stops | Never send a user out purely because the weather is unknown. |
| Saved copy after a failed refresh | Go is capped at marginal (new reason `fallback-cap`), whatever the copy's age | One conservative rule in line with the guardrail "never a confident go"; no new tunable. |
| Forecast doesn't span the dark window | That night is "no weather data" (marginal); gaps inside the series still count as cloudy | A data gap must never read as a weather no-go; fresh-data behaviour is unchanged. |
| Date the dark window returns | First night with any window, shown with its times | Same definition the verdict uses; a short first window stays visible rather than hidden. |
| Forecast age display | Always shown (fresh, fallback or none wording) | Consistent and fully transparent. |
| Return-date search | Every 7th night, then scan back through the last week | A night-by-night scan measured 16 ms, over the Workers Free 10 ms cap; a test pins the result to the night-by-night scan. |

## Scope

**In scope:**
- verdict coverage rule and fallback cap;
- a pure `engine/outlook.ts` with `nextNightNotNoGo` and `darkWindowReturn`;
- `forecast_days=4` and a `fallback` flag on `ForecastResult`;
- view-model explanations and the forecast line, with their wording templates;
- `VerdictCard` rendering;
- manual checks, deploy and CPU check.

**Out of scope:** nights 4–7 and the 7-night strip (S-05), moon display, a tunable age threshold, a minimum length for the returning window, a dev date override, the telescope selector and empty states (S-08), and changes to the cache TTL or key.

## Architecture / Approach

The engine stays pure. `verdict` gains the coverage and fallback rules, and `outlook.ts` composes `darkWindow` and `verdict` over later nights. The forecast service reports where its data came from. `buildTonight` picks the explanation from the verdict reason (`cloudy` gives the next-night line, `no-darkness` gives the cause and return date), and `format.ts` owns each phrase's single template. The page only passes the service result through and renders.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Engine rules and forecast provenance | Coverage rule, fallback cap, next-night and return-date searches, 4-day series and fallback flag, all unit-tested | The stride search skipping a window; pinned by a test that compares it with a night-by-night scan across many start dates |
| 2. Tonight explanations and forecast status | View model, templates, `VerdictCard`, manual checks of all states, deploy | No-go can't be reproduced live; covered by a local stub forecast and a KV clear |

**Prerequisites:** S-02 merged (done). Local dev works against hosted Supabase, since there are no migrations. For the manual checks: `FORECAST_BASE_URL` in `.dev.vars` and access to local KV.
**Estimated effort:** about 2 sessions, one per phase.

## Open Risks & Assumptions

- The CPU on Workers Free is still unmeasured on warm requests (#22). This slice lowers CPU on no-go and no-darkness nights by skipping the ranking, but the Tonight view as a whole stays borderline.
- The McMurdo manual check depends on its current season having no darkness (true from September to about April).
- Wording says "at this time of year" rather than naming a season, because no darkness also happens in spring at polar latitudes.

## Success Criteria (Summary)

- On a no-go night the user sees why and which of the next two nights is worth trying, or that none is.
- On a night with no darkness the user sees the latitude and season cause and the date darkness returns.
- A forecast outage shows the saved copy's age or "no weather data", never a false go, and never an error page.
