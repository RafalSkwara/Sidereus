// Forecast fixture for the e2e run: a deterministic all-clear Open-Meteo answer, whatever the date, so
// /tonight always has a "go" night to rank objects for. Zero dependencies on purpose.
// Start it before building the preview and point FORECAST_BASE_URL (in .env and .dev.vars) at it:
//   FIXTURE_PORT=4400 node tests/e2e/forecast-fixture.mjs
// It serves the shape `src/lib/forecast/open-meteo.ts` parses and ignores the query string (coordinates included).

import { createServer } from "node:http";
import { fixtureHours } from "./clock-scenarios.mjs";

const PORT = Number(process.env.FIXTURE_PORT ?? 4400);
const HOST = process.env.FIXTURE_HOST ?? "127.0.0.1";

/**
 * Hourly unix seconds: the sorted union of the -48 h / +216 h windows (past_days=1 and forecast_days=8, with margin)
 * around the real current hour AND around every named clock scenario (`clock-scenarios.mjs`), so a test pinned to
 * another date still gets a complete, all-clear series. The forecast parser drops nulls and the completeness check reads
 * only the series' first and last hour, so the gaps between windows are accepted; each pinned night sees its own whole
 * window. No environment variable and no restart between scenarios.
 */
function allClearForecast() {
  const time = fixtureHours();
  return {
    hourly: {
      time,
      cloud_cover: time.map(() => 0),
      relative_humidity_2m: time.map(() => 40),
    },
  };
}

const server = createServer((req, res) => {
  const pathname = (req.url ?? "/").split("?")[0];
  if (req.method === "GET" && pathname === "/v1/forecast") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(allClearForecast()));
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, HOST, () => {
  console.log(`Forecast fixture listening on http://${HOST}:${PORT}`);
});
