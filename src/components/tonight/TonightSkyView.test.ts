import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Import guard for Tonight's live sky (interactive-sky): the island runs in the browser, so it, the sky-view maths
 * it composes and the star catalogue it draws may import only React, `@/lib/sky-view/*`, the island-safe star
 * catalogue (`stars.ts` with its JSON, `star-names.ts` with the `Locale` type), the shared `sky-band` and
 * `range-classes`, the international compass (`@/lib/compass`), the message catalogue, `cn` and `buttonVariants`. Never astronomy-engine, the engine barrel or an engine module,
 * `@/lib/tonight/format`, or `@/lib/catalogue` / `./index` (which would ship `messier.json` to the browser).
 */

const SKY_VIEW_DIR = fileURLToPath(new URL("../../lib/sky-view/", import.meta.url));

const SOURCES = [
  fileURLToPath(new URL("./TonightSkyView.tsx", import.meta.url)),
  fileURLToPath(new URL("./range-classes.ts", import.meta.url)),
  ...readdirSync(SKY_VIEW_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => SKY_VIEW_DIR + name),
  fileURLToPath(new URL("../../lib/catalogue/stars.ts", import.meta.url)),
  fileURLToPath(new URL("../../lib/catalogue/star-names.ts", import.meta.url)),
  fileURLToPath(new URL("../../lib/compass.ts", import.meta.url)),
];

/** Module specifiers of every static import, re-export and dynamic import in `source`. */
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)].map((m) => m[1]);
}

/** Whether the island may import `specifier`. */
function isAllowedImport(specifier: string): boolean {
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
    specifier === "@/components/ui/button"
  );
}

describe("TonightSkyView import guard", () => {
  it("scans the island, every sky-view module and the star catalogue", () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(8);
    expect(SOURCES.some((source) => source.endsWith("rotate.ts"))).toBe(true);
  });

  it("imports only React, the sky-view maths, the star catalogue, sky-band, range-classes, i18n, cn and buttonVariants", () => {
    const specifiers = SOURCES.flatMap((source) => importSpecifiers(readFileSync(source, "utf8")));
    expect(specifiers).toContain("@/lib/sky-view/rotate");
    expect(specifiers).toContain("@/lib/catalogue/stars");
    expect(specifiers.filter((specifier) => !isAllowedImport(specifier))).toEqual([]);
  });

  it("recognises the imports it forbids", () => {
    expect(isAllowedImport("astronomy-engine")).toBe(false);
    expect(isAllowedImport("@/lib/engine")).toBe(false);
    expect(isAllowedImport("@/lib/engine/sky-frames")).toBe(false);
    expect(isAllowedImport("@/lib/tonight/format")).toBe(false);
    expect(isAllowedImport("@/lib/tonight/build")).toBe(false);
    expect(isAllowedImport("@/lib/catalogue")).toBe(false);
    expect(isAllowedImport("./index")).toBe(false);
    expect(isAllowedImport("@/lib/sky-view/projection")).toBe(true);
  });
});
