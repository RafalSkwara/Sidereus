/**
 * Pure functions of the star build (scripts/build-stars.mjs): from the Hipparcos reader's rows and the two committed
 * name tables to the four generated files' text. Nothing here reads the network, the filesystem, the clock or the
 * environment, so the same input always gives the same strings (scripts/lib/build-stars.test.mjs pins that).
 *
 * Rows are `{ hip, vmag, raDeg, decDeg, ... , fromSexagesimal }` from `readHipparcos` (J2000, V <= 7.5). The HIP number is
 * the id of a star and the tie-break of both files' order.
 */

/**
 * Everything the build guards, in one place. The counts are exact because the pinned file cannot change: 921 and 25,723
 * (919 and 25,713 with an astrometric solution plus the ten stars positioned from RAhms/DEdms). `designatedRange` is the
 * measured 3,277 designated finder stars (a Bayer letter, a Flamsteed number or an IAU name) less and plus about 2 %: it
 * catches a table that lost or gained a tenth of its stars, never a single changed entry.
 */
export const BUILD_LIMITS = Object.freeze({
  brightMaxVmag: 4.5,
  /** The finder chart's depth: the file is complete to about here. */
  finderMaxVmag: 7.5,
  brightCount: 921,
  finderCount: 25723,
  countMargin: 0,
  brightestNamed: 40,
  /** Named beyond the brightest 40: the northern pole star (HIP 11767), the anchor a beginner finds first. */
  alwaysNamedHips: Object.freeze([11767]),
  /** The named-count guard: 40 brightest plus Polaris. */
  expectedNamed: 41,
  designatedRange: Object.freeze({ min: 3212, max: 3342 }),
  /** The stars positioned from RAhms/DEdms (no astrometric solution in the file), V <= 7.5. */
  sexagesimalHips: Object.freeze([31067, 31500, 34716, 50572, 52800, 55203, 59273, 78727, 80579, 115125]),
});

export const VECTOR_DIGITS = 5;

export function round(n, digits) {
  return Number(n.toFixed(digits));
}

/** J2000 unit vector from RA (hours) and Dec (degrees): x towards the equinox, z towards the pole. */
export function unitVector(raHours, decDeg) {
  const ra = (raHours * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return {
    x: round(Math.cos(dec) * Math.cos(ra), VECTOR_DIGITS),
    y: round(Math.cos(dec) * Math.sin(ra), VECTOR_DIGITS),
    z: round(Math.sin(dec), VECTOR_DIGITS),
  };
}

/** Declination in 0.01 degrees runs -9000..9000, so `pos` packs right ascension as raCenti * 18001 + (decCenti + 9000). */
export const DEC_CENTI_MAX = 9000;
export const POS_DEC_RANGE = 2 * DEC_CENTI_MAX + 1;

/** Position in 0.01 degrees; right ascension wraps so a value that rounds up to 360 degrees becomes 0. */
export function centiDegrees(degrees, wrap) {
  const n = Math.round(degrees * 100);
  return wrap ? n % 36000 : n;
}

/** The magnitude the finder file stores: tenths, exactly as the previous generator rounded it, so the order is unchanged. */
export function magnitudeTenths(vmag) {
  return Math.round(vmag * 10);
}

function requireFiniteNumber(value, label, hip) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`HIP ${hip}: ${label} is not a finite number`);
  }
  return value;
}

/** Fails on a row the build cannot place; the reader already guarantees these, so this only guards a changed contract. */
function checkRow(row) {
  if (!Number.isInteger(row.hip) || row.hip < 1) {
    throw new Error(`Star ${JSON.stringify(row.hip)} has no positive integer HIP number`);
  }
  requireFiniteNumber(row.vmag, "Vmag", row.hip);
  const ra = requireFiniteNumber(row.raDeg, "RAdeg", row.hip);
  const dec = requireFiniteNumber(row.decDeg, "DEdeg", row.hip);
  if (ra < 0 || ra >= 360 || dec < -90 || dec > 90) {
    throw new Error(`HIP ${row.hip}: position ${ra} / ${dec} out of range`);
  }
}

function checkCount(label, actual, expected, margin) {
  if (expected !== null && Math.abs(actual - expected) > margin) {
    throw new Error(`Expected ${expected} ± ${margin} ${label}, got ${actual}`);
  }
}

function checkUniqueHips(label, stars) {
  const seen = new Set();
  for (const s of stars) {
    if (seen.has(s.hip)) {
      throw new Error(`Duplicate HIP ${s.hip} in the ${label}`);
    }
    seen.add(s.hip);
  }
}

