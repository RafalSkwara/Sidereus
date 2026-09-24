import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Purity guard: the engine must not read the clock, the environment or the network, or touch the
 * filesystem. Identical inputs must give identical outputs (PRD determinism NFR), and the code
 * must run unchanged on the edge runtime.
 *
 * Scans every source file under src/lib/engine/, excluding test files and the test-only fixtures
 * directory (which legitimately use fs and the clock).
 */

const ENGINE_DIR = fileURLToPath(new URL(".", import.meta.url));

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
];

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
  const files = engineSourceFiles(ENGINE_DIR);

  it("scans the engine sources", () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith("sun.ts"))).toBe(true);
  });

  for (const file of files) {
    it(`${relative(ENGINE_DIR, file)} has no clock, env, network or filesystem access`, () => {
      const source = readFileSync(file, "utf8");
      const hits = FORBIDDEN.filter(({ pattern }) => pattern.test(source)).map(({ name }) => name);
      expect(hits).toEqual([]);
    });
  }
});
