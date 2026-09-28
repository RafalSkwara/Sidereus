import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Red night mode guard (S-10, PRD FR-024). Red mode exists to keep the observer's dark adaptation, and
 * only long-wavelength light does that: every colour in a `[data-theme="red"]` block must have zero
 * green and zero blue. The red palette must also stay complete (a token added to `:root` later needs a
 * red value) and readable on both the page background and the card surface.
 */

const CSS = readFileSync(fileURLToPath(new URL("./global.css", import.meta.url)), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Tokens on `:root` that are not colours, so no theme redefines them. */
const NON_COLOUR_TOKENS = new Set(["--radius"]);

function blocks(selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...CSS.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, "g"))].map((m) => m[1]);
}

function declarations(body: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (name && value) result.set(name, value.trim());
  }
  return result;
}

const redBlocks = blocks('[data-theme="red"]');
const red = new Map(redBlocks.flatMap((body) => [...declarations(body)]));
const rootTokens = [...declarations(blocks(":root")[0] ?? "").keys()].filter((t) => !NON_COLOUR_TOKENS.has(t));

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseColour(literal: string): Rgb {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(literal);
  if (hex?.[1]) {
    const digits = hex[1].length === 3 ? hex[1].replace(/./g, "$&$&") : hex[1];
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
    };
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(literal);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  throw new Error(`Unparsed colour literal: ${literal}`);
}

function colourLiterals(body: string): string[] {
  return [...body.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map((m) => m[0]);
}

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

function token(name: string): Rgb {
  const value = red.get(name);
  if (!value) throw new Error(`${name} has no red value`);
  return parseColour(value);
}

describe("red night mode palette", () => {
  it("exists", () => {
    expect(redBlocks.length).toBeGreaterThan(0);
  });

  it("emits no green or blue light in any colour", () => {
    const offenders = redBlocks.flatMap(colourLiterals).filter((literal) => {
      const { g, b } = parseColour(literal);
      return g !== 0 || b !== 0;
    });
    expect(offenders).toEqual([]);
  });

  it("gives every themed :root token a red value", () => {
    expect(rootTokens.length).toBeGreaterThan(0);
    expect(rootTokens.filter((name) => !red.has(name))).toEqual([]);
  });

  it.each([
    ["--foreground", 4.5],
    ["--heading", 4.5],
    ["--muted-foreground", 3],
    ["--no-go", 3],
  ])("keeps %s readable on the page and on cards (≥ %s:1)", (name, floor) => {
    expect(contrast(token(name), token("--background"))).toBeGreaterThanOrEqual(floor);
    expect(contrast(token(name), token("--surface"))).toBeGreaterThanOrEqual(floor);
  });

  it("keeps text on a primary button readable (≥ 4.5:1)", () => {
    expect(contrast(token("--primary-foreground"), token("--primary"))).toBeGreaterThanOrEqual(4.5);
  });
});