/**
 * The two committed tables as maps. `designationsText` is `scripts/data/star-designations.json`
 * (`{ meta, stars: { hip: [bayer|null, flamsteed|null] } }`), `namesText` is `scripts/data/iau-star-names.json`
 * (`{ meta, names: { hip: name } }`). Returns `{ designations: Map<hip, [bayer, flamsteed]>, names: Map<hip, name>,
 * starsMeta, namesMeta }`; a malformed entry throws. The build reads these two tables for names and designations and
 * nothing else.
 */
export function parseTables({ designationsText, namesText }) {
  const stars = JSON.parse(designationsText);
  const named = JSON.parse(namesText);
  if (typeof stars?.stars !== "object" || stars.stars === null || typeof stars.meta !== "object") {
    throw new Error("star-designations.json has no { meta, stars } shape");
  }
  if (typeof named?.names !== "object" || named.names === null || typeof named.meta !== "object") {
    throw new Error("iau-star-names.json has no { meta, names } shape");
  }
  for (const [file, meta] of [
    ["star-designations.json", stars.meta],
    ["iau-star-names.json", named.meta],
  ]) {
    if (typeof meta.fetchedAt !== "string" || typeof meta.counts !== "object" || meta.counts === null) {
      throw new Error(`${file}: meta has no fetchedAt and counts, which the star files' provenance quotes`);
    }
  }
  const designations = new Map();
  for (const [key, value] of Object.entries(stars.stars)) {
    const hip = Number(key);
    if (!Number.isInteger(hip) || hip < 1) {
      throw new Error(`star-designations.json: key "${key}" is not a HIP number`);
    }
    const [bayer, flamsteed] = Array.isArray(value) && value.length === 2 ? value : [undefined, undefined];
    const bayerOk = bayer === null || (typeof bayer === "string" && /^[A-Z][a-z]{1,2}(-\d+)?$/.test(bayer));
    const flamsteedOk = flamsteed === null || (Number.isInteger(flamsteed) && flamsteed > 0);
    if (!bayerOk || !flamsteedOk || (bayer === null && flamsteed === null)) {
      throw new Error(`star-designations.json: HIP ${key} is not [bayer|null, flamsteed|null] with one of them set`);
    }
    designations.set(hip, [bayer, flamsteed]);
  }
  const names = new Map();
  for (const [key, value] of Object.entries(named.names)) {
    const hip = Number(key);
    if (!Number.isInteger(hip) || hip < 1 || typeof value !== "string" || value.trim() === "") {
      throw new Error(`iau-star-names.json: HIP "${key}" does not map to a non-empty name`);
    }
    names.set(hip, value);
  }
  return { designations, names, starsMeta: stars.meta, namesMeta: named.meta };
}

/**
 * The bright-star output: stars with Vmag <= `brightMaxVmag` (a float comparison), sorted by magnitude then HIP, as
 * `{ id, mag, x, y, z, name? }` with `id` the HIP number. `name` (the IAU name) goes to the `brightestNamed` brightest stars
 * that have one, plus the HIPs in `alwaysNamedHips` (Polaris), which do not use up one of the 40 places; the named count
 * must come to `expectedNamed` (41), the names must be unique, and an always-named star must have a name.
 */
export function buildBrightCatalogue(rows, names, overrides = {}) {
  const limits = { ...BUILD_LIMITS, ...overrides };
  rows.forEach(checkRow);
  const stars = rows.filter((s) => s.vmag <= limits.brightMaxVmag);
  stars.sort((a, b) => a.vmag - b.vmag || a.hip - b.hip);

  checkCount(`stars at Vmag <= ${limits.brightMaxVmag}`, stars.length, limits.brightCount, limits.countMargin);
  checkUniqueHips("bright set", stars);
  for (const hip of limits.alwaysNamedHips) {
    if (!stars.some((s) => s.hip === hip) || !names.has(hip)) {
      throw new Error(`HIP ${hip} must be a bright star with an IAU name`);
    }
  }

  let named = 0;
  const entries = stars.map((s) => {
    // Key order here is the key order in bright-stars.json; keep it stable.
    const entry = { id: s.hip, mag: s.vmag, ...unitVector(s.raDeg / 15, s.decDeg) };
    const name = names.get(s.hip);
    if (name !== undefined) {
      if (limits.alwaysNamedHips.includes(s.hip)) {
        entry.name = name;
      } else if (named < limits.brightestNamed) {
        entry.name = name;
        named++;
      }
    }
    return entry;
  });

  const namedCount = entries.filter((e) => e.name !== undefined).length;
  if (limits.expectedNamed !== null && namedCount !== limits.expectedNamed) {
    throw new Error(`Expected ${limits.expectedNamed} named stars, got ${namedCount}`);
  }
  const used = new Set();
  for (const e of entries) {
    if (e.name !== undefined) {
      if (used.has(e.name)) {
        throw new Error(`The name "${e.name}" is used for more than one bright star`);
      }
      used.add(e.name);
    }
  }
  return entries;
}

