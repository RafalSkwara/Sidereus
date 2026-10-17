import { Body, Observer } from "astronomy-engine";
import { beforeAll, describe, expect, it } from "vitest";

import { DEEP_SKY, findDeepSky } from "@/lib/catalogue";
import { addDays, darkWindow, observingNight, PLANET_KEYS, sunEvents } from "@/lib/engine";
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
import { isPlanetKey, MOON_TARGET_KEY, type TargetKey } from "@/lib/targets";
import type { EyepieceRecord, SiteRecord, TelescopeRecord } from "@/lib/gear/store";

import { buildTonight } from "./build";
import type { TonightView } from "./build";
import { deepSkyWindow, solarSystemWindow } from "./plan-window";
import { EYEPIECES, hourlyForecast, NOW, result, TELESCOPE, uniformForecast, WARSAW } from "./test-fixtures";

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
 * module scope; every build runs in `beforeAll`. Nothing here logs (`no-console` is an error in all of
 * `src`).
 *
 * An edited plan (adjustable-session-plan) is held to the same rule: random saved lists over the same cases (subsets
 * and permutations of tonight's suggested and addable targets, with keys that have no window, planets that are no
 * target and the Moon on nights it is none) must still draw every row inside its independently recomputed window, in
 * the saved order, with every other saved key set aside, and a night that does not pass draws no edited row.
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

interface RowCheck {
  /** Rows accepted at a night edge (`from === 0` or `to === 1`) on a night-wide axis. */
  clampedEdgeRows: number;
  rowsChecked: number;
  /** Every violation of the row checks, one line each. */
  violations: string[];
}

/**
 * Checks every row of `plan` against the independent oracle: the row's window start, end and best time are at or above
 * the site's minimum altitude, with the Sun at or below the row's own threshold. Shared by the suggested and the edited
 * plans, so an edit is held to exactly the rule a suggestion is.
 */
