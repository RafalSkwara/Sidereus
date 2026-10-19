/**
 * Pure rule that corrects an impossible galaxy V magnitude, for scripts/build-catalogue.mjs. Nothing here reads the
 * network, the clock or a file.
 *
 * OpenNGC's V-Mag of some galaxies is HyperLEDA's `vt` (uncertainty about 1 mag), and a Caldwell row without a V-Mag
 * has B copied into V, so a few galaxies end with B-V below 0.2, which no galaxy has. The correction is
 * V = B - (median B-V of the catalogue's own credible galaxies of the same Hubble group), so it needs no new source.
 */

/** The smallest B-V a galaxy can have (GitHub #178: V > B - 0.2 is not credible). */
export const MIN_GALAXY_BV = 0.2;

/** The fewest credible galaxies a group may rest on; fewer fails the build. */
export const MIN_GROUP_SIZE = 3;

/**
 * The four colour groups, each an explicit list of OpenNGC Hubble strings. A string in none of them throws, so a new
 * value after a pin bump is classed on purpose.
 */
const GROUPS = {
  early: ["E", "E-S0", "S0", "S0-a"],
  "Sa-Sb": ["Sa", "SABa", "SBa", "Sab", "SABab", "SBab", "S?", "Sb", "SABb", "SBb"],
  "Sbc-Sc": ["Sbc", "SBbc", "SABbc", "Sc", "SABc", "SBc", "Scd", "SBcd", "SABcd"],
  late: ["I", "IB", "IBm", "Im", "Sd", "SBd", "SABd", "Sm", "SBm"],
};

export const GROUP_NAMES = Object.freeze(Object.keys(GROUPS));

const GROUP_OF_HUBBLE = new Map(Object.entries(GROUPS).flatMap(([group, types]) => types.map((type) => [type, group])));

function round(n, digits) {
  return Number(n.toFixed(digits));
}

/** The colour group of an OpenNGC Hubble string; throws for an empty, null or unlisted one. */
export function colourGroupOf(hubble) {
  const group = typeof hubble === "string" ? GROUP_OF_HUBBLE.get(hubble) : undefined;
  if (group === undefined) {
    throw new Error(
      `Hubble type ${JSON.stringify(hubble)} is in no colour group; add it to scripts/lib/galaxy-colour.mjs`,
    );
  }
  return group;
}

/** B-V rounded to 0.01, or null when either magnitude is missing. */
export function colourOf(galaxy) {
  if (galaxy.bMag === null || galaxy.bMag === undefined || galaxy.vMag === null || galaxy.vMag === undefined) {
    return null;
  }
  return round(galaxy.bMag - galaxy.vMag, 2);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The median B-V of each group over the credible galaxies `{ hubble, bMag, vMag }` (both magnitudes and
 * B-V >= MIN_GALAXY_BV), rounded to 0.01: `{ [group]: { median, count } }`. A group with fewer than 3 credible
 * galaxies throws.
 */
export function groupMedians(galaxies) {
  const colours = Object.fromEntries(GROUP_NAMES.map((group) => [group, []]));
  for (const galaxy of galaxies) {
    const bv = colourOf(galaxy);
    if (bv !== null && bv >= MIN_GALAXY_BV) {
      colours[colourGroupOf(galaxy.hubble)].push(bv);
    }
  }
  const result = {};
  for (const group of GROUP_NAMES) {
    const count = colours[group].length;
    if (count < MIN_GROUP_SIZE) {
      throw new Error(`Colour group ${group} has ${count} credible galaxies, fewer than the ${MIN_GROUP_SIZE} needed`);
    }
    result[group] = { median: round(median(colours[group]), 2), count };
  }
  return result;
}

/** V from B and the group's median B-V, rounded to 0.01. */
export function correctedV(bMag, medianBV) {
  return round(bMag - medianBV, 2);
}
