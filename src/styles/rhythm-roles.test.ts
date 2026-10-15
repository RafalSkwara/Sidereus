import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Rhythm guard (ui-fact-rhythm): the guarded files space their content vertically with the rhythm roles from
 * `src/styles/global.css` (`line` 8 px, `group` 24 px, `item` 20 px: `mt-group`, `py-item`, `space-y-line`, …), never
 * with numeric steps, so the gap between lines, groups and items stays one rule instead of a per-file choice.
 *
 * It fails on every vertical spacing utility with a number (`mt-4`, `sm:py-3`, `-mt-2`, `space-y-1.5`, `gap-y-2`),
 * variants and negatives included, unless it is a zero (`pt-0`, `last:pb-0`) or on that file's allowlist (exact tokens,
 * for the few steps that are not rhythm: an icon's first-line nudge, a card's own padding, a 44 px summary).
 * Left out by the pattern on purpose: `scroll-mt-*` (the lookbehind), horizontal `px-*` / `mx-*`, and a bare `gap-<n>`
 * (a flex row's horizontal gap). Comments are blanked first, as in `no-hardcoded-colors.test.ts`.
 *
 * The guard grows with the change: each phase adds the files it converts to `GUARDED`, with an exact allowlist.
 */

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url));

/** A numeric vertical spacing utility, with any variants and a leading minus. */
export const NUMERIC_VERTICAL_SPACING =
  /(?<![\w-])-?(?:[a-z0-9-]+:)*(?:(?:m|p)[tby]?|space-y|gap-y)-\d+(?:\.\d+)?(?![\w.])/g;

/** File (relative to `src/`) → the numeric tokens it may keep, exactly as written. */
const GUARDED: Record<string, readonly string[]> = {
  // The icon's first-line nudge.
  "components/ui/Fact.astro": ["mt-0.5"],
  "components/ui/FactList.astro": [],
  // The card's own padding and the value's nudge under its caption label.
  "components/ui/StatCard.astro": ["py-2", "mt-0.5"],
  "components/ui/StatPair.astro": [],
  // Phase 3: Targets, Planets and the Moon (`scroll-mt-4` and the zeros are outside the pattern).
  "components/tonight/TargetDetails.astro": [],
  "components/tonight/ObjectDetails.astro": [],
  "components/tonight/ObjectCard.astro": [],
  // The 44 px summary of an expandable row.
  "components/tonight/ObjectRow.astro": ["py-4"],
  "components/tonight/PlanetCard.astro": [],
  "components/tonight/MoonCard.astro": [],
  "components/tonight/SolarSystemSection.astro": [],
  // The pill's own padding (the plan listed none; the chip's py-0.5 is not rhythm).
  "components/tonight/SeenTag.astro": ["py-0.5"],
};

/** Replaces comment text with spaces, keeping newlines so line numbers still match the file. */
function blankComments(source: string): string {
  const blank = (match: string) => match.replace(/[^\n]/g, " ");
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, blank)
      .replace(/<!--[\s\S]*?-->/g, blank)
      // `//` not preceded by `:` or a quote, so URLs such as https://… are kept.
      .replace(/(^|[^:"'`\\])(\/\/.*)$/gm, (_match, before: string, comment: string) => before + blank(comment))
  );
}

/** A zero value (`pt-0`, `last:pb-0`, `-mt-0`) is no spacing step at all. */
function isZero(token: string): boolean {
  return /-0(?:\.0+)?$/.test(token);
}

/** Every numeric vertical spacing token in `source` that is neither zero nor allowed, with its line. */
export function findNumericSpacing(source: string, allowed: readonly string[] = []): { line: number; token: string }[] {
  const hits: { line: number; token: string }[] = [];
  blankComments(source)
    .split("\n")
    .forEach((text, index) => {
      for (const found of text.matchAll(NUMERIC_VERTICAL_SPACING)) {
        const token = found[0];
        if (isZero(token) || allowed.includes(token)) continue;
        hits.push({ line: index + 1, token });
      }
    });
  return hits;
}

describe("the rhythm guard's pattern", () => {
  it.each(["mt-4", "sm:py-3", "-mt-2", "space-y-1.5", "gap-y-2", "pb-5", "m-2", "p-4", "md:hover:mb-1", "first:pt-2"])(
    "catches %s",
    (token) => {
      expect(findNumericSpacing(`<div class="flex ${token} items-start">`)).toEqual([{ line: 1, token }]);
    },
  );

  it.each([
    "mt-line",
    "py-item",
    "space-y-line",
    "gap-y-line",
    "mt-group",
    "scroll-mt-4",
    "px-3",
    "mx-2",
    "gap-3",
    "gap-x-5",
    "size-4",
    "w-72",
    "h-14",
    "pt-0",
    "last:pb-0",
    "first:pt-0",
    "text-label",
  ])("leaves %s alone", (token) => {
    expect(findNumericSpacing(`<div class="flex ${token} items-start">`)).toEqual([]);
  });

  it("keeps an allowed token and still reports another use of a step", () => {
    expect(findNumericSpacing(`<svg class="mt-0.5 size-4" /><p class="mt-4">`, ["mt-0.5"])).toEqual([
      { line: 1, token: "mt-4" },
    ]);
  });

  it("ignores comments", () => {
    expect(findNumericSpacing(`<!-- was mt-4 -->\n{/* py-5 before */}\n// space-y-3\n<p class="mt-line">`)).toEqual([]);
  });
});

describe("rhythm roles in the guarded files", () => {
  it.each(Object.entries(GUARDED))("%s uses the rhythm roles, not numeric vertical steps", (file, allowed) => {
    const offenders = findNumericSpacing(readFileSync(join(SRC_DIR, file), "utf8"), allowed).map(
      ({ line, token }) => `${file}:${String(line)} ${token}`,
    );
    expect(offenders).toEqual([]);
  });
});
