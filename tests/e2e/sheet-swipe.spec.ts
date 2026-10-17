import { expect, type CDPSession, type Locator, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, test, waitForHydration } from "./helpers";

/*
 * Swipe down to close a bottom sheet (ui-quick-nav Phase 3, owner P6, 2026-10-17): the quick nav's sheet and the
 * settings sheet, the app's only two, share one helper (`src/lib/ui/sheet-swipe.ts`). This spec is the only protection
 * of the gesture: on a 320×568 phone the sheet sits under the Topbar strip and its heading stays put while the list
 * scrolls (P2 B); a short drag on the handle follows the finger and snaps back; a long swipe closes, from the handle or
 * from the list while it is at its top (and the row under the finger is not followed); the settings sheet closes with a
 * touch swipe and with a mouse drag on its handle (the pointer path); with reduced motion the sheet does not follow, a
 * long swipe just closes it. Esc still closes. Touch goes through CDP touch events (real `touchstart`/`touchmove`),
 * which is what a phone sends.
 */

test.use({ hasTouch: true });

const t = en.tonight.subnav;
const quickPanel = (page: Page) => page.locator("[data-quick-nav-panel]");
const settingsPanel = (page: Page) => page.getByRole("dialog", { name: en.nav.settings });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

/** A one-finger touch from `start`, moved down by `dy` in eight steps; released unless `hold`. */
async function touchSwipe(cdp: CDPSession, start: { x: number; y: number }, dy: number, hold = false) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  for (let step = 1; step <= 8; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: start.x, y: start.y + (dy * step) / 8 }],
    });
  }
  if (!hold) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function releaseTouch(cdp: CDPSession) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** The centre of `locator`'s box, a little below its top for a handle (the grab bar sits there). */
async function pointIn(locator: Locator, fromTop?: number) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element to drag has no box");
  return { x: box.x + box.width / 2, y: box.y + (fromTop ?? box.height / 2) };
}

const top = async (locator: Locator) => (await locator.boundingBox())?.y ?? Number.NaN;

test("a bottom sheet follows a swipe down, snaps back after a short one and closes after a long one", async ({
  page,
}) => {
  await onboardInMadrid(page, "e2e-sheet-swipe");
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/log");
  await expect(page.locator("main")).toBeVisible();
  await waitForHydration(page, `button[aria-label="${en.nav.settings}"]`);
  const cdp = await page.context().newCDPSession(page);
  const trigger = page.getByRole("button", { name: t.label });

  // The quick-nav sheet on a 568 px phone: under the Topbar strip, all seven rows reachable, the heading fixed.
  await trigger.click();
  const panel = quickPanel(page);
  await expect(panel).toBeVisible();
  const handle = panel.locator("[data-sheet-handle]");
  const restingTop = await top(panel);
  const strip = await page.evaluate(() =>
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-strip-height")),
  );
  expect(restingTop, "the sheet stays under the Topbar strip").toBeGreaterThanOrEqual(strip * 16);
  const headingTop = await top(handle);
  await panel.locator("[data-sheet-body]").evaluate((body) => {
    body.scrollTo({ top: body.scrollHeight });
  });
  await expect(panel.getByRole("link", { name: t.nights, exact: true })).toBeInViewport({ ratio: 1 });
  expect(await top(handle), "the heading does not scroll with the list").toBe(headingTop);
  await panel.locator("[data-sheet-body]").evaluate((body) => {
    body.scrollTo({ top: 0 });
  });

  // A short drag on the handle: the sheet follows the finger, then snaps back and stays open.
  await touchSwipe(cdp, await pointIn(handle, 8), 20, true);
  await expect.poll(() => top(panel), { message: "the sheet follows the finger" }).toBeGreaterThan(restingTop + 8);
  await releaseTouch(cdp);
  await expect.poll(() => top(panel), { message: "the sheet snaps back" }).toBeCloseTo(restingTop, 0);
  await expect(panel).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  // A long swipe from a row of the list (scrolled to its top) closes it, and the row's link is not followed.
  await touchSwipe(cdp, await pointIn(panel.getByRole("link", { name: t.targets, exact: true })), 260);
  await expect(panel).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/\/log$/);

  // A long swipe on the handle closes it too.
  await trigger.click();
  await expect(panel).toBeVisible();
  await touchSwipe(cdp, await pointIn(handle, 8), 260);
  await expect(panel).toBeHidden();

  // The settings sheet: a touch swipe on its handle, then a mouse drag on its handle (the pointer path).
  const settingsButton = page.getByRole("button", { name: en.nav.settings });
  await settingsButton.click();
  await expect(settingsPanel(page)).toBeVisible();
  await touchSwipe(cdp, await pointIn(settingsPanel(page).locator("[data-sheet-handle]"), 8), 260);
  await expect(settingsPanel(page)).toBeHidden();

  await settingsButton.click();
  await expect(settingsPanel(page)).toBeVisible();
  const grab = await pointIn(settingsPanel(page).locator("[data-sheet-handle]"), 8);
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x, grab.y + 260, { steps: 8 });
  await page.mouse.up();
  await expect(settingsPanel(page)).toBeHidden();

  // Esc still closes a sheet.
  await settingsButton.click();
  await expect(settingsPanel(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settingsPanel(page)).toBeHidden();

  // Reduced motion: the sheet does not follow the finger; a long swipe just closes it.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  await expect(panel).toBeVisible();
  const still = await top(panel);
  await touchSwipe(cdp, await pointIn(handle, 8), 260, true);
  expect(await top(panel), "with reduced motion the sheet stays put during the drag").toBe(still);
  await releaseTouch(cdp);
  await expect(panel).toBeHidden();
});
