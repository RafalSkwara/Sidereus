---
change_id: testing-forecast-honesty
title: "Test rollout Phase 1: forecast honesty, no false Clear on a weak forecast"
status: implementing
created: 2026-10-07
updated: 2026-10-08
archived_at: null
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Forecast honesty".
Risks covered: #1 (Tonight shows a confident "Clear" sky when the forecast is partial, stale or missing). Test types planned: unit + integration.
Risk response intent: #1 — with a truncated, stale, partly missing or absent forecast the sky reads marginal, "no weather data" or "last forecast, N hours old", never "Clear"; moon, twilight and altitude results stay usable; no error page. Challenge "no cloud data for an hour means no cloud" and "a 200 from the provider means a usable series". Avoid complete-series-only tests and expected verdicts copied from the verdict code.
After creating the folder, follow the downstream continuation rule.
