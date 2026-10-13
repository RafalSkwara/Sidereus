import { findDeepSky } from "@/lib/catalogue";
import { formatDesignation, loadFinderStars, type FinderStar } from "@/lib/catalogue/finder-stars";
import {
  eyepieceOptics,
  finderChart,
  planetJ2000Vector,
  type FinderChartData,
  type Site,
  type UnitVector,
} from "@/lib/engine";
import {
  EXAMPLE_BORTLE,
  EXAMPLE_EYEPIECE,
  EXAMPLE_FINDER_CHART,
  EXAMPLE_MIN_ALTITUDE_DEG,
  EXAMPLE_SITE,
  EXAMPLE_TARGET_ID,
  EXAMPLE_TELESCOPE,
  EXAMPLE_TIME,
  exampleLabels,
} from "@/lib/finder/example-chart";
import type { FinderChartLabels } from "@/lib/finder/steps";
import type { Locale } from "@/lib/preferences";
import { createFormatter } from "@/lib/tonight/format";

/**
 * Sample finder charts for the /design specimens (dev only). The engine draws each one from the real star file at a
 * fixed public reference point and instant, so the specimens show what the page really renders; the variants that need
 * a sparse sky (a hop that does not exist, no starting star) get it from a fixed star cut or a high minimum altitude,
 * said in each sample's `note`.
 */

export interface FinderSample {
  chart: FinderChartData;
  labels: FinderChartLabels;
  note: string;
}

const EYEPIECE_FIELD_DEG = eyepieceOptics(EXAMPLE_TELESCOPE, EXAMPLE_EYEPIECE).trueFovDeg;

