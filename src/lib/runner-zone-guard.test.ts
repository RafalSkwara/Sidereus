import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Runner-zone guard: no production module may read the runner's (process) time zone. Every night, date
 * and label must come from the site's IANA zone or from UTC, so the same inputs give the same answer on
 * a laptop in Warsaw and on an edge worker in UTC. The in-process runner-zone tables
 * (src/lib/engine/fixtures/runner-zones.ts) can only exercise code they call; this scan also covers pages
 * and islands.
 *
 * Scans every .ts, .tsx and .astro file under src/, excluding *.test.ts and the test-only
 * src/lib/engine/fixtures/ directory. Non-test helpers (test-fixtures.ts, test-helpers.ts) are scanned on
 * purpose. A false positive is fixed by narrowing the matcher below, never by a file allowlist.
 *
 * Known gap: a plain `Date#toLocaleString()` cannot be told apart from a number's `toLocaleString()`, so it is out of scope.
 */

const SRC_DIR = fileURLToPath(new URL("../", import.meta.url));
const FIXTURES_DIR = join(SRC_DIR, "lib", "engine", "fixtures");

export interface Violation {
  line: number;
  rule: string;
}

const LOCAL_ACCESSORS = "Hours|Date|Day|Month|FullYear|Minutes|Seconds|Milliseconds";

const SIMPLE_RULES: { rule: string; pattern: RegExp }[] = [
  {
    rule: "local Date getter/setter (use the getUTC*/setUTC* form or the site zone)",
    pattern: new RegExp(`\\.(?:get|set)(?:${LOCAL_ACCESSORS})\\s*\\(`, "g"),
  },
  { rule: "getTimezoneOffset", pattern: /\bgetTimezoneOffset\s*\(/g },
  {
    rule: "toLocaleDateString/toLocaleTimeString/toDateString/toTimeString (process zone)",
    pattern: /\.(?:toLocaleDateString|toLocaleTimeString|toDateString|toTimeString)\s*\(/g,
  },
];

/** Index just past the string, template or regex-free literal starting at `i` (a quote or backtick). */
function skipLiteral(src: string, i: number): number {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === quote) {
      return j + 1;
    }
    if (quote === "`" && c === "$" && src[j + 1] === "{") {
      let depth = 1;
      j += 2;
      while (j < src.length && depth > 0) {
        const d = src[j];
        if (d === '"' || d === "'" || d === "`") {
          j = skipLiteral(src, j);
          continue;
        }
        if (d === "{") depth++;
        if (d === "}") depth--;
        j++;
      }
      continue;
    }
    j++;
  }
  return j;
}

/** Splits the argument list whose `(` is at `open` into top-level arguments; `end` is the index of the matching `)`. */
function callArguments(src: string, open: number): { args: string[]; end: number } {
  const args: string[] = [];
  let depth = 0;
  let start = open + 1;
  let i = open + 1;
  while (i < src.length) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipLiteral(src, i);
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      depth++;
    } else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) {
        const last = src.slice(start, i).trim();
        if (last !== "") args.push(last);
        return { args, end: i };
      }
      depth--;
    } else if (c === "," && depth === 0) {
      args.push(src.slice(start, i).trim());
      start = i + 1;
    }
    i++;
  }
  return { args, end: src.length };
}

