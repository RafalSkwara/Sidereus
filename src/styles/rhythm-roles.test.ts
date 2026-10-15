import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Rhythm guard (ui-fact-rhythm): the guarded files space their content vertically with the rhythm roles from
 * `src/styles/global.css` (`line` 8 px, `group` 24 px, `item` 20 px: `mt-group`, `py-item`, `space-y-line`, …), never
 * with numeric steps, so the gap between lines, groups and items stays one rule instead of a per-file choice.
 *
 * It fails on every vertical spacing utility with a number, a `px`, an arbitrary value or a custom property
 * (`mt-4`, `sm:py-3`, `-mt-2`, `space-y-1.5`, `gap-y-2`, `mt-px`, `mt-[13px]`, `py-(--x)`), variants and negatives
 * included, unless it is a zero (`pt-0`, `last:pb-0`) or the file's allowlist still has one left for that token.
 * The allowlist is a count per token (`{ "mt-0.5": 1 }`): the first N uses are allowed, every use beyond N fails with
 * its file:line. It covers the few steps that are not rhythm: an icon's first-line nudge, a card's own padding, a 44 px
 * summary.
 *
 * A bare `gap-<n>` / `gap-px` / `gap-[…]` is vertical spacing when its class string also holds `flex-col` or `grid`
 * (variants included): a column's gap is its row spacing, and so is a grid's even with `grid-cols-2`, since the rows
 * are still spaced. In a flex row it is the horizontal gap and stays allowed. A "class string" is the text of one quoted
 * literal ("…" or '…' on one line, `…` on any number of lines) or of one `class="…"` attribute; a `flex-col` in one
 * literal of a `class:list` array and a `gap-2` in another are not seen together (a known limit, keep them in one).
 * A bare gap that is wanted goes on the same count allowlist (`"gap-3": 1`).
 *
 * Left out by the pattern on purpose: `scroll-mt-*` (the lookbehind) and horizontal `px-*` / `mx-*` / `gap-x-*`.
 * Comments are blanked first, as in `no-hardcoded-colors.test.ts`.
 *
 * The guard grows with the change: each phase adds the files it converts to `GUARDED`, with an exact count allowlist.
 */

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url));

/** A utility value: a number, `px`, an arbitrary value (`[13px]`) or a custom property (`(--x)`). */
const VALUE = String.raw`(?:\d+(?:\.\d+)?|px|\[[^\]\s]+\]|\([^)\s]+\))`;
/** What may precede a utility name: a leading minus and any variants (`sm:`, `md:hover:`). */
const LEAD = String.raw`(?<![\w-])-?(?:[a-z0-9-]+:)*`;

/** A vertical spacing utility with a number, `px`, an arbitrary value or a custom property, with variants and minus. */
export const VERTICAL_SPACING = new RegExp(String.raw`${LEAD}(?:(?:m|p)[tby]?|space-y|gap-y)-${VALUE}(?![\w.])`, "g");

/** A bare `gap-*` (both axes): vertical spacing only inside a column or a grid. */
export const BARE_GAP = new RegExp(String.raw`${LEAD}gap-${VALUE}(?![\w.])`, "g");

/** A flex column or a grid among a class string's utilities. */
const COLUMN_OR_GRID = /(?<![\w-])(?:[a-z0-9-]+:)*(?:flex-col|flex-col-reverse|grid|inline-grid)(?![\w-])/;

/** Token → how many times a file may use it, exactly as written. */
type Allowance = Readonly<Record<string, number>>;

