#!/usr/bin/env node
/**
 * Builds the bright-star catalogue from the HYG database (v4.1) at a pinned commit.
 *
 * Output (committed, never hand-edited):
 *   src/lib/catalogue/bright-stars.json       stars with mag <= 4.5 (Sol excluded), sorted by mag then id
 *   src/lib/catalogue/bright-stars.meta.json  provenance, licence, filter, counts
 *
 * HYG is CC BY-SA 4.0 (https://github.com/astronexus/HYG-Database, David Nash / astronexus). The
 * generated files are Adapted Material under the same licence; see src/lib/catalogue/LICENSE-DATA.md.
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
const SOL_ID = 0;
/** 925 at the pinned commit; the margin only absorbs a deliberate filter tweak. */
const EXPECTED_COUNT = 925;
const COUNT_MARGIN = 10;
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
      for (const key of ["id", "proper", "ra", "dec", "mag"]) {
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
    if (id === SOL_ID || mag > MAX_MAG) {
      continue;
    }
    const raHours = requireNumber(row, "ra", lineNo);
    const decDeg = requireNumber(row, "dec", lineNo);
    if (raHours < 0 || raHours >= 24 || decDeg < -90 || decDeg > 90) {
      throw new Error(`Line ${lineNo}: ra ${raHours} / dec ${decDeg} out of range`);
    }
    stars.push({ id, mag, raHours, decDeg, proper: row.proper.trim() });
  }
  if (header === null) {
    throw new Error("Source file is empty");
  }
  return stars;
}

function buildCatalogue(stars) {
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

async function main() {
  const catalogue = buildCatalogue(await readStars());
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

  await mkdir(OUT_DIR, { recursive: true });
  // One star per line keeps a regeneration's diff reviewable.
  const body = catalogue.map((s) => "  " + JSON.stringify(s)).join(",\n");
  await writeFile(path.join(OUT_DIR, "bright-stars.json"), `[\n${body}\n]\n`);
  await writeFile(path.join(OUT_DIR, "bright-stars.meta.json"), JSON.stringify(meta, null, 2) + "\n");
  console.log(`Wrote ${catalogue.length} stars (${namedCount} named) to ${path.relative(process.cwd(), OUT_DIR)}/`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
