#!/usr/bin/env node
/**
 * Builds the star catalogues from the HYG database (v4.1) at a pinned commit, both from one download.
 *
 * Output (committed, never hand-edited):
 *   src/lib/catalogue/bright-stars.json       stars with mag <= 4.5 (Sol excluded), sorted by mag then id
 *   src/lib/catalogue/bright-stars.meta.json  provenance, licence, filter, counts
 *   src/lib/catalogue/finder-stars.json       stars with mag <= 7.5 (Sol excluded), sorted by mag then id, as
 *                                             columnar integers (server-only; the finder chart's star field)
 *   src/lib/catalogue/finder-stars.meta.json  provenance, licence, filter, counts
 *
 * HYG is CC BY-SA 4.0 (https://github.com/astronexus/HYG-Database, David Nash / astronexus). The
 * generated files are Adapted Material under the same licence; see src/lib/catalogue/LICENSE-DATA.md.
 * HYG compiles ESA's Hipparcos catalogue (CC BY-NC 3.0 IGO, "Credit: ESA"): that upstream condition
 * stays, see the same file.
 *
 * The 34 MB source is streamed line by line. Re-running the script must produce byte-identical
 * output. Nothing here reads the clock.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const PINNED_SHA = "c7f7f883fe678cc7680169a50ccd7dcc49b060ce";
const PINNED_COMMIT_DATE = "2025-02-14";
const SOURCE_REPO = "https://github.com/astronexus/HYG-Database";
const SOURCE_FILE = "hyg/CURRENT/hygdata_v41.csv";
const SOURCE_URL = `https://raw.githubusercontent.com/astronexus/HYG-Database/${PINNED_SHA}/${SOURCE_FILE}`;
const MAX_MAG = 4.5;
/** The finder chart's depth: HYG's even completeness ends near 7.5. */
const FINDER_MAX_MAG = 7.5;
const SOL_ID = 0;
/** 925 at the pinned commit; the margin only absorbs a deliberate filter tweak. */
const EXPECTED_COUNT = 925;
const COUNT_MARGIN = 10;
/** 25,791 at the pinned commit; the margin only absorbs a deliberate filter tweak. */
const FINDER_EXPECTED_COUNT = 25791;
const FINDER_COUNT_MARGIN = 50;
const BRIGHTEST_NAMED = 40;
/** Named beyond the brightest 40: the northern pole star, the anchor a beginner finds first. */
const ALWAYS_NAMED = ["Polaris"];
const NAMED_COUNT = BRIGHTEST_NAMED + ALWAYS_NAMED.length;
const VECTOR_DIGITS = 5;

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "catalogue");

/** Splits one CSV line; HYG quotes text fields with `"` and doubles embedded quotes. */
function parseCsvLine(line, lineNo) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (quoted) {
    throw new Error(`Line ${lineNo}: unterminated quoted field`);
  }
  cells.push(cell);
  return cells;
}

function requireNumber(row, key, lineNo) {
  const value = row[key];
  const n = value === "" ? Number.NaN : Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Line ${lineNo}: non-numeric ${key} "${value}"`);
  }
  return n;
}

function round(n, digits) {
  return Number(n.toFixed(digits));
}

/** J2000 unit vector from RA (hours) and Dec (degrees): x towards the equinox, z towards the pole. */
function unitVector(raHours, decDeg) {
  const ra = (raHours * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return {
    x: round(Math.cos(dec) * Math.cos(ra), VECTOR_DIGITS),
    y: round(Math.cos(dec) * Math.sin(ra), VECTOR_DIGITS),
    z: round(Math.sin(dec), VECTOR_DIGITS),
  };
}

async function readStars() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok || res.body === null) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${res.status} ${res.statusText}`);
  }
  const lines = createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity });

  let header = null;
  let lineNo = 0;
  const stars = [];
  for await (const line of lines) {
    lineNo++;
    if (line.length === 0) {
      continue;
    }
    const cells = parseCsvLine(line, lineNo);
    if (header === null) {
      header = cells;
      for (const key of ["id", "proper", "ra", "dec", "mag", "bayer", "flam", "con"]) {
        if (!header.includes(key)) {
          throw new Error(`Source header has no "${key}" column`);
        }
      }
      continue;
    }
    if (cells.length !== header.length) {
      throw new Error(`Line ${lineNo}: ${cells.length} cells, header has ${header.length}`);
    }
    const row = {};
    header.forEach((name, i) => {
      row[name] = cells[i];
    });

    const id = requireNumber(row, "id", lineNo);
    if (!Number.isInteger(id) || id < 0) {
      throw new Error(`Line ${lineNo}: id "${row.id}" is not a non-negative integer`);
    }
    const mag = requireNumber(row, "mag", lineNo);
    if (id === SOL_ID || mag > FINDER_MAX_MAG) {
      continue;
    }
    const raHours = requireNumber(row, "ra", lineNo);
    const decDeg = requireNumber(row, "dec", lineNo);
    if (raHours < 0 || raHours >= 24 || decDeg < -90 || decDeg > 90) {
      throw new Error(`Line ${lineNo}: ra ${raHours} / dec ${decDeg} out of range`);
    }
    stars.push({
      id,
      mag,
      raHours,
      decDeg,
      proper: row.proper.trim(),
      bayer: row.bayer.trim(),
      flam: row.flam.trim(),
      con: row.con.trim(),
    });
  }
  if (header === null) {
    throw new Error("Source file is empty");
  }
  return stars;
}

