import { Body, Observer } from "astronomy-engine";
import { beforeAll, describe, expect, it } from "vitest";

import { findDeepSky } from "@/lib/catalogue";
import { darkWindow, observingNight, sunEvents } from "@/lib/engine";
import type { PlanetKey } from "@/lib/engine";
import { generateCase, GENERATED_SITES, seeded } from "@/lib/engine/fixtures/generated";
import type { GeneratedCase } from "@/lib/engine/fixtures/generated";
import {
  ALTITUDE_TOLERANCE_DEG,
  DARK_THRESHOLD_BY_BORTLE,
  PLANET_BODIES,
  PLANET_WINDOW_THRESHOLD_DEG,
  bodyAltitudeDeg,
  deepSkyAltitudeDeg,
  sunAltitudeGeometricDeg,
} from "@/lib/engine/fixtures/independent-altitude";
import { toEngineSite } from "@/lib/gear/store";
import type { EyepieceRecord, SiteRecord, TelescopeRecord } from "@/lib/gear/store";

import { buildTonight } from "./build";
import type { TonightView } from "./build";
import { EYEPIECES, NOW, result, TELESCOPE, uniformForecast, WARSAW } from "./test-fixtures";

/**
 * Risk #3 (test-plan §2), through what the user sees: every Session plan row of a generated Tonight build is up at or
 * above the site's minimum altitude, in the dark it claims, at its window start, end and best time; and a night that
 * cannot be observed shows no ranking.
 *
 * About 40 cases from a fixed seed plus fixed polar-summer cases (Tromsø and Longyearbyen on 2026-06-21, Helsinki on
 * 2026-06-21 at Bortle 1 to 4), which guarantee the no-darkness floor whatever the seed. A row carries only its
 * window as fractions of the plan's axis, so the axis is rebuilt here from the same pure engine functions the plan
 * uses (`sunEvents`, falling back to `observingNight`): start = axis start + from x length, end = axis start + to x
 * length. The best time is the row's `bestAt`. Altitude and sun altitude come from `fixtures/independent-altitude.ts`
 * at elevation 0 (Tonight's sites carry none), with the test's own PRD threshold table, never from the engine's
 * tracks or `parameters.ts`. Failure messages name the case index and inputs, so a case replays from the seed. The
 * case array is built from the seed alone at module scope; every build runs in `beforeAll`. Nothing here logs
 * (`no-console` is an error under `src/lib/tonight/**`).
 */

const SEED = 20261010;
const SEEDED_CASE_COUNT = 40;
const HOUR_MS = 3_600_000;

interface IndexedCase extends GeneratedCase {
  index: number;
}

function polarSummerCase(label: string, bortle: number): GeneratedCase {
  const site = GENERATED_SITES.find((candidate) => candidate.label === label);
  if (site === undefined) {
    throw new Error(`No generated site named ${label}`);
  }
  return {
    site,
    date: "2026-06-21",
    bortle,
    minAltitudeDeg: 15,
    telescope: { id: "fixed-telescope", apertureMm: 150, focalLengthMm: 750 },
    eyepieces: [{ id: "fixed-eyepiece-1", focalLengthMm: 25, afovDeg: 52 }],
  };
}

const random = seeded(SEED);
const GENERATED: GeneratedCase[] = Array.from({ length: SEEDED_CASE_COUNT }, () => generateCase(random));
const POLAR_SUMMER: GeneratedCase[] = [
  polarSummerCase("Tromsø", 3),
  polarSummerCase("Longyearbyen", 2),
  polarSummerCase("Helsinki", 1),
  polarSummerCase("Helsinki", 2),
  polarSummerCase("Helsinki", 3),
  polarSummerCase("Helsinki", 4),
];
const CASES: IndexedCase[] = [...GENERATED, ...POLAR_SUMMER].map((c, index) => ({ index, ...c }));

function describeCase(c: IndexedCase): string {
  const kit = c.eyepieces.map((e) => `${e.focalLengthMm}mm/${e.afovDeg}deg`).join(",") || "none";
  return (
    `case ${c.index} (seed ${SEED}): ${c.site.label} ${c.site.latitudeDeg},${c.site.longitudeDeg} ` +
    `${c.site.timeZone}, night ${c.date}, Bortle ${c.bortle}, minAlt ${c.minAltitudeDeg}, ` +
    `telescope ${c.telescope.apertureMm}/${c.telescope.focalLengthMm}, eyepieces ${kit}`
  );
}

