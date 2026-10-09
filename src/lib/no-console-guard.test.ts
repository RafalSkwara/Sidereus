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
 * - An `eslint-disable` comment that names `no-console` is allowed only in the files below, with an exact count,
 *   and must give its reason after ` -- ` (split as ESLint does, so `---` counts too). A disable that names no
 *   rule silences `no-console` too, so it fails in any file, and so does an inline config comment that sets
 *   `no-console` (`/* eslint no-console: "off" *\/`), which turns the rule off without any disable.
 *
 * Resolving a config does not parse the file, so the whole tree stays cheap once the first config load is warm.
 * Blind spots (not a lint rule's job): `console` reached through an alias, `reportError`, thrown messages and
 * third-party request URLs; see context/foundation/test-plan.md §6.4.
 *
 * Config resolution is not proof that a rule runs: client `<script>` blocks in .astro files resolved to error here
 * while no rule ran on them (eslint-plugin-astro's virtual `X.astro/N.ts` failed the type-aware parser and the
 * plugin dropped the error; impl review F3). So the last case lints in-memory .astro samples end to end.
 */

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SRC_DIR = join(REPO_ROOT, "src");
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".astro", ".js", ".jsx", ".mjs", ".cjs"];
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

/** An existing .astro page whose path the in-memory samples borrow: a path that does not exist fails to parse. */
const ASTRO_SAMPLE_PATH = "src/pages/offline.astro";

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
/** ESLint's own split between a directive's rules and its description (`@eslint/plugin-kit`), end of line included. */
const REASON_SEPARATOR = /\s-{2,}(?:\s|$)/u;
/** An inline config comment (`/* eslint no-console: "off" *\/`) that sets no-console, among other rules or alone. */
const CONFIG_COMMENT = /\/\*\s*eslint\s[^*]*?\bno-console\s*:/g;

export interface DisableCounts {
  noConsole: number;
  /** no-console disables without a reason after ` -- `. */
  unreasoned: number;
  ruleless: number;
  configComments: number;
}

/** Counts `eslint-disable` comments naming `no-console` (and those without a reason), those naming no rule at all,
 * and inline config comments that set `no-console`. */
export function countDisables(source: string): DisableCounts {
  const counts: DisableCounts = { noConsole: 0, unreasoned: 0, ruleless: 0, configComments: 0 };
  for (const match of source.matchAll(DISABLE_DIRECTIVE)) {
    const [ruleList, ...reasonParts] = match[1].split("*/")[0].split(REASON_SEPARATOR);
    const rules = ruleList
      .split(",")
      .map((rule) => rule.trim())
      .filter((rule) => rule !== "");
    if (rules.length === 0) counts.ruleless++;
    else if (rules.includes("no-console")) {
      counts.noConsole++;
      if (reasonParts.join(" ").trim() === "") counts.unreasoned++;
    }
  }
  counts.configComments = [...source.matchAll(CONFIG_COMMENT)].length;
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
    ).toEqual({ noConsole: 4, unreasoned: 3, ruleless: 0, configComments: 0 });
  });

  it("splits the reason as ESLint does, so a longer dash run still names the rule", () => {
    expect(
      countDisables(
        [
          "// eslint-disable-next-line no-console --- reason",
          "x(); // eslint-disable-line no-console ---- why",
          "/* eslint-disable no-console -- a reason */",
          "// eslint-disable-next-line no-console --",
        ].join("\n"),
      ),
    ).toEqual({ noConsole: 4, unreasoned: 1, ruleless: 0, configComments: 0 });
  });

  it("counts inline config comments that set no-console", () => {
    expect(
      countDisables(
        [
          '/* eslint no-console: "off" */',
          "/* eslint no-console: 0 */",
          '/* eslint eqeqeq: "error", no-console: ["off"] */',
          '/* eslint eqeqeq: "error" */',
        ].join("\n"),
      ),
    ).toEqual({ noConsole: 0, unreasoned: 0, ruleless: 0, configComments: 3 });
  });

  it("flags a disable that names no rule", () => {
    expect(countDisables("// eslint-disable-next-line\n/* eslint-disable */\n// eslint-disable -- why")).toEqual({
      noConsole: 0,
      unreasoned: 0,
      ruleless: 3,
      configComments: 0,
    });
  });
});

describe("no-console guard", () => {
  let eslint: ESLint;

  beforeAll(() => {
    eslint = new ESLint({ cwd: REPO_ROOT });
  });

  it("checks the whole source tree", () => {
    expect(files.length).toBeGreaterThanOrEqual(300);
    for (const module of KNOWN_COORDINATE_MODULES) expect(files).toContain(module);
    for (const file of [...IGNORED, ...Object.keys(ALLOWED_DISABLES), ASTRO_SAMPLE_PATH]) expect(files).toContain(file);
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
    // ESLint loads its config lazily on the first lookup: ~10 s cold, then milliseconds per file.
  }, 30_000);

  it("allows no-console disables only where listed, with the exact count and a reason, and nothing that turns it off", () => {
    const violations: string[] = [];
    for (const file of files) {
      if (file === SELF) continue;
      const { noConsole, unreasoned, ruleless, configComments } = countDisables(
        readFileSync(join(REPO_ROOT, file), "utf8"),
      );
      const allowed = ALLOWED_DISABLES[file]?.count ?? 0;
      if (noConsole !== allowed) {
        violations.push(`${file}: ${String(noConsole)} no-console disable(s), allowed ${String(allowed)}`);
      }
      if (unreasoned > 0) violations.push(`${file}: ${String(unreasoned)} no-console disable(s) without a -- reason`);
      if (ruleless > 0) violations.push(`${file}: ${String(ruleless)} eslint-disable naming no rule`);
      if (configComments > 0) {
        violations.push(`${file}: ${String(configComments)} inline config comment(s) setting no-console`);
      }
    }
    expect(violations, "a new log needs an entry in ALLOWED_DISABLES with its reason").toEqual([]);
  });

  it("reports no-console inside .astro client scripts, plain and is:inline, end to end", async () => {
    const lint = async (script: string) => {
      const [result] = await eslint.lintText(`<div></div>\n\n${script}\n`, {
        filePath: join(REPO_ROOT, ASTRO_SAMPLE_PATH),
      });
      return result.messages
        .filter((message) => message.ruleId === "no-console")
        .map((message) => ({ severity: message.severity, line: message.line }));
    };
    expect(await lint("<script>\n  console.log(1);\n</script>"), "plain <script>").toEqual([{ severity: 2, line: 4 }]);
    expect(await lint("<script is:inline>\n  console.log(1);\n</script>"), "<script is:inline>").toEqual([
      { severity: 2, line: 4 },
    ]);
    // eslint-plugin-astro does not extract JSON scripts, so there is nothing to lint.
    expect(await lint('<script type="application/ld+json">\n  {"a": 1}\n</script>'), "JSON script").toEqual([]);
  }, 30_000);
});
