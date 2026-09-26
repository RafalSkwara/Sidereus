import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Colour guard (F-03): every colour comes from a theme token in `src/styles/global.css`, so both
 * themes stay complete. Fails on a Tailwind palette class, a hex colour or an rgb()/rgba() literal in
 * any `.astro`, `.tsx`, `.ts` or `.css` file under src/, listing each offending `file:line`.
 *
 * Scope choices, so non-colour `#` usage does not trip it:
 * - Comments (`// …`, `/* … *\/`, `<!-- … -->`) are blanked before matching: they render nothing, and
 *   may cite issue numbers such as #123.
 * - A hex match must be a CSS colour length (3, 4, 6 or 8 digits) and stand alone: not an `href`
 *   anchor, not a URL fragment (`/#…`), not an HTML entity (`&#…`), not part of a hyphenated id
 *   (`#add-site`).
 */

const SRC_DIR = fileURLToPath(new URL("..", import.meta.url));

const EXTENSIONS = [".astro", ".tsx", ".ts", ".css"];
const EXCLUDED_FILES = new Set(["global.css", "database.types.ts"]);

const PATTERNS: { name: string; pattern: RegExp }[] = [
  {
    name: "Tailwind palette class",
    pattern:
      /\b(?:text|bg|border|ring|fill|stroke|from|via|to|decoration|placeholder|divide|outline|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d+)?\b/g,
  },
  {
    name: "hex colour",
    pattern: /(?<!href=["'`{]*)(?<![&\w/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g,
  },
  { name: "rgb()/rgba()", pattern: /\brgba?\(/g },
];

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

function findColorLiterals(source: string): { line: number; name: string; match: string }[] {
  const hits: { line: number; name: string; match: string }[] = [];
  const lines = blankComments(source).split("\n");
  lines.forEach((text, index) => {
    for (const { name, pattern } of PATTERNS) {
      for (const found of text.matchAll(pattern)) {
        hits.push({ line: index + 1, name, match: found[0] });
      }
    }
  });
  return hits;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!EXTENSIONS.some((ext) => entry.endsWith(ext))) continue;
    if (entry.endsWith(".test.ts") || EXCLUDED_FILES.has(entry)) continue;
    out.push(full);
  }
  return out;
}

describe("no hard-coded colours outside global.css", () => {
  it("catches the patterns it guards", () => {
    const sample = [
      '<p class="text-slate-300/80 bg-white/5">',
      'const tone = "border-emerald-300";',
      "color: #0b1020;",
      "background: rgba(0, 0, 0, 0.5);",
    ].join("\n");
    expect(findColorLiterals(sample).map((hit) => hit.line)).toEqual([1, 1, 2, 3, 4]);
  });

  it("ignores non-colour uses of #, comments and token classes", () => {
    const sample = [
      '<a href="#add">Jump</a>',
      '<a href="#sites-heading">Sites</a>',
      "<span>&#123;</span>",
      'const link = "https://example.com/#abc";',
      "// fixed in #123, see also #cafe",
      "/* was text-amber-200 before F-03 */",
      "<!-- bg-slate-900 -->",
      '<p class="bg-surface text-heading border-border text-primary">',
    ].join("\n");
    expect(findColorLiterals(sample)).toEqual([]);
  });

  const files = sourceFiles(SRC_DIR);

  it("scans the app sources", () => {
    expect(files.some((f) => f.endsWith("Topbar.astro"))).toBe(true);
    expect(files.some((f) => f.endsWith("verdict-tones.ts"))).toBe(true);
  });

  it("finds no palette classes or colour literals", () => {
    const offenders = files.flatMap((file) =>
      findColorLiterals(readFileSync(file, "utf8")).map(
        ({ line, name, match }) => `${relative(SRC_DIR, file)}:${String(line)} ${name}: ${match}`,
      ),
    );
    expect(offenders).toEqual([]);
  });
});