/**
 * The finder output: stars with Vmag <= `finderMaxVmag` as columnar integers (position packed into one integer, magnitude
 * as runs in tenths) and a sparse table of designations keyed by the star's index in those columns, each
 * `[bayer, flamsteed, con, proper]` with null for an absent field. The order is magnitude tenths, then HIP number; the
 * HIP numbers are not stored (the packed file has to stay small: finder-stars.test.ts holds its gzip under 160,000
 * bytes). A star has an entry when it has a Bayer letter or Flamsteed number in `designations` or an IAU name in `names`;
 * its `con` is `constellationOf(raHours, decDeg)` of the propagated position and a missing one throws.
 */
export function buildFinderCatalogue(rows, { designations, names, constellationOf }, overrides = {}) {
  const limits = { ...BUILD_LIMITS, ...overrides };
  rows.forEach(checkRow);
  // Sorted by the magnitude the file stores (tenths), so a reader can verify the order from the file alone.
  const stars = rows
    .filter((s) => s.vmag <= limits.finderMaxVmag)
    .map((s) => ({ ...s, tenths: magnitudeTenths(s.vmag) }));
  stars.sort((a, b) => a.tenths - b.tenths || a.hip - b.hip);

  checkCount(`stars at Vmag <= ${limits.finderMaxVmag}`, stars.length, limits.finderCount, limits.countMargin);
  checkUniqueHips("finder set", stars);
  const present = new Set(stars.map((s) => s.hip));
  for (const hip of designations.keys()) {
    if (!present.has(hip)) {
      throw new Error(`The designation table lists HIP ${hip}, which is not among the ${stars.length} finder stars`);
    }
  }

  const catalogue = { pos: [], mag: [], designations: {} };
  const runs = catalogue.mag;
  stars.forEach((s, index) => {
    const raCenti = centiDegrees(s.raDeg, true);
    const decCenti = centiDegrees(s.decDeg, false);
    catalogue.pos.push(raCenti * POS_DEC_RANGE + (decCenti + DEC_CENTI_MAX));
    const last = runs[runs.length - 1];
    if (last !== undefined && last[0] === s.tenths) {
      last[1]++;
    } else {
      runs.push([s.tenths, 1]);
    }
    const [bayer, flamsteed] = designations.get(s.hip) ?? [null, null];
    const proper = names.get(s.hip) ?? null;
    if (bayer !== null || flamsteed !== null || proper !== null) {
      const con = constellationOf(s.raDeg / 15, s.decDeg);
      if (typeof con !== "string" || con === "") {
        throw new Error(`HIP ${s.hip} has a designation but no constellation`);
      }
      // [bayer, flamsteed, con, proper], null for an absent field; the order is the file's format.
      catalogue.designations[index] = [bayer, flamsteed, con, proper];
    }
  });

  const designated = Object.keys(catalogue.designations).length;
  const { min, max } = limits.designatedRange;
  if (designated < min || designated > max) {
    throw new Error(`Expected ${min}..${max} designated finder stars, got ${designated}`);
  }
  return catalogue;
}

/** One star per line keeps a regeneration's diff reviewable. */
export function brightJson(catalogue) {
  const body = catalogue.map((s) => "  " + JSON.stringify(s)).join(",\n");
  return `[\n${body}\n]\n`;
}

/**
 * One column per line and one designation per line keep a regeneration's diff reviewable. `pos` is one comma-joined
 * string: the server bundle prints a number array one element per line, and 25,723 of them would add ~80 KB.
 */
export function finderJson(catalogue) {
  const column = (name) => `  "${name}": ${JSON.stringify(name === "pos" ? catalogue.pos.join(",") : catalogue[name])}`;
  const designations = Object.entries(catalogue.designations)
    .map(([index, d]) => `    "${index}": ${JSON.stringify(d)}`)
    .join(",\n");
  return `{\n${["pos", "mag"].map(column).join(",\n")},\n  "designations": {\n${designations}\n  }\n}\n`;
}

const SOURCE_PAGE = "https://www.cosmos.esa.int/web/hipparcos/catalogues";
const EPOCH_NOTE =
  "J1991.25 propagated to J2000 by proper motion; the ten stars without a solution keep their J1991.25 sexagesimal position";

