import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";
import { createFormatter } from "@/lib/tonight/format";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * The observation log, end to end (S-07, FR-017 / FR-021 / FR-022), walked by one user from the shared
 * onboarding in Madrid: add an entry by hand, edit it, move it to a telescope and delete that telescope, then
 * delete the entry. The Tonight ranking is not asserted here (real clock); how edits and deletions feed it is
 * pinned by tests/db/observations.test.ts.
 */

const t = en.log;
const MANUAL_FORM = 'form[action="/api/log"]';
const EDIT_FORM = 'form[action^="/api/log/"]:not([action$="/delete"])';
const DELETE_FORM = 'form[action$="/delete"]';
const TELESCOPE_FORM = 'form[action="/api/gear/telescopes"]';

const logEntry = (page: Page, id: string) => page.locator('main a[href^="/log/"]').filter({ hasText: id });

async function addTelescope(page: Page, name: string) {
  await page.goto("/gear/telescopes/new");
  await waitForHydration(page, TELESCOPE_FORM);
  const form = page.locator(TELESCOPE_FORM);
  await form.locator("#name").fill(name);
  await form.locator("#apertureMm").fill("80");
  await form.locator("#focalLengthMm").fill("400");
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/gear$/);
}

async function deleteTelescope(page: Page, name: string) {
  await page.goto("/gear");
  await page
    .locator('main a[href^="/gear/telescopes/"]')
    .filter({ has: page.locator("span.font-semibold", { hasText: name }) })
    .click();
  // DeleteButton asks for confirmation only once hydrated (see telescope-selector.spec.ts).
  await waitForHydration(page, DELETE_FORM);
  const confirmed = page.waitForEvent("dialog").then((dialog) => dialog.accept());
  await page.locator(DELETE_FORM).getByRole("button").click();
  await confirmed;
  await expect(page).toHaveURL(/\/gear$/);
}

async function openEntry(page: Page, id: string) {
  await page.goto("/log");
  await logEntry(page, id).click();
  await expect(page).toHaveURL(/\/log\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(t.editTitle({ object: id }));
  await waitForHydration(page, EDIT_FORM);
  return page.locator(EDIT_FORM);
}

async function rate(form: ReturnType<Page["locator"]>, rating: number) {
  // The radios are visually hidden inside their labels; click the label, as a user does.
  await form
    .locator("label")
    .filter({ hasText: new RegExp(`^${rating}$`) })
    .click();
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("a user adds, edits and deletes log entries, including one whose telescope was deleted", async ({ page }) => {
  test.setTimeout(120_000);
  await onboardInMadrid(page, "e2e-log-management");

  // The log starts empty and offers both ways in.
  await page.getByRole("link", { name: en.nav.log }).click();
  await expect(page).toHaveURL(/\/log$/);
  await expect(page.getByText(t.list.empty)).toBeVisible();

  // Manual entry: find M31 by number in the picker, choose it with the keyboard, rate it.
  await page.getByRole("link", { name: t.list.add }).first().click();
  await expect(page).toHaveURL(/\/log\/new\?from=log$/);
  await waitForHydration(page, MANUAL_FORM);
  const manual = page.locator(MANUAL_FORM);
  const picker = manual.getByRole("combobox", { name: t.picker.label });
  await picker.fill("31");
  await expect(manual.getByRole("option").first()).toContainText("M31");
  await picker.press("Enter");
  await expect(picker).toHaveValue(/^M31 · /);
  await rate(manual, 4);
  const night = await manual.locator("#night").inputValue();
  await manual.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/log\?saved=31$/);
  await expect(page.getByRole("status")).toHaveText(t.list.saved({ object: "M31" }));
  await expect(logEntry(page, "M31")).toContainText(t.list.rated({ rating: "4" }));
  // It sits under the heading of the night it was logged for.
  await expect(page.locator("main section").filter({ hasText: "M31" }).getByRole("heading", { level: 2 })).toHaveText(
    createFormatter("en").formatNightDate(night),
  );

  // The edit form comes prefilled. Enter in the object field submits it as it is: focusing the picker highlights
  // no option, so the object cannot be swapped by accident.
  let form = await openEntry(page, "M31");
  await expect(form.getByRole("radio", { name: "4", exact: true })).toBeChecked();
  await form.getByRole("combobox", { name: t.picker.label }).press("Enter");
  await expect(page).toHaveURL(/\/log\?updated=31$/);
  await expect(logEntry(page, "M31")).toContainText(t.list.rated({ rating: "4" }));

  // Lower the rating to 2.
  form = await openEntry(page, "M31");
  await rate(form, 2);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/log\?updated=31$/);
  await expect(page.getByRole("status")).toHaveText(t.list.updated({ object: "M31" }));
  await expect(logEntry(page, "M31")).toContainText(t.list.rated({ rating: "2" }));

  // Move the entry to a second telescope, then delete that telescope: the entry stays, marked "(deleted)".
  await addTelescope(page, "Travel refractor");
  form = await openEntry(page, "M31");
  await form.locator("#telescopeId").selectOption({ label: "Travel refractor" });
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/log\?updated=31$/);
  await deleteTelescope(page, "Travel refractor");

  await page.goto("/log");
  await expect(logEntry(page, "M31")).toContainText(t.list.deletedGear({ name: "Travel refractor" }));

  // The entry still edits, keeping the deleted telescope.
  form = await openEntry(page, "M31");
  await expect(form.locator("#telescopeId")).toHaveValue("");
  await rate(form, 3);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/log\?updated=31$/);
  await expect(logEntry(page, "M31")).toContainText(t.list.rated({ rating: "3" }));
  await expect(logEntry(page, "M31")).toContainText(t.list.deletedGear({ name: "Travel refractor" }));

  // Delete the entry (accepting the confirm): the log is empty again.
  await openEntry(page, "M31");
  await waitForHydration(page, DELETE_FORM);
  const confirmed = page.waitForEvent("dialog").then((dialog) => dialog.accept());
  await page.getByRole("button", { name: t.delete }).click();
  await confirmed;
  await expect(page).toHaveURL(/\/log\?deleted=31$/);
  await expect(page.getByRole("status")).toHaveText(t.list.deleted({ object: "M31" }));
  await expect(page.getByText(t.list.empty)).toBeVisible();
});

test("an unknown entry reads as not found", async ({ page }) => {
  await onboardInMadrid(page, "e2e-log-missing");

  const response = await page.goto("/log/00000000-0000-4000-8000-000000000000");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.notFound);
});
