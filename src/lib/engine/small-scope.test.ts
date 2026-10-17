import { describe, expect, it } from "vitest";

import { DEEP_SKY } from "@/lib/catalogue";

import { expectationFor } from "./expectation";
import type { ExpectationKey } from "./expectation";
import { EYEPIECES, WARSAW } from "./fixtures";
import { observingNight } from "./night";
import { BRIGHTNESS_RAMP_MAG, GALAXY_FAINT_BRIGHTNESS_CAP, darknessThresholdDegForBortle } from "./parameters";
import { rankObjects } from "./ranking";
import type { Ranking } from "./ranking";
import { telescopeLimitingMag } from "./score";
import { darkWindow } from "./sun";
import type { DarkWindow, Site } from "./types";

/**
 * Small-aperture ranking guard (small-scope-galaxies, M-4 S-04, Phase 3): a galaxy's ranking and its what-to-expect
 * line agree in a 60-150 mm telescope. Fixed nights at the calibration test's Warsaw site, plus the S-02 checkpoint's
 * Bieszczady night (49.10 N, 22.65 E, elevation 0 m, `context/archive/2026-09-25-tonight-verdict-and-ranking/
 * checkpoint.md:185`). Minimum altitude 15 degrees, the calibration test's eyepieces, an unlimited list. The expectations
 * come from the plan (research sections 2 and 4 and the owner's city-sky decision, plan review F6), never from the
 * engine's own output.
 */

const BIESZCZADY: Site = { latitudeDeg: 49.1, longitudeDeg: 22.65, elevationM: 0, timeZone: "Europe/Warsaw" };

interface Night {
  site: Site;
  place: string;
  date: string;
}

const WARSAW_NIGHTS: readonly Night[] = ["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"].map((date) => ({
  site: WARSAW,
  place: "Warsaw",
  date,
}));
const BIESZCZADY_NIGHT: Night = { site: BIESZCZADY, place: "Bieszczady", date: "2027-04-06" };

function darkOf(night: Night, bortle: number): DarkWindow {
  return darkWindow(night.site, observingNight(night.date, night.site.timeZone), darknessThresholdDegForBortle(bortle));
}

/** The unlimited ranking for one night, Bortle class and aperture (an f/5 telescope, as the calibration test's). */
function rank(
  night: Night,
  bortle: number,
  apertureMm: number,
): Ranking<(typeof DEEP_SKY)[number], (typeof EYEPIECES)[number]> {
  const dark = darkOf(night, bortle);
  if (dark.kind !== "window") {
    throw new Error(`expected a dark window on ${night.date} at ${night.place}, Bortle ${bortle}`);
  }
  return rankObjects({
    site: night.site,
    bortle,
    minAltitudeDeg: 15,
    darkWindow: dark,
    telescope: { id: "t1", apertureMm, focalLengthMm: apertureMm * 5 },
    eyepieces: EYEPIECES,
    catalogue: DEEP_SKY,
    limit: Number.POSITIVE_INFINITY,
  });
}

/** 1-based rank of an object on a night, or `null` when it is not listed. */
function rankOf(ranking: Ranking<(typeof DEEP_SKY)[number], (typeof EYEPIECES)[number]>, id: string): number | null {
  const index = ranking.entries.findIndex((e) => e.object.id === id);
  return index === -1 ? null : index + 1;
}

function object(id: string) {
  const found = DEEP_SKY.find((o) => o.id === id);
  if (found === undefined) {
    throw new Error(`${id} is not in the catalogue`);
  }
  return found;
}

const WARSAW_APRIL = WARSAW_NIGHTS[1];
const WARSAW_JULY = WARSAW_NIGHTS[2];
const WARSAW_OCTOBER = WARSAW_NIGHTS[3];

