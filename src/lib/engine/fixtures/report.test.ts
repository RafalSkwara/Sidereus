import { describe, expect, it } from "vitest";

import { FIXTURES, fixtureTimeMs, minutesBetween } from "./index";
import { findMessier } from "@/lib/catalogue";
import { moonState } from "@/lib/engine/moon";
import { observingNight } from "@/lib/engine/night";
import { objectPosition } from "@/lib/engine/objects";
import { ALTITUDE_TOLERANCE_DEG, TIME_TOLERANCE_MINUTES } from "@/lib/engine/parameters";
import { darkWindow, sunEvents } from "@/lib/engine/sun";
import type { Site } from "@/lib/engine/types";

/**
 * Tolerance report: prints the maximum deviation between the engine and every captured Stellarium
 * value, per fixture and quantity, so the numbers behind PRD Open Question 9 come from a run, not
 * from memory. Run `npm test -- --reporter=verbose` and read the `[tolerance]` lines. The single
 * assertion here only checks that the report was produced; the pass/fail judgement lives in the
 * sun/moon/object fixture tests.
 */

interface Row {
  fixture: string;
  quantity: string;
  maxDeviation: number;
  unit: "min" | "deg" | "fraction";
  tolerance: number;
  samples: number;
}

function circularDeltaDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

function siteOf(fixture: (typeof FIXTURES)[number]): Site {
  return {
    latitudeDeg: fixture.site.latitudeDeg,
    longitudeDeg: fixture.site.longitudeDeg,
    elevationM: fixture.site.elevationM,
    timeZone: fixture.site.timeZone,
  };
}

function buildReport(): { rows: Row[]; pending: string[] } {
  const rows: Row[] = [];
  const pending: string[] = [];

  for (const fixture of FIXTURES) {
    const site = siteOf(fixture);
    const night = observingNight(fixture.night, site.timeZone);

    if (fixture.sun.status === "captured") {
      const events = sunEvents(site, night);
      const dw = darkWindow(site, night, fixture.sun.darkStart.thresholdDeg);
      const pairs: [string, Date | null, string | null][] = [
        ["sunset", events.sunset, fixture.sun.sunset],
        ["sunrise", events.sunrise, fixture.sun.sunrise],
        ["dark start", dw.kind === "window" ? dw.start : null, fixture.sun.darkStart.time],
        ["dark end", dw.kind === "window" ? dw.end : null, fixture.sun.darkEnd.time],
      ];
      for (const [quantity, engine, reference] of pairs) {
        if (engine === null || reference === null) {
          continue; // both null is the agreeing "does not occur" case, covered by the sun tests
        }
        rows.push({
          fixture: fixture.name,
          quantity,
          maxDeviation: minutesBetween(engine, fixtureTimeMs(reference)),
          unit: "min",
          tolerance: TIME_TOLERANCE_MINUTES,
          samples: 1,
        });
      }
    } else {
      pending.push(`${fixture.name}: sun ${fixture.sun.status}`);
    }

    if (fixture.moon.status === "captured") {
      let alt = 0;
      let az = 0;
      let frac = 0;
      for (const s of fixture.moon.samples) {
        const m = moonState(site, new Date(fixtureTimeMs(s.time)));
        alt = Math.max(alt, Math.abs(m.altitudeDeg - s.altitudeDeg));
        az = Math.max(az, circularDeltaDeg(m.azimuthDeg, s.azimuthDeg));
        frac = Math.max(frac, Math.abs(m.illuminatedFraction - s.illuminatedFraction));
      }
      const n = fixture.moon.samples.length;
      rows.push(
        {
          fixture: fixture.name,
          quantity: "moon altitude",
          maxDeviation: alt,
          unit: "deg",
          tolerance: ALTITUDE_TOLERANCE_DEG,
          samples: n,
        },
        {
          fixture: fixture.name,
          quantity: "moon azimuth",
          maxDeviation: az,
          unit: "deg",
          tolerance: ALTITUDE_TOLERANCE_DEG,
          samples: n,
        },
        {
          fixture: fixture.name,
          quantity: "moon fraction",
          maxDeviation: frac,
          unit: "fraction",
          tolerance: 0.02,
          samples: n,
        },
      );
    } else {
      pending.push(`${fixture.name}: moon ${fixture.moon.status}`);
    }

    if (fixture.objects.status === "captured") {
      let alt = 0;
      let az = 0;
      for (const s of fixture.objects.samples) {
        const target = findMessier(Number(s.id.slice(1)));
        if (target === undefined) {
          throw new Error(`${fixture.name}: unknown object ${s.id}`);
        }
        const p = objectPosition(site, new Date(fixtureTimeMs(s.time)), target);
        alt = Math.max(alt, Math.abs(p.altitudeDeg - s.altitudeDeg));
        az = Math.max(az, circularDeltaDeg(p.azimuthDeg, s.azimuthDeg));
      }
      const n = fixture.objects.samples.length;
      rows.push(
        {
          fixture: fixture.name,
          quantity: "object altitude",
          maxDeviation: alt,
          unit: "deg",
          tolerance: ALTITUDE_TOLERANCE_DEG,
          samples: n,
        },
        {
          fixture: fixture.name,
          quantity: "object azimuth",
          maxDeviation: az,
          unit: "deg",
          tolerance: ALTITUDE_TOLERANCE_DEG,
          samples: n,
        },
      );
    } else {
      pending.push(`${fixture.name}: objects ${fixture.objects.status}`);
    }
  }
  return { rows, pending };
}

describe("tolerance report", () => {
  it("prints max deviation per fixture and quantity for every captured section", () => {
    const { rows, pending } = buildReport();
    for (const r of rows) {
      const value = r.unit === "fraction" ? r.maxDeviation.toFixed(3) : r.maxDeviation.toFixed(2);
      const verdict = r.maxDeviation <= r.tolerance ? "ok" : "EXCEEDS";
      console.info(
        `[tolerance] ${r.fixture} | ${r.quantity} | max ${value} ${r.unit} of ${r.tolerance} | n=${r.samples} | ${verdict}`,
      );
    }
    for (const p of pending) {
      console.info(`[tolerance] not captured: ${p}`);
    }
    expect(rows.length).toBeGreaterThan(0);
  });
});
