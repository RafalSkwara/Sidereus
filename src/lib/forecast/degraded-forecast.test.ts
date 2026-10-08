import { describe, expect, it } from "vitest";

import { verdict, type DarkWindow, type Verdict, type VerdictLevel } from "@/lib/engine";
import { createFormatter } from "@/lib/tonight/format";

import { FORECAST_RESPONSE_INVALID, mapForecastResponse } from "./open-meteo";
import { openMeteoBody } from "./test-helpers";

/**
 * Forecast honesty (test-plan Risk #1): what Open-Meteo can send in a 200, mapped and judged, never reads as a
 * confident go when the series is partial. Expected values come from the PRD thresholds (go = a run of at least
 * 2 h below 30 % cloud, marginal = at least 1 h below 65 %, humidity above 90 % caps at marginal), the PRD
 * headline table and the agreed coverage rules, never from reading `verdict.ts`.
 */

const HOUR_MS = 3_600_000;
const SERIES_START_MS = Date.UTC(2026, 9, 10, 12, 0, 0); // 2026-10-10 12:00 UTC
const SERIES_START_S = SERIES_START_MS / 1000;
const SERIES_HOURS = 18; // 12:00 to 05:00 UTC
const WINDOW_OFFSET = 6; // the dark window's first hour is the series' seventh

/** A six-hour dark window, 18:00-24:00 UTC, with six series hours on each side. */
const WINDOW: DarkWindow = {
  kind: "window",
  thresholdDeg: -18,
  start: new Date(SERIES_START_MS + WINDOW_OFFSET * HOUR_MS),
  end: new Date(SERIES_START_MS + (WINDOW_OFFSET + 6) * HOUR_MS),
  clampedToNightStart: false,
  clampedToNightEnd: false,
};

const OUTSIDE_CLOUD = 100;
const OUTSIDE_HUMIDITY = 60;

/** A full Open-Meteo body whose six dark-window hours carry `cloud` and `humidity`; the hours around them are overcast. */
function nightBody(cloud: (number | null)[], humidity: (number | null)[] = cloud.map(() => 50)): unknown {
  const pad = (values: (number | null)[], fill: number) => [
    ...Array<number>(WINDOW_OFFSET).fill(fill),
    ...values,
    ...Array<number>(SERIES_HOURS - WINDOW_OFFSET - values.length).fill(fill),
  ];
  return openMeteoBody(SERIES_START_S, pad(cloud, OUTSIDE_CLOUD), pad(humidity, OUTSIDE_HUMIDITY));
}

function judge(body: unknown, fallback = false): Verdict {
  return verdict(WINDOW, mapForecastResponse(body), { fallback });
}

const headlineId = (v: Verdict) => createFormatter("en").skyHeadline(v).id;

describe("a provider body with hours missing", () => {
  it("does not count a null hour inside the only clear run as clear", () => {
    // Without the null: 10 %, 10 % is a 2 h run below 30 %, a go. With it, one clear hour is left: marginal.
    expect(judge(nightBody([100, 10, 10, 100, 100, 100])).level).toBe("go");
    expect(judge(nightBody([100, 10, null, 100, 100, 100])).level).toBe("marginal");
  });

  it("drops an hour whose humidity alone is null, exactly as one whose cloud is null", () => {
    const cloudNull = judge(nightBody([100, 10, null, 100, 100, 100]));
    const humidityNull = judge(nightBody([100, 10, 10, 100, 100, 100], [50, 50, null, 50, 50, 50]));
    expect(humidityNull).toEqual(cloudNull);
  });

  it("never lets a missing hour hide a humid one and turn a capped night into a go", () => {
    const cloud = [10, 10, 10, 80, 100, 100];
    // Complete: a 3 h run below 30 %, but one dark hour above 90 % humidity caps it at marginal.
    expect(judge(nightBody(cloud, [50, 50, 50, 95, 50, 50]))).toMatchObject({
      level: "marginal",
      reason: { kind: "humidity-cap" },
    });
    // The humid hour missing, by its humidity or by its cloud: the forecast cannot rule the cap out.
    for (const body of [
      nightBody(cloud, [50, 50, 50, null, 50, 50]),
      nightBody([10, 10, 10, null, 100, 100], [50, 50, 50, 95, 50, 50]),
    ]) {
      expect(judge(body)).toEqual({ level: "marginal", reason: { kind: "missing-hours" } });
    }
  });

  it("reads a go-shaped night with any dark hour missing as no forecast, not clear", () => {
    const v = judge(nightBody([10, 10, 10, 100, null, 100]));
    // Its own reason, so the page can say an hour is missing rather than that no forecast reaches the night.
    expect(v).toEqual({ level: "marginal", reason: { kind: "missing-hours" } });
    expect(headlineId(v)).toBe("noForecast");
  });

  it("reads trailing nulls over the end of the dark window as no weather data, never as cloud", () => {
    const body = openMeteoBody(SERIES_START_S, [
      ...Array<number>(WINDOW_OFFSET + 4).fill(90),
      ...Array<null>(SERIES_HOURS - WINDOW_OFFSET - 4).fill(null),
    ]);
    expect(judge(body)).toEqual({ level: "marginal", reason: { kind: "no-weather-data" } });
  });

  it("reads leading nulls over the start of the dark window as no weather data", () => {
    const body = openMeteoBody(SERIES_START_S, [
      ...Array<null>(WINDOW_OFFSET + 2).fill(null),
      ...Array<number>(SERIES_HOURS - WINDOW_OFFSET - 2).fill(10),
    ]);
    expect(judge(body)).toEqual({ level: "marginal", reason: { kind: "no-weather-data" } });
  });

  it("never reads a dark window with no hour at all as clear, even with hours on both sides", () => {
    const v = judge(nightBody([null, null, null, null, null, null]));
    expect(v.level).not.toBe("go");
    // "No forecast" for a no-go without a single present hour is a formatter decision (format.ts), not PRD text.
    expect(headlineId(v)).toBe("noForecast");
  });

  it("reads an empty or all-null 200 as no weather data", () => {
    const empty = openMeteoBody(SERIES_START_S, []);
    const allNull = openMeteoBody(SERIES_START_S, Array<null>(SERIES_HOURS).fill(null));
    for (const body of [empty, allNull]) {
      expect(mapForecastResponse(body)).toEqual({ hours: [] });
      expect(judge(body)).toEqual({ level: "marginal", reason: { kind: "no-weather-data" } });
    }
  });
});

