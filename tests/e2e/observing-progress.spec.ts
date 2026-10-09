import { expect, test, type Locator, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";
import { createFormatter } from "@/lib/tonight/format";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * Observing progress (M-3 S-05, FR-039/FR-040). The Tonight half: the "not seen yet" mark on Tonight's targets follows
 * the log. The page half: `/log/progress` counts and ticks only entries rated 3 or above, and follows edits and deletes. From the shared onboarding in Madrid on the all-clear forecast fixture; the clock is real, so the spec never
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

test("on a desktop, hover opens the tooltip, and Esc keeps it closed once the pointer leaves", async ({ page }) => {
  test.setTimeout(120_000);
  await onboardInMadrid(page, "e2e-progress-desktop");

  const { card } = await firstCard(page);
  await expect(page.locator("html[data-not-seen-tip='ready']")).toHaveCount(1);
  const mark = markOf(card);
  const tooltip = card.getByRole("tooltip");

  await mark.hover();
  await expect(tooltip).toHaveText(copy.legend);

  // Clicked open and dismissed with Esc: the still-focused button now matches :focus-visible, which must not
  // bring the tooltip back when the pointer moves away.
  await mark.click();
  await page.keyboard.press("Escape");
  await expect(tooltip).toHaveCount(0);
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);

  // Once both the pointer and the focus have left, hovering opens it again.
  await page.getByRole("heading", { level: 1 }).click();
  await mark.hover();
  await expect(tooltip).toBeVisible();
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

test.describe("the progress page", () => {
  const progress = en.progress;
  const count = (seen: number, total: number) => progress.count({ seen: String(seen), total: String(total) });
  const messierHeading = (page: Page) => page.locator("#progress-messier-heading");
  const m31Chip = (page: Page) => page.locator('[data-checklist-item="M31"]');

  /** Logs `object` rated `rating` from the log's manual entry; returns the night the form proposed. */
  async function logManually(page: Page, object: string, rating: number): Promise<string> {
    await page.goto(`/log/new?object=${object}&from=log`);
    await waitForHydration(page, LOG_FORM);
    const form = page.locator(LOG_FORM);
    const night = await form.locator("#night").inputValue();
    await rate(form, rating);
    await form.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/log$/);
    return night;
  }

  test("counts only entries rated 3 or above, shows a planet's first night, and follows edits and deletes", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await onboardInMadrid(page, "e2e-progress-page");

    // 1. The log's Progress link opens the page; nothing is seen yet, but every band shows.
    await page.goto("/log");
    await page.getByRole("link", { name: en.log.list.progress }).click();
    await expect(page).toHaveURL(/\/log\/progress$/);
    await expect(messierHeading(page)).toContainText(count(0, 110));
    await expect(page.locator("#progress-caldwell-heading")).toContainText(count(0, 61));
    await expect(page.locator("[data-progress-firsts] li")).toHaveCount(8);
    await expect(page.locator("[data-checklist-item]")).toHaveCount(171);
    await expect(page.getByRole("link", { name: progress.empty })).toBeVisible();

    // 2. A rating of 2 ticks nothing.
    await logManually(page, "M31", 2);
    await page.goto("/log/progress");
    await expect(messierHeading(page)).toContainText(count(0, 110));
    await expect(m31Chip(page)).toHaveCount(1);
    await expect(m31Chip(page)).not.toHaveAttribute("data-seen", /.*/);

    // 3. Re-rated to 4, it counts, its chip is ticked and it is listed under seen.
    await page.goto("/log");
    await page.locator('main a[href^="/log/"]').filter({ hasText: "M31" }).click();
    await expect(page).toHaveURL(/\/log\/[0-9a-f-]{36}$/);
    await waitForHydration(page, EDIT_FORM);
    await rate(page.locator(EDIT_FORM), 4);
    await page.locator(EDIT_FORM).locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/log$/);
    await page.goto("/log/progress");
    await expect(messierHeading(page)).toContainText(count(1, 110));
    await expect(m31Chip(page)).toHaveAttribute("data-seen", "");
    await expect(page.locator('[data-seen-item="M31"]')).toHaveCount(1);
    await expect(page.locator("[data-progress-empty]")).toHaveCount(0);

    // 4. Jupiter rated 3 shows the night it was logged as its first.
    const night = await logManually(page, "jupiter", 3);
    expect(night).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await page.goto("/log/progress");
    await expect(page.locator('[data-first="jupiter"]')).toContainText(
      progress.firstSeen({ date: createFormatter("en").formatShortDate(night) }),
    );
    await expect(page.locator('[data-first="saturn"]')).toContainText(progress.notYet);

    // 5. Deleting the M31 entry takes the count back to 0.
    await page.goto("/log");
    await page.locator('main a[href^="/log/"]').filter({ hasText: "M31" }).click();
    await waitForHydration(page, 'form[action$="/delete"]');
    await page.getByRole("button", { name: en.log.delete }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: en.log.delete }).click();
    await expect(page).toHaveURL(/\/log$/);
    await page.goto("/log/progress");
    await expect(messierHeading(page)).toContainText(count(0, 110));
    await expect(m31Chip(page)).not.toHaveAttribute("data-seen", /.*/);
  });
});
