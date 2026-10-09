import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Purity guard: the engine must not read the clock, the environment or the network, or touch the
 * filesystem. Identical inputs must give identical outputs (PRD determinism NFR), and the code
 * must run unchanged on the edge runtime. It must not log either: engine functions take a `Site`,
 * and coordinates never reach logs (eslint's `no-console` error covers all of src; this scan
 * keeps the engine's own guard).
 *
 * Scans every source file under src/lib/engine/ and src/lib/moon-disc/ (the browser-safe Moon-disc
 * drawing, moonlight-and-the-verdict), excluding test files and the test-only fixtures directory
 * (which legitimately use fs and the clock). The Moon-disc module must also stay browser-safe: it
 * imports neither astronomy-engine nor the engine, except the island-safe `@/lib/engine/parameters`.
 */

const ENGINE_DIR = fileURLToPath(new URL(".", import.meta.url));
const MOON_DISC_DIR = fileURLToPath(new URL("../moon-disc/", import.meta.url));
const LIB_DIR = fileURLToPath(new URL("../", import.meta.url));

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: "Date.now", pattern: /\bDate\.now\b/ },
  { name: "argument-less new Date()", pattern: /\bnew Date\(\s*\)/ },
  { name: "performance.now", pattern: /\bperformance\.now\b/ },
  { name: "Math.random", pattern: /\bMath\.random\b/ },
  { name: "process.env / process.", pattern: /\bprocess\.(env|hrtime|cwd|platform)\b/ },
  { name: "fetch(", pattern: /\bfetch\(/ },
  { name: "node:* import", pattern: /["']node:[a-z_/]+["']/ },
  { name: "bare fs import", pattern: /["']fs(\/promises)?["']/ },
  {
    name: "Intl.DateTimeFormat without an explicit time zone",
    pattern: /Intl\.DateTimeFormat\(\s*\)|Intl\.DateTimeFormat\(\s*["'][^"']*["']\s*\)/,
  },
  { name: "toLocale* (process locale/zone)", pattern: /\.toLocale(Date|Time)?String\(/ },
  { name: "console.* (coordinates never reach logs)", pattern: /\bconsole\./ },
];

/** Module specifiers of every static import, re-export and dynamic import in `source`. */
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)].map((m) => m[1]);
}

/**
 * Whether a Moon-disc module may import `specifier`: anything but astronomy-engine, the engine barrel or an engine
 * module other than `parameters` (by alias or by relative path).
 */
function isBrowserUnsafeImport(specifier: string): boolean {
  if (specifier === "astronomy-engine") {
    return true;
  }
  const engine = /^(?:@\/lib\/engine|(?:\.\.\/)+engine)(?:\/(.*))?$/.exec(specifier);
  return engine !== null && engine[1] !== "parameters";
}

function engineSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "fixtures") {
        continue;
      }
      out.push(...engineSourceFiles(full));
      continue;
    }
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) {
      continue;
    }
    out.push(full);
  }
  return out;
}

describe("engine purity guard", () => {
  it("finds no clock, env, network, filesystem or console access in any engine or Moon-disc source", () => {
    const files = [...engineSourceFiles(ENGINE_DIR), ...engineSourceFiles(MOON_DISC_DIR)];
    expect(files.some((f) => f.endsWith("sun.ts"))).toBe(true);
    expect(files.some((f) => f.endsWith("geometry.ts"))).toBe(true);
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return FORBIDDEN.filter(({ pattern }) => pattern.test(source)).map(
        ({ name }) => `${relative(LIB_DIR, file)}: ${name}`,
      );
    });
    expect(offenders).toEqual([]);
  });

  it("keeps the Moon-disc module browser-safe: no astronomy-engine and no engine import but parameters", () => {
    const files = engineSourceFiles(MOON_DISC_DIR);
    expect(files.some((f) => f.endsWith("state.ts"))).toBe(true);
    const offenders = files.flatMap((file) =>
      importSpecifiers(readFileSync(file, "utf8"))
        .filter(isBrowserUnsafeImport)
        .map((specifier) => `${relative(LIB_DIR, file)}: imports ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  it("recognises the imports the Moon-disc guard forbids", () => {
    expect(isBrowserUnsafeImport("astronomy-engine")).toBe(true);
    expect(isBrowserUnsafeImport("@/lib/engine")).toBe(true);
    expect(isBrowserUnsafeImport("@/lib/engine/moon")).toBe(true);
    expect(isBrowserUnsafeImport("../engine/moon-disc")).toBe(true);
    expect(isBrowserUnsafeImport("@/lib/engine/parameters")).toBe(false);
    expect(isBrowserUnsafeImport("./state")).toBe(false);
    expect(importSpecifiers('import type { A } from "x";\nexport { b } from \'y\';\nawait import("z");')).toEqual([
      "x",
      "y",
      "z",
    ]);
  });
});
