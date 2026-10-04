import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Import guard for the Moon card's time slider (moonlight-and-the-verdict): it runs in the browser, so it may import
 * only React, the browser-safe Moon-disc drawing (`@/lib/moon-disc/*`), the engine's island-safe `parameters`, the
 * message catalogue, `cn`, the shared `buttonVariants` (for "Now", tonight-nightfall) and its extracted `MoonDisc`,
 * held to the same list. Never astronomy-engine, the engine barrel or another engine module, which would pull
 * the sky maths into the client bundle.
 */

/** The slider and the disc it hydrates (extracted for the Moon summary band, tonight-nightfall). */
const SOURCES = ["./MoonTimeSlider.tsx", "./MoonDisc.tsx"].map((path) => fileURLToPath(new URL(path, import.meta.url)));

/** Module specifiers of every static import, re-export and dynamic import in `source`. */
function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)].map((m) => m[1]);
}

/** Whether the island may import `specifier`. */
function isAllowedImport(specifier: string): boolean {
  return (
    specifier === "react" ||
    /^@\/lib\/moon-disc\/[\w-]+$/.test(specifier) ||
    specifier === "@/lib/engine/parameters" ||
    specifier === "@/i18n" ||
    specifier === "@/lib/utils" ||
    specifier === "@/components/ui/button" ||
    specifier === "@/components/tonight/MoonDisc"
  );
}

describe("MoonTimeSlider import guard", () => {
  it("imports only React, the Moon-disc drawing, engine parameters, i18n, cn, buttonVariants and MoonDisc", () => {
    const specifiers = SOURCES.flatMap((source) => importSpecifiers(readFileSync(source, "utf8")));
    expect(specifiers).toContain("@/lib/moon-disc/geometry");
    expect(specifiers.filter((specifier) => !isAllowedImport(specifier))).toEqual([]);
  });

  it("recognises the imports it forbids", () => {
    expect(isAllowedImport("astronomy-engine")).toBe(false);
    expect(isAllowedImport("@/lib/engine")).toBe(false);
    expect(isAllowedImport("@/lib/engine/moon-disc")).toBe(false);
    expect(isAllowedImport("@/lib/tonight/format")).toBe(false);
    expect(isAllowedImport("@/lib/engine/parameters")).toBe(true);
    expect(isAllowedImport("@/lib/moon-disc/state")).toBe(true);
  });
});