/** The bright-star output: stars to MAX_MAG, the fields and guards it has always had. */
function buildCatalogue(allStars) {
  const stars = allStars.filter((s) => s.mag <= MAX_MAG);
  stars.sort((a, b) => a.mag - b.mag || a.id - b.id);

  if (Math.abs(stars.length - EXPECTED_COUNT) > COUNT_MARGIN) {
    throw new Error(`Expected ${EXPECTED_COUNT} ± ${COUNT_MARGIN} stars at mag <= ${MAX_MAG}, got ${stars.length}`);
  }
  const ids = new Set(stars.map((s) => s.id));
  if (ids.size !== stars.length) {
    throw new Error("Duplicate HYG ids in the filtered set");
  }

  let named = 0;
  return stars.map((s) => {
    // Key order here is the key order in bright-stars.json; keep it stable.
    const entry = { id: s.id, mag: s.mag, ...unitVector(s.raHours, s.decDeg) };
    if (s.proper !== "" && (named < BRIGHTEST_NAMED || ALWAYS_NAMED.includes(s.proper))) {
      entry.name = s.proper;
      named++;
    }
    return entry;
  });
}

/** Declination in 0.01 degrees runs -9000..9000, so `pos` packs right ascension as raCenti * 18001 + (decCenti + 9000). */
const DEC_CENTI_MAX = 9000;
const POS_DEC_RANGE = 2 * DEC_CENTI_MAX + 1;

/** Position in 0.01 degrees; right ascension wraps so a value that rounds up to 360 degrees becomes 0. */
function centiDegrees(degrees, wrap) {
  const n = Math.round(degrees * 100);
  return wrap ? n % 36000 : n;
}

/**
 * The finder output: stars to FINDER_MAX_MAG as columnar integers (position packed into one integer, mag as runs in 0.1),
 * and a sparse table of designations keyed by the star's index in those columns. HYG ids decide the order but are
 * not stored (the packed file has to stay small: see finder-stars.test.ts for the size budget).
 */
function buildFinderCatalogue(allStars) {
  // Sorted by the magnitude the file stores (tenths), so a reader can verify the order from the file alone.
  const stars = allStars.map((s) => ({ ...s, tenths: Math.round(s.mag * 10) }));
  stars.sort((a, b) => a.tenths - b.tenths || a.id - b.id);

  if (Math.abs(stars.length - FINDER_EXPECTED_COUNT) > FINDER_COUNT_MARGIN) {
    throw new Error(
      `Expected ${FINDER_EXPECTED_COUNT} ± ${FINDER_COUNT_MARGIN} stars at mag <= ${FINDER_MAX_MAG}, got ${stars.length}`,
    );
  }
  const ids = new Set(stars.map((s) => s.id));
  if (ids.size !== stars.length) {
    throw new Error("Duplicate HYG ids in the finder set");
  }

  const catalogue = { pos: [], mag: [], designations: {} };
  const runs = catalogue.mag;
  stars.forEach((s, index) => {
    const raCenti = centiDegrees(s.raHours * 15, true);
    const decCenti = centiDegrees(s.decDeg, false);
    catalogue.pos.push(raCenti * POS_DEC_RANGE + (decCenti + DEC_CENTI_MAX));
    const last = runs[runs.length - 1];
    if (last !== undefined && last[0] === s.tenths) {
      last[1]++;
    } else {
      runs.push([s.tenths, 1]);
    }
    if (s.bayer !== "" || s.flam !== "" || s.proper !== "") {
      if (s.con === "") {
        throw new Error(`HYG id ${s.id} has a designation but no constellation`);
      }
      let flamsteed = null;
      if (s.flam !== "") {
        flamsteed = Number(s.flam);
        if (!Number.isInteger(flamsteed) || flamsteed <= 0) {
          throw new Error(`HYG id ${s.id}: Flamsteed number "${s.flam}" is not a positive integer`);
        }
      }
      // [bayer, flamsteed, con, proper], null for an absent field; the order is the file's format.
      const entry = [s.bayer === "" ? null : s.bayer, flamsteed, s.con, s.proper === "" ? null : s.proper];
      catalogue.designations[index] = entry;
    }
  });
  return catalogue;
}

