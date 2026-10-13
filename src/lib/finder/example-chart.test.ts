import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { findDeepSky } from "@/lib/catalogue";
import { formatDesignation, loadFinderStars } from "@/lib/catalogue/finder-stars";
import { eyepieceOptics, finderChart, type FinderChartData, type Site, type UnitVector } from "@/lib/engine";

import {
  EXAMPLE_BORTLE,
  EXAMPLE_EYEPIECE,
  EXAMPLE_FINDER_CHART,
  EXAMPLE_MIN_ALTITUDE_DEG,
  EXAMPLE_SITE,
  EXAMPLE_STAR_DESIGNATIONS,
  EXAMPLE_TARGET_ID,
  EXAMPLE_TELESCOPE,
  EXAMPLE_TIME,
  exampleLabels,
} from "./example-chart";

/**
 * The free explainer's committed example (finder-chart Phase 3): it must equal what the engine computes from the fixed
 * inputs below and the real star file, so an engine or star-file change cannot leave the explainer stale. The inputs
 * are constants here (the source of truth); `example-chart.ts` mirrors them for the page and a test pins the mirror.
 * Regenerate with `EXAMPLE_CHART_REGENERATE=1 npx vitest run src/lib/finder/example-chart.test.ts`, then prettier.
 */

const SITE: Site = { latitudeDeg: 52.23, longitudeDeg: 21.01, elevationM: 110, timeZone: "Europe/Warsaw" };
const TIME = new Date("2026-07-20T21:30:00Z");
const BORTLE = 7;
const MIN_ALTITUDE_DEG = 15;
const TELESCOPE = { apertureMm: 150, focalLengthMm: 750 };
const EYEPIECE = { focalLengthMm: 25, afovDeg: 50 };

