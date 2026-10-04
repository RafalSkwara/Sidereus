import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Contrast guard (visual-redesign): WCAG AA in all three themes is a failing test, not a manual check. Reads the
 * base colour tokens of the `:root` (dark), light and red blocks of `global.css` the way `red-theme.test.ts` does,
 * resolving plain hex values only; derived `color-mix` tokens are out of scope.
 *
 * Red mode cannot reach AA for every text colour with zero green and blue, so muted text and the no-go verdict get
 * the accepted 3:1 floor there (red-night-mode plan-brief); everything else read as text keeps 4.5:1.
 */

const CSS = readFileSync(fileURLToPath(new URL("./global.css", import.meta.url)), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function blocks(selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...CSS.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, "g"))].map((m) => m[1]);
}

/** Plain hex declarations only: `var(...)` and `color-mix(...)` values are skipped. */
function hexTokens(bodies: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const body of bodies) {
    for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})\s*;/g)) {
      if (name && value) result.set(name, value);
    }
  }
  return result;
}

const dark = hexTokens(blocks(":root"));
const themes = {
  dark,
  light: new Map([...dark, ...hexTokens(blocks('[data-theme="light"]'))]),
  red: new Map([...dark, ...hexTokens(blocks('[data-theme="red"]'))]),
};
type Theme = keyof typeof themes;

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const digits = hex.length === 4 ? hex.slice(1).replace(/./g, "$&$&") : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(digits.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

interface Check {
  themes: Theme[];
  fg: string[];
  bg: string[];
  floor: number;
}

const DARK_LIGHT: Theme[] = ["dark", "light"];

const CHECKS: Check[] = [
  { themes: DARK_LIGHT, fg: ["foreground", "heading", "muted-foreground"], bg: ["background", "surface"], floor: 4.5 },
  { themes: DARK_LIGHT, fg: ["heading", "muted-foreground"], bg: ["zenith", "horizon"], floor: 4.5 },
  { themes: DARK_LIGHT, fg: ["primary-foreground"], bg: ["primary"], floor: 4.5 },
  { themes: DARK_LIGHT, fg: ["primary-strong"], bg: ["background"], floor: 4.5 },
  { themes: DARK_LIGHT, fg: ["go", "marginal", "no-go"], bg: ["background"], floor: 4.5 },
  // The focus ring (`--ring: var(--primary-strong)`) as a non-text indicator.
  { themes: DARK_LIGHT, fg: ["primary-strong"], bg: ["background"], floor: 3 },
  { themes: ["red"], fg: ["foreground", "heading"], bg: ["background", "surface"], floor: 4.5 },
  { themes: ["red"], fg: ["primary-foreground"], bg: ["primary"], floor: 4.5 },
  { themes: ["red"], fg: ["muted-foreground", "no-go"], bg: ["background", "surface"], floor: 3 },
];

const pairs = CHECKS.flatMap(({ themes: names, fg, bg, floor }) =>
  names.flatMap((theme) => fg.flatMap((f) => bg.map((b) => ({ theme, fg: f, bg: b, floor })))),
);

describe("theme contrast", () => {
  it("reads every theme's base colours", () => {
    for (const tokens of Object.values(themes)) expect(tokens.size).toBeGreaterThan(10);
  });

  it("meets the contrast floor for every pair in every theme", () => {
    const failures = pairs.flatMap(({ theme, fg, bg, floor }) => {
      const tokens = themes[theme];
      const a = tokens.get(fg);
      const b = tokens.get(bg);
      if (!a || !b) return [`${theme}: --${fg} on --${bg} is not a plain hex pair`];
      const ratio = contrast(a, b);
      return ratio >= floor ? [] : [`${theme}: --${fg} on --${bg} is ${ratio.toFixed(2)}, needs ${String(floor)}`];
    });
    expect(failures).toEqual([]);
  });
});
