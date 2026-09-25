import { describe, expect, it } from "vitest";

import {
  darknessThresholdDegForBortle,
  darkWindow,
  observingNight,
  observingNightDateFor,
  verdict,
  type Site,
} from "@/lib/engine";

import { fetchForecast } from "./open-meteo";
import { fakeFetch, jsonResponse, openMeteoBody } from "./test-helpers";

/**
 * A user opening the page at 01:30 local, after UTC midnight, must get the verdict for the night in
 * progress, judged on the evening's hours. Open-Meteo's series starts at 00:00 UTC today unless
 * `past_days=1` is requested, so without it the evening before UTC midnight would be missing and
 * the night would have no weather data.
 */

const WARSAW: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, timeZone: "Europe/Warsaw" };
const NOW = new Date("2026-11-11T00:30:00Z"); // 01:30 CET, 30 minutes after UTC midnight
const HOURS_PER_DAY = 24;

/** Clear until UTC midnight, overcast after it: the evening is the only good part of the night. */
function cloudFrom(seriesStartUtc: Date, hours: number): number[] {
  const midnight = Date.UTC(2026, 10, 11);
  return Array.from({ length: hours }, (_, i) => (seriesStartUtc.getTime() + i * 3_600_000 < midnight ? 10 : 100));
}

describe("the night in progress after UTC midnight", () => {
  const date = observingNightDateFor(NOW, WARSAW.timeZone);
  const window = darkWindow(WARSAW, observingNight(date, WARSAW.timeZone), darknessThresholdDegForBortle(4));

  it("is the previous evening's night, and its dark window started before UTC midnight", () => {
    expect(date).toBe("2026-11-10");
    expect(window.kind).toBe("window");
    if (window.kind === "window") {
      expect(window.start.getTime()).toBeLessThan(Date.UTC(2026, 10, 11));
      expect(window.end.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it("judges the verdict on the evening hours that a past_days=1 response carries", async () => {
    // past_days=1 + forecast_days=4: five days of hours from 00:00 UTC yesterday.
    const seriesStart = new Date("2026-11-10T00:00:00Z");
    const hours = 5 * HOURS_PER_DAY;
    const fake = fakeFetch(() =>
      jsonResponse(openMeteoBody(seriesStart.getTime() / 1000, cloudFrom(seriesStart, hours))),
    );
    const forecast = await fetchForecast(fake.fetchFn, WARSAW);

    expect(fake.calls[0].url.searchParams.get("past_days")).toBe("1");
    const result = verdict(window, forecast);
    expect(result.level).toBe("go");
    expect(result.reason).toMatchObject({ kind: "clear-run", cloudPct: 10 });
  });

  it("would have no weather data for the night if the series started at 00:00 UTC today", async () => {
    // forecast_days=4 alone: four days of hours from 00:00 UTC today, missing the evening.
    const seriesStart = new Date("2026-11-11T00:00:00Z");
    const hours = 4 * HOURS_PER_DAY;
    const fake = fakeFetch(() =>
      jsonResponse(openMeteoBody(seriesStart.getTime() / 1000, cloudFrom(seriesStart, hours))),
    );
    const forecast = await fetchForecast(fake.fetchFn, WARSAW);
    expect(verdict(window, forecast)).toEqual({ level: "marginal", reason: { kind: "no-weather-data" } });
  });
});
