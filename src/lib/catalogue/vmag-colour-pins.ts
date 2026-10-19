/**
 * Test support, shared by `messier.test.ts` and `caldwell.test.ts` (openngc-galaxy-magnitudes, Phase 2): the checks
 * that tie each `overrides` entry of action `vMagColour` in a generated meta file to the data it describes. A pure
 * function over plain values, so the tests run it on the real files and on doctored in-memory copies (the generated
 * JSON is never edited). Nothing here is shipped.
 */

/** The reason's wording for a galaxy whose B-Mag is itself doubtful (NGC 4449, NGC 4565). */
const B_DOUBT_TEXT = "B-Mag may itself be too bright";
/** The reason's wording for a galaxy whose group median rests on the minimum number of galaxies. */
const THIN_MEDIAN_TEXT = "median of 3 galaxies";

export interface VMagColourExpectation {
  /** The ids the meta must correct, exactly: no more, no fewer. */
  readonly ids: readonly string[];
  /** The ids whose reason must name the doubt about B. */
  readonly bDoubt: readonly string[];
  /** The ids whose reason must name the three-galaxy median. */
  readonly thinMedian: readonly string[];
}

interface CatalogueMagnitudes {
  readonly id: string;
  readonly vMag: number;
  readonly bMag: number | null;
}

/** The problems found, each naming the id; an empty array means every `vMagColour` entry holds. */
export function vMagColourProblems(
  overrides: readonly unknown[],
  objects: readonly CatalogueMagnitudes[],
  expected: VMagColourExpectation,
): string[] {
  const problems: string[] = [];
  const entries = overrides.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && (entry as { action?: unknown }).action === "vMagColour",
  );
  const byId = new Map(objects.map((object) => [object.id, object]));

  for (const entry of entries) {
    const id = String(entry.id);
    const source = entry.source;
    if (typeof source !== "string" || !source.startsWith("https://")) {
      problems.push(`${id}: source is not an https URL`);
    }
    const object = byId.get(id);
    if (object === undefined) {
      problems.push(`${id}: no such object in the catalogue`);
    } else {
      if (entry.vMag !== object.vMag) {
        problems.push(`${id}: meta vMag ${String(entry.vMag)} differs from the data's ${object.vMag}`);
      }
      if (entry.bMag !== object.bMag) {
        problems.push(`${id}: meta bMag ${String(entry.bMag)} differs from the data's ${String(object.bMag)}`);
      }
    }
    const reason = typeof entry.reason === "string" ? entry.reason : "";
    if (expected.bDoubt.includes(id) && !reason.includes(B_DOUBT_TEXT)) {
      problems.push(`${id}: reason does not say "${B_DOUBT_TEXT}"`);
    }
    if (expected.thinMedian.includes(id) && !reason.includes(THIN_MEDIAN_TEXT)) {
      problems.push(`${id}: reason does not say "${THIN_MEDIAN_TEXT}"`);
    }
  }

  const found = entries.map((entry) => String(entry.id));
  for (const id of expected.ids) {
    if (!found.includes(id)) {
      problems.push(`${id}: missing vMagColour entry`);
    }
  }
  for (const id of new Set(found)) {
    if (!expected.ids.includes(id)) {
      problems.push(`${id}: unexpected vMagColour entry`);
    }
  }
  if (found.length !== new Set(found).size) {
    problems.push("a vMagColour entry is listed twice");
  }
  return problems;
}