function siteRecordOf(c: IndexedCase): SiteRecord {
  return {
    id: "generated-site",
    name: c.site.label,
    latitudeDeg: c.site.latitudeDeg,
    longitudeDeg: c.site.longitudeDeg,
    bortle: c.bortle,
    minAltitudeDeg: c.minAltitudeDeg,
    timeZone: c.site.timeZone,
    timeZoneSource: "auto",
    createdAt: "2026-09-01T00:00:00Z",
  };
}

function telescopeRecordOf(c: IndexedCase): TelescopeRecord {
  return { ...c.telescope, name: "Generated telescope", createdAt: "2026-09-01T00:00:00Z" };
}

function eyepieceRecordsOf(c: IndexedCase): EyepieceRecord[] {
  return c.eyepieces.map((eyepiece, i) => ({
    ...eyepiece,
    name: `Generated eyepiece ${i + 1}`,
    createdAt: `2026-09-01T00:0${i}:00Z`,
  }));
}

interface CaseResult {
  /** The deep-sky dark window does not exist (judged by the engine's `darkWindow` at the test's own threshold). */
  noDarkness: boolean;
  /** The plan has at least one row. */
  hasRows: boolean;
  rowsChecked: number;
  /** Every violation of the row checks, one line each. */
  violations: string[];
  /** Violations of the no-ranking gate on a night without darkness, one line each. */
  gateViolations: string[];
}

function failureMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function analyse(c: IndexedCase): CaseResult {
  const record = siteRecordOf(c);
  const engineSite = toEngineSite(record);
  const observer = new Observer(c.site.latitudeDeg, c.site.longitudeDeg, 0);
  const night = observingNight(c.date, c.site.timeZone);
  const outcome: CaseResult = {
    noDarkness: darkWindow(engineSite, night, DARK_THRESHOLD_BY_BORTLE[c.bortle]).kind === "none",
    hasRows: false,
    rowsChecked: 0,
    violations: [],
    gateViolations: [],
  };

  // Gate (i) is guarded twice in production, so a break of both guards may throw instead of returning a ranking:
  // either way the case fails as an assertion, never as a crash.
  let view: TonightView;
  try {
    view = buildTonight(
      {
        site: record,
        telescope: telescopeRecordOf(c),
        eyepieces: eyepieceRecordsOf(c),
        forecast: null,
        now: new Date(night.start.getTime() + 6 * HOUR_MS),
      },
      "en",
      { withSessionPlan: true, limit: Infinity },
    );
  } catch (error) {
    outcome.violations.push(`build threw: ${failureMessage(error)}`);
    if (outcome.noDarkness) {
      outcome.gateViolations.push(
        `ranking built, or build threw, on a night without darkness: ${failureMessage(error)}`,
      );
    }
    return outcome;
  }

  if (outcome.noDarkness && view.ranking !== null) {
    outcome.gateViolations.push("ranking built, or build threw, on a night without darkness: a ranking was built");
  }
  if (outcome.noDarkness && view.verdict.level !== "no-go") {
    outcome.gateViolations.push(`night without darkness has verdict ${view.verdict.level}, not no-go`);
  }
  if (view.date !== c.date) {
    outcome.violations.push(`the view is for night ${view.date}, not ${c.date}`);
    return outcome;
  }
  const plan = view.sessionPlan;
  if (plan === null) {
    outcome.violations.push("no Session plan was built");
    return outcome;
  }
  outcome.hasRows = plan.rows.length > 0;

  // The plan's axis, rebuilt the way `skyAxis` does: sunset to sunrise, else the whole observing night.
  const { sunset, sunrise } = sunEvents(engineSite, night);
  const axis = sunset !== null && sunrise !== null ? { start: sunset, end: sunrise } : night;
  const axisStartMs = axis.start.getTime();
  const lengthMs = axis.end.getTime() - axisStartMs;

  for (const row of plan.rows) {
    const label = `${row.kind} ${row.key}`;
    outcome.rowsChecked += 1;
    // A clamped edge could hide a window that runs past the axis, so it fails before anything else is read.
    if (!(row.from > 0 && row.to < 1)) {
      outcome.violations.push(`${label}: row is clamped to the axis (from ${row.from}, to ${row.to})`);
      continue;
    }
    let thresholdDeg = PLANET_WINDOW_THRESHOLD_DEG;
    let altitudeAt: (time: Date) => number;
    if (row.kind === "object") {
      const object = findDeepSky(row.key);
      if (object === undefined) {
        outcome.violations.push(`${label}: not in the catalogue`);
        continue;
      }
      thresholdDeg = DARK_THRESHOLD_BY_BORTLE[c.bortle];
      altitudeAt = (time) => deepSkyAltitudeDeg(object, time, observer);
    } else if (row.kind === "planet") {
      const body = PLANET_BODIES[row.key as PlanetKey];
      altitudeAt = (time) => bodyAltitudeDeg(body, time, observer);
    } else {
      altitudeAt = (time) => bodyAltitudeDeg(Body.Moon, time, observer);
    }
    for (const [point, time] of [
      ["start", new Date(axisStartMs + row.from * lengthMs)],
      ["end", new Date(axisStartMs + row.to * lengthMs)],
      ["best", new Date(row.bestAt)],
    ] as const) {
      const altitude = altitudeAt(time);
      if (!(altitude >= c.minAltitudeDeg - ALTITUDE_TOLERANCE_DEG)) {
        outcome.violations.push(
          `${label} at ${point} ${time.toISOString()}: altitude ${altitude.toFixed(3)} is under minimum ${c.minAltitudeDeg}`,
        );
      }
      const sun = sunAltitudeGeometricDeg(time, observer);
      if (!(sun <= thresholdDeg + ALTITUDE_TOLERANCE_DEG)) {
        outcome.violations.push(
          `${label} at ${point} ${time.toISOString()}: sun altitude ${sun.toFixed(3)} is above threshold ${thresholdDeg}`,
        );
      }
    }
  }
  return outcome;
}

