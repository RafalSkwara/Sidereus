#!/usr/bin/env node
/**
 * Builds the Messier and Caldwell catalogues from OpenNGC at a pinned commit.
 *
 * Output (committed, never hand-edited):
 *   src/lib/catalogue/messier.json        110 objects sorted by Messier number
 *   src/lib/catalogue/messier.meta.json   provenance, licence, overrides, type map
 *   src/lib/catalogue/caldwell.json       61 Caldwell objects (non-Messier, dec >= -23) sorted by Caldwell number
 *   src/lib/catalogue/caldwell.meta.json  provenance, licence, selection rule, overrides, normalisations
 *
 * OpenNGC is CC BY-SA 4.0 (https://github.com/mattiaverga/OpenNGC). The generated
 * files are Adapted Material under the same licence; see src/lib/catalogue/LICENSE-DATA.md.
 *
 * Re-running the script must produce byte-identical output. Nothing here reads the clock.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PINNED_SHA = "da90466031b0372c896588b85be6016c617e205b";
const PINNED_COMMIT_DATE = "2026-07-26";
const SOURCE_REPO = "https://github.com/mattiaverga/OpenNGC";
const RAW_BASE = `https://raw.githubusercontent.com/mattiaverga/OpenNGC/${PINNED_SHA}/database_files/`;
const SOURCE_FILES = ["NGC.csv", "addendum.csv"];
const EXPECTED_COUNT = 110;

/**
 * Caldwell selection: a Caldwell object is reachable from the PRD's 52° N reference latitude when it
 * clears the 15° default minimum altitude at culmination: 38 + dec >= 15, so dec >= -23 (PRD param 8).
 */
const MIN_DEC_DEG = -23;
/** 60 rows selected by rule plus the Double Cluster (C 14), which OpenNGC splits into two rows. */
const EXPECTED_CALDWELL_COUNT = 61;
const CALDWELL_SELECTION_RULE =
  "Rows of NGC.csv/addendum.csv whose Identifiers column holds a 'C <n>' token, whose M column is empty and whose declination is >= -23 deg (38 + dec >= 15 at 52 N with the 15 deg default minimum altitude); plus C 14 (NGC 869 + NGC 884) merged into one entry";
/** Index of the "Common names" column: the last one this script reads. */
const LAST_READ_COLUMN = "Common names";

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "catalogue");

/** OpenNGC type codes → catalogue types. An unknown code fails the build. */
const TYPE_MAP = {
  G: "galaxy",
  GCl: "globular-cluster",
  OCl: "open-cluster",
  PN: "planetary-nebula",
  Neb: "nebula",
  HII: "emission-nebula",
  RfN: "reflection-nebula",
  SNR: "supernova-remnant",
  "Cl+N": "cluster-with-nebula",
  "*Ass": "asterism",
  "**": "double-star",
  Other: "other",
};

/** Constellation codes OpenNGC splits that the catalogue keeps as one IAU abbreviation. */
const CONSTELLATION_MAP = { Se1: "Ser", Se2: "Ser" };

/** Deviations from the source, recorded in messier.meta.json. */
const OVERRIDES = [
  {
    messier: 102,
    action: "drop",
    sourceName: "M102",
    reason:
      "OpenNGC follows NED and lists M102 as a duplicate of M101 (type Dup). This catalogue follows the common observing identification instead.",
  },
  {
    messier: 102,
    action: "assign",
    sourceName: "NGC5866",
    reason: "NGC 5866 is listed as M102, matching Stellarium and most observing guides.",
  },
];

/**
 * Deviations from the source, recorded in caldwell.meta.json: the merged Double Cluster and any
 * `action: "vMag"` entry `{ caldwell, action, id, vMag, reason, source }` for an object with neither a
 * V-Mag nor a B-Mag in OpenNGC. The pinned commit has a B-Mag for every reachable object that lacks a
 * V-Mag, so there are none today. Every entry carries the https page its value was read from.
 */
const CALDWELL_OVERRIDES = [
  {
    caldwell: 14,
    action: "merge",
    sourceName: "NGC0869 + NGC0884",
    id: "NGC869",
    reason:
      "OpenNGC has no Caldwell token for the Double Cluster; its notes say 'Caldwell 14 refers to both NGC869 and NGC884'. The two rows are merged into one entry: RA/Dec are the midpoint, the major axis covers both clusters, V-Mag and B-Mag are the brighter of the two, surface brightness is null, the common name is 'Double Cluster'.",
    source: `${SOURCE_REPO}/blob/${PINNED_SHA}/database_files/NGC.csv`,
  },
];