function equatorialVector(raHours: number, decDeg: number): UnitVector {
  const ra = (raHours * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

function objectVector(id: string): { vector: UnitVector; magnitude: number; majorAxisArcmin: number | null } {
  const object = findDeepSky(id);
  if (object === undefined) {
    throw new Error(`the design samples reference ${id}, which is not in the catalogue`);
  }
  return {
    vector: equatorialVector(object.raHours, object.decDeg),
    magnitude: object.vMag,
    majorAxisArcmin: object.majorAxisArcmin,
  };
}

function labelsOf(
  chart: FinderChartData,
  stars: readonly FinderStar[],
  target: string,
  time: Date,
  site: Site,
  locale: Locale,
  withEyepiece: boolean,
): FinderChartLabels {
  const format = createFormatter(locale);
  const route = chart.start === null ? [] : [chart.start.index, ...chart.hops.map((hop) => hop.index)];
  return {
    target,
    stars: Object.fromEntries(route.map((index) => [index, formatDesignation(stars[index].designation, locale)])),
    eyepiece: withEyepiece ? { name: EXAMPLE_EYEPIECE.name, fieldDeg: EYEPIECE_FIELD_DEG } : null,
    direction: format.formatDirection({ azimuthDeg: chart.facing.azDeg, altitudeDeg: chart.facing.altDeg }),
    time: format.formatTime(time, site.timeZone),
  };
}

export async function finderSamples(locale: Locale): Promise<{
  hop: FinderSample;
  m31: FinderSample;
  noEyepiece: FinderSample;
  overhead: FinderSample;
  overheadEdge: FinderSample;
  direct: FinderSample;
  nakedEye: FinderSample;
  noStart: FinderSample;
}> {
  const stars = await loadFinderStars();
  const site = EXAMPLE_SITE;
  const m13 = objectVector(EXAMPLE_TARGET_ID);
  const base = {
    site,
    bortle: EXAMPLE_BORTLE,
    minAltitudeDeg: EXAMPLE_MIN_ALTITUDE_DEG,
    stars,
    eyepieceFieldDeg: EYEPIECE_FIELD_DEG as number | null,
  };
  const exampleTime = new Date(EXAMPLE_TIME);

  const hop: FinderSample = {
    chart: EXAMPLE_FINDER_CHART,
    labels: exampleLabels(locale),
    note: "M13, Warsaw, 20 July 2026, Bortle 7: the committed free example, facing.",
  };

  // For comparing with a published M31 chart: Mirach (limit 3.5 at Bortle 5), then μ and ν Andromedae. M31 never
  // passes 80° at 52° N (its declination is +41°), so the chart is always facing here.
  const m31Time = new Date("2026-10-15T19:30:00Z");
  const m31Chart = finderChart({
    ...base,
    bortle: 5,
    time: m31Time,
    target: { ...objectVector("M31"), isPlanet: false },
  });
  const m31: FinderSample = {
    chart: m31Chart,
    labels: labelsOf(m31Chart, stars, "M31", m31Time, site, locale, true),
    note: "M31, Warsaw, 15 October 2026, Bortle 5: the hop to compare with a published M31 chart, facing.",
  };

  const noEyepiece: FinderSample = {
    chart: {
      ...EXAMPLE_FINDER_CHART,
      finder: {
        ...EXAMPLE_FINDER_CHART.finder,
        circles: EXAMPLE_FINDER_CHART.finder.circles.filter((circle) => circle.kind !== "eyepiece"),
      },
    },
    labels: { ...exampleLabels(locale), eyepiece: null },
    note: "The same chart for a kit with no eyepieces: no eyepiece circle, one line saying why.",
  };

  const overheadTime = new Date("2026-04-20T23:00:00Z");
  const m101 = objectVector("M101");
  const overheadChart = finderChart({
    ...base,
    bortle: 5,
    time: overheadTime,
    target: { ...m101, isPlanet: false },
  });
  const overhead: FinderSample = {
    chart: overheadChart,
    labels: labelsOf(overheadChart, stars, "M101", overheadTime, site, locale, true),
    note: "M101 passing near the zenith at 52° N: north up in both panels, the zenith inside both and marked with a cross.",
  };

  // An hour earlier M101 is 83° up: the zenith is 7° from the finder panel's centre, outside both panels' 10° squares,
  // so each draws an arrow on its edge toward it.
  const overheadEdgeTime = new Date("2026-04-20T22:00:00Z");
  const overheadEdgeChart = finderChart({
    ...base,
    bortle: 5,
    time: overheadEdgeTime,
    target: { ...m101, isPlanet: false },
  });
  const overheadEdge: FinderSample = {
    chart: overheadEdgeChart,
    labels: labelsOf(overheadEdgeChart, stars, "M101", overheadEdgeTime, site, locale, true),
    note: "M101 an hour earlier, 83° up: north up in both panels, the zenith outside both, so each has an arrow on its edge toward it.",
  };

  // A thin sky (stars to magnitude 3.5 only) leaves no chain of stars short enough for the finder.
  const thin = stars.filter((star) => star.mag <= 3.5);
  const directChart = finderChart({ ...base, stars: thin, time: exampleTime, target: { ...m13, isPlanet: false } });
  const direct: FinderSample = {
    chart: directChart,
    labels: labelsOf(directChart, stars, "M13", exampleTime, site, locale, true),
    note: "M13 with only stars to magnitude 3.5 drawn: no hop exists, so a direct line from the nearest star.",
  };

  const saturnTime = new Date("2026-10-15T19:00:00Z");
  const saturnChart = finderChart({
    ...base,
    time: saturnTime,
    target: {
      vector: planetJ2000Vector("saturn", site, saturnTime),
      magnitude: 0.6,
      isPlanet: true,
      majorAxisArcmin: null,
    },
  });
  const nakedEye: FinderSample = {
    chart: saturnChart,
    labels: labelsOf(saturnChart, stars, "Saturn", saturnTime, site, locale, true),
    note: "Saturn, at least as bright as the starting limit: it is its own starting point, so the finder panel only.",
  };

  // No star above 89° is bright enough to start from, so there is no chart to hop.
  const noStartChart = finderChart({
    ...base,
    minAltitudeDeg: 89,
    time: exampleTime,
    target: { ...m13, isPlanet: false },
  });
  const noStart: FinderSample = {
    chart: noStartChart,
    labels: labelsOf(noStartChart, stars, "M13", exampleTime, site, locale, true),
    note: "M13 with a minimum altitude of 89°: no starting star qualifies, so a message and the finder panel.",
  };

  return { hop, m31, noEyepiece, overhead, overheadEdge, direct, nakedEye, noStart };
}
