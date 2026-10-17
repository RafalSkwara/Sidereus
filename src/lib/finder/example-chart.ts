import { formatDesignation, type StarDesignation } from "@/lib/catalogue/finder-stars";
import { eyepieceOptics, type FinderChartData, type Site } from "@/lib/engine";
import type { Locale } from "@/lib/preferences";
import { createFormatter } from "@/lib/tonight/format";

import type { FinderChartLabels } from "./steps";

/**
 * The free explainer's example chart (finder-chart O-5, D-1): M13 as `finderChart` draws it from a fixed public
 * reference point and instant, a fixed Bortle class and a fixed 25 mm Plossl on a 150/750 reflector. It is committed
 * data, so a free account's view reads no star file, runs no engine and touches nothing of the user's: never computed
 * per view, never from the user's site or gear.
 *
 * Regenerating (when the engine, the star file or the example's inputs change; `example-chart.test.ts` fails until it
 * is done, because the fixture must equal what the engine computes from the inputs below and the real star file):
 *
 *   EXAMPLE_CHART_REGENERATE=1 npx vitest run src/lib/finder/example-chart.test.ts
 *   npx prettier --write src/lib/finder/example-chart.ts
 *
 * The test rewrites only the block between the BEGIN/END GENERATED markers; review the diff. The inputs live in the
 * test (it is their source of truth) and are mirrored by the constants below, which the test also asserts equal.
 */

/** The fixed public reference point (Warsaw's city-centre coordinates), not anyone's home. */
export const EXAMPLE_SITE: Site = {
  latitudeDeg: 52.23,
  longitudeDeg: 21.01,
  elevationM: 110,
  timeZone: "Europe/Warsaw",
};
/** The fixed instant: a July night, M13 high in the west. */
export const EXAMPLE_TIME = "2026-07-20T21:30:00Z";
/** A suburban sky (the starting limit is then 2.5, so the hop has steps). */
export const EXAMPLE_BORTLE = 7;
export const EXAMPLE_MIN_ALTITUDE_DEG = 15;
export const EXAMPLE_TARGET_ID = "M13";
export const EXAMPLE_TELESCOPE = { apertureMm: 150, focalLengthMm: 750 } as const;
/** The finding eyepiece: a 25 mm Plossl with a 50 degree apparent field (1.7 degrees true on the telescope above). */
export const EXAMPLE_EYEPIECE = { name: "25 mm Plössl", focalLengthMm: 25, afovDeg: 50 } as const;