/** File (relative to `src/`) → the tokens it may keep, with how many times. */
const GUARDED: Record<string, Allowance> = {
  // The icon's first-line nudge.
  "components/ui/Fact.astro": { "mt-0.5": 1 },
  "components/ui/FactList.astro": {},
  // The card's own padding and the value's nudge under its caption label.
  "components/ui/StatCard.astro": { "py-2": 1, "mt-0.5": 1 },
  "components/ui/StatPair.astro": {},
  // Phase 3: Targets, Planets and the Moon (`scroll-mt-4` and the zeros are outside the pattern).
  "components/tonight/TargetDetails.astro": {},
  "components/tonight/ObjectDetails.astro": {},
  "components/tonight/ObjectCard.astro": {},
  // The 44 px summary of an expandable row.
  "components/tonight/ObjectRow.astro": { "py-4": 1 },
  "components/tonight/PlanetCard.astro": {},
  "components/tonight/MoonCard.astro": {},
  "components/tonight/SolarSystemSection.astro": {},
  // The pill's own padding (the plan listed none; the chip's py-0.5 is not rhythm).
  "components/tonight/SeenTag.astro": { "py-0.5": 1 },
  // Phase 4: Sky events and Nights. The kind icon's first-line nudge, and the wrap gap between the name and the mark
  // when they wrap (the marks' own `gap-1` is a bare gap in a flex row).
  "components/tonight/SkyEventList.astro": { "mt-0.5": 1, "gap-y-1": 1 },
  "components/tonight/NightStrip.astro": {},
  // The skeleton's rows, nights and events layouts are on the roles. What stays: the header (the title's and the
  // context lines' offsets, the page wrapper's `pt-8`, the slow hint's `mt-6`) and the whole `layout="plan"` branch
  // (its night lines, legend and rows, as tall as SessionTimeline's). The plan branch belongs to S-08: re-measure
  // these counts after the S-08 rebase, whichever of them its conversion removes.
  "components/tonight/TonightPageSkeleton.astro": {
    "mt-1": 3,
    "sm:mt-2": 1,
    "mt-2": 1,
    "sm:mt-3": 1,
    "pt-8": 1,
    "mt-6": 2,
    "space-y-1.5": 1,
    "mt-5": 1,
    "gap-y-2": 1,
    "py-6": 1,
    "sm:py-5": 1,
    "mt-1.5": 1,
    "mt-3": 1,
  },
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

/** The class strings of `source`, each with its offset: quoted literals, plus multi-line `class="…"` attributes. */
function classStrings(source: string): { start: number; text: string }[] {
  const found: { start: number; text: string }[] = [];
  const patterns = [/"([^"\n]*)"/g, /'([^'\n]*)'/g, /`([^`]*)`/g, /\bclass\s*=\s*"([^"]*)"/g];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const text = match[1];
      found.push({ start: match.index + match[0].indexOf(text), text });
    }
  }
  return found;
}

/**
 * Every vertical spacing token in `source` that is neither zero nor within `allowed`, with its line: the numeric,
 * `px`, arbitrary and custom-property utilities, and a bare gap in a column or a grid. For a token with a count N
 * the first N uses (in file order) pass and each one after reports.
 */
export function findNumericSpacing(source: string, allowed: Allowance = {}): { line: number; token: string }[] {
  const text = blankComments(source);
  const found = new Map<number, string>();
  for (const match of text.matchAll(VERTICAL_SPACING)) found.set(match.index, match[0]);
  for (const { start, text: classes } of classStrings(text)) {
    if (!COLUMN_OR_GRID.test(classes)) continue;
    for (const match of classes.matchAll(BARE_GAP)) found.set(start + match.index, match[0]);
  }

  const left = new Map(Object.entries(allowed));
  const hits: { line: number; token: string }[] = [];
  for (const [index, token] of [...found].sort(([a], [b]) => a - b)) {
    if (isZero(token)) continue;
    const remaining = left.get(token) ?? 0;
    if (remaining > 0) {
      left.set(token, remaining - 1);
      continue;
    }
    hits.push({ line: text.slice(0, index).split("\n").length, token });
  }
  return hits;
}

/** The token a lone utility reports when it sits in a `div` with `classes` in front of it. */
function inDiv(classes: string): { line: number; token: string }[] {
  return findNumericSpacing(`<div class="${classes}">`);
}