function equatorialVector(raHours: number, decDeg: number): UnitVector {
  const ra = (raHours * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

async function computeExample(): Promise<{ chart: FinderChartData; designations: Record<number, unknown> }> {
  const stars = await loadFinderStars();
  const object = findDeepSky("M13");
  if (object === undefined) {
    throw new Error("M13 is not in the catalogue");
  }
  const chart = finderChart({
    site: SITE,
    time: TIME,
    bortle: BORTLE,
    minAltitudeDeg: MIN_ALTITUDE_DEG,
    target: {
      vector: equatorialVector(object.raHours, object.decDeg),
      magnitude: object.vMag,
      isPlanet: false,
      majorAxisArcmin: object.majorAxisArcmin,
    },
    stars,
    eyepieceFieldDeg: eyepieceOptics(TELESCOPE, EYEPIECE).trueFovDeg,
  });
  const route = chart.start === null ? [] : [chart.start.index, ...chart.hops.map((hop) => hop.index)];
  const designations: Record<number, unknown> = {};
  for (const index of route) {
    const designation = stars[index].designation;
    if (designation !== null) {
      designations[index] = designation;
    }
  }
  return { chart, designations };
}

const isPrimitive = (value: unknown): boolean => value === null || typeof value !== "object";

/** A TypeScript literal with leaf objects and short primitive arrays on one line, so the fixture stays reviewable. */
function literal(value: unknown, depth = 0): string {
  if (isPrimitive(value)) {
    return JSON.stringify(value);
  }
  const pad = "  ".repeat(depth + 1);
  const end = "  ".repeat(depth);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const flat = `[${value.map((item) => literal(item)).join(", ")}]`;
    if (value.every(isPrimitive) && flat.length <= 100) {
      return flat;
    }
    return `[\n${value.map((item) => `${pad}${literal(item, depth + 1)},`).join("\n")}\n${end}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const key = (name: string): string => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name));
  const flat = `{ ${entries.map(([name, item]) => `${key(name)}: ${literal(item)}`).join(", ")} }`;
  if (entries.every(([, item]) => isPrimitive(item)) && flat.length <= 100) {
    return flat;
  }
  return `{\n${entries.map(([name, item]) => `${pad}${key(name)}: ${literal(item, depth + 1)},`).join("\n")}\n${end}}`;
}

const SOURCE = fileURLToPath(new URL("./example-chart.ts", import.meta.url));

describe("the free explainer's example chart", () => {
  it("regenerates the fixture (opt-in, EXAMPLE_CHART_REGENERATE=1)", async () => {
    if (process.env.EXAMPLE_CHART_REGENERATE !== "1") {
      return;
    }
    const { chart, designations } = await computeExample();
    const block = [
      "// BEGIN GENERATED",
      `export const EXAMPLE_FINDER_CHART: FinderChartData = ${literal(chart)};`,
      `export const EXAMPLE_STAR_DESIGNATIONS: Readonly<Record<number, StarDesignation>> = ${literal(designations)};`,
      "// END GENERATED",
    ].join("\n");
    const source = readFileSync(SOURCE, "utf8");
    const next = source.replace(/\/\/ BEGIN GENERATED[\s\S]*?\/\/ END GENERATED/, () => block);
    expect(next).not.toBe("");
    writeFileSync(SOURCE, next);
  });

  it("equals the engine's chart for the fixed inputs and the real star file", async () => {
    const { chart, designations } = await computeExample();
    expect(EXAMPLE_FINDER_CHART).toEqual(chart);
    expect(EXAMPLE_STAR_DESIGNATIONS).toEqual(designations);
  });

  it("mirrors the inputs the page-side constants state", () => {
    expect(EXAMPLE_SITE).toEqual(SITE);
    expect(new Date(EXAMPLE_TIME).getTime()).toBe(TIME.getTime());
    expect(EXAMPLE_BORTLE).toBe(BORTLE);
    expect(EXAMPLE_MIN_ALTITUDE_DEG).toBe(MIN_ALTITUDE_DEG);
    expect(EXAMPLE_TARGET_ID).toBe("M13");
    expect(EXAMPLE_TELESCOPE).toEqual(TELESCOPE);
    expect({ focalLengthMm: EXAMPLE_EYEPIECE.focalLengthMm, afovDeg: EXAMPLE_EYEPIECE.afovDeg }).toEqual(EYEPIECE);
    expect(EXAMPLE_EYEPIECE.name).toBe("25 mm Plössl");
  });

  it("is a facing hop chart with steps, a start and the eyepiece circle", () => {
    expect(EXAMPLE_FINDER_CHART.kind).toBe("hop");
    expect(EXAMPLE_FINDER_CHART.orientation).toBe("facing");
    expect(EXAMPLE_FINDER_CHART.hops.length).toBeGreaterThan(0);
    expect(EXAMPLE_FINDER_CHART.overview).not.toBeNull();
    expect(EXAMPLE_FINDER_CHART.finder.circles.map((circle) => circle.kind)).toContain("eyepiece");
    expect(EXAMPLE_FINDER_CHART.start?.mag).toBeLessThanOrEqual(2.5);
  });

  it("names every route star and builds labels in both languages", () => {
    const route = [EXAMPLE_FINDER_CHART.start?.index ?? -1, ...EXAMPLE_FINDER_CHART.hops.map((hop) => hop.index)];
    for (const locale of ["en", "pl"] as const) {
      const labels = exampleLabels(locale);
      expect(labels.target).toBe("M13");
      for (const index of route) {
        expect(labels.stars[index], `star ${String(index)}`).toBe(
          formatDesignation(EXAMPLE_STAR_DESIGNATIONS[index] ?? null, locale),
        );
        expect(labels.stars[index]).toBeTruthy();
      }
      expect(labels.eyepiece?.fieldDeg).toBeCloseTo(50 / 30, 10);
      expect(labels.direction).toMatch(/^[NESW]{1,3}, \d{1,2}°$/);
      expect(labels.time).toBe("23:30");
    }
  });
});