describe("Session plan rows are visible over generated Tonight builds (Risk #3)", () => {
  let results: CaseResult[] = [];
  beforeAll(() => {
    results = CASES.map(analyse);
  });

  // First: a property that checks nothing passes for the wrong reason.
  it("builds enough plans with rows, and enough nights without darkness, to prove something", () => {
    expect(CASES).toHaveLength(SEEDED_CASE_COUNT + POLAR_SUMMER.length);
    expect(results.filter((r) => r.hasRows).length, "plans with rows").toBeGreaterThanOrEqual(30);
    expect(results.filter((r) => r.noDarkness).length, "cases without darkness").toBeGreaterThanOrEqual(3);
    expect(
      results.reduce((sum, r) => sum + r.rowsChecked, 0),
      "rows checked",
    ).toBeGreaterThan(0);
  });

  it.each(CASES)("case $index: $site.label, night $date, Bortle $bortle", (c) => {
    const { violations } = results[c.index];
    expect(violations.slice(0, 10), `${violations.length} violations; ${describeCase(c)}`).toEqual([]);
  });

  it("builds no ranking, and does not throw, on a night without darkness", () => {
    const failing = CASES.flatMap((c, i) => results[i].gateViolations.map((v) => `${describeCase(c)}: ${v}`));
    expect(failing.slice(0, 10), `${failing.length} gate violations`).toEqual([]);
  });

  it("builds no ranking under a 100% cloudy forecast on a Warsaw October night", () => {
    const input = { site: WARSAW, telescope: TELESCOPE, eyepieces: EYEPIECES, now: NOW };
    // The same night without a forecast does rank, so an empty ranking below is the verdict's doing.
    expect(buildTonight({ ...input, forecast: null }, "en", { limit: Infinity }).ranking).not.toBeNull();
    const cloudy = buildTonight({ ...input, forecast: result(uniformForecast("2026-10-10T00:00:00Z", 100)) }, "en", {
      limit: Infinity,
    });
    expect(cloudy.verdict.level).toBe("no-go");
    expect(cloudy.ranking).toBeNull();
  });
});