describe("a small telescope's ranking follows the what-to-expect line", () => {
  // G1 (OD-1, plan review F1): a faint, low-surface-brightness galaxy is not a top-ten pick from a suburban sky.
  describe.each([5, 6])("G1: M101 at Warsaw 2026-04-15, Bortle %i", (bortle) => {
    it.each([60, 80])("is not in the top 10 at %i mm", (apertureMm) => {
      const place = rankOf(rank(WARSAW_APRIL, bortle, apertureMm), "M101");
      expect(place === null || place > 10, `M101 is #${place}`).toBe(true);
    });
  });

  // G2: a pin against regression, the opposite end of G6. M31 keeps a high rank with a line that agrees with "bright
  // for your 60 mm" (one test over both nights).
  it("G2: M31 is in the top 5 with a smudge or better line at Warsaw 2026-07-15 and 2026-10-15, Bortle 6, 60 mm", () => {
    expect(["galaxySmudge", "galaxyBright"]).toContain(expectationFor(object("M31"), 6, 60));
    for (const night of [WARSAW_JULY, WARSAW_OCTOBER]) {
      const place = rankOf(rank(night, 6, 60), "M31");
      expect(place, `M31 is not listed on ${night.date}`).not.toBeNull();
      expect(place ?? Number.POSITIVE_INFINITY, `M31 is #${place} on ${night.date}`).toBeLessThanOrEqual(5);
    }
  });

  // G3 (#21 item 3 and the research probe): M33's low surface brightness keeps it out of a suburban top ten.
  it("G3: M33 is not in the top 10 at Warsaw 2026-10-15, Bortle 6, 60 mm", () => {
    const place = rankOf(rank(WARSAW_OCTOBER, 6, 60), "M33");
    expect(place === null || place > 10, `M33 is #${place}`).toBe(true);
  });

  // G4 (OD-1 a): the line decides. The sources call M101 "a large nebulous haze with a brighter centre" in an 80 mm
  // under dark skies, so it keeps the smudge line there and with it its whole brightness credit (the headroom ramp,
  // uncapped); there is no rank assertion. The credit check catches a cap that reaches the smudge band (impl review F5).
  it("G4: M101 reads galaxySmudge at Bieszczady 2027-04-06, Bortle 3, 80 mm, with its brightness credit uncapped", () => {
    const m101 = object("M101");
    expect(expectationFor(m101, 3, 80)).toBe("galaxySmudge");
    const entry = rank(BIESZCZADY_NIGHT, 3, 80).entries.find((e) => e.object.id === "M101");
    expect(entry, "M101 is not listed").toBeDefined();
    const ramp = Math.min(1, Math.max(0, (telescopeLimitingMag(3, 80) - m101.vMag) / BRIGHTNESS_RAMP_MAG));
    expect(ramp).toBeGreaterThan(GALAXY_FAINT_BRIGHTNESS_CAP);
    expect(entry?.score.components.brightness).toBeCloseTo(ramp, 12);
  });

  // G5 (plan review F2): the reason line never says "bright for your N mm" beside a faint line. Every galaxy on the
  // unlimited list is checked, and both reasons the list shows (`leadComponent` and `secondComponent`).
  it("G5: a galaxy whose reason is brightness has a bright or smudge line", () => {
    const allowed: readonly ExpectationKey[] = ["galaxyBright", "galaxySmudge"];
    let rankings = 0;
    let galaxiesChecked = 0;
    let brightnessReasons = 0;
    const offenders: string[] = [];
    for (const night of [...WARSAW_NIGHTS, BIESZCZADY_NIGHT]) {
      for (const apertureMm of [60, 80, 150]) {
        for (const bortle of [3, 5, 6, 8]) {
          // A combination with no dark window (Warsaw 2026-07-15 at Bortle 3, where the Sun never reaches -18 degrees)
          // has no ranking to check; it is skipped here, never through a caught error.
          if (darkOf(night, bortle).kind !== "window") {
            continue;
          }
          rankings += 1;
          for (const e of rank(night, bortle, apertureMm).entries) {
            if (e.object.type !== "galaxy") {
              continue;
            }
            galaxiesChecked += 1;
            if (e.leadComponent !== "brightness" && e.secondComponent !== "brightness") {
              continue;
            }
            brightnessReasons += 1;
            const key = expectationFor(e.object, bortle, apertureMm);
            if (!allowed.includes(key)) {
              offenders.push(
                `${night.place} ${night.date}, Bortle ${bortle}, ${apertureMm} mm: ${e.object.id} reads ${key}`,
              );
            }
          }
        }
      }
    }
    // A property over an empty or short sample passes for the wrong reason: the counts come first.
    expect(rankings, "rankings checked").toBeGreaterThanOrEqual(50);
    expect(galaxiesChecked, "galaxy entries checked").toBeGreaterThanOrEqual(2000);
    expect(brightnessReasons, "galaxies with brightness as a reason").toBeGreaterThanOrEqual(150);
    expect(offenders).toEqual([]);
  });

  // G6 (owner, plan review F6): under city skies a 60 mm sees M31 as very faint, and it leaves the top 5.
  it("G6: M31 reads galaxyFaint and is not in the top 5 at Warsaw 2026-10-15, Bortle 8, 60 mm", () => {
    expect(expectationFor(object("M31"), 8, 60)).toBe("galaxyFaint");
    const place = rankOf(rank(WARSAW_OCTOBER, 8, 60), "M31");
    expect(place === null || place > 5, `M31 is #${place}`).toBe(true);
  });
});
