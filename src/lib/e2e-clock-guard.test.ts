import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The e2e clock guard (test-suite-diet Phase 6): no e2e test depends on the real wall-clock hour or date. The tests pin
 * the browser and the server to a named moment through the `test` of `tests/e2e/helpers.ts` (its automatic `clock`
 * fixture, `pinContext` for a hand-made context), so a spec that reads the clock itself, skips on a date or a night, or
 * bypasses the fixture is a bug. An allowlist, not heuristics: the only skips are the environmental ones named below.
 *
 * Scans `tests/e2e/*.spec.ts` and `helpers.ts`. `forecast-fixture.mjs`, `offline-proxy.ts` and `clock-scenarios.mjs`
 * are excluded by name: they are Node-side infrastructure that runs once, outside any test.
 *
 * Every rule has an in-memory violating and clean sample, so a matcher that stops matching fails here (the no-console
 * lesson: a guard needs a positive control).
 */

const E2E_DIR = fileURLToPath(new URL("../../tests/e2e/", import.meta.url));
const EXCLUDED = ["forecast-fixture.mjs", "offline-proxy.ts", "clock-scenarios.mjs", "clock-scenarios.d.mts"];
/** The one skip left: `requirePlanGrant` has no way to grant the plan locally (its CI twin throws). */
const ENVIRONMENTAL_SKIP = "no SUPABASE_SECRET_KEY";

type Rule = "skip" | "real-clock" | "wait" | "playwright-test-import" | "real-without-reason" | "new-context";
interface Hit {
  line: number;
  rule: Rule;
}

/** Comments blanked (line count kept), so a rule that quotes `Date.now()` in prose is not a hit. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|\s)\/\/[^\n]*/gm, (match, lead: string) => lead + " ".repeat(match.length - lead.length));
}

