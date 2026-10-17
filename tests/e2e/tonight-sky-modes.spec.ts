import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE, SKY_MODE_COOKIE, type SkyMode } from "@/lib/preferences";

import { onboardInMadrid, test, waitForHydration } from "./helpers";

/*
 * The live sky's three modes, end to end (ui-sky-modes, Phase 4): the only protection of the preference's round trip
 * (cookie, server-rendered `<html data-sky-mode>`, the skeleton reserving the chosen height so the island swaps in
 * without a jump), of EXPANDED's size and of its rule that the projection is recomputed for the box, never scaled,
 * and of HIDDEN's content. Same setup as the other Tonight specs: a production preview on local Supabase with the
 * all-clear forecast fixture and place search stubbed with Madrid, the clock pinned to the evening.
 */

const t = en.tonight.sky;

test.use({ clock: "evening" });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

/** Waits for the hydrated live sky (its strip and its mode control). */
async function waitForSky(page: Page) {
  await expect(page.locator("[data-sky-band]")).toBeVisible();
  await waitForHydration(page, "[data-sky-mode-trigger]");
  await page.evaluate(() => document.fonts.ready);
}

/** Picks `mode` in the sky-view menu, as a user does, and waits for the page's scope to carry it. */
async function chooseMode(page: Page, mode: SkyMode) {
  await page.locator("[data-sky-mode-trigger]").click();
  const menu = page.locator("[data-sky-mode-menu]");
  await expect(menu).toBeVisible();
  // By its value: the option's name is the page's language (the last test switches to Polish).
  await menu.locator(`button[data-segment="${mode}"]`).click();
  await expect(menu).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-sky-mode", mode);
  await expect(page.locator("[data-sky-mode-trigger]")).toHaveAttribute("data-sky-mode-trigger", mode);
}

/** The frame's box (the band plus the slider row) of `which`: the skeleton's, the live island's. */
async function frameBox(page: Page, which: "skeleton" | "live") {
  const box = await page.locator(`[data-sky-mode-frame="${which}"]`).boundingBox();
  if (box === null) throw new Error(`the ${which} sky frame has no box`);
  return box;
}

/** The verdict's event line moves everything under it on an event night (no room is reserved): measure without it. */
async function hideEventLine(page: Page) {
  await page.addStyleTag({ content: ":has(> [data-verdict-event]), [data-verdict-event]{display:none}" });
}