describe("a provider body that breaks the contract", () => {
  it("rejects arrays of different lengths", () => {
    const body = openMeteoBody(SERIES_START_S, [10, 10, 10]) as { hourly: { cloud_cover: number[] } };
    body.hourly.cloud_cover.pop();
    expect(() => mapForecastResponse(body)).toThrow(FORECAST_RESPONSE_INVALID);
  });

  it.each([
    { name: "a negative cloud cover", cloud: [10, -5], humidity: [50, 50] },
    { name: "a cloud cover above 100", cloud: [10, 150], humidity: [50, 50] },
    { name: "a humidity above 100", cloud: [10, 10], humidity: [50, 101] },
    { name: "a negative humidity", cloud: [10, 10], humidity: [50, -1] },
  ])("rejects $name", ({ cloud, humidity }) => {
    expect(() => mapForecastResponse(openMeteoBody(SERIES_START_S, cloud, humidity))).toThrow(
      FORECAST_RESPONSE_INVALID,
    );
  });

  it("accepts the bounds 0 and 100 for both values", () => {
    expect(mapForecastResponse(openMeteoBody(SERIES_START_S, [0, 100], [0, 100])).hours).toHaveLength(2);
  });
});

/** mulberry32: a small seeded generator, so the property runs the same cases every time. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const RANK: Record<VerdictLevel, number> = { "no-go": 0, marginal: 1, go: 2 };

describe("removing hours from a provider body (seeded property)", () => {
  const random = seeded(20261008);
  const pick = (n: number) => Math.floor(random() * n);
  const CASES = 300;
  const HOURS = 24;

  const cases = Array.from({ length: CASES }, () => {
    // Mostly clear and dry, so many complete series are go and the property is not vacuous.
    const cloud = Array.from({ length: HOURS }, () => (random() < 0.6 ? pick(30) : pick(101)));
    const humidity = Array.from({ length: HOURS }, () => (random() < 0.85 ? 40 + pick(50) : 91 + pick(10)));
    const nulled = cloud.map(() => random() < 0.15);
    const nullCloud = nulled.map((isNull) => isNull && random() < 0.5);
    const startMs = SERIES_START_MS + pick(12) * HOUR_MS + pick(60) * 60_000;
    const window: Extract<DarkWindow, { kind: "window" }> = {
      kind: "window",
      thresholdDeg: -18,
      start: new Date(startMs),
      end: new Date(startMs + (1 + pick(10)) * HOUR_MS),
      clampedToNightStart: false,
      clampedToNightEnd: false,
    };
    const complete = mapForecastResponse(openMeteoBody(SERIES_START_S, cloud, humidity));
    const partial = mapForecastResponse(
      openMeteoBody(
        SERIES_START_S,
        cloud.map((value, i) => (nullCloud[i] ? null : value)),
        humidity.map((value, i) => (nulled[i] && !nullCloud[i] ? null : value)),
      ),
    );
    return { window, complete, partial };
  });

  it("generates enough go nights with a dark hour removed to mean something", () => {
    // Counted from the inputs alone, so the check never leans on the rule under test.
    const darkHourRemoved = (c: (typeof cases)[number]) => {
      const firstHour = Math.floor(c.window.start.getTime() / HOUR_MS) * HOUR_MS;
      const inWindow = (hour: { start: Date }) =>
        hour.start.getTime() >= firstHour && hour.start.getTime() < c.window.end.getTime();
      return c.partial.hours.filter(inWindow).length < c.complete.hours.filter(inWindow).length;
    };
    const goNightsHit = cases.filter((c) => verdict(c.window, c.complete).level === "go" && darkHourRemoved(c));
    expect(goNightsHit.length).toBeGreaterThanOrEqual(20);
  });

  it("never turns a night that was not a go into a go", () => {
    for (const { window, complete, partial } of cases) {
      if (verdict(window, partial).level === "go") {
        expect(verdict(window, complete).level).toBe("go");
      }
    }
  });

  it("raises a verdict only to marginal for missing data (edge or dark hours gone), never to a weather reading", () => {
    const missingData: Verdict[] = [
      { level: "marginal", reason: { kind: "no-weather-data" } },
      { level: "marginal", reason: { kind: "missing-hours" } },
    ];
    for (const { window, complete, partial } of cases) {
      const before = verdict(window, complete);
      const after = verdict(window, partial);
      if (RANK[after.level] > RANK[before.level]) {
        expect(missingData).toContainEqual(after);
      }
    }
  });

  it("never gives a go from a saved copy served after a failed refresh", () => {
    for (const { window, complete, partial } of cases) {
      expect(verdict(window, complete, { fallback: true }).level).not.toBe("go");
      expect(verdict(window, partial, { fallback: true }).level).not.toBe("go");
    }
  });
});
