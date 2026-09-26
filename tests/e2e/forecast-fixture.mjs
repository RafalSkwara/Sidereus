// Forecast fixture for the e2e run: a deterministic all-clear Open-Meteo answer, whatever the date, so
// /tonight always has a "go" night to rank objects for. Zero dependencies on purpose.
// Start it before building the preview and point FORECAST_BASE_URL (in .env and .dev.vars) at it:
//   FIXTURE_PORT=4400 node tests/e2e/forecast-fixture.mjs
// It serves the shape `src/lib/forecast/open-meteo.ts` parses and ignores the query string (coordinates included).

import { createServer } from "node:http";

const PORT = Number(process.env.FIXTURE_PORT ?? 4400);
const HOST = process.env.FIXTURE_HOST ?? "127.0.0.1";
const HOUR_S = 3600;

/** Hourly unix seconds from the current UTC hour minus 48 h to plus 120 h: covers past_days=1 and forecast_days=4. */
function allClearForecast() {
  const currentHour = Math.floor(Date.now() / 1000 / HOUR_S) * HOUR_S;
  const time = [];
  for (let t = currentHour - 48 * HOUR_S; t <= currentHour + 120 * HOUR_S; t += HOUR_S) time.push(t);
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
