import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Import guard for the Fact family (ui-fact-rhythm): `Fact`, `FactList`, `StatCard`, `StatPair` are Astro components
 * and `fact-icons.ts` pulls in the whole lucide icon set, so no browser island may import them. The islands that
 * would be tempted to (the Moon slider, Tonight's live sky and the sky-view maths) already hold a positive import
 * allowlist in `MoonTimeSlider.test.ts` and `TonightSkyView.test.ts`; this guard names the Fact family explicitly,
 * so the rule survives a widened allowlist. Pass-through facts reach an island only as props or `ReactNode` slots.
 */

const SKY_VIEW_DIR = fileURLToPath(new URL("../../lib/sky-view/", import.meta.url));

const ISLANDS = [
  fileURLToPath(new URL("../tonight/MoonTimeSlider.tsx", import.meta.url)),
  fileURLToPath(new URL("../tonight/TonightSkyView.tsx", import.meta.url)),
  ...readdirSync(SKY_VIEW_DIR)
    .filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".test.ts"))
    .map((name) => SKY_VIEW_DIR + name),
];

const FACT_FAMILY = new Set(["Fact", "FactList", "StatCard", "StatPair", "fact-icons"]);

/** Module specifiers of every static import, re-export and dynamic import in `source`. */
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)].map((m) => m[1]);
}

/** Whether `specifier` reaches a Fact component or `fact-icons`, by alias or by a relative path, with or without an extension. */
function isFactFamilyImport(specifier: string): boolean {
  const last = specifier.split("/").pop() ?? "";
  return FACT_FAMILY.has(last.replace(/\.(?:astro|tsx?)$/, ""));
}

describe("island Fact-family import guard", () => {
  it("scans the Moon slider, the live sky and every sky-view module", () => {
    expect(ISLANDS.length).toBeGreaterThanOrEqual(8);
    expect(ISLANDS.some((source) => source.endsWith("MoonTimeSlider.tsx"))).toBe(true);
    expect(ISLANDS.some((source) => source.endsWith("TonightSkyView.tsx"))).toBe(true);
    expect(ISLANDS.some((source) => source.endsWith("rotate.ts"))).toBe(true);
  });

  it("never imports Fact, FactList, StatCard, StatPair or fact-icons", () => {
    const offenders = ISLANDS.flatMap((source) =>
      importSpecifiers(readFileSync(source, "utf8"))
        .filter(isFactFamilyImport)
        .map((specifier) => `${source.slice(source.indexOf("/src/") + 1)} imports ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  it.each([
    "@/components/ui/Fact",
    "@/components/ui/Fact.astro",
    "@/components/ui/FactList",
    "@/components/ui/StatCard",
    "@/components/ui/StatPair.astro",
    "@/components/ui/fact-icons",
    "../ui/fact-icons.ts",
    "./Fact.astro",
  ])("recognises %s", (specifier) => {
    expect(isFactFamilyImport(specifier)).toBe(true);
  });

  it.each(["@/components/ui/button", "@/components/ui/Tile", "@/lib/sky-view/labels", "react", "@/i18n"])(
    "leaves %s alone",
    (specifier) => {
      expect(isFactFamilyImport(specifier)).toBe(false);
    },
  );
});