export function findClockViolations(source: string, file: "helpers.ts" | "spec"): Hit[] {
  const rawLines = source.split("\n");
  const lines = withoutComments(source).split("\n");
  const hits: Hit[] = [];
  const add = (index: number, rule: Rule) => hits.push({ line: index + 1, rule });

  lines.forEach((line, i) => {
    // Any skip or fixme, in any form (`if (x) test.skip(true, ...)` included), except the one environmental skip.
    if (/\.(skip|fixme)\s*\(/.test(line) && !(file === "helpers.ts" && rawLines[i].includes(ENVIRONMENTAL_SKIP))) {
      add(i, "skip");
    }
    if (/\bwaitForTimeout\s*\(/.test(line)) add(i, "wait");
    // The real clock: only the helpers (the fixture and `pinnedNow`) may read it.
    if (file === "spec" && /\bDate\.now\s*\(|\bnew Date\s*\(\s*\)|\bperformance\.now\s*\(/.test(line))
      add(i, "real-clock");
    if (/\.newContext\s*\(/.test(line) && file === "spec") {
      const reasoned = rawLines[i].includes("clock: real (") || (i > 0 && rawLines[i - 1].includes("clock: real ("));
      const pinned = lines.slice(i, i + 15).some((next) => /\bpinContext\s*\(/.test(next));
      if (!reasoned && !pinned) add(i, "new-context");
    }
  });

  if (file === "spec") {
    const stripped = withoutComments(source);
    for (const match of stripped.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']@playwright\/test["']/g)) {
      if (/\btest\b/.test(match[1])) {
        add(stripped.slice(0, match.index).split("\n").length - 1, "playwright-test-import");
      }
    }
  }
  lines.forEach((line, i) => {
    if (/test\.use\(\s*\{\s*clock:\s*["']real["']/.test(line)) {
      const reasoned = rawLines[i].includes("//") || (i > 0 && rawLines[i - 1].trim().startsWith("//"));
      if (!reasoned) add(i, "real-without-reason");
    }
  });
  return hits.sort((a, b) => a.line - b.line);
}

interface Sample {
  label: string;
  rule: Rule;
  file: "helpers.ts" | "spec";
  bad: string;
  good: string;
}

const SAMPLES: Sample[] = [
  {
    label: "a conditional skip, in any form",
    rule: "skip",
    file: "spec",
    bad: 'test("a", async () => {\n  if (x) test.skip(true, "no planet is up tonight");\n});',
    good: 'test("a", async () => {\n  expect(planets, "a planet is up on the pinned evening").toBeGreaterThan(0);\n});',
  },
  {
    label: "a test.fixme",
    rule: "skip",
    file: "spec",
    bad: 'test.fixme(true, "later");',
    good: "// the rule says test.fixme is not allowed\nconst skipped = 0;",
  },
  {
    label: "the environmental skip is allowed in helpers only",
    rule: "skip",
    file: "helpers.ts",
    bad: 'base.skip(true, "tonight is not editable");',
    good: 'base.skip(true, "no SUPABASE_SECRET_KEY");',
  },
  {
    label: "the real clock in a spec",
    rule: "real-clock",
    file: "spec",
    bad: "const now = Date.now();",
    good: "const now = pinnedNow().getTime();",
  },
  {
    label: "a no-argument new Date() in a spec",
    rule: "real-clock",
    file: "spec",
    bad: "const today = new Date();",
    good: 'const instant = new Date("2026-10-17T19:30:00Z");',
  },
  {
    label: "a waitForTimeout",
    rule: "wait",
    file: "spec",
    bad: "await page.waitForTimeout(1000);",
    good: "await expect.poll(() => page.url()).toMatch(/log/);",
  },
  {
    label: "test imported from @playwright/test",
    rule: "playwright-test-import",
    file: "spec",
    bad: 'import {\n  expect,\n  test,\n} from "@playwright/test";',
    good: 'import { expect, type Page } from "@playwright/test";\nimport { test } from "./helpers";',
  },
  {
    label: "a real-clock opt-out without a reason",
    rule: "real-without-reason",
    file: "spec",
    bad: 'const a = 1;\ntest.use({ clock: "real" });',
    good: '// clock: real (the worker compares its own real clock)\ntest.use({ clock: "real" });',
  },
  {
    label: "a hand-made context",
    rule: "new-context",
    file: "spec",
    bad: "const context = await browser.newContext({ baseURL: proxy.origin });\nawait context.newPage();",
    good: 'const context = await browser.newContext({ baseURL: proxy.origin });\nawait pinContext(context, "evening", proxy.origin);',
  },
  {
    label: "a hand-made context that says why it stays real",
    rule: "new-context",
    file: "spec",
    bad: "const context = await browser.newContext({ baseURL: proxy.origin });",
    good: "// clock: real (the worker's own clock decides expiry)\nconst context = await browser.newContext({ baseURL: proxy.origin });",
  },
];

describe("the e2e clock guard", () => {
  it("flags every violating sample under its own rule and no clean one (the samples first)", () => {
    expect(SAMPLES.length).toBe(10);
    expect(new Set(SAMPLES.map((sample) => sample.rule)).size, "every rule has a sample").toBe(6);
    for (const sample of SAMPLES) {
      expect(
        findClockViolations(sample.bad, sample.file).map((hit) => hit.rule),
        `should flag: ${sample.label}`,
      ).toContain(sample.rule);
      expect(findClockViolations(sample.good, sample.file), `should not flag: ${sample.label}`).toEqual([]);
    }
    // The helpers are the one place that may read the real clock (the fixture and `pinnedNow`).
    expect(findClockViolations("const real = Date.now() + new Date().getTime();", "helpers.ts")).toEqual([]);
  });

  it("finds no violation in any e2e spec or helper, and reports file:line when it does", () => {
    const specs = readdirSync(E2E_DIR).filter((name) => name.endsWith(".spec.ts"));
    expect(specs.length, "the specs scanned").toBeGreaterThanOrEqual(25);
    for (const name of EXCLUDED) {
      expect(readdirSync(E2E_DIR), `${name} is excluded by name and must exist`).toContain(name);
    }
    const found: string[] = [];
    const scan = (name: string, kind: "helpers.ts" | "spec") => {
      for (const hit of findClockViolations(readFileSync(join(E2E_DIR, name), "utf8"), kind)) {
        found.push(`tests/e2e/${name}:${String(hit.line)} ${hit.rule}`);
      }
    };
    for (const name of specs) scan(name, "spec");
    scan("helpers.ts", "helpers.ts");
    expect(found, "a spec reads the real clock, skips, or bypasses the clock fixture").toEqual([]);
  });
});