describe("the rhythm guard's pattern", () => {
  it.each([
    "mt-4",
    "sm:py-3",
    "-mt-2",
    "space-y-1.5",
    "gap-y-2",
    "pb-5",
    "m-2",
    "p-4",
    "md:hover:mb-1",
    "first:pt-2",
    "mt-[13px]",
    "-mt-[2px]",
    "sm:py-[0.4rem]",
    "py-(--x)",
    "md:mb-(--gap)",
    "mt-px",
    "-mb-px",
    "space-y-[3px]",
    "gap-y-px",
    "gap-y-[5px]",
  ])("catches %s", (token) => {
    expect(inDiv(`flex ${token} items-start`)).toEqual([{ line: 1, token }]);
  });

  it.each([
    "mt-line",
    "py-item",
    "space-y-line",
    "gap-y-line",
    "mt-group",
    "scroll-mt-4",
    "scroll-mt-[13px]",
    "px-3",
    "px-px",
    "mx-2",
    "mx-[3px]",
    "gap-3",
    "gap-px",
    "gap-[3px]",
    "gap-x-5",
    "gap-x-px",
    "size-4",
    "w-72",
    "h-14",
    "pt-0",
    "last:pb-0",
    "first:pt-0",
    "text-label",
  ])("leaves %s alone", (token) => {
    expect(inDiv(`flex ${token} items-start`)).toEqual([]);
  });

  it.each([
    ["flex flex-col gap-2", "gap-2"],
    ["flex flex-col gap-px", "gap-px"],
    ["flex flex-col sm:gap-4", "sm:gap-4"],
    ["flex sm:flex-col gap-[3px]", "gap-[3px]"],
    ["grid gap-3", "gap-3"],
    ["grid grid-cols-2 gap-3", "gap-3"],
    ["md:grid gap-(--g)", "gap-(--g)"],
  ])("catches a bare gap in a column or grid: %s", (classes, token) => {
    expect(inDiv(classes)).toEqual([{ line: 1, token }]);
  });

  it.each([
    "flex gap-2",
    "flex items-center gap-2",
    "inline-flex gap-px",
    "flex flex-col gap-y-line",
    "flex flex-col gap-x-2",
    "flex flex-col gap-0",
    "grid-cols-2 gap-3",
  ])("leaves a bare gap outside a column or grid alone: %s", (classes) => {
    expect(inDiv(classes)).toEqual([]);
  });

  it("sees a column or grid and a bare gap in one multi-line class attribute, and reports the gap's line", () => {
    expect(findNumericSpacing(`<ul\n  class="flex\n    flex-col\n    gap-2"\n>`)).toEqual([
      { line: 4, token: "gap-2" },
    ]);
    expect(findNumericSpacing("const a = `\nflex flex-col\ngap-1`;")).toEqual([{ line: 3, token: "gap-1" }]);
  });

  it("does not pair a flex row's gap with another string's flex-col", () => {
    expect(findNumericSpacing(`<ul class="flex flex-col"><li class="flex gap-2">`)).toEqual([]);
  });

  it("keeps an allowed token and still reports another use of a step", () => {
    expect(findNumericSpacing(`<svg class="mt-0.5 size-4" /><p class="mt-4">`, { "mt-0.5": 1 })).toEqual([
      { line: 1, token: "mt-4" },
    ]);
  });

  it("allows a token only as many times as its count and reports each use beyond it", () => {
    const source = `<i class="mt-0.5" />\n<i class="mt-0.5" />\n<i class="mt-0.5" />`;
    expect(findNumericSpacing(source, { "mt-0.5": 1 })).toEqual([
      { line: 2, token: "mt-0.5" },
      { line: 3, token: "mt-0.5" },
    ]);
    expect(findNumericSpacing(source, { "mt-0.5": 3 })).toEqual([]);
    expect(findNumericSpacing(source)).toHaveLength(3);
  });

  it("counts an allowed bare gap the same way", () => {
    const source = `<div class="flex flex-col gap-3" />\n<div class="grid gap-3" />`;
    expect(findNumericSpacing(source, { "gap-3": 1 })).toEqual([{ line: 2, token: "gap-3" }]);
  });

  it("ignores comments", () => {
    expect(
      findNumericSpacing(
        `<!-- was mt-4 -->\n{/* py-5 before */}\n// space-y-3\n/* <div class="flex-col gap-2"> mt-[2px] */\n<p class="mt-line">`,
      ),
    ).toEqual([]);
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
