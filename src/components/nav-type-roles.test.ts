import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Type-role guard for the navigation rows (ui-tonight-nav): the Topbar's pill, the phone TabBar and the Tonight
 * sub-nav size their text with the type roles (`text-label`, `text-caption`), never Tailwind's raw size scale, which
 * sits off the roles and drifts from the measured fit of four destinations at 320 px and of the pill at `md`. The
 * second guard on the nav is `navigation.test.ts`'s `TONIGHT_NAV` ≡ `TONIGHT_PAGES` set test.
 */

const NAV_FILES = ["Topbar.astro", "TabBar.astro", "tonight/TonightSubNav.astro"];

/** Tailwind's raw type sizes, with or without a variant prefix (`sm:text-sm`); `text-2xl` and up are not nav sizes. */
const RAW_TYPE_SIZE = /\btext-(xs|sm|base|lg|xl)\b/g;

describe("nav type roles", () => {
  it.each(NAV_FILES)("%s uses the type roles, never a raw text size", (file) => {
    const source = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
    const offenders = source
      .split("\n")
      .flatMap((line, i) => [...line.matchAll(RAW_TYPE_SIZE)].map((match) => `${file}:${i + 1} ${match[0]}`));
    expect(offenders).toEqual([]);
  });
});
