#!/usr/bin/env node
/**
 * Builds the Messier catalogue from OpenNGC at a pinned commit.
 *
 * Output (committed, never hand-edited):
 *   src/lib/catalogue/messier.json       110 objects sorted by Messier number
 *   src/lib/catalogue/messier.meta.json  provenance, licence, overrides, type map
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
    const row = {};
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
  return value === "" ? null : Number(value);
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

function toMessierObject(row, messier) {
  const type = TYPE_MAP[row.Type];
  if (type === undefined) {
    throw new Error(`Unknown OpenNGC type code "${row.Type}" on ${row.Name} (M${messier})`);
  }
  const constellation = CONSTELLATION_MAP[row.Const] ?? row.Const;
  const vMag = nullableNumber(row["V-Mag"]);
  if (vMag === null) {
    throw new Error(`Missing V-Mag on ${row.Name} (M${messier})`);
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

async function main() {
  const texts = await Promise.all(SOURCE_FILES.map(fetchCsv));
  const rows = texts.flatMap(parseSemicolonCsv);
  const objects = buildCatalogue(rows);

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
  console.log(`Wrote ${objects.length} Messier objects to ${path.relative(process.cwd(), OUT_DIR)}/`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
