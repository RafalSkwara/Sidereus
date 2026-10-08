import { describe, expect, it } from "vitest";

import { getForecast, type ForecastResult } from "@/lib/forecast/service";
import { fakeFetch, jsonResponse, memoryCache, openMeteoBody, type MemoryCache } from "@/lib/forecast/test-helpers";
import type { EyepieceRecord, SiteRecord, TelescopeRecord } from "@/lib/gear/store";

import { buildTonight, type TonightView } from "./build";

/**
 * Forecast honesty end to end (test-plan Risk #1): the real forecast service, its in-memory cache and a fake HTTP
 * edge, then the real Tonight view builder, with nothing mocked below the fetch. Expectations come from the PRD
 * headline table (Clear for go, Clear (old forecast) for the saved-copy cap, No forecast for no weather data), the
 * guardrails ("never a confident go", "forecast outage degrades, never blanks": moon and twilight stay usable) and
 * calendar arithmetic with wide margins, never from reading the verdict or the builder.
 */

// Fixtures copied from build.test.ts (not exported there): Warsaw, a 150/750 reflector and two Plössls.
const WARSAW: SiteRecord = {
  id: "site-1",
  name: "Home",
  latitudeDeg: 52.23,
  longitudeDeg: 21.01,
  bortle: 6,
  minAltitudeDeg: 15,
  timeZone: "Europe/Warsaw",
  timeZoneSource: "auto",
  createdAt: "2026-09-01T00:00:00Z",
};

const TELESCOPE: TelescopeRecord = {
  id: "scope-1",
  name: "Skywatcher 150P",
  apertureMm: 150,
  focalLengthMm: 750,
  createdAt: "2026-09-01T00:00:00Z",
};

const EYEPIECES: EyepieceRecord[] = [
  { id: "ep-1", name: "25 mm Plössl", focalLengthMm: 25, afovDeg: 52, createdAt: "2026-09-01T00:00:00Z" },
  { id: "ep-2", name: "10 mm Plössl", focalLengthMm: 10, afovDeg: 52, createdAt: "2026-09-01T00:01:00Z" },
];

/** Early evening in Warsaw on 2026-10-10 (20:00 CEST), before night 1's dark window. */
const NOW = new Date("2026-10-10T18:00:00Z");

const HOUR_MS = 3_600_000;
/** `past_days=1` + `forecast_days=8`: 216 hours from 00:00 UTC the day before the fetch. */
const REQUEST_HOURS = 216;

function hoursBefore(hours: number, instant = NOW): Date {
  return new Date(instant.getTime() - hours * HOUR_MS);
}

/** The first hour of a real response fetched at `fetchedAt`: 00:00 UTC the day before, in Unix seconds. */
function requestStartS(fetchedAt: Date): number {
  return Date.UTC(fetchedAt.getUTCFullYear(), fetchedAt.getUTCMonth(), fetchedAt.getUTCDate() - 1) / 1000;
}

/**
 * A clear body (cloud 0 %, humidity 40 %) over the real request range of a fetch at `fetchedAt`; every hour from
 * `nullFrom` on is null, as a provider that drops its trailing hours would send it.
 */
function clearBody(fetchedAt: Date, nullFrom?: Date): unknown {
  const startS = requestStartS(fetchedAt);
  const isNull = (i: number) => nullFrom !== undefined && (startS + i * 3600) * 1000 >= nullFrom.getTime();
  const cloud = Array.from({ length: REQUEST_HOURS }, (_, i) => (isNull(i) ? null : 0));
  const humidity = Array.from({ length: REQUEST_HOURS }, (_, i) => (isNull(i) ? null : 40));
  return openMeteoBody(startS, cloud, humidity);
}

const SITE_COORDS = { latitudeDeg: WARSAW.latitudeDeg, longitudeDeg: WARSAW.longitudeDeg };

/** One Tonight request's forecast: `getForecast` against `cache` with a fetch that answers `respond()`. */
function forecastAt(
  now: Date,
  cache: MemoryCache,
  respond: () => Response | Promise<Response>,
): Promise<ForecastResult | null> {
  return getForecast({ fetchFn: fakeFetch(respond).fetchFn, cache, siteId: WARSAW.id, coords: SITE_COORDS, now });
}

/** A cache holding the copy a first, successful (clear, complete) call at `fetchedAt` stored. */
async function cacheWithCopyFrom(fetchedAt: Date): Promise<MemoryCache> {
  const cache = memoryCache();
  const first = await forecastAt(fetchedAt, cache, () => jsonResponse(clearBody(fetchedAt)));
  expect(first?.fallback).toBe(false);
  expect(cache.puts).toHaveLength(1);
  return cache;
}

const outage503 = () => jsonResponse({ error: true }, 503);
const networkRejection = () => Promise.reject(new TypeError("fetch failed"));
const invalidJson200 = () => new Response("<html>", { status: 200 });

function buildView(forecast: ForecastResult | null): TonightView {
  return buildTonight({ site: WARSAW, telescope: TELESCOPE, eyepieces: EYEPIECES, forecast, now: NOW }, "en");
}

