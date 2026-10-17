import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The one import guard for the browser islands (merged from the Moon slider's, Tonight's live sky's and the Fact
 * family's guards of moonlight-and-the-verdict, interactive-sky and ui-fact-rhythm). An island runs in the browser, so:
 *
 * - the Moon card's slider (`MoonTimeSlider.tsx`, the `MoonDisc` it hydrates and `range-classes.ts`) may import only
 *   React, the browser-safe Moon-disc drawing (`@/lib/moon-disc/*`), the engine's island-safe `parameters`, the message
 *   catalogue, `cn`, `buttonVariants`, `MoonDisc` and `range-classes`;
 * - Tonight's live sky (`TonightSkyView.tsx`, `range-classes.ts`, every `@/lib/sky-view/*` module, the island-safe star
 *   catalogue `stars.ts` / `star-names.ts` and `compass.ts`) may import only React, `@/lib/sky-view/*`, the star
 *   catalogue, `sky-band`, `range-classes`, the compass, the message catalogue, `cn`, `buttonVariants`, `SegmentedGroup`, the sky-view control and `lucide-react`;
 * - neither may import astronomy-engine, the engine barrel or an engine module, `@/lib/tonight/format`, or
 *   `@/lib/catalogue` / `./index` (which would ship `messier.json` to the browser);
 * - no island (the slider, the live sky, every sky-view module) may import `Fact`, `FactList`, `StatCard`, `StatPair`,
 *   `fact-icons` or `progress-icons` (Astro components, and icon sets built on the whole lucide set; the progress icons
 *   are server-rendered on /log/progress only, ui-progress-rewards), by alias or by a relative path.
 */

const SKY_VIEW_DIR = fileURLToPath(new URL("../lib/sky-view/", import.meta.url));
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const inSrc = (path: string) => path.slice(path.indexOf("/src/") + 1);

/** The slider, the disc it hydrates and its range styling. */
const MOON_SOURCES = ["./tonight/MoonTimeSlider.tsx", "./tonight/MoonDisc.tsx", "./tonight/range-classes.ts"].map(here);

/** The live sky island, every sky-view module and the star catalogue it draws. */
const SKY_SOURCES = [
  here("./tonight/TonightSkyView.tsx"),
  here("./tonight/range-classes.ts"),
  // The sky-view control and the shared segmented control it renders (ui-sky-modes, plan review F9).
  here("./tonight/sky-mode-control.tsx"),
  here("./ui/segmented.tsx"),
  ...readdirSync(SKY_VIEW_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => SKY_VIEW_DIR + name),
  here("../lib/catalogue/stars.ts"),
  here("../lib/catalogue/star-names.ts"),
  here("../lib/compass.ts"),
];

/** Every browser island the Fact-family rule covers. */
const ISLANDS = [
  here("./tonight/MoonTimeSlider.tsx"),
  here("./tonight/TonightSkyView.tsx"),
  ...readdirSync(SKY_VIEW_DIR)
    .filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".test.ts"))
    .map((name) => SKY_VIEW_DIR + name),
];

const FACT_FAMILY = new Set(["Fact", "FactList", "StatCard", "StatPair", "fact-icons", "progress-icons"]);

/** Module specifiers of every static import, re-export and dynamic import in `source`. */
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)].map((m) => m[1]);
}

/** Whether the Moon slider may import `specifier`. */
function isAllowedMoonImport(specifier: string): boolean {
  return (
    specifier === "react" ||
    /^@\/lib\/moon-disc\/[\w-]+$/.test(specifier) ||
    specifier === "@/lib/engine/parameters" ||
    specifier === "@/i18n" ||
    specifier === "@/lib/utils" ||
    specifier === "@/components/ui/button" ||
    specifier === "@/components/tonight/MoonDisc" ||
    specifier === "@/components/tonight/range-classes"
  );
}

/** Whether the live sky may import `specifier`. */
function isAllowedSkyImport(specifier: string): boolean {
  return (
    specifier === "react" ||
    /^@\/lib\/sky-view\/[\w-]+$/.test(specifier) ||
    specifier === "@/lib/catalogue/stars" ||
    specifier === "@/lib/catalogue/star-names" ||
    specifier === "@/lib/compass" ||
    // `stars.ts` reads its generated JSON; `star-names.ts` takes the `Locale` type from the island-safe preferences.
    specifier === "./bright-stars.json" ||
    specifier === "@/lib/preferences" ||
    specifier === "@/components/tonight/sky-band" ||
    specifier === "@/components/tonight/range-classes" ||
    specifier === "@/i18n" ||
    specifier === "@/lib/utils" ||
    specifier === "@/components/ui/button" ||
    // The sky-view menu's segmented control (ui-sky-modes), the one shared segmented control.
    specifier === "@/components/ui/segmented" ||
    specifier === "@/components/tonight/sky-mode-control" ||
    // The pan chevrons' icons (ui-sky-light): browser-safe SVG components, as in the other islands.
    specifier === "lucide-react"
  );
}

/** Whether `specifier` reaches a Fact component or `fact-icons`, by alias or by a relative path, with or without an extension. */
function isFactFamilyImport(specifier: string): boolean {
  const last = specifier.split("/").pop() ?? "";
  return FACT_FAMILY.has(last.replace(/\.(?:astro|tsx?)$/, ""));
}