// BEGIN GENERATED
export const EXAMPLE_FINDER_CHART: FinderChartData = {
  kind: "hop",
  orientation: "facing",
  poleUp: null,
  facing: { azDeg: 246.98, altDeg: 62.8 },
  start: { index: 70, mag: 2.2, altDeg: 45.97, azDeg: 253.6, distanceDeg: 17.24 },
  hops: [
    { index: 590, stepDeg: 5.12 },
    { index: 4088, stepDeg: 4.8 },
    { index: 2092, stepDeg: 4.8 },
  ],
  finalStepDeg: 4.76,
  directionDeg: null,
  overview: {
    fieldDeg: 22.2,
    stars: [
      { index: 70, x: 3.403, y: 8.054, mag: 2.2 },
      { index: 134, x: -9.743, y: 3.684, mag: 2.8 },
      { index: 136, x: -4.279, y: -5.316, mag: 2.8 },
      { index: 289, x: 10.786, y: 5.145, mag: 3.5 },
      { index: 291, x: 0.822, y: -10.727, mag: 3.5 },
      { index: 359, x: 6.09, y: 7.04, mag: 3.7 },
      { index: 363, x: -9.976, y: 6.79, mag: 3.7 },
      { index: 415, x: 1.705, y: 7.245, mag: 3.8 },
      { index: 478, x: -7.61, y: -7.897, mag: 3.9 },
      { index: 586, x: 6.55, y: 4.543, mag: 4.1 },
      { index: 590, x: -0.506, y: 4.662, mag: 4.1 },
      { index: 637, x: 9.795, y: -10.701, mag: 4.2 },
      { index: 1023, x: 8.71, y: -0.518, mag: 4.6 },
      { index: 1025, x: 0.356, y: 6.447, mag: 4.6 },
      { index: 1027, x: 10.379, y: -6.791, mag: 4.6 },
      { index: 1151, x: -3.228, y: 10.217, mag: 4.7 },
      { index: 1155, x: 3.976, y: -4.207, mag: 4.7 },
      { index: 1295, x: 6.179, y: -1.241, mag: 4.8 },
      { index: 1296, x: -3.996, y: 7.106, mag: 4.8 },
      { index: 1299, x: 4.915, y: -10.891, mag: 4.8 },
      { index: 1461, x: -1.834, y: -1.908, mag: 4.9 },
      { index: 1636, x: 7.629, y: 6.685, mag: 5 },
      { index: 1645, x: 0.781, y: 1.845, mag: 5 },
      { index: 1647, x: -8.963, y: 10.682, mag: 5 },
      { index: 1651, x: -11.015, y: -2.167, mag: 5 },
      { index: 1837, x: 10.853, y: -1.941, mag: 5.1 },
      { index: 2091, x: 1.335, y: -3.025, mag: 5.2 },
      { index: 2092, x: 0.123, y: -4.07, mag: 5.2 },
      { index: 2094, x: -10.535, y: 4.371, mag: 5.2 },
      { index: 2313, x: 8.567, y: 8.766, mag: 5.3 },
      { index: 2325, x: -5.947, y: -7.228, mag: 5.3 },
      { index: 2326, x: -5.792, y: -9.902, mag: 5.3 },
      { index: 2558, x: 9.442, y: 4.683, mag: 5.4 },
      { index: 2568, x: 10.553, y: -7.579, mag: 5.4 },
      { index: 2569, x: 6.947, y: -3.61, mag: 5.4 },
      { index: 2571, x: 3.095, y: -0.721, mag: 5.4 },
      { index: 2578, x: 0.036, y: -4.014, mag: 5.4 },
      { index: 2862, x: 7.786, y: 7.637, mag: 5.5 },
      { index: 2864, x: 9.498, y: 2.964, mag: 5.5 },
      { index: 2872, x: -4.267, y: 10.245, mag: 5.5 },
      { index: 2882, x: 4.577, y: -8.097, mag: 5.5 },
      { index: 2883, x: 2.169, y: -7.126, mag: 5.5 },
      { index: 3237, x: 5.376, y: 2.164, mag: 5.6 },
      { index: 3242, x: 5.603, y: -3.001, mag: 5.6 },
      { index: 3245, x: 3.508, y: -4.545, mag: 5.6 },
      { index: 3642, x: 10.042, y: -7.226, mag: 5.7 },
      { index: 3648, x: -5.159, y: 5.142, mag: 5.7 },
      { index: 3650, x: -9.069, y: 8.101, mag: 5.7 },
      { index: 3656, x: -7.002, y: -5.552, mag: 5.7 },
      { index: 4085, x: 4.927, y: -3.564, mag: 5.8 },
      { index: 4088, x: -2.176, y: 0.152, mag: 5.8 },
      { index: 4093, x: -9.41, y: 2.993, mag: 5.8 },
      { index: 4576, x: 1.863, y: 4.961, mag: 5.9 },
      { index: 4586, x: 7.578, y: -9.068, mag: 5.9 },
      { index: 4593, x: -7.712, y: -2.075, mag: 5.9 },
      { index: 5064, x: 10.158, y: 6.597, mag: 6 },
      { index: 5067, x: 3.709, y: 10.357, mag: 6 },
      { index: 5085, x: -8.249, y: 5.592, mag: 6 },
      { index: 5088, x: -2.895, y: -7.428, mag: 6 },
      { index: 5635, x: 7.585, y: 1.122, mag: 6.1 },
      { index: 5646, x: -8.976, y: 10.445, mag: 6.1 },
      { index: 5647, x: -9.857, y: 10.426, mag: 6.1 },
      { index: 5650, x: -3.193, y: 1.573, mag: 6.1 },
      { index: 5660, x: -9.113, y: -0.519, mag: 6.1 },
      { index: 5669, x: -10.737, y: -3.465, mag: 6.1 },
      { index: 5674, x: -5.178, y: -11.098, mag: 6.1 },
      { index: 6321, x: -5.547, y: 7.078, mag: 6.2 },
      { index: 6336, x: -4.987, y: -7.456, mag: 6.2 },
      { index: 7071, x: 9.6, y: 5.317, mag: 6.3 },
      { index: 7079, x: 10.365, y: -1.485, mag: 6.3 },
      { index: 7092, x: 7.842, y: -5.19, mag: 6.3 },
      { index: 7099, x: -8.963, y: 10.682, mag: 6.3 },
      { index: 7101, x: 1.455, y: -2.213, mag: 6.3 },
      { index: 7109, x: -0.17, y: -6.36, mag: 6.3 },
      { index: 7953, x: 10.015, y: 0.476, mag: 6.4 },
      { index: 7959, x: 4.212, y: 2.238, mag: 6.4 },
      { index: 7969, x: 5.248, y: -6.572, mag: 6.4 },
      { index: 7976, x: -0.981, y: -3.085, mag: 6.4 },
      { index: 7996, x: -7.181, y: -8.871, mag: 6.4 },
      { index: 8000, x: -8.533, y: -9.38, mag: 6.4 },
      { index: 8921, x: 6.955, y: 4.934, mag: 6.5 },
      { index: 8922, x: 10.271, y: 0.435, mag: 6.5 },
      { index: 8929, x: 5.024, y: 5.118, mag: 6.5 },
      { index: 8951, x: -3.198, y: 2.586, mag: 6.5 },
    ],
    path: [
      { x: 3.403, y: 8.054 },
      { x: -0.506, y: 4.662 },
      { x: -2.176, y: 0.152 },
      { x: 0.123, y: -4.07 },
      { x: -0.818, y: -8.804 },
    ],
    target: { x: -0.818, y: -8.804 },
    zenith: null,
    zenithEdge: null,
    circles: [],
  },
  finder: {
    fieldDeg: 10,
    stars: [
      { index: 136, x: -3.361, y: 3.53, mag: 2.8 },
      { index: 291, x: 1.565, y: -1.913, mag: 3.5 },
      { index: 1155, x: 4.914, y: 4.417, mag: 4.7 },
      { index: 2092, x: 1.06, y: 4.656, mag: 5.2 },
      { index: 2326, x: -4.921, y: -0.933, mag: 5.3 },
      { index: 2578, x: 0.974, y: 4.714, mag: 5.4 },
      { index: 2586, x: -4.042, y: -3.512, mag: 5.4 },
      { index: 2883, x: 3.007, y: 1.565, mag: 5.5 },
      { index: 3245, x: 4.432, y: 4.092, mag: 5.6 },
      { index: 4594, x: 3.335, y: -4.867, mag: 5.9 },
      { index: 5088, x: -2.024, y: 1.405, mag: 6 },
      { index: 5674, x: -4.334, y: -2.107, mag: 6.1 },
      { index: 6336, x: -4.095, y: 1.433, mag: 6.2 },
      { index: 6341, x: -3.822, y: -2.469, mag: 6.2 },
      { index: 7109, x: 0.704, y: 2.385, mag: 6.3 },
      { index: 10043, x: 3.49, y: 2.549, mag: 6.6 },
      { index: 10048, x: 2.279, y: -0.063, mag: 6.6 },
      { index: 11261, x: 2.692, y: -1.734, mag: 6.7 },
      { index: 11281, x: -4.578, y: -1.764, mag: 6.7 },
      { index: 11288, x: -4.793, y: -2.982, mag: 6.7 },
      { index: 14025, x: -0.552, y: 4.683, mag: 6.9 },
      { index: 14048, x: -0.164, y: -0.231, mag: 6.9 },
      { index: 14053, x: -2.123, y: -0.005, mag: 6.9 },
      { index: 15652, x: 3.887, y: 3.468, mag: 7 },
      { index: 15663, x: -0.223, y: 3.548, mag: 7 },
      { index: 15668, x: -1.063, y: 2.655, mag: 7 },
      { index: 17367, x: -0.546, y: 3.576, mag: 7.1 },
      { index: 17369, x: -3.081, y: 4.731, mag: 7.1 },
      { index: 17371, x: 0.453, y: 1.03, mag: 7.1 },
      { index: 17376, x: -3.914, y: 4.004, mag: 7.1 },
      { index: 17399, x: -4.147, y: -1.235, mag: 7.1 },
      { index: 19235, x: 4.212, y: 2.128, mag: 7.2 },
      { index: 19239, x: 2.13, y: 3.176, mag: 7.2 },
      { index: 19272, x: -0.06, y: -1.617, mag: 7.2 },
      { index: 19276, x: -1.378, y: -0.618, mag: 7.2 },
      { index: 21298, x: 2.774, y: 4.949, mag: 7.3 },
      { index: 21327, x: 3.828, y: -1.386, mag: 7.3 },
      { index: 21338, x: -0.095, y: 0.273, mag: 7.3 },
      { index: 21340, x: -2.945, y: 2.398, mag: 7.3 },
      { index: 21343, x: -1.175, y: 0.002, mag: 7.3 },
      { index: 21358, x: -0.624, y: -4.455, mag: 7.3 },
      { index: 23463, x: 0.875, y: 2.586, mag: 7.4 },
      { index: 23476, x: 1.675, y: -0.989, mag: 7.4 },
      { index: 23509, x: -0.823, y: -4.389, mag: 7.4 },
      { index: 23524, x: -4.323, y: -2.891, mag: 7.4 },
      { index: 25190, x: 3.376, y: 4.818, mag: 7.5 },
      { index: 25195, x: 3.021, y: 3.846, mag: 7.5 },
      { index: 25196, x: 2.178, y: 4.736, mag: 7.5 },
      { index: 25218, x: -4.316, y: 4.474, mag: 7.5 },
    ],
    path: [
      { x: 1.06, y: 4.656 },
      { x: 0, y: 0 },
    ],
    target: { x: 0, y: 0 },
    zenith: null,
    zenithEdge: null,
    circles: [
      { kind: "finder", r: 3.504 },
      { kind: "reflex", r: 0.25 },
      { kind: "reflex", r: 1 },
      { kind: "reflex", r: 2.001 },
      { kind: "eyepiece", r: 0.833 },
    ],
  },
};
export const EXAMPLE_STAR_DESIGNATIONS: Readonly<Record<number, StarDesignation>> = {
  "70": { con: "CrB", bayer: "Alp", flamsteed: 5, proper: "Alphecca" },
  "590": { con: "CrB", bayer: "Eps", flamsteed: 13 },
  "2092": { con: "CrB", bayer: "Nu-1", flamsteed: 20 },
  "4088": { con: "CrB", bayer: "Ups", flamsteed: 18 },
};
// END GENERATED

/** The example's labels in `locale`: the same shape the loader builds for a real chart. */
export function exampleLabels(locale: Locale): FinderChartLabels {
  const format = createFormatter(locale);
  return {
    target: EXAMPLE_TARGET_ID,
    stars: Object.fromEntries(
      Object.entries(EXAMPLE_STAR_DESIGNATIONS).map(([index, designation]) => [
        index,
        formatDesignation(designation, locale),
      ]),
    ),
    eyepiece: { name: EXAMPLE_EYEPIECE.name, fieldDeg: eyepieceOptics(EXAMPLE_TELESCOPE, EXAMPLE_EYEPIECE).trueFovDeg },
    direction: format.formatDirection({
      azimuthDeg: EXAMPLE_FINDER_CHART.facing.azDeg,
      altitudeDeg: EXAMPLE_FINDER_CHART.facing.altDeg,
    }),
    time: format.formatTime(new Date(EXAMPLE_TIME), EXAMPLE_SITE.timeZone),
  };
}
