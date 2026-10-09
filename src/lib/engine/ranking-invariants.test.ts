import { beforeAll, describe, expect, it } from "vitest";

import { DEEP_SKY } from "@/lib/catalogue";
import type { DeepSkyObject } from "@/lib/catalogue";

import { EYEPIECES, TELESCOPE, WARSAW, warsawDarkWindow } from "./fixtures";
import { generateCase, seeded } from "./fixtures/generated";
import type { GeneratedEyepiece, GeneratedTelescope } from "./fixtures/generated";
import { seenSummaries } from "./log";
import type { LogEntry, SeenSummary } from "./log";
import { addDays, observingNight } from "./night";
import { LOG_PENALTY, MESSIER_RANK_BONUS, MIN_OBJECT_SCORE, darknessThresholdDegForBortle } from "./parameters";
import { rankObjects } from "./ranking";
import type { RankableObject, Ranking } from "./ranking";
import { darkWindow } from "./sun";
import type { DarkWindow, Site } from "./types";

/**
 * Risk #4 (test-plan §2): the PRD's ranking invariants ("decided, not tuned", prd.md:565-575, FR-018) as relations
 * over the whole catalogue, so a retune that breaks one fails here.
 *
 * Every assertion compares two engine runs, or checks a PRD constant relation; no expected value is ever copied
 * from engine output. All rankings use `DEEP_SKY` with `limit: Infinity`, so `entries` is the whole cleared set.
 * Inputs: the four calibration nights (Warsaw, Bortle 5, 150/750), the full-Moon nights 2026-10-26 and 2026-03-03
 * (Warsaw, Bortle 6, where the Moon washes objects out) and about 20 generated cases with a dark window.
 *
 * Logs always go through `seenSummaries(log, night)` with log nights on or before the ranked night: the rating
 * filter lives only there, so a hand-built `seen` map would hide a `LOG_PENALTY_MIN_RATING` retune.
 *
 * (a) ratings 1 and 2 are inert (FR-018): such a log ranks exactly like an empty one.
 * (b) seen never decides the bar: with every object logged at rating 4, the cleared set is unchanged.
 * (c) the Messier bonus never decides the bar: without any Messier object, the cleared set is unchanged.
 * (d) the bar is the PRD bar: every entry has `score.total >= MIN_OBJECT_SCORE`, and the rank key differs from the
 *     score only by the bonus and the log penalty.
 * (e) a washed-out object is never listed.
 * (f) the order is total: a shuffled catalogue ranks in the same order.
 * (g) a bigger telescope never hides an object. Regression guard: it holds by construction today (aperture enters
 *     the score only through the monotone limiting magnitude), so it fails only if someone adds a term that
 *     penalises aperture.
 */

const SEED = 20261009;
const BORTLE_CALIBRATION = 5;
const BORTLE_FULL_MOON = 6;
const MIN_ALTITUDE_DEG = 15;
const CALIBRATION_NIGHTS = ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"] as const;
const FULL_MOON_NIGHTS = ["2026-10-26", "2026-03-03"] as const;
const GENERATED_WANTED = 20;
const GENERATED_CANDIDATES = 60;
const GENERATED_APERTURE_CASES = 5;
const LOGGED_OBJECTS = 30;
const EPSILON = 1e-9;

type KitEyepiece = GeneratedEyepiece;
type Dark = Extract<DarkWindow, { kind: "window" }>;
type DeepSkyRanking = Ranking<DeepSkyObject, KitEyepiece>;

interface Scenario {
  label: string;
  kind: "calibration" | "full-moon" | "generated";
  site: Site;
  /** The observing night's evening date, `YYYY-MM-DD`. */
  date: string;
  bortle: number;
  minAltitudeDeg: number;
  telescope: GeneratedTelescope;
  eyepieces: readonly KitEyepiece[];
  dark: Dark;
}

/** Everything computed once per scenario, in `beforeAll`. */
interface Run {
  scenario: Scenario;
  base: DeepSkyRanking;
  /** 30 seeded-random catalogue objects, logged at rating 1 or 2 (through `seenSummaries`). */
  lowRatingLog: LogEntry[];
  lowRatings: DeepSkyRanking;
  allSeen: DeepSkyRanking;
  halfSeen: DeepSkyRanking;
  noMessier: Ranking<RankableObject, KitEyepiece>;
  shuffled: DeepSkyRanking;
}

interface CandidateCase {
  index: number;
  generated: ReturnType<typeof generateCase>;
}

// Candidates are built here from the seed alone; the engine runs in `beforeAll`.
const candidateRandom = seeded(SEED);
const CANDIDATES: CandidateCase[] = Array.from({ length: GENERATED_CANDIDATES }, (_, index) => ({
  index,
  generated: generateCase(candidateRandom),
}));

