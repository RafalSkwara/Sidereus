import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * No-console guard (PRD coordinate-privacy NFR): a site's coordinates must never reach a log, and any module may
 * come to carry them, so no source file under src may log. This proves the property file by file without knowing
 * which modules handle coordinates:
 *
 * - ESLint's own `calculateConfigForFile` must give every source file `no-console` at error. A narrower `files`
 *   list in eslint.config.js, or a later config that turns the rule down, fails here with the file's name.
 * - An `eslint-disable` comment that names `no-console` is allowed only in the files below, with an exact count
 *   and a reason. A disable that names no rule silences `no-console` too, so it fails in any file.
 *
 * Resolving a config does not parse the file, so the whole tree stays cheap once the first config load is warm.
 * Blind spots (not a lint rule's job): `console` reached through an alias, `reportError`, thrown messages and
 * third-party request URLs; see context/foundation/test-plan.md §6.4.
 */

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SRC_DIR = join(REPO_ROOT, "src");
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".astro", ".js", ".mjs"];
const SELF = "src/lib/no-console-guard.test.ts";

/** Files ESLint ignores on purpose (eslint.config.js `generatedIgnores`): they resolve to no config at all. */
const IGNORED = new Set(["src/lib/database.types.ts"]);

/** Every file allowed to disable `no-console`, with the exact number of disables and why. */
const ALLOWED_DISABLES: Partial<Record<string, { count: number; reason: string }>> = {
  "src/lib/tonight/build.ts": {
    count: 1,
    reason: "the Session plan's failure trace: a fixed line and the error's name only, never its message",
  },
  "src/lib/engine/calibration.test.ts": {
    count: 1,
    reason: "the opt-in calibration snapshot (CALIBRATION_SNAPSHOT=1) over fixed test nights",
  },
  "src/lib/engine/determinism.test.ts": { count: 2, reason: "engine and ranking timings printed for CI" },
};

/** Coordinate-handling modules that must be among the checked files (non-vacuity). */
const KNOWN_COORDINATE_MODULES = ["src/lib/gear/store.ts", "src/lib/engine/index.ts", "src/i18n/messages/en.ts"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension)) ? [path] : [];
  });
}

const DISABLE_DIRECTIVE = /(?:\/\/|\/\*)\s*eslint-disable(?:-next-line|-line)?(?=[\s*]|$)([^\n]*)/gm;

export interface DisableCounts {
  noConsole: number;
  ruleless: number;
}

/** Counts `eslint-disable` comments naming `no-console`, and those naming no rule at all. */
export function countDisables(source: string): DisableCounts {
  const counts: DisableCounts = { noConsole: 0, ruleless: 0 };
  for (const match of source.matchAll(DISABLE_DIRECTIVE)) {
    const body = match[1].split("*/")[0];
    const rules = body
      .split(/\s--\s|\s--$/)[0]
      .split(",")
      .map((rule) => rule.trim())
      .filter((rule) => rule !== "");
    if (rules.length === 0) counts.ruleless++;
    else if (rules.includes("no-console")) counts.noConsole++;
  }
  return counts;
}

function severity(setting: unknown): unknown {
  return Array.isArray(setting) ? setting[0] : setting;
}

const files = sourceFiles(SRC_DIR)
  .map((path) => relative(REPO_ROOT, path))
  .sort();

describe("countDisables", () => {
  it("counts next-line, line and block disables naming no-console, with or without a reason", () => {
    expect(
      countDisables(
        [
          "// eslint-disable-next-line no-console",
          "x(); // eslint-disable-line no-console -- reason",
          "/* eslint-disable no-console */",
          "/* eslint-disable react-hooks/exhaustive-deps, no-console */",
          "/* eslint-enable no-console */",
          "// eslint-disable-next-line no-control-regex",
        ].join("\n"),
      ),
    ).toEqual({ noConsole: 4, ruleless: 0 });
  });

  it("flags a disable that names no rule", () => {
    expect(countDisables("// eslint-disable-next-line\n/* eslint-disable */\n// eslint-disable -- why")).toEqual({
      noConsole: 0,
      ruleless: 3,
    });
  });
});

describe("no-console guard", () => {
  let eslint: ESLint;

  beforeAll(() => {
    eslint = new ESLint({ cwd: REPO_ROOT });
  }, 30_000);

  it("checks the whole source tree", () => {
    expect(files.length).toBeGreaterThanOrEqual(300);
    for (const module of KNOWN_COORDINATE_MODULES) expect(files).toContain(module);
    for (const file of [...IGNORED, ...Object.keys(ALLOWED_DISABLES)]) expect(files).toContain(file);
  });

  it("gives every source file no-console at error", async () => {
    const violations: string[] = [];
    for (const file of files) {
      const config = (await eslint.calculateConfigForFile(join(REPO_ROOT, file))) as
        { rules?: Record<string, unknown> } | undefined;
      if (config === undefined) {
        if (!IGNORED.has(file)) violations.push(`${file}: ignored by ESLint, so never linted`);
        continue;
      }
      const level = severity(config.rules?.["no-console"]);
      if (level !== 2 && level !== "error") violations.push(`${file}: no-console is ${JSON.stringify(level ?? "off")}`);
    }
    expect(violations, "every source file under src needs no-console at error (eslint.config.js)").toEqual([]);
  }, 30_000);

  it("allows no-console disables only where listed, with the exact count, and no rule-less disable", () => {
    const violations: string[] = [];
    for (const file of files) {
      if (file === SELF) continue;
      const { noConsole, ruleless } = countDisables(readFileSync(join(REPO_ROOT, file), "utf8"));
      const allowed = ALLOWED_DISABLES[file]?.count ?? 0;
      if (noConsole !== allowed) {
        violations.push(`${file}: ${String(noConsole)} no-console disable(s), allowed ${String(allowed)}`);
      }
      if (ruleless > 0) violations.push(`${file}: ${String(ruleless)} eslint-disable naming no rule`);
    }
    expect(violations, "a new log needs an entry in ALLOWED_DISABLES with its reason").toEqual([]);
  });
});