/** Night `index` (0 = night 1)'s headline id; nights 1-3 always carry a verdict. */
function nightHeadline(view: TonightView, index: number): string {
  const night = view.nights[index];
  return night.kind === "verdict" ? night.headline.id : `outlook on night ${index + 1}`;
}

/** Every degraded case: the build never throws, and no night 1-3 reads go. */
function degradedView(forecast: ForecastResult | null): TonightView {
  const built: TonightView[] = [];
  expect(() => built.push(buildView(forecast))).not.toThrow();
  const [view] = built;
  expect(view.verdict.level).not.toBe("go");
  for (const night of view.nights.slice(0, 3)) {
    expect(night.kind).toBe("verdict");
    expect(night.kind === "verdict" ? night.level : null).not.toBe("go");
  }
  return view;
}

describe("Tonight over a fresh, complete forecast", () => {
  it("reads Clear with a fresh status, which proves the fixture night is go-shaped", async () => {
    const forecast = await forecastAt(NOW, memoryCache(), () => jsonResponse(clearBody(NOW)));
    const view = buildView(forecast);
    expect(view.verdict.level).toBe("go");
    expect(view.headline.id).toBe("go");
    expect(view.forecastStatus.kind).toBe("fresh");
  });
});

describe("Tonight in a forecast outage with nothing stored", () => {
  it("reads No forecast on nights 1-3, says no weather data, and keeps the Moon, the dark window and the ranking", async () => {
    const forecast = await forecastAt(NOW, memoryCache(), outage503);
    const view = degradedView(forecast);
    expect(view.verdict.level).toBe("marginal");
    expect(view.headline.id).toBe("noForecast");
    expect(view.forecastStatus.kind).toBe("none");

    expect(view.moonCard).not.toBeNull();
    expect(view.darkWindow.kind).toBe("window");
    expect(view.ranking?.entries.length).toBeGreaterThan(0);

    expect(nightHeadline(view, 1)).toBe("noForecast");
    expect(nightHeadline(view, 2)).toBe("noForecast");
  });
});

describe("Tonight from a copy stored 3 h earlier, then an outage", () => {
  it.each([
    ["a 503", outage503],
    ["a network rejection", networkRejection],
    ["an invalid 200", invalidJson200],
  ])("reads Clear (old forecast) with the copy's age after %s, never go", async (_label, respond) => {
    const cache = await cacheWithCopyFrom(hoursBefore(3));
    const forecast = await forecastAt(NOW, cache, respond);
    const view = degradedView(forecast);
    expect(view.verdict.level).toBe("marginal");
    expect(view.headline.id).toBe("fallbackCap");
    expect(view.headline.text).toBe("Clear (old forecast)");
    expect(view.forecastStatus.kind).toBe("fallback");
    expect(view.forecastStatus.text).toContain("3 h");
  });
});

describe("Tonight from a copy fetched on 5 Oct, then an outage", () => {
  it("caps nights 1-2 at Clear (old forecast) and reads No forecast where the copy ends before night 3 does", async () => {
    // Fetched 2026-10-05 06:00 UTC, so the copy runs from 2026-10-04 00:00 to 2026-10-12 23:00 UTC. Night 2's dark
    // window ends on the morning of 12 Oct, most of a day before that; night 3's runs from the evening of 12 Oct
    // into the small hours of 13 Oct (Warsaw, local midnight is 22:00 UTC), past the copy's last hour.
    const cache = await cacheWithCopyFrom(new Date("2026-10-05T06:00:00Z"));
    const forecast = await forecastAt(NOW, cache, outage503);
    const view = degradedView(forecast);
    expect(view.forecastStatus.kind).toBe("fallback");
    expect(nightHeadline(view, 0)).toBe("fallbackCap");
    expect(nightHeadline(view, 1)).toBe("fallbackCap");
    expect(nightHeadline(view, 2)).toBe("noForecast");
  });
});

describe("Tonight from a usable copy stored 2 h earlier, then an empty 200", () => {
  it("keeps showing the copy as Clear (old forecast), not No forecast", async () => {
    const cache = await cacheWithCopyFrom(hoursBefore(2));
    const forecast = await forecastAt(NOW, cache, () => jsonResponse(openMeteoBody(requestStartS(NOW), [])));
    const view = degradedView(forecast);
    expect(view.verdict.level).toBe("marginal");
    expect(view.headline.id).toBe("fallbackCap");
    expect(view.forecastStatus.kind).toBe("fallback");
    expect(view.forecastStatus.text).toContain("2 h");
  });
});

describe("Tonight over a body whose trailing hours are null", () => {
  it("reads No forecast when the hours stop at 20:00 UTC, mid-evening, and keeps the Moon and the ranking", async () => {
    // 20:00 UTC is 22:00 in Warsaw: the dark window of 10 Oct runs until the small hours of 11 Oct, long after.
    const forecast = await forecastAt(NOW, memoryCache(), () =>
      jsonResponse(clearBody(NOW, new Date("2026-10-10T20:00:00Z"))),
    );
    const view = degradedView(forecast);
    expect(view.headline.id).toBe("noForecast");
    expect(view.verdict.level).not.toBe("no-go");
    expect(view.moonCard).not.toBeNull();
    expect(view.ranking?.entries.length).toBeGreaterThan(0);
  });
});