function rankScenario(
  s: Scenario,
  options: { seen?: ReadonlyMap<string, SeenSummary>; telescope?: GeneratedTelescope } = {},
): DeepSkyRanking {
  return rankObjects({
    site: s.site,
    bortle: s.bortle,
    minAltitudeDeg: s.minAltitudeDeg,
    darkWindow: s.dark,
    telescope: options.telescope ?? s.telescope,
    eyepieces: s.eyepieces,
    catalogue: DEEP_SKY,
    seen: options.seen,
    limit: Number.POSITIVE_INFINITY,
  });
}

const idsOf = (ranking: { entries: { object: { id: string } }[] }): string[] => ranking.entries.map((e) => e.object.id);
const clearedSet = (ranking: { entries: { object: { id: string } }[] }): Set<string> => new Set(idsOf(ranking));
const sortedIds = (set: ReadonlySet<string>): string[] => [...set].sort();

/** A seeded Fisher-Yates shuffle of a copy. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

describe("ranking invariants as relations (Risk #4)", () => {
  const runs: Run[] = [];
  const scenarios: Scenario[] = [];
  /** Rating-2 log entries whose object is in the cleared set of the empty-log ranking, summed over scenarios. */
  let ratingTwoHitsOnCleared = 0;
  /** Per calibration night: the 150 mm ranking and the 300 mm ranking at the same focal ratio. */
  const apertureRuns: { scenario: Scenario; small: DeepSkyRanking; large: DeepSkyRanking }[] = [];

  beforeAll(() => {
    for (const date of CALIBRATION_NIGHTS) {
      scenarios.push({
        label: `calibration night ${date} (Warsaw, Bortle ${BORTLE_CALIBRATION}, 150/750)`,
        kind: "calibration",
        site: WARSAW,
        date,
        bortle: BORTLE_CALIBRATION,
        minAltitudeDeg: MIN_ALTITUDE_DEG,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        dark: warsawDarkWindow(date, BORTLE_CALIBRATION),
      });
    }
    for (const date of FULL_MOON_NIGHTS) {
      scenarios.push({
        label: `full-Moon night ${date} (Warsaw, Bortle ${BORTLE_FULL_MOON}, 150/750)`,
        kind: "full-moon",
        site: WARSAW,
        date,
        bortle: BORTLE_FULL_MOON,
        minAltitudeDeg: MIN_ALTITUDE_DEG,
        telescope: TELESCOPE,
        eyepieces: EYEPIECES,
        dark: warsawDarkWindow(date, BORTLE_FULL_MOON),
      });
    }
    for (const { index, generated: c } of CANDIDATES) {
      if (scenarios.filter((s) => s.kind === "generated").length === GENERATED_WANTED) {
        break;
      }
      const dark = darkWindow(c.site, observingNight(c.date, c.site.timeZone), darknessThresholdDegForBortle(c.bortle));
      if (dark.kind !== "window") {
        continue;
      }
      const kit = c.eyepieces.map((e) => `${e.focalLengthMm}mm/${e.afovDeg}deg`).join(",") || "none";
      scenarios.push({
        label:
          `generated case ${index} (seed ${SEED}): ${c.site.label} ${c.site.latitudeDeg},${c.site.longitudeDeg} ` +
          `${c.site.timeZone}, night ${c.date}, Bortle ${c.bortle}, minAlt ${c.minAltitudeDeg}, ` +
          `telescope ${c.telescope.apertureMm}/${c.telescope.focalLengthMm}, eyepieces ${kit}`,
        kind: "generated",
        site: c.site,
        date: c.date,
        bortle: c.bortle,
        minAltitudeDeg: c.minAltitudeDeg,
        telescope: c.telescope,
        eyepieces: c.eyepieces,
        dark,
      });
    }

    const random = seeded(SEED + 1);
    for (const scenario of scenarios) {
      const base = rankScenario(scenario);
      const baseCleared = clearedSet(base);

      // (a): 30 seeded-random objects at rating 1 or 2, on nights on or before the ranked night.
      const lowRatingLog: LogEntry[] = shuffle(DEEP_SKY, random)
        .slice(0, LOGGED_OBJECTS)
        .map((object, i) => ({
          target: object.id,
          night: addDays(scenario.date, -(i % 5)),
          rating: 1 + Math.floor(random() * 2),
        }));
      ratingTwoHitsOnCleared += lowRatingLog.filter((e) => e.rating === 2 && baseCleared.has(e.target)).length;
      const lowRatings = rankScenario(scenario, { seen: seenSummaries(lowRatingLog, scenario.date) });

      // (b), (d): every object logged at rating 4, and a seeded half of them.
      const allLog: LogEntry[] = DEEP_SKY.map((object) => ({ target: object.id, night: scenario.date, rating: 4 }));
      const allSeen = rankScenario(scenario, { seen: seenSummaries(allLog, scenario.date) });
      const halfLog = shuffle(allLog, random).slice(0, Math.floor(allLog.length / 2));
      const halfSeen = rankScenario(scenario, { seen: seenSummaries(halfLog, scenario.date) });

      // (c): a catalogue without a single Messier object.
      const noMessier = rankObjects({
        site: scenario.site,
        bortle: scenario.bortle,
        minAltitudeDeg: scenario.minAltitudeDeg,
        darkWindow: scenario.dark,
        telescope: scenario.telescope,
        eyepieces: scenario.eyepieces,
        catalogue: DEEP_SKY.map((object): RankableObject => ({ ...object, messier: null })),
        limit: Number.POSITIVE_INFINITY,
      });

      // (f): the same catalogue in a seeded shuffled order.
      const shuffled = rankObjects({
        site: scenario.site,
        bortle: scenario.bortle,
        minAltitudeDeg: scenario.minAltitudeDeg,
        darkWindow: scenario.dark,
        telescope: scenario.telescope,
        eyepieces: scenario.eyepieces,
        catalogue: shuffle(DEEP_SKY, random),
        limit: Number.POSITIVE_INFINITY,
      });

      runs.push({ scenario, base, lowRatingLog, lowRatings, allSeen, halfSeen, noMessier, shuffled });
    }

    // (g): 150 mm against 300 mm at the same focal ratio, on the calibration nights and the first generated cases.
    const apertureScenarios = [
      ...scenarios.filter((s) => s.kind === "calibration"),
      ...scenarios.filter((s) => s.kind === "generated").slice(0, GENERATED_APERTURE_CASES),
    ];
    for (const scenario of apertureScenarios) {
      const ratio = scenario.telescope.focalLengthMm / scenario.telescope.apertureMm;
      const at = (apertureMm: number): GeneratedTelescope => ({
        id: scenario.telescope.id,
        apertureMm,
        focalLengthMm: Math.round(apertureMm * ratio),
      });
      apertureRuns.push({
        scenario,
        small: rankScenario(scenario, { telescope: at(150) }),
        large: rankScenario(scenario, { telescope: at(300) }),
      });
    }
  });

  it("has the inputs the relations need (non-vacuity)", () => {
    expect(scenarios.filter((s) => s.kind === "calibration")).toHaveLength(CALIBRATION_NIGHTS.length);
    expect(scenarios.filter((s) => s.kind === "full-moon")).toHaveLength(FULL_MOON_NIGHTS.length);
    expect(
      scenarios.filter((s) => s.kind === "generated"),
      `only ${scenarios.filter((s) => s.kind === "generated").length} of ${GENERATED_CANDIDATES} generated candidates (seed ${SEED}) have a dark window`,
    ).toHaveLength(GENERATED_WANTED);
    expect(apertureRuns).toHaveLength(CALIBRATION_NIGHTS.length + GENERATED_APERTURE_CASES);
    // (a) is vacuous unless a low rating hits an object that actually clears the bar.
    expect(ratingTwoHitsOnCleared, "no rating-2 log entry hit a cleared object").toBeGreaterThanOrEqual(1);
    for (const run of runs) {
      expect(run.base.clearedCount, `${run.scenario.label}: nothing clears the bar`).toBeGreaterThan(0);
      expect(
        seenSummaries(run.lowRatingLog, run.scenario.date).size,
        `${run.scenario.label}: a rating 1-2 log must count nothing as seen`,
      ).toBe(0);
    }
  });

  it("lists every cleared object when the limit is Infinity", () => {
    for (const { scenario, base, allSeen } of runs) {
      expect(base.entries.length, scenario.label).toBe(base.clearedCount);
      expect(allSeen.entries.length, scenario.label).toBe(allSeen.clearedCount);
    }
  });

  it("(a) ratings 1 and 2 are inert: such a log ranks exactly like an empty one (FR-018)", () => {
    for (const { scenario, base, lowRatings } of runs) {
      expect(idsOf(lowRatings), scenario.label).toEqual(idsOf(base));
      expect(lowRatings, scenario.label).toEqual(base);
    }
  });

  it("(a) control: a rating of 3 on the same objects is not inert, so (a) can fail", () => {
    for (const { scenario, base, lowRatingLog } of runs.filter((r) => r.scenario.kind === "calibration")) {
      const asThrees = lowRatingLog.map((e) => ({ ...e, rating: 3 }));
      const seen = seenSummaries(asThrees, scenario.date);
      const hit = [...seen.keys()].some((id) => clearedSet(base).has(id));
      expect(hit, `${scenario.label}: the control log hits no cleared object`).toBe(true);
      const logged = rankScenario(scenario, { seen: seen });
      expect(
        logged.entries.some((e) => e.seen !== null),
        scenario.label,
      ).toBe(true);
    }
  });

  it("(b) seen never decides the bar: with every object logged, the cleared set is unchanged", () => {
    for (const { scenario, base, allSeen } of runs) {
      expect(
        seenSummaries(
          DEEP_SKY.map((object) => ({ target: object.id, night: scenario.date, rating: 4 })),
          scenario.date,
        ).size,
        `${scenario.label}: every catalogue object must be seen`,
      ).toBe(DEEP_SKY.length);
      expect(allSeen.clearedCount, scenario.label).toBe(base.clearedCount);
      expect(sortedIds(clearedSet(allSeen)), scenario.label).toEqual(sortedIds(clearedSet(base)));
    }
  });

  it("(c) the Messier bonus never decides the bar: without Messier objects, the cleared set is unchanged", () => {
    for (const { scenario, base, noMessier } of runs) {
      expect(noMessier.clearedCount, scenario.label).toBe(base.clearedCount);
      expect(sortedIds(clearedSet(noMessier)), scenario.label).toEqual(sortedIds(clearedSet(base)));
    }
  });

  it("(d) the bar is the PRD bar: total >= MIN_OBJECT_SCORE, and the rank key moves only by the bonus and the penalty", () => {
    // The four input combinations (Messier or not, seen or not) the half-seen runs reached, keyed by inputs, so a
    // retune that makes two deltas coincide (bonus 0, or bonus == penalty) cannot fail the check.
    const combinations = new Set<string>();
    for (const { scenario, base, allSeen, halfSeen } of runs) {
      for (const [name, ranking] of [
        ["no log", base],
        ["all seen", allSeen],
        ["half seen", halfSeen],
      ] as const) {
        for (const { object, score, rankScore, seen } of ranking.entries) {
          const where = `${scenario.label}, ${name}, ${object.id}`;
          expect(score.total, where).toBeGreaterThanOrEqual(MIN_OBJECT_SCORE);
          const expectedDelta = (object.messier === null ? 0 : MESSIER_RANK_BONUS) - (seen === null ? 0 : LOG_PENALTY);
          expect(
            Math.abs(rankScore - score.total - expectedDelta),
            `${where}: rankScore - total = ${rankScore - score.total}, expected ${expectedDelta}`,
          ).toBeLessThanOrEqual(EPSILON);
          if (name === "half seen") {
            combinations.add(
              `${object.messier === null ? "caldwell" : "messier"}/${seen === null ? "unseen" : "seen"}`,
            );
          }
        }
      }
    }
    // The half-seen runs must reach all four input combinations, or the check proves less than it says.
    expect([...combinations].sort()).toEqual(["caldwell/seen", "caldwell/unseen", "messier/seen", "messier/unseen"]);
  });

  it("(e) a washed-out object is never listed", () => {
    for (const { scenario, base, allSeen, halfSeen } of runs) {
      for (const [name, ranking] of [
        ["no log", base],
        ["all seen", allSeen],
        ["half seen", halfSeen],
      ] as const) {
        const listed = clearedSet(ranking);
        const leaked = ranking.washedOut.map((w) => w.object.id).filter((id) => listed.has(id));
        expect(leaked, `${scenario.label}, ${name}: washed-out objects listed`).toEqual([]);
        expect(ranking.washedOut.length, `${scenario.label}, ${name}`).toBe(ranking.washedOutCount);
      }
    }
  });

  it.each(FULL_MOON_NIGHTS)("(e) precondition: the full Moon on %s washes out at least one object", (date) => {
    const run = runs.find((r) => r.scenario.kind === "full-moon" && r.scenario.date === date);
    expect(run, `no run for ${date}`).toBeDefined();
    expect(run?.base.washedOutCount, `full-Moon night ${date}`).toBeGreaterThanOrEqual(1);
  });

  it("(f) permutation invariance: a shuffled catalogue gives the same order", () => {
    for (const { scenario, base, shuffled } of runs) {
      expect(idsOf(shuffled), scenario.label).toEqual(idsOf(base));
      expect(shuffled.clearedCount, scenario.label).toBe(base.clearedCount);
      expect(
        shuffled.washedOut.map((w) => w.object.id),
        scenario.label,
      ).toEqual(base.washedOut.map((w) => w.object.id));
    }
  });

  it("(g) aperture never shrinks the cleared set: 150 mm clears a subset of 300 mm at the same focal ratio (regression guard, holds by construction today)", () => {
    for (const { scenario, small, large } of apertureRuns) {
      const larger = clearedSet(large);
      const dropped = sortedIds(clearedSet(small)).filter((id) => !larger.has(id));
      expect(dropped, `${scenario.label}: objects cleared at 150 mm but not at 300 mm`).toEqual([]);
    }
  });
});
