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

import {
  colourGroupOf,
  colourOf,
  correctedV,
  groupMedians,
  MIN_GALAXY_BV,
  MIN_GROUP_SIZE,
} from "./lib/galaxy-colour.mjs";

const PINNED_SHA = "da90466031b0372c896588b85be6016c617e205b";
const PINNED_COMMIT_DATE = "2026-07-26";
const SOURCE_REPO = "https://github.com/mattiaverga/OpenNGC";
const RAW_BASE = `https://raw.githubusercontent.com/mattiaverga/OpenNGC/${PINNED_SHA}/database_files/`;
const SOURCE_FILES = ["NGC.csv", "addendum.csv"];
const EXPECTED_COUNT = 110;
/** Galaxies whose B-V is below MIN_GALAXY_BV (V from HyperLEDA's `vt`) or that have no V-Mag (B copied into V): 6 Messier, 6 Caldwell. */
const EXPECTED_COLOUR_CORRECTIONS = 12;

/**
 * Caldwell selection: a Caldwell object is reachable from the PRD's 52° N reference latitude when it
 * clears the 15° default minimum altitude at culmination: 38 + dec >= 15, so dec >= -23 (PRD param 8).
 */
const MIN_DEC_DEG = -23;
/** 60 rows selected by rule plus the Double Cluster (C 14), which OpenNGC splits into two rows. */
const EXPECTED_CALDWELL_COUNT = 61;
const CALDWELL_SELECTION_RULE =
  "Rows of NGC.csv/addendum.csv whose Identifiers column holds a 'C <n>' token, whose M column is empty and whose declination is >= -23 deg (38 + dec >= 15 at 52 N with the 15 deg default minimum altitude); plus C 14 (NGC 869 + NGC 884) merged into one entry";
/** Caldwell numbers reachable from 52 N that the pinned OpenNGC cannot supply, recorded in caldwell.meta.json. */
const CALDWELL_EXCLUDED = [
  {
    caldwell: 9,
    name: "Cave Nebula (Sh2-155)",
    reason: "Not in OpenNGC's NGC/IC rows (Sh2-155 has no NGC or IC number)",
  },
  { caldwell: 41, name: "Hyades (Mel 25)", reason: "Not in OpenNGC's NGC/IC identifiers (Mel 25 carries no C token)" },
  { caldwell: 99, name: "Coalsack Nebula", reason: "No OpenNGC row" },
];
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

/** One `normalisations` line, in both metas, for the galaxy V-Mag rule (the per-object record is under `overrides`). */
const COLOUR_NORMALISATION = `Galaxy V-Mag: where B-V would be below ${MIN_GALAXY_BV}, or OpenNGC has no V-Mag, V is B-Mag minus the median B-V of the catalogue's own credible galaxies of the same Hubble group (per object: overrides, action vMagColour)`;

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
 * Deviations from the source, recorded in caldwell.meta.json: the merged Double Cluster, any
 * `action: "designation"` entry `{ caldwell, action, sourceName, id, designation, reason, source }` that
 * relabels an object with the designation observing guides use (the row's data is kept), and any
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
  {
    caldwell: 49,
    action: "designation",
    sourceName: "NGC2238",
    id: "NGC2237",
    designation: "NGC 2237",
    reason:
      "OpenNGC puts the 'C 049' token on NGC2238, its row for the whole Rosette Nebula (HII). Caldwell lists, Stellarium and atlases call the Rosette NGC 2237, so the entry keeps NGC2238's data under that designation.",
    source: `${SOURCE_REPO}/blob/${PINNED_SHA}/database_files/NGC.csv`,
  },
  {
    caldwell: 50,
    action: "designation",
    sourceName: "NGC2239",
    id: "NGC2244",
    designation: "NGC 2244",
    reason:
      "OpenNGC puts the 'C 050' token on NGC2239 and lists NGC2244 as its duplicate (type Dup). The Rosette's cluster is known as NGC 2244 in Caldwell lists and observing guides, so the entry keeps NGC2239's data under that designation.",
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
    // Set after the columns so the header's key order (and lastReadIndex) is unchanged.
    row._quoted = cells.slice(0, header.indexOf(LAST_READ_COLUMN) + 1).some((cell) => cell.includes('"'));
    return row;
  });
}

