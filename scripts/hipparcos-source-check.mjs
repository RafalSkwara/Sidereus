#!/usr/bin/env node
/**
 * Confirms the pinned Hipparcos file without building anything: downloads `hip_main.dat` from the pinned URL (the one
 * network use here; the mirror is the reader's single retry), verifies byte length, row count and SHA-256, and prints
 * them with the star counts at V <= 4.5 and V <= 7.5 and the ten stars positioned from RAhms/DEdms.
 *
 * Exit 0 when the pin verifies and the counts are the recorded ones; non-zero with the reader's mismatch report
 * otherwise. The pin itself lives in scripts/lib/hipparcos.mjs and changes only by a deliberate edit.
 */
import { describeError, HIPPARCOS_PIN, readHipparcos } from "./lib/hipparcos.mjs";
import { BUILD_LIMITS } from "./lib/stars-build.mjs";

const BRIGHT_MAX_MAG = BUILD_LIMITS.brightMaxVmag;
const FINDER_MAX_MAG = BUILD_LIMITS.finderMaxVmag;
/** The counts of the pinned file, shared with the build's own limits. */
const EXPECTED_BRIGHT = BUILD_LIMITS.brightCount;
const EXPECTED_FINDER = BUILD_LIMITS.finderCount;
const EXPECTED_SEXAGESIMAL = BUILD_LIMITS.sexagesimalHips;

async function main() {
  const { rows, skipped, stats } = await readHipparcos();
  const atMost = (mag) => rows.filter((r) => r.vmag <= mag).length;
  const sexagesimal = rows.filter((r) => r.fromSexagesimal);

  console.log(`file: ${stats.url}${stats.url === HIPPARCOS_PIN.url ? "" : " (mirror)"}`);
  console.log(`sha256: ${stats.sha256}`);
  console.log(`bytes: ${stats.bytes}`);
  console.log(`rows: ${stats.rows}`);
  console.log(`rows without Vmag: ${skipped.map((s) => `HIP ${s.hip}`).join(", ")}`);
  console.log(`stars at V <= ${BRIGHT_MAX_MAG}: ${atMost(BRIGHT_MAX_MAG)}`);
  console.log(`stars at V <= ${FINDER_MAX_MAG}: ${atMost(FINDER_MAX_MAG)}`);
  console.log(`positioned from RAhms/DEdms (J1991.25, no proper motion, not propagated): ${sexagesimal.length}`);
  for (const r of sexagesimal) {
    console.log(`  HIP ${r.hip}  V ${r.vmag.toFixed(2)}  RA ${r.raDeg.toFixed(5)} deg  Dec ${r.decDeg.toFixed(5)} deg`);
  }

  const problems = [];
  if (atMost(BRIGHT_MAX_MAG) !== EXPECTED_BRIGHT) {
    problems.push(`expected ${EXPECTED_BRIGHT} stars at V <= ${BRIGHT_MAX_MAG}`);
  }
  if (atMost(FINDER_MAX_MAG) !== EXPECTED_FINDER) {
    problems.push(`expected ${EXPECTED_FINDER} stars at V <= ${FINDER_MAX_MAG}`);
  }
  if (sexagesimal.map((r) => r.hip).join(",") !== EXPECTED_SEXAGESIMAL.join(",")) {
    problems.push(`expected the sexagesimal stars HIP ${EXPECTED_SEXAGESIMAL.join(", ")}`);
  }
  if (problems.length > 0) {
    throw new Error(`The pin verified but the counts differ: ${problems.join("; ")}`);
  }
}

main().catch((err) => {
  console.error(describeError(err));
  process.exit(1);
});