async function fetchCsv(file) {
  const url = RAW_BASE + file;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function parseSemicolonCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const header = lines[0].split(";");
  return lines.slice(1).map((line) => {
    const cells = line.split(";");
    const row = { _fieldCount: cells.length };
    header.forEach((name, i) => {
      row[name] = cells[i] ?? "";
    });
    return row;
  });
}

function parseRaHours(value) {
  const [h, m, s] = value.split(":").map(Number);
  return round(h + m / 60 + s / 3600, 6);
}

function parseDecDegrees(value) {
  // Sign comes from the string, so "-00:30:00" stays negative.
  const sign = value.trim().startsWith("-") ? -1 : 1;
  const [d, m, s] = value.replace(/^[+-]/, "").split(":").map(Number);
  return round(sign * (d + m / 60 + s / 3600), 6);
}

function round(n, digits) {
  return Number(n.toFixed(digits));
}

function nullableNumber(value) {
  if (value === "") {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Non-numeric value "${value}" in a numeric column`);
  }
  return n;
}

function designationFor(name) {
  const match = /^(NGC|IC|Mel)0*(\d+)$/.exec(name);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  const messierOnly = /^M0*(\d+)$/.exec(name);
  if (messierOnly) {
    return `M${messierOnly[1]}`;
  }
  return name;
}

function commonNameFor(value) {
  const first = value
    .split(",")
    .map((s) => s.trim())
    .find((s) => s.length > 0);
  return first ?? null;
}

/** `options.vMag` replaces the row's V-Mag (the Caldwell fallbacks); `options.where` names the object in errors. */
function toMessierObject(row, messier, options = {}) {
  const type = TYPE_MAP[row.Type];
  if (type === undefined) {
    throw new Error(`Unknown OpenNGC type code "${row.Type}" on ${row.Name} (${options.where ?? `M${messier}`})`);
  }
  const constellation = CONSTELLATION_MAP[row.Const] ?? row.Const;
  const vMag = "vMag" in options ? options.vMag : nullableNumber(row["V-Mag"]);
  if (vMag === null) {
    throw new Error(`Missing V-Mag on ${row.Name} (${options.where ?? `M${messier}`})`);
  }
  // Key order here is the key order in messier.json; keep it stable.
  return {
    id: `M${messier}`,
    messier,
    designation: designationFor(row.Name),
    commonName: commonNameFor(row["Common names"]),
    type,
    raHours: parseRaHours(row.RA),
    decDeg: parseDecDegrees(row.Dec),
    constellation,
    majorAxisArcmin: nullableNumber(row.MajAx),
    minorAxisArcmin: nullableNumber(row.MinAx),
    vMag,
    bMag: nullableNumber(row["B-Mag"]),
    surfaceBrightness: nullableNumber(row.SurfBr),
  };
}

function buildCatalogue(rows) {
  const objects = [];
  for (const row of rows) {
    if (row.Name === "M102") {
      continue; // OVERRIDES[0]: the Dup row.
    }
    if (row.Name === "NGC5866") {
      objects.push(toMessierObject(row, 102)); // OVERRIDES[1]
      continue;
    }
    if (row.M === "") {
      continue;
    }
    objects.push(toMessierObject(row, Number(row.M)));
  }
  objects.sort((a, b) => a.messier - b.messier);

  const numbers = objects.map((o) => o.messier);
  const unique = new Set(numbers);
  if (objects.length !== EXPECTED_COUNT || unique.size !== EXPECTED_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_COUNT} distinct Messier objects, got ${objects.length} (${unique.size} distinct)`,
    );
  }
  for (let n = 1; n <= EXPECTED_COUNT; n++) {
    if (!unique.has(n)) {
      throw new Error(`Missing M${n}`);
    }
  }
  return objects;
}