/**
 * This parser splits on every ';' and knows nothing of quoting. A '"' in any column the generator reads
 * (up to "Common names") could hide a ';' that mis-splits the row, so it fails the build instead.
 */
function assertNoQuotedCells(row, where) {
  if (row._quoted) {
    throw new Error(`${row.Name} (${where}) has a '"' in a read column; the naive ';' split cannot be trusted`);
  }
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

/** A trimmed text column, or null when it is empty ("Sb", "SABc"; OpenNGC's Hubble type). */
function nullableText(value) {
  const text = (value ?? "").trim();
  return text === "" ? null : text;
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
    hubble: nullableText(row.Hubble),
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
  assertNoQuotedCells(a, "C 14");
  assertNoQuotedCells(b, "C 14");
  const oa = toCaldwellObject(a, 14, nullableNumber(a["V-Mag"]));
  const ob = toCaldwellObject(b, 14, nullableNumber(b["V-Mag"]));
  for (const [name, o] of [
    ["NGC0869", oa],
    ["NGC0884", ob],
  ]) {
    for (const field of ["raHours", "decDeg", "vMag", "bMag", "majorAxisArcmin"]) {
      if (o[field] === null || o[field] === undefined) {
        throw new Error(`${name} has no ${field}; the Double Cluster merge needs it`);
      }
    }
  }
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
    hubble: null,
  };
}