test("a chosen mode is server-rendered on the next load and the skeleton keeps its height", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await onboardInMadrid(page, "e2e-sky-modes-persist");
  await waitForSky(page);

  // A phone first (the verdict fills its min-height exactly there), then a desktop.
  for (const [width, height, mode] of [
    [390, 844, "expanded"],
    [390, 844, "hidden"],
    [390, 844, "default"],
    [1280, 720, "expanded"],
    [1280, 720, "hidden"],
    [1280, 720, "default"],
  ] as const) {
    await page.setViewportSize({ width, height });
    await chooseMode(page, mode);
    const cookie = (await context.cookies()).find((entry) => entry.name === SKY_MODE_COOKIE);
    expect(cookie?.value, `the ${mode} choice is remembered in the cookie`).toBe(mode);

    // Hold the island so the skeleton can be measured, then let it swap in.
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/_server-islands/**", async (route) => {
      await held;
      await route.continue();
    });
    const response = await page.reload({ waitUntil: "domcontentloaded" });
    if (response === null) throw new Error(`the reload in ${mode} returned no response`);
    // The raw HTML, not the DOM: the head script rewrites <html data-sky-mode> from the cookie before paint, so only the
    // response shows that the server itself read the cookie (impl review F3).
    expect(await response.text(), `the server renders ${mode} on <html>`).toMatch(
      new RegExp(`<html[^>]*\\sdata-sky-mode="${mode}"`),
    );
    await expect(page.locator("html"), `the shell shows ${mode} on <html>`).toHaveAttribute("data-sky-mode", mode);
    await expect(page.locator('[data-sky-mode-frame="skeleton"]')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const skeleton = await frameBox(page, "skeleton");
    release?.();
    await waitForSky(page);
    await page.unroute("**/_server-islands/**");
    await hideEventLine(page);
    const live = await frameBox(page, "live");
    expect(
      Math.abs(live.y + live.height - (skeleton.y + skeleton.height)),
      `in ${mode} at ${String(width)} px the band's bottom stays where the skeleton's was`,
    ).toBeLessThanOrEqual(1);
  }
});

test("expanded fills the phone screen and redraws the sky at its size", async ({ page }) => {
  test.setTimeout(120_000);
  await onboardInMadrid(page, "e2e-sky-modes-expanded");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tonight");
  await waitForSky(page);
  await chooseMode(page, "expanded");

  // From the Topbar to the TabBar.
  const tabBar = await page.getByRole("navigation", { name: en.nav.primary }).boundingBox();
  if (tabBar === null) throw new Error("no TabBar at 390 px");
  const frame = await frameBox(page, "live");
  expect(Math.abs(frame.y + frame.height - tabBar.y), "the expanded band meets the TabBar").toBeLessThanOrEqual(1);

  // The field is drawn for its box: the SVG's own height is the rendered one, taller than DEFAULT's 272 px.
  const svg = page.locator("svg[data-sky-frame]");
  await expect.poll(async () => Number(await svg.getAttribute("height"))).toBeGreaterThan(272);
  const drawn = Number(await svg.getAttribute("height"));
  const rendered = await svg.boundingBox();
  expect(Math.abs((rendered?.height ?? 0) - drawn), "the SVG is not scaled by CSS").toBeLessThanOrEqual(0.5);

  // Every marker sits at its altitude on the taller field (its name carries the altitude in whole degrees).
  const slider = page.getByRole("slider", { name: t.slider });
  const max = Number(await slider.getAttribute("max"));
  await slider.focus();
  await slider.press("Home");
  let checked = 0;
  for (let index = 0; index <= max && checked === 0; index++) {
    if (index > 0) await slider.press("ArrowRight");
    await expect(svg).toHaveAttribute("data-sky-frame", String(index));
    const placed = await page.locator("[data-sky-body]").evaluateAll((elements) =>
      elements.map((element) => ({
        name: element.getAttribute("aria-label") ?? "",
        cy: Number(element.querySelector("circle")?.getAttribute("cy") ?? "NaN"),
      })),
    );
    for (const { name, cy } of placed) {
      const alt = Number(/(-?\d+)°/.exec(name)?.[1] ?? "NaN");
      expect(Number.isFinite(alt) && Number.isFinite(cy), `a marker's altitude and dot: ${name}`).toBe(true);
      expect(Math.abs(cy - (drawn - (alt / 90) * drawn)), `${name} sits at its altitude`).toBeLessThanOrEqual(
        drawn / 90 + 1,
      );
      checked += 1;
    }
  }
  expect(checked, "at least one marker was checked").toBeGreaterThan(0);

  // A desktop: the band is the screen under the Topbar strip times the one share constant, never shorter than DEFAULT.
  await page.setViewportSize({ width: 1440, height: 900 });
  await chooseMode(page, "default");
  const defaultFrame = await frameBox(page, "live");
  await chooseMode(page, "expanded");
  const share = Number(
    await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sky-expanded-share")),
  );
  expect(share, "the share is one number in (0, 1]").toBeGreaterThan(0);
  expect(share).toBeLessThanOrEqual(1);
  await expect
    .poll(async () => {
      const box = await frameBox(page, "live");
      return Math.abs(box.height - Math.max(share * (900 - box.y), defaultFrame.height));
    }, "the expanded band is max(share × the screen under the Topbar strip, DEFAULT)")
    .toBeLessThanOrEqual(2);
});

test("hidden keeps the verdict and the dark window and lifts the gear cards", async ({ page, context, baseURL }) => {
  test.setTimeout(120_000);
  await onboardInMadrid(page, "e2e-sky-modes-hidden");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tonight");
  await waitForSky(page);
  await chooseMode(page, "hidden");

  await expect(page.locator("#verdict-heading [data-sky-headline]")).toBeVisible();
  // The dark window, sr-only beside the slider, is a full line here.
  const darkLine = await page.locator("[data-verdict-dark-line]").boundingBox();
  expect(darkLine?.height ?? 0, "the dark-window line shows").toBeGreaterThanOrEqual(15);
  await expect(page.locator("[data-sky-strip]")).toBeHidden();
  await expect(page.getByRole("slider", { name: t.slider })).toBeHidden();
  const tabBar = await page.getByRole("navigation", { name: en.nav.primary }).boundingBox();
  const telescope = await page.locator('[data-gear-card="telescope"]').boundingBox();
  if (tabBar === null || telescope === null) throw new Error("no TabBar or Telescope card at 390 px");
  expect(telescope.y + telescope.height, "the whole Telescope card fits above the TabBar").toBeLessThanOrEqual(
    tabBar.y,
  );

  // The trigger never covers the Polish date or headline at 320 px, in HIDDEN and in DEFAULT (plan review F8).
  await context.addCookies([{ name: LOCALE_COOKIE, value: "pl", url: baseURL ?? "http://localhost:4321" }]);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.reload();
  await waitForSky(page);
  for (const mode of ["hidden", "default"] as const) {
    if (mode !== "hidden") await chooseMode(page, mode);
    await expect(page.locator("html")).toHaveAttribute("data-sky-mode", mode);
    const overlaps = await page.evaluate(() => {
      const trigger = document.querySelector("[data-sky-mode-trigger]")?.getBoundingClientRect();
      const section = document.querySelector('section[aria-labelledby="verdict-heading"]');
      const date = section?.querySelector("p");
      const headline = section?.querySelector("[data-sky-headline]");
      if (!trigger || !date || !headline) return ["missing"];
      const textRects = (element: Element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      };
      const hits = (rect: DOMRect) =>
        rect.left < trigger.right &&
        rect.right > trigger.left &&
        rect.top < trigger.bottom &&
        rect.bottom > trigger.top;
      return [
        ...textRects(date)
          .filter(hits)
          .map(() => "date"),
        ...textRects(headline)
          .filter(hits)
          .map(() => "headline"),
      ];
    });
    expect(overlaps, `in ${mode} at 320 px (PL) the sky-view button covers no text`).toEqual([]);
  }
});