/** The `<file> imports <specifier>` lines of every import in `sources` that `offends`. */
function offenders(sources: string[], offends: (specifier: string) => boolean): string[] {
  return sources.flatMap((source) =>
    importSpecifiers(readFileSync(source, "utf8"))
      .filter(offends)
      .map((specifier) => `${inSrc(source)} imports ${specifier}`),
  );
}

describe("island import guard", () => {
  it("keeps the Moon slider, the live sky and every sky-view module to their allowed imports, and out of the Fact family", () => {
    // Non-vacuity: the scans cover the islands, every sky-view module and the star catalogue.
    expect(MOON_SOURCES.length, "Moon slider sources").toBe(3);
    expect(SKY_SOURCES.length, "live sky sources").toBeGreaterThanOrEqual(8);
    expect(SKY_SOURCES.some((source) => source.endsWith("rotate.ts"))).toBe(true);
    expect(ISLANDS.length, "island sources").toBeGreaterThanOrEqual(8);
    expect(ISLANDS.some((source) => source.endsWith("MoonTimeSlider.tsx"))).toBe(true);
    expect(ISLANDS.some((source) => source.endsWith("TonightSkyView.tsx"))).toBe(true);
    expect(ISLANDS.some((source) => source.endsWith("rotate.ts"))).toBe(true);
    const moonSpecifiers = MOON_SOURCES.flatMap((source) => importSpecifiers(readFileSync(source, "utf8")));
    expect(moonSpecifiers).toContain("@/lib/moon-disc/geometry");
    const skySpecifiers = SKY_SOURCES.flatMap((source) => importSpecifiers(readFileSync(source, "utf8")));
    expect(skySpecifiers).toContain("@/lib/sky-view/rotate");
    expect(skySpecifiers).toContain("@/lib/catalogue/stars");
    expect(skySpecifiers).toContain("@/components/ui/segmented");

    expect(
      offenders(MOON_SOURCES, (specifier) => !isAllowedMoonImport(specifier)),
      "Moon slider imports outside its allowlist",
    ).toEqual([]);
    expect(
      offenders(SKY_SOURCES, (specifier) => !isAllowedSkyImport(specifier)),
      "live sky imports outside its allowlist",
    ).toEqual([]);
    expect(offenders(ISLANDS, isFactFamilyImport), "islands importing the Fact family").toEqual([]);
  });

  it("flags a sample of every forbidden family: engine, catalogue index and Fact family", () => {
    const forbiddenInMoon = [
      "astronomy-engine",
      "@/lib/engine",
      "@/lib/engine/moon-disc",
      "@/lib/tonight/format",
      "@/lib/catalogue",
    ];
    for (const specifier of forbiddenInMoon) {
      expect(isAllowedMoonImport(specifier), `Moon slider must refuse ${specifier}`).toBe(false);
    }
    const forbiddenInSky = [
      "astronomy-engine",
      "@/lib/engine",
      "@/lib/engine/sky-frames",
      "@/lib/tonight/format",
      "@/lib/tonight/build",
      "@/lib/catalogue",
      "./index",
    ];
    for (const specifier of forbiddenInSky) {
      expect(isAllowedSkyImport(specifier), `live sky must refuse ${specifier}`).toBe(false);
    }
    const factFamily = [
      "@/components/ui/Fact",
      "@/components/ui/Fact.astro",
      "@/components/ui/FactList",
      "@/components/ui/StatCard",
      "@/components/ui/StatPair.astro",
      "@/components/ui/fact-icons",
      "../ui/fact-icons.ts",
      "./Fact.astro",
    ];
    for (const specifier of factFamily) {
      expect(isFactFamilyImport(specifier), `the Fact family check must flag ${specifier}`).toBe(true);
    }
    // And the matchers leave the allowed imports alone.
    for (const specifier of ["@/lib/engine/parameters", "@/lib/moon-disc/state"]) {
      expect(isAllowedMoonImport(specifier), `Moon slider must allow ${specifier}`).toBe(true);
    }
    expect(isAllowedSkyImport("@/lib/sky-view/projection")).toBe(true);
    for (const specifier of [
      "@/components/ui/button",
      "@/components/ui/Tile",
      "@/lib/sky-view/labels",
      "react",
      "@/i18n",
    ]) {
      expect(isFactFamilyImport(specifier), `the Fact family check must leave ${specifier} alone`).toBe(false);
    }
  });

  it("reads static imports, re-exports and dynamic imports from an in-memory source", () => {
    const sample = [
      'import { a } from "react";',
      "import type { B } from '@/lib/engine';",
      'export * from "../ui/fact-icons.ts";',
      'const lazy = import("astronomy-engine");',
      'import "./side-effect";',
    ].join("\n");
    const specifiers = importSpecifiers(sample);
    expect(specifiers).toEqual(["react", "@/lib/engine", "../ui/fact-icons.ts", "astronomy-engine", "./side-effect"]);
    expect(specifiers.filter((specifier) => !isAllowedMoonImport(specifier))).toEqual([
      "@/lib/engine",
      "../ui/fact-icons.ts",
      "astronomy-engine",
      "./side-effect",
    ]);
    expect(specifiers.filter(isFactFamilyImport)).toEqual(["../ui/fact-icons.ts"]);
  });
});