function buildCaldwell(rows) {
  const lastReadIndex = Object.keys(rows[0]).indexOf(LAST_READ_COLUMN) - 1; // minus _fieldCount
  const overrides = new Map(CALDWELL_OVERRIDES.filter((o) => o.action === "vMag").map((o) => [o.id, o]));
  const renames = new Map(CALDWELL_OVERRIDES.filter((o) => o.action === "designation").map((o) => [o.caldwell, o]));
  const usedOverrides = new Set();
  const usedRenames = new Set();
  const bMagFallbacks = [];
  const objects = [];
  let belowDecLimit = 0;

  for (const row of rows) {
    const caldwell = caldwellNumber(row.Identifiers);
    if (caldwell === null || row.M !== "") {
      continue;
    }
    if (!/^\d\d:\d\d:\d\d(\.\d+)?$/.test(row.RA) || !/^[+-]\d\d:\d\d:\d\d(\.\d+)?$/.test(row.Dec)) {
      throw new Error(`Malformed RA/Dec on ${row.Name} (C ${caldwell}): "${row.RA}" "${row.Dec}"`);
    }
    if (parseDecDegrees(row.Dec) < MIN_DEC_DEG) {
      belowDecLimit++;
      continue;
    }
    assertNoQuotedCells(row, `C ${caldwell}`);
    // A truncated row (short of the last column we read) is also a bad row.
    if (row._fieldCount < lastReadIndex + 1) {
      throw new Error(
        `${row.Name} (C ${caldwell}) has ${row._fieldCount} fields, fewer than the ${lastReadIndex + 1} read columns`,
      );
    }
    let vMag = nullableNumber(row["V-Mag"]);
    let fallbackText = null;
    if (vMag === null) {
      const bMag = nullableNumber(row["B-Mag"]);
      const override = overrides.get(idFromDesignation(designationFor(row.Name)));
      if (bMag !== null) {
        vMag = bMag;
        fallbackText = `${row.Name} (C ${caldwell}): vMag taken from B-Mag ${row["B-Mag"]} (V-Mag empty)`;
      } else if (override) {
        vMag = override.vMag;
        usedOverrides.add(override.id);
      } else {
        throw new Error(`Missing V-Mag and B-Mag on ${row.Name} (C ${caldwell}) and no override`);
      }
    }
    const object = toCaldwellObject(row, caldwell, vMag);
    const rename = renames.get(caldwell);
    if (rename) {
      if (row.Name !== rename.sourceName) {
        throw new Error(`C ${caldwell} designation override expects ${rename.sourceName}, found ${row.Name}`);
      }
      object.id = idFromDesignation(rename.designation);
      object.designation = rename.designation;
      usedRenames.add(caldwell);
    }
    objects.push(object);
    if (fallbackText !== null) {
      bMagFallbacks.push({ id: object.id, text: fallbackText });
    }
  }
  const unusedRenames = [...renames.keys()].filter((n) => !usedRenames.has(n));
  if (unusedRenames.length > 0) {
    throw new Error(`Unused designation overrides: C ${unusedRenames.join(", C ")}`);
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
  return { objects, bMagFallbacks, belowDecLimit };
}

/**
 * NED's single unfiltered magnitude for the two galaxies whose B-Mag may itself be too bright (a V computed from it
 * inherits the error). NED's values are read from its object pages (2026-10-19); they are not in OpenNGC's files.
 */
const B_MAG_DOUBT = {
  NGC4449: 9.99,
  NGC4565: 10.42,
};

/** The sentences that follow the rule in a correction's reason, for the galaxies it needs them for. */
function colourCaveats(id, bMag, groupCount) {
  const caveats = [];
  const ned = B_MAG_DOUBT[id];
  if (ned !== undefined) {
    caveats.push(
      `B-Mag may itself be too bright: NED's single unfiltered magnitude (${ned}) is about ${round(ned - bMag, 1)} mag fainter, so this V may be about 0.4 mag too bright.`,
    );
  }
  if (groupCount === MIN_GROUP_SIZE) {
    caveats.push(`The group is thin: the median of ${groupCount} galaxies is the minimum the build accepts.`);
  }
  return caveats;
}

/**
 * Corrects the V-Mag of every galaxy whose colour is impossible, in place (no other field and no key order changes):
 * B-V below MIN_GALAXY_BV (OpenNGC's V-Mag is HyperLEDA's `vt`, uncertainty about 1 mag), or no V-Mag at all (the
 * Caldwell B fallback, B-V 0 by construction). V = B-Mag minus the median B-V of the credible galaxies of the same
 * Hubble group, where the credible ones are the catalogue's own galaxies with an OpenNGC V-Mag and B-V of
 * MIN_GALAXY_BV or more. Returns the `overrides` entries (action "vMagColour") for each meta, in catalogue order.
 */
function applyColourCorrections(messierObjects, caldwellObjects, fallbackIds) {
  const galaxies = [...messierObjects, ...caldwellObjects].filter((o) => o.type === "galaxy");
  const medians = groupMedians(galaxies.filter((o) => !fallbackIds.has(o.id)));
  const source = `${SOURCE_REPO}/blob/${PINNED_SHA}/database_files/NGC.csv`;
  const entries = { messier: [], caldwell: [] };
  let count = 0;
  for (const galaxy of galaxies) {
    const fromFallback = fallbackIds.has(galaxy.id);
    const bv = colourOf(galaxy);
    if (!fromFallback && (bv === null || bv >= MIN_GALAXY_BV)) {
      continue;
    }
    const group = colourGroupOf(galaxy.hubble);
    const { median, count: groupCount } = medians[group];
    const fromVMag = fromFallback ? null : galaxy.vMag;
    const vMag = correctedV(galaxy.bMag, median);
    const rule = `V = B-Mag minus the median B-V (${median}) of the ${groupCount} credible galaxies of Hubble group ${group}.`;
    const was = fromFallback
      ? `OpenNGC has no V-Mag for this galaxy, so the B-Mag ${galaxy.bMag} was used as V (B-V of 0.00), which is impossible for a galaxy.`
      : `OpenNGC's V-Mag ${fromVMag} is HyperLEDA's vt (uncertainty about 1 mag); with B-Mag ${galaxy.bMag} it gives a B-V of ${bv.toFixed(2)}, which is impossible for a galaxy.`;
    const reason = [was, rule, ...colourCaveats(galaxy.id, galaxy.bMag, groupCount)].join(" ");
    galaxy.vMag = vMag;
    count++;
    (galaxy.messier !== null ? entries.messier : entries.caldwell).push({
      id: galaxy.id,
      action: "vMagColour",
      fromVMag,
      vMag,
      bMag: galaxy.bMag,
      hubble: galaxy.hubble,
      group,
      medianBV: median,
      groupCount,
      reason,
      source,
    });
  }
  if (count !== EXPECTED_COLOUR_CORRECTIONS) {
    throw new Error(`Expected ${EXPECTED_COLOUR_CORRECTIONS} colour corrections, got ${count}`);
  }
  return { entries, medians };
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
  const { objects: caldwellObjects, bMagFallbacks, belowDecLimit } = buildCaldwell(rows);
  assertDisjoint(objects, caldwellObjects);
  const fallbackIds = new Set(bMagFallbacks.map((f) => f.id));
  const { entries: colourEntries, medians } = applyColourCorrections(objects, caldwellObjects, fallbackIds);

  const meta = {
    source: SOURCE_REPO,
    files: SOURCE_FILES.map((f) => `database_files/${f}`),
    commit: PINNED_SHA,
    retrievedAt: PINNED_COMMIT_DATE,
    licence: "CC BY-SA 4.0",
    count: objects.length,
    overrides: [...OVERRIDES, ...colourEntries.messier],
    normalisations: [
      "RA HH:MM:SS.ss -> decimal hours (6 dp); Dec ±DD:MM:SS.s -> decimal degrees (6 dp), sign taken from the string",
      "Constellation codes Se1/Se2 -> Ser",
      "Empty numeric fields -> null",
      "Designations: NGC0224 -> NGC 224, IC4715 -> IC 4715, Mel022 -> Mel 22, M040 -> M40",
      "commonName: first entry of the Common names column, or null",
      COLOUR_NORMALISATION,
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
    excluded: [
      ...CALDWELL_EXCLUDED,
      { reason: `Below dec ${MIN_DEC_DEG} deg, not reachable from 52 N`, count: belowDecLimit },
    ],
    overrides: [...CALDWELL_OVERRIDES, ...colourEntries.caldwell],
    normalisations: [
      "RA HH:MM:SS.ss -> decimal hours (6 dp); Dec ±DD:MM:SS.s -> decimal degrees (6 dp), sign taken from the string",
      "Constellation codes Se1/Se2 -> Ser",
      "Empty numeric fields -> null",
      "Designations: NGC0224 -> NGC 224, IC4715 -> IC 4715; ids drop the space: NGC7000, IC405",
      "commonName: first entry of the Common names column, or null",
      "vMag: the V-Mag column, else the B-Mag column (listed below), else a documented override (galaxies: see overrides, action vMagColour)",
      COLOUR_NORMALISATION,
      ...bMagFallbacks.filter((f) => !colourEntries.caldwell.some((e) => e.id === f.id)).map((f) => f.text),
    ],
    typeMap: TYPE_MAP,
  };
  await writeFile(path.join(OUT_DIR, "caldwell.json"), JSON.stringify(caldwellObjects, null, 2) + "\n");
  await writeFile(path.join(OUT_DIR, "caldwell.meta.json"), JSON.stringify(caldwellMeta, null, 2) + "\n");
  console.log(
    `Colour corrections: ${Object.entries(medians)
      .map(([group, m]) => `${group} median B-V ${m.median} (${m.count} galaxies)`)
      .join(", ")}`,
  );
  console.log(
    `Wrote ${objects.length} Messier and ${caldwellObjects.length} Caldwell objects to ${path.relative(process.cwd(), OUT_DIR)}/`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