function checkRows(c: IndexedCase, plan: NonNullable<TonightView["sessionPlan"]>): RowCheck {
  const engineSite = toEngineSite(siteRecordOf(c));
  const observer = new Observer(c.site.latitudeDeg, c.site.longitudeDeg, 0);
  const night = observingNight(c.date, c.site.timeZone);
  const outcome: RowCheck = { clampedEdgeRows: 0, rowsChecked: 0, violations: [] };
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

  const checked = checkRows(c, plan);
  outcome.clampedEdgeRows = checked.clampedEdgeRows;
  outcome.rowsChecked = checked.rowsChecked;
  outcome.violations.push(...checked.violations);
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

  it("draws every Session plan row inside its independently recomputed window, in every generated case", () => {
    // Non-vacuity first: one result per case, and rows were actually checked (the "enough" test above sets the floors).
    expect(results).toHaveLength(CASES.length);
    expect(CASES).toHaveLength(SEEDED_CASE_COUNT + POLAR_SUMMER.length + POLAR_NIGHT.length);
    expect(results.filter((r) => r.rowsChecked > 0).length, "cases with rows checked").toBeGreaterThanOrEqual(30);
    for (const c of CASES) {
      const { violations } = results[c.index];
      expect(violations.slice(0, 10), `${violations.length} violations; ${describeCase(c)}`).toEqual([]);
    }
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

// ---- Edited plans (adjustable-session-plan) ----------------------------------------------------------------------

const EDIT_SEED = 20261014;
const JUNK_DEEP_SKY_PER_CASE = 3;

interface EditedResult {
  passes: boolean;
  /** Every violation of the edited-plan checks, one line each. */
  violations: string[];
  /** Rows of the edited plans the oracle checked, and how many of them were added beyond the suggestion. */
  rowsChecked: number;
  addedRows: number;
  /** Saved keys set aside as having no window tonight. */
  setAside: number;
  /** Candidates whose window the pure helpers confirmed. */
  candidatesChecked: number;
  /** Builds on a night that does not pass whose held list was drawn as the suggested plan. */
  heldChecked: number;
}

type Plan = NonNullable<TonightView["sessionPlan"]>;

/** A saved list for this case: a shuffled subset of the targets that can be rows plus keys that cannot, sometimes with a repeat. */
function savedListFor(c: IndexedCase, valid: readonly string[]): TargetKey[] {
  const random = seeded(EDIT_SEED + c.index);
  const inValid = new Set(valid);
  const junk: string[] = [...PLANET_KEYS, MOON_TARGET_KEY].filter((key) => !inValid.has(key));
  for (let i = 0; i < JUNK_DEEP_SKY_PER_CASE; i++) {
    const object = DEEP_SKY[Math.floor(random() * DEEP_SKY.length)];
    if (!inValid.has(object.id)) {
      junk.push(object.id);
    }
  }
  // Fisher-Yates, so the saved order is a permutation, not the catalogue's.
  const shuffle = (list: string[]): string[] => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const picked = shuffle([...valid]).slice(0, Math.floor(random() * 10));
  // Up to three keys with no window, each at a random place in the list.
  for (const key of shuffle(junk).slice(0, Math.floor(random() * 4))) {
    picked.splice(Math.floor(random() * (picked.length + 1)), 0, key);
  }
  if (picked.length > 1 && random() < 0.3) {
    picked.push(picked[0]);
  }
  return picked as TargetKey[];
}

const dedupe = (keys: readonly string[]): string[] => [...new Set(keys)];

function analyseEdited(c: IndexedCase): EditedResult {
  const record = siteRecordOf(c);
  const night = observingNight(c.date, c.site.timeZone);
  const now = new Date(night.start.getTime() + 6 * HOUR_MS);
  const out: EditedResult = {
    passes: false,
    violations: [],
    rowsChecked: 0,
    addedRows: 0,
    setAside: 0,
    candidatesChecked: 0,
    heldChecked: 0,
  };
  const inputOf = (forecast: ReturnType<typeof result> | null) => ({
    site: record,
    telescope: telescopeRecordOf(c),
    eyepieces: eyepieceRecordsOf(c),
    forecast,
    now,
  });
  const planOf = (view: TonightView): Plan | null => view.sessionPlan;
  try {
    // Without a forecast the verdict is marginal, so the night passes whenever it has a dark window.
    const base = buildTonight(inputOf(null), "en", { withSessionPlan: true, withPlanCandidates: true });
    const basePlan = planOf(base);
    if (basePlan === null) {
      out.violations.push("no Session plan was built");
      return out;
    }
    out.passes = base.ranking !== null;
    const baseKeys = basePlan.rows.map((row) => row.key);
    const candidateKeys = basePlan.candidates?.map((option) => option.key) ?? [];

    if (out.passes) {
      // The property: every key the editor offers has a window by the pure helpers' own rule (F4).
      for (const key of candidateKeys) {
        const object = findDeepSky(key);
        const window =
          object !== undefined
            ? deepSkyWindow(record, c.date, object)
            : isPlanetKey(key) || key === MOON_TARGET_KEY
              ? solarSystemWindow(record, c.date, key, { apertureMm: c.telescope.apertureMm })
              : null;
        out.candidatesChecked += 1;
        if (window === null) {
          out.violations.push(`candidate ${key} has no window by plan-window.ts`);
        }
      }
      if (basePlan.candidates === null) {
        out.violations.push("a passing night offered no candidates");
      }
    } else if (basePlan.candidates !== null) {
      out.violations.push("a night that does not pass offered candidates");
    }

    const valid = new Set([...baseKeys, ...candidateKeys]);
    const saved = savedListFor(c, [...valid]);
    const edited = buildTonight(inputOf(null), "en", {
      withSessionPlan: true,
      withPlanCandidates: true,
      planEdits: saved,
    });
    const plan = planOf(edited);
    if (plan === null) {
      out.violations.push("no edited Session plan was built");
      return out;
    }
    const rowKeys = plan.rows.map((row) => row.key);
    if (out.passes) {
      const wantRows = dedupe(saved).filter((key) => valid.has(key));
      const wantAside = dedupe(saved).filter((key) => !valid.has(key));
      if (!plan.edited || plan.heldEdits) {
        out.violations.push(
          `a saved list was not applied on a passing night (edited ${plan.edited}, held ${plan.heldEdits})`,
        );
      }
      if (rowKeys.join() !== wantRows.join()) {
        out.violations.push(`rows [${rowKeys.join(", ")}] are not the saved order [${wantRows.join(", ")}]`);
      }
      const aside = plan.notTonight.map((entry) => entry.key as string);
      if (aside.join() !== wantAside.join()) {
        out.violations.push(`set-aside keys [${aside.join(", ")}] are not [${wantAside.join(", ")}]`);
      }
      if (rowKeys.some((key) => aside.includes(key)) || new Set(rowKeys).size !== rowKeys.length) {
        out.violations.push("a saved key is a row and set aside, or a row twice");
      }
      if (!dedupe(saved).every((key) => rowKeys.includes(key) || aside.includes(key))) {
        out.violations.push("a saved key is neither a row nor set aside");
      }
      const checked = checkRows(c, plan);
      out.rowsChecked += checked.rowsChecked;
      out.addedRows += rowKeys.filter((key) => !baseKeys.includes(key)).length;
      out.setAside += aside.length;
      out.violations.push(...checked.violations.map((line) => `edited plan: ${line}`));
    } else {
      out.heldChecked += 1;
      if (plan.edited || !plan.heldEdits || plan.notTonight.length > 0 || plan.candidates !== null) {
        out.violations.push(`a night that does not pass applied or listed edits: ${JSON.stringify(plan.heldEdits)}`);
      }
      if (rowKeys.join() !== baseKeys.join()) {
        out.violations.push(
          `a night that does not pass drew [${rowKeys.join(", ")}], not the suggested [${baseKeys.join(", ")}]`,
        );
      }
    }

    // The same list on a night that has darkness but is clouded out: held, and the suggested plan drawn.
    if (out.passes) {
      const cloudy = result(
        hourlyForecast(`${addDays(c.date, -1)}T00:00:00Z`, 96, () => 100),
        false,
        new Date(now.getTime() - 20 * 60_000),
      );
      const heldView = buildTonight(inputOf(cloudy), "en", { withSessionPlan: true, planEdits: saved });
      const heldPlan = planOf(heldView);
      const suggested = planOf(buildTonight(inputOf(cloudy), "en", { withSessionPlan: true }));
      if (heldView.ranking !== null) {
        out.violations.push(`expected a no-go night under 100% cloud, got ${heldView.verdict.level}`);
      } else if (heldPlan === null || suggested === null) {
        out.violations.push("no Session plan was built on the clouded-out night");
      } else {
        out.heldChecked += 1;
        if (heldPlan.edited || !heldPlan.heldEdits) {
          out.violations.push("a clouded-out night applied a saved list");
        }
        if (heldPlan.rows.map((row) => row.key).join() !== suggested.rows.map((row) => row.key).join()) {
          out.violations.push("a clouded-out night drew something other than the suggested plan");
        }
      }
    }
  } catch (error) {
    out.violations.push(`build threw: ${failureMessage(error)}`);
  }
  return out;
}

describe("An edited Session plan never draws a target outside its window (adjustable-session-plan)", () => {
  let results: EditedResult[] = [];
  beforeAll(() => {
    results = CASES.map(analyseEdited);
  });

  // One test: the non-vacuity counts come first (a property that checks nothing passes for the wrong reason), then
  // every case is held to the rule with its index and inputs in the failure. The rows added beyond the suggestion
  // come from `applyPlanEdits`' reachable list, so `checkRows` holds them to the independent oracle too (altitude and
  // Sun against the test's own PRD thresholds); a saved key outside the suggestion and the reachable list must be set
  // aside, never drawn (`wantRows`, `wantAside`). It replaces plan-edits.test.ts (test-suite-diet Phase 2).
  it("applies enough random lists, adds enough objects and sets enough keys aside, and draws every edited row inside its window in every case", () => {
    const sum = (pick: (r: EditedResult) => number) => results.reduce((total, r) => total + pick(r), 0);
    expect(results).toHaveLength(CASES.length);
    expect(results.filter((r) => r.passes).length, "passing nights").toBeGreaterThanOrEqual(30);
    expect(
      sum((r) => r.rowsChecked),
      "edited rows checked",
    ).toBeGreaterThanOrEqual(60);
    expect(
      sum((r) => r.addedRows),
      "rows added beyond the suggestion",
    ).toBeGreaterThanOrEqual(30);
    expect(
      sum((r) => r.setAside),
      "keys set aside",
    ).toBeGreaterThanOrEqual(30);
    expect(
      sum((r) => r.candidatesChecked),
      "candidates checked",
    ).toBeGreaterThanOrEqual(500);
    expect(
      sum((r) => r.heldChecked),
      "held lists checked",
    ).toBeGreaterThanOrEqual(30);
    for (const c of CASES) {
      const { violations } = results[c.index];
      expect(violations.slice(0, 10), `${violations.length} violations; ${describeCase(c)}`).toEqual([]);
    }
  });
});
