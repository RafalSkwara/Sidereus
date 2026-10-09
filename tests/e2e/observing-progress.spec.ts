import { expect, test, type Locator, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * Observing progress, the Tonight half (M-3 S-05, FR-039): the "not seen yet" mark on Tonight's targets follows the
 * log. From the shared onboarding in Madrid on the all-clear forecast fixture; the clock is real, so the spec never
 * asserts which object ranks first, only that the first card carries the mark and what the mark does. The copy is
 * read from the catalogue.
 */

const copy = en.tonight.object.notSeen;
const LOG_FORM = 'form[action="/api/log"]';
const EDIT_FORM = 'form[action^="/api/log/"]:not([action$="/delete"])';

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

/** The first of the best objects on Targets, shown in full as a card with its mark, once the island has rendered. */
async function firstCard(page: Page): Promise<{ card: Locator; key: string; label: string }> {
  await page.goto("/tonight/targets");
  const card = page.locator("li[data-object]").first();
  await expect(card).toBeVisible();
  const key = await card.getAttribute("data-object");
  const label = await card.getAttribute("data-label");
  if (!key || !label) throw new Error("the first row has no data-object or data-label");
  return { card, key, label };
}

const markOf = (card: Locator) => card.getByRole("button", { name: copy.label });

/** Any form of the mark: the card's button or a row's static icon. */
const anyMarkOf = (row: Locator) => row.locator("[data-not-seen-button], [data-not-seen-static]");

async function rate(form: Locator, rating: number) {
  // The radios are visually hidden inside their labels; click the label, as a user does.
  await form
    .locator("label")
    .filter({ hasText: new RegExp(`^${rating}$`) })
    .click();
}

test("the mark follows the log: shown for a new object, kept at a rating of 2, gone at 4", async ({ page }) => {
  test.setTimeout(120_000);
  await onboardInMadrid(page, "e2e-progress-tonight");

  // 1. A fresh user sees the mark on the first card, in its heading, with its name outside the button.
  const { card, key, label } = await firstCard(page);
  await expect(markOf(card)).toBeVisible();
  await expect(card.getByRole("heading", { level: 3 }).getByRole("button", { name: copy.label })).toHaveCount(1);
  await expect(card.locator("[data-target-name]")).toContainText(label);
  // Nothing is open at rest: the tooltip is out of the layout.
  await expect(card.getByRole("tooltip")).toHaveCount(0);

  // 2. Keyboard Tab focus shows the tooltip (a real Tab from the name, not a programmatic focus).
  await card.locator("[data-target-name]").click();
  await page.keyboard.press("Tab");
  await expect(markOf(card)).toBeFocused();
  await expect(card.getByRole("tooltip")).toHaveText(copy.legend);
  await expect(card.getByRole("tooltip")).toBeVisible();

  // Esc dismisses it again.
  await page.keyboard.press("Escape");
  await expect(card.getByRole("tooltip")).toHaveCount(0);

  // 3. Logged with a rating of 2, the object still counts as not seen yet.
  await card.getByRole("link", { name: new RegExp(en.tonight.object.markObserved) }).click();
  await expect(page).toHaveURL(new RegExp(`/log/new\\?object=${key}&night=\\d{4}-\\d{2}-\\d{2}&site=.*&from=targets$`));
  await waitForHydration(page, LOG_FORM);
  await rate(page.locator(LOG_FORM), 2);
  await page.locator(LOG_FORM).locator('button[type="submit"]').click();
  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object: label }) })).toBeVisible();
  await expect(page).toHaveURL(/\/tonight\/targets$/);
  // A rating of 1-2 never reorders the ranking, so the object is still a card with its button.
  const loggedRow = page.locator(`li[data-object="${key}"]`);
  await expect(markOf(loggedRow)).toBeVisible();

  // 4. Edited to 4, the mark is gone and the seen tag shows. The penalty may move the row into "show the other N",
  // so it is found again by its key.
  await page.goto("/log");
  await page.locator('main a[href^="/log/"]').filter({ hasText: label }).click();
  await expect(page).toHaveURL(/\/log\/[0-9a-f-]{36}$/);
  await waitForHydration(page, EDIT_FORM);
  const form = page.locator(EDIT_FORM);
  await expect(form.getByRole("radio", { name: "2", exact: true })).toBeChecked();
  await rate(form, 4);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/log$/);

  await page.goto("/tonight/targets");
  const seenRow = page.locator(`li[data-object="${key}"]`);
  await expect(seenRow).toHaveCount(1);
  await expect(seenRow).toContainText(en.tonight.object.seen.one({ count: "1", date: "" }));
  await expect(anyMarkOf(seenRow)).toHaveCount(0);
});

test.describe("on a touch screen", () => {
  // A phone: no hover, so only a tap, Esc and a tap outside drive the tooltip.
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("a tap opens the tooltip, and a second tap, Esc or a tap outside closes it", async ({ page }) => {
    test.setTimeout(120_000);
    await onboardInMadrid(page, "e2e-progress-touch");

    const { card } = await firstCard(page);
    // The delegated listeners are in place once the page's script has run.
    await expect(page.locator("html[data-not-seen-tip='ready']")).toHaveCount(1);
    const mark = markOf(card);
    const tooltip = card.getByRole("tooltip");
    await expect(tooltip).toHaveCount(0);

    await mark.tap();
    await expect(tooltip).toHaveText(copy.legend);
    await expect(tooltip).toBeVisible();
    // It stays on screen at phone width.
    const box = await tooltip.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error("no tooltip box or viewport");
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);

    // A second tap closes it.
    await mark.tap();
    await expect(tooltip).toHaveCount(0);

    // Esc closes it.
    await mark.tap();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);

    // A tap outside closes it.
    await mark.tap();
    await expect(tooltip).toBeVisible();
    await page.getByRole("heading", { level: 1 }).tap();
    await expect(tooltip).toHaveCount(0);
  });
});