/**
 * The two meta files' content. `pin` is HIPPARCOS_PIN, `fieldsUsed` HIPPARCOS_FIELDS_USED, `rows` the reader's rows (for
 * the stars positioned from RAhms/DEdms), `tables` the result of `parseTables`. Key order is the file's key order.
 */
export function buildMetas({
  pin,
  fieldsUsed,
  rows,
  bright,
  finder,
  tables,
  namedCount,
  designatedCount,
  overrides = {},
}) {
  const limits = { ...BUILD_LIMITS, ...overrides };
  const sexagesimal = rows.filter((r) => r.fromSexagesimal);
  const actual = sexagesimal.map((r) => r.hip).join(",");
  if (actual !== limits.sexagesimalHips.join(",")) {
    throw new Error(
      `Stars positioned from RAhms/DEdms: expected HIP ${limits.sexagesimalHips.join(", ")}, got ${actual}`,
    );
  }
  const common = {
    source: SOURCE_PAGE,
    url: pin.url,
    mirror: pin.mirror,
    file: "I/239/hip_main.dat",
    sha256: pin.sha256,
    bytes: pin.bytes,
    rows: pin.rows,
    epoch: EPOCH_NOTE,
    licence: "CC BY-NC 3.0 IGO",
    attribution: "Credit: ESA; ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200",
    commercialUse: "requires ESA authorisation",
    positionFromSexagesimal: {
      hips: sexagesimal.map((r) => r.hip),
      vmag: sexagesimal.map((r) => r.vmag),
      note: "J1991.25, no proper motion, not propagated",
    },
    fieldsUsed: fieldsUsed.map((f) => ({ ...f })),
  };
  const inputs = [
    {
      kind: "designations",
      name: "Wikidata",
      licence: "CC0 1.0",
      table: "scripts/data/star-designations.json",
      fetchedAt: tables.starsMeta.fetchedAt,
      counts: tables.starsMeta.counts,
      use: "Bayer letter and Flamsteed number by HIP number",
    },
    {
      kind: "names",
      name: "IAU Working Group on Star Names (WGSN)",
      licence: "public domain (IAU star names are not subject to copyright)",
      table: "scripts/data/iau-star-names.json",
      fetchedAt: tables.namesMeta.fetchedAt,
      counts: tables.namesMeta.counts,
      use: "proper name by HIP number",
    },
  ];
  const constellations =
    "constellation: IAU abbreviation from astronomy-engine Constellation() at the star's J2000 position";

  const brightMeta = {
    ...common,
    filter: `Vmag <= ${limits.brightMaxVmag}, Hipparcos stars with a position`,
    count: bright.length,
    namedCount,
    normalisations: [
      "Sorted by Vmag, then HIP number",
      "id is the Hipparcos (HIP) number",
      "RAdeg / DEdeg moved from J1991.25 to J2000 by linear proper motion (pmRA, pmDE over 8.75 years), then to a J2000 unit vector x, y, z, rounded to 5 dp; the ten stars without a solution use RAhms / DEdms unpropagated",
      `name: IAU WGSN proper name, kept only for the ${limits.brightestNamed} brightest stars that have one, plus Polaris (HIP ${limits.alwaysNamedHips.join(", ")})`,
      "No other Hipparcos field is read",
    ],
    inputs,
  };
  const finderMeta = {
    ...common,
    filter: `Vmag <= ${limits.finderMaxVmag}, Hipparcos stars with a position, finder chart depth`,
    count: finder.pos.length,
    designatedCount,
    normalisations: [
      "Sorted by Vmag rounded to 0.1 (Math.round(Vmag * 10)), then HIP number",
      "HIP numbers order the stars but are not stored: the file holds no HIP, only the order the HIP tie-break gives",
      "pos: one comma-joined string of integers, one per star, raCenti * 18001 + (decCenti + 9000), with raCenti the J2000 right ascension in 0.01 degrees (0..35999, 36000 wrapped to 0) and decCenti the declination in 0.01 degrees (-9000..9000); positions as in the bright file",
      "mag: runs of [tenths, count] over the sorted stars, tenths being the magnitude as an integer in 0.1",
      `designations: sparse, keyed by star index; each a tuple [bayer, flamsteed, con, proper] with null for an absent field (bayer: Greek abbreviation with a -n component suffix; flamsteed: integer), kept only for stars that have a Bayer letter, Flamsteed number or IAU name; ${constellations}`,
      "No other Hipparcos field is read",
    ],
    inputs,
  };
  return { brightMeta, finderMeta };
}