/** "C 020, C 5" style token in the Identifiers column; the Caldwell number or null. */
function caldwellNumber(identifiers) {
  for (const token of identifiers.split(",")) {
    const match = /^C 0*(\d+)$/.exec(token.trim());
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

/** "NGC 7000" -> "NGC7000"; anything the log key grammar would reject fails the build. */
function idFromDesignation(designation) {
  const id = designation.replace(/\s+/g, "");
  if (!/^(NGC|IC)[1-9][0-9]{0,3}$/.test(id)) {
    throw new Error(`Caldwell id "${id}" (from "${designation}") is not NGC<n> or IC<n>`);
  }
  return id;
}

/** Angular separation of two J2000 positions in arcminutes (haversine). */
function separationArcmin(a, b) {
  const rad = Math.PI / 180;
  const dRa = (a.raHours - b.raHours) * 15 * rad;
  const dDec = (a.decDeg - b.decDeg) * rad;
  const h = Math.sin(dDec / 2) ** 2 + Math.cos(a.decDeg * rad) * Math.cos(b.decDeg * rad) * Math.sin(dRa / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(h)) * (180 / Math.PI) * 60;
}

function toCaldwellObject(row, caldwell, vMag) {
  const {
    id: _id,
    messier: _messier,
    designation,
    ...rest
  } = toMessierObject(row, caldwell, { vMag, where: `C ${caldwell}` });
  return { id: idFromDesignation(designation), messier: null, caldwell, designation, ...rest };
}

function buildDoubleCluster(rows) {
  const a = rows.find((r) => r.Name === "NGC0869");
  const b = rows.find((r) => r.Name === "NGC0884");
  if (!a || !b) {
    throw new Error("NGC0869 / NGC0884 rows missing for C 14");
  }
  const oa = toCaldwellObject(a, 14, nullableNumber(a["V-Mag"]));
  const ob = toCaldwellObject(b, 14, nullableNumber(b["V-Mag"]));
  const mid = {
    raHours: round((oa.raHours + ob.raHours) / 2, 6),
    decDeg: round((oa.decDeg + ob.decDeg) / 2, 6),
  };
  return {
    id: "NGC869",
    messier: null,
    caldwell: 14,
    designation: "NGC 869 / 884",
    commonName: "Double Cluster",
    type: oa.type,
    raHours: mid.raHours,
    decDeg: mid.decDeg,
    constellation: oa.constellation,
    // Extent covering both: centre separation plus each cluster's own radius.
    majorAxisArcmin: round(separationArcmin(oa, ob) + (oa.majorAxisArcmin + ob.majorAxisArcmin) / 2, 1),
    minorAxisArcmin: null,
    vMag: Math.min(oa.vMag, ob.vMag),
    bMag: Math.min(oa.bMag, ob.bMag),
    surfaceBrightness: null,
  };
}

function buildCaldwell(rows) {
  const lastReadIndex = Object.keys(rows[0]).indexOf(LAST_READ_COLUMN) - 1; // minus _fieldCount
  const overrides = new Map(CALDWELL_OVERRIDES.filter((o) => o.action === "vMag").map((o) => [o.id, o]));
  const usedOverrides = new Set();
  const bMagFallbacks = [];
  const objects = [];

  for (const row of rows) {
    const caldwell = caldwellNumber(row.Identifiers);
    if (caldwell === null || row.M !== "") {
      continue;
    }
    if (!/^\d\d:\d\d:\d\d(\.\d+)?$/.test(row.RA) || !/^[+-]\d\d:\d\d:\d\d(\.\d+)?$/.test(row.Dec)) {
      throw new Error(`Malformed RA/Dec on ${row.Name} (C ${caldwell}): "${row.RA}" "${row.Dec}"`);
    }
    if (parseDecDegrees(row.Dec) < MIN_DEC_DEG) {
      continue;
    }
    // A ';' inside a quoted note splits late columns; a row short of the last column we read is a mis-split.
    if (row._fieldCount < lastReadIndex + 1) {
      throw new Error(
        `${row.Name} (C ${caldwell}) has ${row._fieldCount} fields, fewer than the ${lastReadIndex + 1} read columns`,
      );
    }
    let vMag = nullableNumber(row["V-Mag"]);
    if (vMag === null) {
      const bMag = nullableNumber(row["B-Mag"]);
      const override = overrides.get(idFromDesignation(designationFor(row.Name)));
      if (bMag !== null) {
        vMag = bMag;
        bMagFallbacks.push(`${row.Name} (C ${caldwell}): vMag taken from B-Mag ${row["B-Mag"]} (V-Mag empty)`);
      } else if (override) {
        vMag = override.vMag;
        usedOverrides.add(override.id);
      } else {
        throw new Error(`Missing V-Mag and B-Mag on ${row.Name} (C ${caldwell}) and no override`);
      }
    }
    objects.push(toCaldwellObject(row, caldwell, vMag));
  }
  const unused = [...overrides.keys()].filter((id) => !usedOverrides.has(id));
  if (unused.length > 0) {
    throw new Error(
      `Unused magnitude overrides: ${unused.join(", ")} (OpenNGC has a magnitude, or the object left the selection)`,
    );
  }
  objects.push(buildDoubleCluster(rows));
  objects.sort((a, b) => a.caldwell - b.caldwell);

  const numbers = new Set(objects.map((o) => o.caldwell));
  const ids = new Set(objects.map((o) => o.id));
  if (
    objects.length !== EXPECTED_CALDWELL_COUNT ||
    numbers.size !== EXPECTED_CALDWELL_COUNT ||
    ids.size !== EXPECTED_CALDWELL_COUNT
  ) {
    throw new Error(
      `Expected ${EXPECTED_CALDWELL_COUNT} distinct Caldwell objects, got ${objects.length} (${numbers.size} numbers, ${ids.size} ids)`,
    );
  }
  return { objects, bMagFallbacks };
}

function assertDisjoint(messierObjects, caldwellObjects) {
  const messierDesignations = new Set(messierObjects.map((o) => o.designation.replace(/\s+/g, "")));
  for (const o of caldwellObjects) {
    if (messierDesignations.has(o.id)) {
      throw new Error(`${o.id} (C ${o.caldwell}) is also a Messier object`);
    }
  }
}

async function main() {
  const texts = await Promise.all(SOURCE_FILES.map(fetchCsv));
  const rows = texts.flatMap(parseSemicolonCsv);
  const objects = buildCatalogue(rows);
  const { objects: caldwellObjects, bMagFallbacks } = buildCaldwell(rows);
  assertDisjoint(objects, caldwellObjects);

  const meta = {
    source: SOURCE_REPO,
    files: SOURCE_FILES.map((f) => `database_files/${f}`),
    commit: PINNED_SHA,
    retrievedAt: PINNED_COMMIT_DATE,
    licence: "CC BY-SA 4.0",
    count: objects.length,
    overrides: OVERRIDES,
    normalisations: [
      "RA HH:MM:SS.ss -> decimal hours (6 dp); Dec ±DD:MM:SS.s -> decimal degrees (6 dp), sign taken from the string",
      "Constellation codes Se1/Se2 -> Ser",
      "Empty numeric fields -> null",
      "Designations: NGC0224 -> NGC 224, IC4715 -> IC 4715, Mel022 -> Mel 22, M040 -> M40",
      "commonName: first entry of the Common names column, or null",
    ],
    typeMap: TYPE_MAP,
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "messier.json"), JSON.stringify(objects, null, 2) + "\n");
  await writeFile(path.join(OUT_DIR, "messier.meta.json"), JSON.stringify(meta, null, 2) + "\n");

  const caldwellMeta = {
    source: SOURCE_REPO,
    files: SOURCE_FILES.map((f) => `database_files/${f}`),
    commit: PINNED_SHA,
    retrievedAt: PINNED_COMMIT_DATE,
    licence: "CC BY-SA 4.0",
    count: caldwellObjects.length,
    selection: CALDWELL_SELECTION_RULE,
    overrides: CALDWELL_OVERRIDES,
    normalisations: [
      "RA HH:MM:SS.ss -> decimal hours (6 dp); Dec ±DD:MM:SS.s -> decimal degrees (6 dp), sign taken from the string",
      "Constellation codes Se1/Se2 -> Ser",
      "Empty numeric fields -> null",
      "Designations: NGC0224 -> NGC 224, IC4715 -> IC 4715; ids drop the space: NGC7000, IC405",
      "commonName: first entry of the Common names column, or null",
      "vMag: the V-Mag column, else the B-Mag column (listed below), else a documented override",
      ...bMagFallbacks,
    ],
    typeMap: TYPE_MAP,
  };
  await writeFile(path.join(OUT_DIR, "caldwell.json"), JSON.stringify(caldwellObjects, null, 2) + "\n");
  await writeFile(path.join(OUT_DIR, "caldwell.meta.json"), JSON.stringify(caldwellMeta, null, 2) + "\n");
  console.log(
    `Wrote ${objects.length} Messier and ${caldwellObjects.length} Caldwell objects to ${path.relative(process.cwd(), OUT_DIR)}/`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
