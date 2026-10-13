import type { Messages } from "@/i18n";
import { compassPoint } from "@/lib/compass";
import { REFLEX_RING_DEG, type FinderChartData } from "@/lib/engine";
import type { Locale } from "@/lib/preferences";
import { formatLocaleTag } from "@/lib/tonight/format";

/**
 * The words of a finder chart (finder-chart Phase 3): the numbered how-to steps and the panels' accessible names, from
 * the engine's `FinderChartData` and the labels the caller has already formatted. Pure; every sentence is a catalogue
 * message (`tonight.finder`), and every number goes through the locale's formatter here, so the catalogue never formats.
 */

type FinderMessages = Messages["tonight"]["finder"];

/** What the loader (or the free example) knows about a chart that the engine's data does not carry. */
export interface FinderChartLabels {
  /** The target's name: "M31", "Jupiter". */
  target: string;
  /**
   * Display designation by star index for the start and every hop star ("Mirach (β And)"); `null` or absent for a star
   * with no name or letter, which the steps then call "the magnitude 5.3 star".
   */
  stars: Readonly<Record<number, string | null>>;
  /** The finding eyepiece ("25 mm Plössl") and its true field, degrees; `null` when the kit has none. */
  eyepiece: { name: string; fieldDeg: number } | null;
  /** The ranking's refracted direction for the best time, "SE, 41°" (the facing context line). */
  direction: string;
  /** The best time, "22:40". */
  time: string;
}

export type WayKey = keyof FinderMessages["way"];

const WAYS: readonly WayKey[] = ["up", "upRight", "right", "downRight", "down", "downLeft", "left", "upLeft"];

/** The way on the chart for a bearing in degrees clockwise from up, to the nearest of eight. */
export function wayKey(bearingDeg: number): WayKey {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  return WAYS[Math.round(normalized / 45) % 8];
}

/** Bearing from `from` to `to` on a panel (x right, y down), degrees clockwise from up. */
export function bearingDeg(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const bearing = (Math.atan2(to.x - from.x, from.y - to.y) * 180) / Math.PI;
  return bearing < 0 ? bearing + 360 : bearing;
}

/** Numbers as the locale writes them: no grouping, at most one decimal. */
export function degreesFormat(locale: Locale): (value: number) => string {
  const format = new Intl.NumberFormat(formatLocaleTag(locale), { useGrouping: false, maximumFractionDigits: 1 });
  return (value) => format.format(value === 0 ? 0 : value);
}

function magnitudeFormat(locale: Locale): (value: number) => string {
  const format = new Intl.NumberFormat(formatLocaleTag(locale), {
    useGrouping: false,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return (value) => format.format(value);
}

export interface FinderText {
  /** The numbered steps; one sentence for `no-start`, which shows it as a paragraph rather than a list. */
  steps: string[];
  /** The overview panel's accessible name, `null` when the chart has no overview. */
  overviewAlt: string | null;
  finderAlt: string;
  /** The star indices on the route, start first (the labelled stars). */
  routeStars: number[];
  /** The legend's reflex-ring sizes: "0.5°, 2° and 4°". */
  reflexRings: string;
}

/** Magnitude of a star the chart drew, or 0 when it is not on the overview (the steps then read "magnitude 0.0"; never in practice). */
function magnitudeOf(chart: FinderChartData, index: number): number {
  const star = chart.overview?.stars.find((s) => s.index === index);
  return star?.mag ?? chart.start?.mag ?? 0;
}

export function finderText(
  chart: FinderChartData,
  labels: FinderChartLabels,
  locale: Locale,
  t: FinderMessages,
): FinderText {
  const deg = degreesFormat(locale);
  const mag = magnitudeFormat(locale);
  const nameOf = (index: number): string =>
    labels.stars[index] ?? t.unnamedStar({ mag: mag(magnitudeOf(chart, index)) });

  const { start, overview } = chart;
  const routeStars = start === null ? [] : [start.index, ...chart.hops.map((hop) => hop.index)];

  // The way of each segment of the overview's path (start, hops, target).
  const segmentWays: string[] =
    overview === null
      ? []
      : overview.path.slice(0, -1).map((from, i) => t.way[wayKey(bearingDeg(from, overview.path[i + 1]))]);

  const startStep =
    start === null
      ? ""
      : t.stepStart({
          name: nameOf(start.index),
          mag: mag(start.mag),
          alt: deg(Math.round(start.altDeg)),
          point: compassPoint(start.azDeg),
        });

  let steps: string[] = [];
  let overviewAlt: string | null = null;
  switch (chart.kind) {
    case "hop": {
      const moves = chart.hops.map((hop, i) =>
        t.stepMove({ deg: deg(hop.stepDeg), way: segmentWays[i], name: nameOf(hop.index) }),
      );
      steps = [
        startStep,
        ...moves,
        t.stepTarget({ deg: deg(chart.finalStepDeg ?? 0), way: segmentWays[chart.hops.length], target: labels.target }),
      ];
      overviewAlt = t.overviewAlt({
        start: nameOf(start?.index ?? 0),
        target: labels.target,
        count: deg(chart.hops.length + 1),
      });
      break;
    }
    case "direct": {
      const way = t.way[wayKey(chart.directionDeg ?? 0)];
      steps = [
        startStep,
        t.stepDirect({
          target: labels.target,
          distance: deg(start?.distanceDeg ?? 0),
          way,
          start: nameOf(start?.index ?? 0),
        }),
      ];
      overviewAlt = t.overviewAltDirect({
        start: nameOf(start?.index ?? 0),
        target: labels.target,
        distance: deg(start?.distanceDeg ?? 0),
      });
      break;
    }
    case "naked-eye":
      steps = [t.stepNakedEye({ target: labels.target, direction: labels.direction }), t.stepNakedEyeCentre];
      break;
    case "no-start":
      steps = [t.noStart];
      break;
  }

  const list = new Intl.ListFormat(formatLocaleTag(locale), { type: "conjunction" });
  const reflexRings = list.format(REFLEX_RING_DEG.map((ring) => `${deg(ring)}°`));

  return {
    steps,
    overviewAlt: overview === null ? null : overviewAlt,
    finderAlt: t.finderAlt({ target: labels.target, field: deg(chart.finder.fieldDeg) }),
    routeStars,
    reflexRings,
  };
}
