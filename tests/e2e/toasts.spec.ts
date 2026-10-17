import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";
import { TOAST_MS } from "@/lib/toasts";

import { onboardInMadrid, test } from "./helpers";

/*
 * Notifications (ui-user-adjustments, Phase 2): a success notice is a fixed, closable, 10-second toast that removes
 * its param from the URL; an informational notice has a × that sticks. Same setup as the other specs: a production
 * preview on local Supabase with the all-clear forecast fixture and place search stubbed with Madrid.
 *
 * A toast is triggered the way the app does it, by the URL a save redirects to: `/gear?saved=site` is a plain server
 * render, `/tonight?skyChecked=1` a notice inside the Tonight server island (it arrives after load). The ten seconds
 * run on Playwright's fake clock (`page.clock`), installed after onboarding so the sign-up flow keeps real time.
 *
 * The offline notice's × (it closes and stays closed while the page re-applies its state) is asserted in
 * offline.spec.ts, against a really unreachable server; the × button's 44 px size is not asserted (test-suite-diet).
 */

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const SAVED_SITE = "/gear?saved=site";

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

// The toast once the script has moved it into the container: interacting earlier would lose the focus on the move.
const toastOf = (page: Page) => page.locator("[data-toast-region] [data-toast]");
const closeOf = (page: Page) => toastOf(page).getByRole("button", { name: en.common.close });

test("a toast floats above the TabBar on a phone and under the Topbar on desktop, with one status role", async ({
  page,
}) => {
  await onboardInMadrid(page, "e2e-toasts-place");

  await page.setViewportSize(PHONE);
  await page.goto(SAVED_SITE);
  const toast = toastOf(page);
  await expect(toast).toHaveText(en.gear.notice.saved.site);
  // One live role per toast: the container is not a live region, and the notice is the only status.
  await expect(page.getByRole("status")).toHaveCount(1);
  const region = page.locator("[data-toast-region]");
  await expect(region).not.toHaveAttribute("role");
  await expect(region).not.toHaveAttribute("aria-live");
  expect(await region.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");

  const tabBar = await page.locator("[data-tabbar]").boundingBox();
  const phoneBox = await toast.boundingBox();
  if (!tabBar || !phoneBox) throw new Error("the TabBar and the toast should both be on screen");
  // Above the TabBar, close to it, and centred in the viewport.
  expect(phoneBox.y + phoneBox.height).toBeLessThanOrEqual(tabBar.y);
  expect(tabBar.y - (phoneBox.y + phoneBox.height)).toBeLessThan(40);
  expect(Math.abs(phoneBox.x + phoneBox.width / 2 - PHONE.width / 2)).toBeLessThan(2);
  expect(phoneBox.x).toBeGreaterThanOrEqual(0);
  expect(phoneBox.x + phoneBox.width).toBeLessThanOrEqual(PHONE.width);

  await page.setViewportSize(DESKTOP);
  await page.goto(SAVED_SITE);
  await expect(toast).toHaveText(en.gear.notice.saved.site);
  const topbar = await page.locator("header").first().boundingBox();
  const deskBox = await toast.boundingBox();
  if (!topbar || !deskBox) throw new Error("the Topbar and the toast should both be on screen");
  // Under the Topbar's bottom edge, close to it, and centred.
  expect(deskBox.y).toBeGreaterThanOrEqual(topbar.y + topbar.height);
  expect(deskBox.y - (topbar.y + topbar.height)).toBeLessThan(24);
  expect(Math.abs(deskBox.x + deskBox.width / 2 - DESKTOP.width / 2)).toBeLessThan(2);
});

test("the × closes a toast, and a reload does not show it again", async ({ page }) => {
  await onboardInMadrid(page, "e2e-toasts-close");

  await page.goto(`/log?saved=M31&page=1`);
  await expect(toastOf(page)).toHaveText(en.log.list.saved({ object: "M31" }));
  // The param is gone once the toast shows; every other param stays.
  await expect(page).toHaveURL(/\/log\?page=1$/);

  await closeOf(page).click();
  await expect(toastOf(page)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: en.log.list.title })).toBeVisible();
  await expect(toastOf(page)).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("a toast is gone after ten seconds, unless it is hovered or focused", async ({ page }) => {
  await onboardInMadrid(page, "e2e-toasts-timer");
  await page.setViewportSize(DESKTOP);
  // The clock fixture (helpers.ts) already installed the fake clock, so `fastForward` below drives the toast timer.

  // Alone, it goes when its ten seconds are up.
  await page.goto(SAVED_SITE);
  await expect(toastOf(page)).toHaveText(en.gear.notice.saved.site);
  await page.clock.fastForward(TOAST_MS / 2);
  await expect(toastOf(page)).toHaveCount(1);
  await page.clock.fastForward(TOAST_MS / 2);
  await expect(toastOf(page)).toHaveCount(0);

  // Hovered, the timer stops; moving away starts it again.
  await page.goto(SAVED_SITE);
  await expect(toastOf(page)).toHaveText(en.gear.notice.saved.site);
  await toastOf(page).hover();
  await page.clock.fastForward(TOAST_MS * 2);
  await expect(toastOf(page)).toHaveCount(1);
  await page.mouse.move(2, 2);
  await page.clock.fastForward(TOAST_MS);
  await expect(toastOf(page)).toHaveCount(0);

  // Focused (a keyboard user reaching the ×), the timer stops too.
  await page.goto(SAVED_SITE);
  await expect(toastOf(page)).toHaveText(en.gear.notice.saved.site);
  await closeOf(page).focus();
  await page.clock.fastForward(TOAST_MS * 2);
  await expect(toastOf(page)).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(toastOf(page)).toHaveCount(0);
  // Focus left with the toast: it lands on <main>, never on <body>, so the next Tab doesn't restart at the top.
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
});

test("a toast in Tonight's server island is adopted when it arrives, and clears only its own param", async ({
  page,
}) => {
  await onboardInMadrid(page, "e2e-toasts-island");

  await page.goto("/tonight?skyChecked=1&keep=this");
  await expect(page.getByRole("status").filter({ hasText: en.skyChecks.saved })).toBeVisible();
  await expect(toastOf(page)).toHaveCount(1);
  await expect(page).toHaveURL(/\/tonight\?keep=this$/);

  await closeOf(page).click();
  await expect(toastOf(page)).toHaveCount(0);
});