/** One array per line and one designation per line keep a regeneration's diff reviewable. */
function finderJson(catalogue) {
  const column = (name) => `  "${name}": ${JSON.stringify(catalogue[name])}`;
  const designations = Object.entries(catalogue.designations)
    .map(([index, d]) => `    "${index}": ${JSON.stringify(d)}`)
    .join(",\n");
  return `{\n${["pos", "mag"].map(column).join(",\n")},\n  "designations": {\n${designations}\n  }\n}\n`;
}

async function main() {
  const allStars = await readStars();
  const catalogue = buildCatalogue(allStars);
  const finder = buildFinderCatalogue(allStars);
  const namedCount = catalogue.filter((s) => s.name !== undefined).length;
  if (namedCount !== NAMED_COUNT) {
    throw new Error(`Expected ${NAMED_COUNT} named stars, got ${namedCount}`);
  }

  const meta = {
    source: SOURCE_REPO,
    url: SOURCE_URL,
    file: SOURCE_FILE,
    commit: PINNED_SHA,
    commitDate: PINNED_COMMIT_DATE,
    licence: "CC BY-SA 4.0",
    attribution: "HYG database, David Nash / astronexus",
    filter: `mag <= ${MAX_MAG}, Sol (id ${SOL_ID}) excluded`,
    count: catalogue.length,
    namedCount,
    normalisations: [
      "Sorted by mag, then HYG id",
      `ra (hours) / dec (degrees) -> J2000 unit vector x, y, z, rounded to ${VECTOR_DIGITS} dp`,
      `name: HYG proper, kept only for the ${BRIGHTEST_NAMED} brightest stars that have one, plus ${ALWAYS_NAMED.join(", ")}`,
      "All other HYG columns dropped",
    ],
  };

  const designatedCount = Object.keys(finder.designations).length;
  const finderMeta = {
    source: SOURCE_REPO,
    url: SOURCE_URL,
    file: SOURCE_FILE,
    commit: PINNED_SHA,
    commitDate: PINNED_COMMIT_DATE,
    licence: "CC BY-SA 4.0",
    attribution: "HYG database, David Nash / astronexus; Hipparcos, Credit: ESA (CC BY-NC 3.0 IGO)",
    filter: `mag <= ${FINDER_MAX_MAG}, Sol (id ${SOL_ID}) excluded`,
    count: finder.pos.length,
    designatedCount,
    normalisations: [
      "Sorted by mag (rounded to 0.1), then HYG id",
      "pos: one integer per star, raCenti * 18001 + (decCenti + 9000), with raCenti the right ascension in 0.01 degrees (0..35999, 36000 wrapped to 0) and decCenti the declination in 0.01 degrees (-9000..9000)",
      "mag: runs of [tenths, count] over the sorted stars, tenths being the magnitude as an integer in 0.1",
      "HYG ids order the stars but are not stored",
      "designations: sparse, keyed by star index; each a tuple [bayer, flamsteed, con, proper] with null for an absent field (HYG bayer: Greek abbreviation with a -n component suffix; flam: integer), kept only for stars that have a bayer, flam or proper",
      "All other HYG columns dropped",
    ],
  };

  await mkdir(OUT_DIR, { recursive: true });
  // One star per line keeps a regeneration's diff reviewable.
  const body = catalogue.map((s) => "  " + JSON.stringify(s)).join(",\n");
  await writeFile(path.join(OUT_DIR, "bright-stars.json"), `[\n${body}\n]\n`);
  await writeFile(path.join(OUT_DIR, "bright-stars.meta.json"), JSON.stringify(meta, null, 2) + "\n");
  await writeFile(path.join(OUT_DIR, "finder-stars.json"), finderJson(finder));
  await writeFile(path.join(OUT_DIR, "finder-stars.meta.json"), JSON.stringify(finderMeta, null, 2) + "\n");
  console.log(`Wrote ${catalogue.length} stars (${namedCount} named) to ${path.relative(process.cwd(), OUT_DIR)}/`);
  console.log(
    `Wrote ${finder.pos.length} finder stars (${designatedCount} designated) to ${path.relative(process.cwd(), OUT_DIR)}/`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
