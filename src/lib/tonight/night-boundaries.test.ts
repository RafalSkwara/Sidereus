import { describe, expect, it } from "vitest";

import { RUNNER_ZONES, expectRunnerZoneActive, useRunnerZone } from "@/lib/engine/fixtures/runner-zones";
import { USNO_CIVIL_DAWN } from "@/lib/engine/fixtures/usno";
import type { SiteRecord } from "@/lib/gear/store";

import { buildTonight, type TonightView } from "./build";
import { logHref } from "./load";
import { EYEPIECES, hourlyForecast, result, TELESCOPE, WARSAW } from "./test-fixtures";

// Tonight's consumers of the night decision, on the edge nights, under every runner zone. Expected dates and
// labels are hand literals, USNO values (engine/fixtures/usno.ts) or hand UTC offsets, never formatTime,
// observingNightDateFor, tonightDateFor or addDays output. Every build runs inside `it`, after the zone switch.

const MINUTE_MS = 60_000;
const SECOND_MS = 1_000;
const HOUR_MS = 3_600_000;

const WARSAW_ENTRY = USNO_CIVIL_DAWN[0]; // Warsaw 24/25 Oct 2026 (25 h night)
const LOS_ANGELES_ENTRY = USNO_CIVIL_DAWN[2]; // Los Angeles 31 Oct / 1 Nov 2026 (month end, 25 h night)

const LOS_ANGELES: SiteRecord = {
  ...WARSAW,
  id: "site-la",
  name: "Los Angeles",
  latitudeDeg: LOS_ANGELES_ENTRY.site.latitudeDeg,
  longitudeDeg: LOS_ANGELES_ENTRY.site.longitudeDeg,
  bortle: 5,
  timeZone: LOS_ANGELES_ENTRY.site.timeZone,
};

/** A clear forecast for 7 days from `fromUtc`, fetched at `now`, built into a view with the Session plan. */
function build(site: SiteRecord, fromUtc: string, now: Date): TonightView {
  return buildTonight(
    {
      site,
      telescope: TELESCOPE,
      eyepieces: EYEPIECES,
      forecast: result(
        hourlyForecast(fromUtc, 168, () => 5),
        false,
        now,
      ),
      now,
    },
    "en",
    { withSessionPlan: true },
  );
}

const LA_FROM = "2026-10-31T12:00:00Z";
const WARSAW_FROM = "2026-10-24T00:00:00Z";
const WARSAW_NOW = new Date("2026-10-24T18:00:00Z"); // 20:00 CEST on 24 Oct

describe.each(RUNNER_ZONES)("Tonight on the edge nights (runner zone %s)", (runnerZone) => {
  useRunnerZone(runnerZone);

  it("runs in the runner zone it claims", () => {
    expectRunnerZoneActive(runnerZone);
  });

  describe("(a) the rollover reaches the view (Los Angeles, month end)", () => {
    const dawn = new Date(LOS_ANGELES_ENTRY.civilDawn).getTime(); // 2026-11-01T13:47Z, 05:47 PST

    it("5 min before civil dawn it is still the night of 31 Oct, with a 7-night strip from 31 Oct", () => {
      const view = build(LOS_ANGELES, LA_FROM, new Date(dawn - 5 * MINUTE_MS));
      expect(view.date).toBe("2026-10-31");
      const first = view.ranking?.entries[0];
      expect(first).toBeDefined();
      const query = new URL(logHref(view, first?.id ?? ""), "http://localhost").searchParams;
      expect(query.get("night")).toBe("2026-10-31");
      expect(view.nights.map((n) => n.date)).toEqual([
        "2026-10-31",
        "2026-11-01",
        "2026-11-02",
        "2026-11-03",
        "2026-11-04",
        "2026-11-05",
        "2026-11-06",
      ]);
    });

    it("5 min after civil dawn it is the evening of 1 Nov, with a 7-night strip from 1 Nov", () => {
      const view = build(LOS_ANGELES, LA_FROM, new Date(dawn + 5 * MINUTE_MS));
      expect(view.date).toBe("2026-11-01");
      const first = view.ranking?.entries[0];
      expect(first).toBeDefined();
      const query = new URL(logHref(view, first?.id ?? ""), "http://localhost").searchParams;
      expect(query.get("night")).toBe("2026-11-01");
      expect(view.nights.map((n) => n.date)).toEqual([
        "2026-11-01",
        "2026-11-02",
        "2026-11-03",
        "2026-11-04",
        "2026-11-05",
        "2026-11-06",
        "2026-11-07",
      ]);
    });
  });

  describe("(b) the Session plan on the European 25-hour night (Warsaw, 24 Oct)", () => {
    it("orders rows by peak across midnight and the clock change, and labels them in the site's zone", () => {
      const rows = (build(WARSAW, WARSAW_FROM, WARSAW_NOW).sessionPlan?.rows ?? []).map((row) => ({
        bestAt: row.bestAt,
        bestTime: row.bestTime,
      }));
      const midnightCest = Date.parse("2026-10-24T22:00:00Z"); // 00:00 CEST on 25 Oct
      const clockChange = Date.parse("2026-10-25T01:00:00Z"); // 03:00 CEST becomes 02:00 CET
      // Preconditions: without rows on both sides of each edge the assertions below would pass vacuously.
      expect(rows.some((row) => row.bestAt < midnightCest)).toBe(true);
      expect(rows.some((row) => row.bestAt > midnightCest)).toBe(true);
      expect(rows.some((row) => row.bestAt >= clockChange)).toBe(true);

      expect(rows.map((row) => row.bestAt)).toEqual(rows.map((row) => row.bestAt).sort((a, b) => a - b));
      for (const row of rows) {
        const offsetHours = row.bestAt < clockChange ? 2 : 1; // CEST +2, CET +1
        const expected = new Date(row.bestAt + offsetHours * HOUR_MS).toISOString().slice(11, 16);
        expect(row.bestTime, new Date(row.bestAt).toISOString()).toBe(expected);
      }
    });
  });

  describe("(c) the offline copy hands over at civil dawn", () => {
    it.each([
      {
        name: "Warsaw 24 Oct",
        site: WARSAW,
        from: WARSAW_FROM,
        now: WARSAW_NOW,
        civilDawn: WARSAW_ENTRY.civilDawn,
        date: "2026-10-24",
        next: "2026-10-25",
      },
      {
        name: "Los Angeles 31 Oct",
        site: LOS_ANGELES,
        from: LA_FROM,
        now: new Date("2026-10-31T20:00:00Z"), // 13:00 PDT, before the evening
        civilDawn: LOS_ANGELES_ENTRY.civilDawn,
        date: "2026-10-31",
        next: "2026-11-01",
      },
    ])(
      "$name: validUntil is civil dawn, and the date flips exactly there",
      ({ site, from, now, civilDawn, date, next }) => {
        const view = build(site, from, now);
        expect(view.date).toBe(date);
        const validUntil = view.validUntil.getTime();
        expect(Math.abs(validUntil - new Date(civilDawn).getTime())).toBeLessThanOrEqual(2 * MINUTE_MS);

        const justBefore = build(site, from, new Date(validUntil - SECOND_MS));
        expect(justBefore.date).toBe(date);
        const atEnd = build(site, from, new Date(validUntil));
        expect(atEnd.date).toBe(next);
      },
    );
  });
});
