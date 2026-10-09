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
 * About 40 cases from a fixed seed plus fixed polar cases: the summer ones (Tromsø and Longyearbyen on 2026-06-21,
 * Helsinki on 2026-06-21 at Bortle 1 to 4), which guarantee the no-darkness floor whatever the seed, and a polar-night
 * one (Longyearbyen on 2026-11-25), which guarantees the night-wide axis whatever the seed. A row carries only its
 * window as fractions of the plan's axis, so the axis is rebuilt here from the same pure engine functions the plan
 * uses (`sunEvents`, falling back to `observingNight`): start = axis start + from x length, end = axis start + to x
 * length. The best time is the row's `bestAt`. A row is never clamped to a sunset-to-sunrise axis; on a night-wide
 * axis (no sunset or sunrise) the engine's planet and Moon window is clamped to the night itself, so `from === 0` or
 * `to === 1` is accepted there only when the sun at that edge is within the row's own threshold. Altitude and sun
 * altitude come from `fixtures/independent-altitude.ts` at elevation 0 (Tonight's sites carry none), with the test's
 * own PRD threshold table, never from the engine's tracks or `parameters.ts`. Whether a night has darkness is
 * judged by sampling the oracle's sun over the observing night, and must agree with `darkWindow`. Failure messages
 * name the case index and inputs, so a case replays from the seed. The case array is built from the seed alone at
 * module scope; every build runs in `beforeAll`. Nothing here logs (`no-console` is an error under
 * `src/lib/tonight/**`).
 */

const SEED = 20261010;
const SEEDED_CASE_COUNT = 40;
const HOUR_MS = 3_600_000;
const SAMPLE_STEP_MS = 600_000;

interface IndexedCase extends GeneratedCase {
  index: number;
}

function fixedCase(label: string, date: string, bortle: number): GeneratedCase {
  const site = GENERATED_SITES.find((candidate) => candidate.label === label);
  if (site === undefined) {
    throw new Error(`No generated site named ${label}`);
  }
  return {
    site,
    date,
    bortle,
    minAltitudeDeg: 15,
    telescope: { id: "fixed-telescope", apertureMm: 150, focalLengthMm: 750 },
    eyepieces: [{ id: "fixed-eyepiece-1", focalLengthMm: 25, afovDeg: 52 }],
  };
}

const random = seeded(SEED);
const GENERATED: GeneratedCase[] = Array.from({ length: SEEDED_CASE_COUNT }, () => generateCase(random));
const POLAR_SUMMER: GeneratedCase[] = [
  fixedCase("Tromsø", "2026-06-21", 3),
  fixedCase("Longyearbyen", "2026-06-21", 2),
  fixedCase("Helsinki", "2026-06-21", 1),
  fixedCase("Helsinki", "2026-06-21", 2),
  fixedCase("Helsinki", "2026-06-21", 3),
  fixedCase("Helsinki", "2026-06-21", 4),
];
// The sun is below -6 deg at both ends of the observing night, so the axis is the whole night and the planet and
// Moon windows are clamped to it (a reviewer's probe built a Moon row with `to === 1` here).
const POLAR_NIGHT: GeneratedCase[] = [fixedCase("Longyearbyen", "2026-11-25", 5)];
const CASES: IndexedCase[] = [...GENERATED, ...POLAR_SUMMER, ...POLAR_NIGHT].map((c, index) => ({ index, ...c }));

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

/** The oracle's sun over the observing night, sampled every 10 minutes, against the test's own Bortle threshold. */
function oracleHasNoDarkness(c: IndexedCase, observer: Observer, startMs: number, endMs: number): boolean {
  const thresholdDeg = DARK_THRESHOLD_BY_BORTLE[c.bortle];
  for (let ms = startMs; ms <= endMs; ms += SAMPLE_STEP_MS) {
    if (sunAltitudeGeometricDeg(new Date(ms), observer) <= thresholdDeg) {
      return false;
    }
  }
  return true;
}

interface CaseResult {
  /** The deep-sky dark window does not exist: the oracle's sun never reaches the test's own Bortle threshold. */
  noDarkness: boolean;
  /** `darkWindow` does not agree with the oracle on whether the night has darkness, or `null` when it does. */
  darknessMismatch: string | null;
  /** The plan has at least one row. */
  hasRows: boolean;
  /** The row ids the view lists as targets (ranking entries, planets, the Moon target) and the ids the plan shows. */
  listedKeys: string[];
  rowKeys: string[];
  /** Rows accepted at a night edge (`from === 0` or `to === 1`) on a night-wide axis. */
  clampedEdgeRows: number;
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
  const noDarkness = oracleHasNoDarkness(c, observer, night.start.getTime(), night.end.getTime());
  const engineKind = darkWindow(engineSite, night, DARK_THRESHOLD_BY_BORTLE[c.bortle]).kind;
  const outcome: CaseResult = {
    noDarkness,
    darknessMismatch:
      noDarkness === (engineKind === "none")
        ? null
        : `the oracle's sun ${noDarkness ? "never reaches" : "reaches"} ${DARK_THRESHOLD_BY_BORTLE[c.bortle]} deg, ` +
          `but darkWindow is "${engineKind}"`,
    hasRows: false,
    listedKeys: [],
    rowKeys: [],
    clampedEdgeRows: 0,
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
  // `layoutSessionPlan` silently drops a row whose window misses the axis, and `build.ts` turns a planet failure into
  // an empty list, so the plan must show exactly the targets the view lists.
  outcome.listedKeys = [
    ...(view.ranking?.entries.map((entry) => entry.id) ?? []),
    ...(view.solarSystem?.entries.map((entry) => entry.key) ?? []),
    ...(view.moonCard?.target ? [view.moonCard.target.key] : []),
  ].sort();
  outcome.rowKeys = plan.rows.map((row) => row.key).sort();

  // The plan's axis, rebuilt the way `skyAxis` does: sunset to sunrise, else the whole observing night.
  const { sunset, sunrise } = sunEvents(engineSite, night);
  const nightWide = !(sunset !== null && sunrise !== null);
  const axis = sunset !== null && sunrise !== null ? { start: sunset, end: sunrise } : night;
  const axisStartMs = axis.start.getTime();
  const lengthMs = axis.end.getTime() - axisStartMs;

  for (const row of plan.rows) {
    const label = `${row.kind} ${row.key}`;
    outcome.rowsChecked += 1;
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
    // A clamped edge could hide a window that runs past the axis, so it fails before anything else is read. Without
    // a sunset and a sunrise the axis is the whole night and the window is clamped to it by construction: an edge
    // row is legitimate there only when the sun at that edge is within the row's own threshold.
    let clampedAtEdge = false;
    let clampFailure = false;
    for (const [edge, clamped, edgeTime] of [
      ["from", !(row.from > 0), axis.start],
      ["to", !(row.to < 1), axis.end],
    ] as const) {
      if (!clamped) {
        continue;
      }
      clampedAtEdge = true;
      if (!nightWide) {
        outcome.violations.push(`${label}: row is clamped to the axis (from ${row.from}, to ${row.to})`);
        clampFailure = true;
      } else if (!(sunAltitudeGeometricDeg(edgeTime, observer) <= thresholdDeg + ALTITUDE_TOLERANCE_DEG)) {
        outcome.violations.push(
          `${label}: row is clamped to the night's ${edge} edge, but the sun there is above threshold ${thresholdDeg} ` +
            `(from ${row.from}, to ${row.to})`,
        );
        clampFailure = true;
      }
    }
    if (clampFailure) {
      continue;
    }
    if (clampedAtEdge) {
      outcome.clampedEdgeRows += 1;
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
    expect(CASES).toHaveLength(SEEDED_CASE_COUNT + POLAR_SUMMER.length + POLAR_NIGHT.length);
    expect(results.filter((r) => r.hasRows).length, "plans with rows").toBeGreaterThanOrEqual(30);
    expect(results.filter((r) => r.noDarkness).length, "cases without darkness").toBeGreaterThanOrEqual(3);
    expect(
      results.reduce((sum, r) => sum + r.rowsChecked, 0),
      "rows checked",
    ).toBeGreaterThan(0);
    // The polar-night case exercises the night-wide axis, where a row legitimately reaches the night's edge.
    expect(
      results.reduce((sum, r) => sum + r.clampedEdgeRows, 0),
      "rows at a night edge on a night-wide axis",
    ).toBeGreaterThanOrEqual(1);
  });

  it("agrees with the oracle's sun about which nights have no darkness", () => {
    const mismatches = CASES.flatMap((c, i) => {
      const mismatch = results[i].darknessMismatch;
      return mismatch === null ? [] : [`${describeCase(c)}: ${mismatch}`];
    });
    expect(mismatches.slice(0, 10), `${mismatches.length} disagreements`).toEqual([]);
  });

  it("shows a Session plan row for every ranked object, listed planet and Moon target", () => {
    const mismatches = CASES.flatMap((c, i) => {
      const { listedKeys, rowKeys } = results[i];
      return listedKeys.join() === rowKeys.join()
        ? []
        : [`${describeCase(c)}: the view lists [${listedKeys.join(", ")}] but the plan shows [${rowKeys.join(", ")}]`];
    });
    expect(mismatches.slice(0, 10), `${mismatches.length} cases with dropped or extra rows`).toEqual([]);
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