const isLiteral = (arg: string): boolean => /^["'`]/.test(arg);

/** A date-time literal (a time part after the date) that does not end in `Z` or a ±hh:mm offset parses in the runner's zone. */
function isZonelessDateTime(arg: string): boolean {
  if (!isLiteral(arg)) return false;
  const body = arg.slice(1, -1);
  const hasTime = /(?:\d|\})[T ](?:\d|\$\{)/.test(body);
  const hasZone = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(body);
  return hasTime && !hasZone;
}

function lineOf(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (src[i] === "\n") line++;
  return line;
}

/** Every runner-zone read in `source`, with its 1-based line. */
export function findRunnerZoneReads(source: string): Violation[] {
  const out: Violation[] = [];
  for (const { rule, pattern } of SIMPLE_RULES) {
    for (const m of source.matchAll(pattern)) out.push({ line: lineOf(source, m.index), rule });
  }
  for (const m of source.matchAll(/\bnew\s+Date\s*\(/g)) {
    const { args } = callArguments(source, m.index + m[0].length - 1);
    const line = lineOf(source, m.index);
    if (args.length >= 2 && !isLiteral(args[0])) {
      out.push({ line, rule: "multi-argument local new Date(y, m, ...) (use Date.UTC)" });
    }
    if (args.length >= 1 && isZonelessDateTime(args[0])) {
      out.push({ line, rule: "zoneless date-time string in new Date(...) (add Z or an offset)" });
    }
  }
  for (const m of source.matchAll(/\bDate\.parse\s*\(/g)) {
    const { args } = callArguments(source, m.index + m[0].length - 1);
    if (args.length >= 1 && isZonelessDateTime(args[0])) {
      out.push({
        line: lineOf(source, m.index),
        rule: "zoneless date-time string in Date.parse(...) (add Z or an offset)",
      });
    }
  }
  for (const m of source.matchAll(/\bIntl\.DateTimeFormat\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const { end } = callArguments(source, open);
    if (!/\btimeZone\b/.test(source.slice(open, end))) {
      out.push({ line: lineOf(source, m.index), rule: "Intl.DateTimeFormat without an explicit timeZone" });
    }
  }
  return out.sort((a, b) => a.line - b.line);
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (full === FIXTURES_DIR) continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx|astro)$/.test(entry) || entry.endsWith(".test.ts")) continue;
    out.push(full);
  }
  return out;
}

describe("runner-zone guard", () => {
  it("finds no read of the runner's time zone in any non-test source under src/", () => {
    const files = sourceFiles(SRC_DIR);
    expect(files.some((f) => f.endsWith("night.ts") || f.endsWith("tonight-date.ts"))).toBe(true);
    expect(files.some((f) => f.endsWith(".astro"))).toBe(true);
    expect(files.some((f) => f.includes(join("engine", "fixtures")))).toBe(false);
    const offenders = files.flatMap((file) =>
      findRunnerZoneReads(readFileSync(file, "utf8")).map(
        ({ line, rule }) => `${relative(SRC_DIR, file)}:${line} ${rule}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  describe("positive control: the matcher can fail", () => {
    const OFFENDING: [string, string][] = [
      ["const h = new Date().getHours();", "local getter"],
      ["d.getDate()", "local getter"],
      ["d.getDay()", "local getter"],
      ["d.getMonth()", "local getter"],
      ["d.getFullYear()", "local getter"],
      ["d.getMinutes()", "local getter"],
      ["d.setHours(0, 0, 0, 0);", "local setter"],
      ["d.setDate(d.getDate() + 1)", "local setter"],
      ["new Date().getTimezoneOffset()", "getTimezoneOffset"],
      ["d.toLocaleDateString()", "toLocale*String"],
      ['d.toLocaleTimeString("en", { hour: "2-digit" })', "toLocale*String"],
      ["d.toDateString()", "toDateString"],
      ["d.toTimeString()", "toTimeString"],
      ["new Date(2026, 9, 10)", "multi-argument new Date"],
      ["new Date(y, m, 1)", "multi-argument new Date"],
      ["new Date(year, month)", "multi-argument new Date"],
      ["const f = new Intl.DateTimeFormat();", "Intl.DateTimeFormat without timeZone"],
      ['new Intl.DateTimeFormat("en-GB")', "Intl.DateTimeFormat without timeZone"],
      ['new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" })', "Intl.DateTimeFormat without timeZone"],
      ["Intl.DateTimeFormat(tag, opts)", "Intl.DateTimeFormat without timeZone"],
      ['new Date("2026-10-24T20:00:00")', "zoneless date-time"],
      ['new Date("2026-10-24 20:00")', "zoneless date-time"],
      ["new Date(`${date}T20:00:00`)", "zoneless date-time"],
      ['Date.parse("2026-10-24T20:00:00")', "zoneless date-time"],
    ];
    const ALLOWED: [string, string][] = [
      ["d.getUTCHours()", "getUTC*"],
      ["d.setUTCDate(d.getUTCDate() + 1)", "setUTC*"],
      ["new Date(Date.UTC(2026, 9, 10))", "UTC constructor"],
      ["new Date(Date.UTC(2026, 9, 10) + n * HOUR_MS)", "design.astro form"],
      ["new Date(Math.max(a, b))", "verdict.ts form"],
      ["new Date(ms)", "epoch argument"],
      ["new Date()", "now"],
      ["Date.now()", "clock read"],
      ["new Intl.DateTimeFormat(tag, { timeZone, hour: '2-digit' })", "explicit zone"],
      ['new Intl.DateTimeFormat("en", { timeZone: site.timeZone })', "explicit zone"],
      ["const cache = new Map<string, Intl.DateTimeFormat>();", "type mention"],
      ["type P = Intl.DateTimeFormatPartTypes;", "type mention"],
      ['new Date("2026-10-24T20:00:00Z")', "UTC date-time"],
      ['new Date("2026-10-24T20:00:00+02:00")', "offset date-time"],
      ['new Date("2026-10-24T20:00:00.000-0700")', "offset date-time"],
      ['new Date("2026-10-24")', "date-only parses as UTC"],
      ["new Date(`${date}T20:00:00Z`)", "UTC template"],
      ['Date.parse("2026-10-24T20:00:00Z")', "UTC parse"],
    ];

    it.each(OFFENDING)("flags %s (%s)", (snippet) => {
      expect(findRunnerZoneReads(snippet).length).toBeGreaterThan(0);
    });

    it.each(ALLOWED)("does not flag %s (%s)", (snippet) => {
      expect(findRunnerZoneReads(snippet)).toEqual([]);
    });

    it("reports the line and the rule of each hit", () => {
      const hits = findRunnerZoneReads("const a = 1;\nconst h = new Date(0).getHours();\n");
      expect(hits).toHaveLength(1);
      expect(hits[0].line).toBe(2);
      expect(hits[0].rule).toContain("local Date getter");
    });
  });
});
