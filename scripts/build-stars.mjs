#!/usr/bin/env node
/**
 * Builds the star catalogues from the Hipparcos Catalogue, Version 1 (ESA 1997, VizieR I/239 `hip_main.dat`), both
 * from one download.
 *
 * Output (committed, never hand-edited):
 *   bright-stars.json       stars with Vmag <= 4.5, sorted by Vmag then HIP number, one per line
 *   bright-stars.meta.json  provenance, licence, filter, counts
 *   finder-stars.json       stars with Vmag <= 7.5, sorted by Vmag in tenths then HIP number, as columnar integers
 *                           (server-only; the finder chart's star field)
 *   finder-stars.meta.json  provenance, licence, filter, counts
 * Written to src/lib/catalogue/, or to the directory in STARS_OUT_DIR (scratch runs: the comparison with the committed
 * files is made before they are replaced).
 *
 * Source: the pinned, checksummed `hip_main.dat` read by scripts/lib/hipparcos.mjs (nothing is written until its length,
 * row count and SHA-256 match). The Hipparcos Catalogue is CC BY-NC 3.0 IGO, "Credit: ESA": the generated files are
 * Adapted Material, commercial use needs ESA's written authorisation, see src/lib/catalogue/LICENSE-DATA.md. Positions
 * are J1991.25 moved to J2000 by proper motion; the ten stars without an astrometric solution keep the J1991.25 position
 * of the file's RAhms / DEdms fields. The HIP number is the id and the tie-break of both files' order.
 *
 * Names and designations come only from the two committed tables in scripts/data/ (Wikidata, CC0, and the IAU WGSN list,
 * public domain), written by `npm run stars:designations`; this build makes no other network call. The constellation is
 * astronomy-engine's Constellation() at each designated star's J2000 position.
 *
 * Re-running the script must produce byte-identical output. Nothing here reads the clock.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Constellation } from "astronomy-engine";
import { HIPPARCOS_FIELDS_USED, HIPPARCOS_PIN, readHipparcos } from "./lib/hipparcos.mjs";
import {
  BUILD_LIMITS,
  brightJson,
  buildBrightCatalogue,
  buildFinderCatalogue,
  buildMetas,
  finderJson,
  parseTables,
} from "./lib/stars-build.mjs";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const DESIGNATIONS_FILE = path.join(SCRIPTS_DIR, "data", "star-designations.json");
const NAMES_FILE = path.join(SCRIPTS_DIR, "data", "iau-star-names.json");
const DEFAULT_OUT_DIR = path.resolve(SCRIPTS_DIR, "..", "src", "lib", "catalogue");
const OUT_DIR = process.env.STARS_OUT_DIR ? path.resolve(process.env.STARS_OUT_DIR) : DEFAULT_OUT_DIR;

/** The constellation's IAU abbreviation ("And") at a J2000 position, right ascension in hours. */
function constellationOf(raHours, decDeg) {
  return Constellation(raHours, decDeg).symbol;
}

async function main() {
  const tables = parseTables({
    designationsText: await readFile(DESIGNATIONS_FILE, "utf8"),
    namesText: await readFile(NAMES_FILE, "utf8"),
  });
  const { rows, stats } = await readHipparcos();

  const bright = buildBrightCatalogue(rows, tables.names);
  const finder = buildFinderCatalogue(rows, { ...tables, constellationOf });
  const namedCount = bright.filter((s) => s.name !== undefined).length;
  const designatedCount = Object.keys(finder.designations).length;
  const { brightMeta, finderMeta } = buildMetas({
    pin: HIPPARCOS_PIN,
    fieldsUsed: HIPPARCOS_FIELDS_USED,
    rows,
    bright,
    finder,
    tables,
    namedCount,
    designatedCount,
  });

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "bright-stars.json"), brightJson(bright));
  await writeFile(path.join(OUT_DIR, "bright-stars.meta.json"), JSON.stringify(brightMeta, null, 2) + "\n");
  await writeFile(path.join(OUT_DIR, "finder-stars.json"), finderJson(finder));
  await writeFile(path.join(OUT_DIR, "finder-stars.meta.json"), JSON.stringify(finderMeta, null, 2) + "\n");

  const relative = path.relative(process.cwd(), OUT_DIR);
  const where = relative === "" ? "." : relative.startsWith("..") ? OUT_DIR : relative;
  console.log(`Read ${stats.rows} Hipparcos rows from ${stats.url} (sha256 ${stats.sha256})`);
  console.log(`Wrote ${bright.length} stars (${namedCount} named) to ${where}/`);
  console.log(
    `Wrote ${finder.pos.length} finder stars (${designatedCount} designated, ${BUILD_LIMITS.sexagesimalHips.length} positioned from RAhms/DEdms) to ${where}/`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
