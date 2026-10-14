import { expect, test, type Browser, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { PASSWORD, onboardInMadrid, planEditable, requirePlanGrant, setPlan, waitForHydration } from "./helpers";

/*
 * Editing the Session plan (adjustable-session-plan Phase 5): a full-plan user opens the editor on /tonight/plan, moves,
 * removes and adds targets and saves them in one POST; the saved order reaches another device, the keyboard keeps its
 * place, Reset asks once, a free account gets the lock line instead of an editor, offline only the network controls
 * mute, and a refused save comes back as an inline alert. Each test signs up its own fresh Madrid user and, where it
 * edits, grants the full plan through the operator command (`requirePlanGrant`, the local stack's key inline on the
 * command); a night that does not pass (`planEditable`) skips the editing tests. Same setup as the other specs: a
 * production preview on local Supabase with the all-clear forecast fixture.
 */

const PLAN_PAGE = "/tonight/plan";
const t = en.tonight.pages.plan;
const EDIT_BUTTON = '[data-plan-editor="closed"] button';
const SIGNIN_FORM = 'form[action="/api/auth/signin"]';

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

/** The timeline's rows, in their order, by target key. */
function timelineKeys(page: Page): Promise<string[]> {
  return page
    .locator("[data-session-plan-row]")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-session-plan-row") ?? ""));
}

/** The open editor's rows, in their order, by target key. */
function editorKeys(page: Page): Promise<string[]> {
  return page
    .locator("[data-plan-editor-row]")
    .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-plan-editor-row") ?? ""));
}

/** One of a row's editor controls (`move-up`, `move-down`, `remove`) by the row's key. */
function control(page: Page, kind: "move-up" | "move-down" | "remove", key: string) {
  return page.locator(`[data-editor-control="${kind}"][data-key="${key}"]`);
}

/**
 * A fresh full-plan user on tonight's plan with the editor hydrated, or a skip when tonight does not pass. Returns the
 * user's email and the suggested plan's keys (at least three, which every test that edits needs).
 */
async function fullUserOnPlan(page: Page, prefix: string): Promise<{ email: string; suggested: string[] }> {
  requirePlanGrant("session-plan-edit");
  const email = await onboardInMadrid(page, prefix);
  await setPlan(email, "full");
  await page.goto(PLAN_PAGE);
  test.skip(!(await planEditable(page)), "tonight's plan is not editable (the night does not pass)");
  await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "suggested");
  const suggested = await timelineKeys(page);
  expect(suggested.length, "the fixture's clear night recommends several targets").toBeGreaterThanOrEqual(3);
  await waitForHydration(page, EDIT_BUTTON);
  return { email, suggested };
}

/** The editor row's visible name (its first line), which the icon buttons' accessible names carry. */
async function rowName(page: Page, key: string): Promise<string> {
  return (await page.locator(`[data-plan-editor-row="${key}"] p`).first().textContent()) ?? key;
}

async function openEditor(page: Page) {
  await page.getByRole("button", { name: t.edit }).click();
  await expect(page.locator('[data-plan-editor="open"]')).toBeVisible();
}

/** Saves the open editor and waits for the toast, its clean URL and the edited plan. */
async function save(page: Page) {
  await page.getByRole("button", { name: t.save }).click();
  await expect(page.locator("[data-toast]").filter({ hasText: t.saved })).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === PLAN_PAGE && /^\?site=[0-9a-f-]+$/.test(url.search));
  await expect(page.locator("html")).not.toHaveAttribute("data-from-device");
  await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "edited");
}

/** Signs the same user in on a second browser context (another device) and opens the plan there. */
async function secondDevice(browser: Browser, baseURL: string, email: string): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL }]);
  const page = await context.newPage();
  await page.goto("/auth/signin");
  await waitForHydration(page, SIGNIN_FORM);
  const form = page.locator(SIGNIN_FORM);
  await form.locator("#email").fill(email);
  await form.locator("#password").fill(PASSWORD);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/tonight$/);
  await page.goto(PLAN_PAGE);
  await expect(page.locator("[data-session-plan-state]")).toBeAttached();
  return page;
}

/**
 * Picks a candidate in the add picker by typing, and adds it: the first option the open list offers, typed as its
 * Messier number ("31") when it has one, else as its name. Returns the added row's key.
 */
async function addFirstCandidate(page: Page): Promise<string> {
  const picker = page.getByRole("combobox", { name: t.addLabel });
  await picker.focus();
  const firstOption = page.getByRole("listbox", { name: t.addLabel }).getByRole("option").first();
  await expect(firstOption).toBeVisible();
  const label = (await firstOption.locator("span").first().textContent()) ?? "";
  const messier = /^M(\d+)/.exec(label);
  await picker.fill(messier ? messier[1] : label);
  await expect(page.getByRole("listbox", { name: t.addLabel }).getByRole("option").first()).toContainText(label);
  await picker.press("Enter");
  await expect(picker).toHaveValue(label);
  const before = await editorKeys(page);
  await page.getByRole("button", { name: t.add, exact: true }).click();
  await expect(page.locator("[data-plan-editor-row]")).toHaveCount(before.length + 1);
  const added = (await editorKeys(page)).at(-1) ?? "";
  expect(before, "the added target was not on the list").not.toContain(added);
  return added;
}

test("a full user removes, moves and adds a target, saves, and sees the plan in their order", async ({ page }) => {
  test.setTimeout(120_000);
  const { suggested } = await fullUserOnPlan(page, "e2e-plan-edit");
  const [first, second, third, ...rest] = suggested;

  await openEditor(page);
  // The timeline is hidden while the editor lists the same targets.
  await expect(page.locator("[data-session-plan-row]").first()).toBeHidden();
  expect(await editorKeys(page)).toEqual(suggested);

  // The icon buttons are found by their accessible names, which carry the row's name.
  await page.getByRole("button", { name: t.remove({ name: await rowName(page, first) }), exact: true }).click();
  await page.getByRole("button", { name: t.moveUp({ name: await rowName(page, third) }), exact: true }).click();
  expect(await editorKeys(page)).toEqual([third, second, ...rest]);
  const added = await addFirstCandidate(page);

  await save(page);
  expect(await timelineKeys(page)).toEqual([third, second, ...rest, added]);
  await expect(page.locator("[data-session-plan-line-edited]")).toContainText(t.edited);
  await expect(page.getByRole("list", { name: t.listLabelEdited })).toBeVisible();
});

test("a second device of the same user shows the saved order", async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  const { email, suggested } = await fullUserOnPlan(page, "e2e-plan-device");
  const [first, second, ...rest] = suggested;

  await openEditor(page);
  await control(page, "move-down", first).click();
  await save(page);
  const order = [second, first, ...rest];
  expect(await timelineKeys(page)).toEqual(order);

  const other = await secondDevice(browser, baseURL ?? "http://localhost:4321", email);
  try {
    await expect(other.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "edited");
    expect(await timelineKeys(other)).toEqual(order);
  } finally {
    await other.context().close();
  }
});

test("with the keyboard, focus stays on the moved row's control and moves on after Remove", async ({ page }) => {
  test.setTimeout(120_000);
  const { suggested } = await fullUserOnPlan(page, "e2e-plan-keys");
  const [first, second, ...rest] = suggested;

  // Opening puts focus on the list.
  await page.locator(EDIT_BUTTON).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-plan-editor-list]")).toBeFocused();

  // Move down, then back up to the top: focus stays on the same control of the same row.
  await control(page, "move-down", first).focus();
  await page.keyboard.press("Enter");
  expect(await editorKeys(page)).toEqual([second, first, ...rest]);
  await expect(control(page, "move-down", first)).toBeFocused();
  await control(page, "move-up", first).focus();
  await page.keyboard.press("Enter");
  expect(await editorKeys(page)).toEqual(suggested);
  // At the top, Move up is aria-disabled but keeps focus, and pressing it again changes nothing.
  await expect(control(page, "move-up", first)).toBeFocused();
  await expect(control(page, "move-up", first)).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  expect(await editorKeys(page)).toEqual(suggested);

  // Remove: focus goes to the next row's Remove; after the last entry, to the list.
  await control(page, "remove", first).focus();
  await page.keyboard.press("Enter");
  await expect(control(page, "remove", second)).toBeFocused();
  const last = suggested.at(-1) ?? "";
  await control(page, "remove", last).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-plan-editor-list]")).toBeFocused();

  // Cancel closes the editor, drops the changes and returns focus to Edit.
  await page.getByRole("button", { name: t.cancel, exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(EDIT_BUTTON)).toBeFocused();
  expect(await timelineKeys(page)).toEqual(suggested);
});

test("Reset asks once, then restores the suggested order", async ({ page }) => {
  test.setTimeout(120_000);
  const { suggested } = await fullUserOnPlan(page, "e2e-plan-reset");
  const first = suggested[0];

  await openEditor(page);
  await control(page, "move-down", first).click();
  await save(page);
  expect(await timelineKeys(page)).not.toEqual(suggested);
  await waitForHydration(page, "[data-session-plan-line-edited] button");

  const reset = page.getByRole("button", { name: t.reset });
  const dialog = page.getByRole("alertdialog");
  await reset.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(t.resetConfirm);
  await expect(dialog.getByRole("button", { name: t.resetCancel })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "edited");

  await reset.click();
  await dialog.getByRole("button", { name: t.resetConfirmYes }).click();
  await expect(page.locator("[data-toast]").filter({ hasText: t.resetDone })).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === PLAN_PAGE && /^\?site=[0-9a-f-]+$/.test(url.search));
  await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "suggested");
  expect(await timelineKeys(page)).toEqual(suggested);
});

test("a free account sees the lock line and no editor", async ({ page }) => {
  await onboardInMadrid(page, "e2e-plan-free");
  await page.goto(PLAN_PAGE);
  await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "locked");
  await expect(page.locator('[data-session-plan-note="locked"]')).toHaveText(t.locked);
  await expect(page.locator("[data-plan-editor]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: t.edit })).toHaveCount(0);
  await expect(page.getByRole("button", { name: t.reset })).toHaveCount(0);
});

test("offline, Edit, Save and Reset are disabled while Move, Remove and Cancel still work", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const { suggested } = await fullUserOnPlan(page, "e2e-plan-offline");
  const [first, second, ...rest] = suggested;

  // An edited plan, so the Reset trigger is on the page.
  await openEditor(page);
  await control(page, "move-down", first).click();
  await save(page);
  await waitForHydration(page, EDIT_BUTTON);
  await openEditor(page);

  // Only the page's `navigator.onLine` goes offline: nothing here navigates, so the worker's network does not matter.
  await context.setOffline(true);
  try {
    await expect(page.locator("html")).toHaveAttribute("data-offline");
    const saveButton = page.getByRole("button", { name: t.save });
    await expect(saveButton).toHaveAttribute("aria-disabled", "true");
    await saveButton.click({ force: true });
    await expect(page.locator('[data-plan-editor="open"]')).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === PLAN_PAGE && !url.search.includes("saved"));

    // Move and Remove need no network.
    expect(await editorKeys(page)).toEqual([second, first, ...rest]);
    await control(page, "move-up", first).click();
    expect(await editorKeys(page)).toEqual(suggested);
    await control(page, "remove", first).click();
    expect(await editorKeys(page)).toEqual([second, ...rest]);

    // Cancel closes the editor; Edit and Reset are then disabled and do nothing.
    await page.getByRole("button", { name: t.cancel, exact: true }).click();
    const edit = page.locator(EDIT_BUTTON);
    await expect(edit).toHaveAttribute("aria-disabled", "true");
    await edit.click({ force: true });
    await expect(page.locator('[data-plan-editor="open"]')).toHaveCount(0);
    const reset = page.getByRole("button", { name: t.reset });
    await expect(reset).toHaveAttribute("aria-disabled", "true");
    await reset.click({ force: true });
    await expect(page.getByRole("alertdialog")).toBeHidden();
  } finally {
    await context.setOffline(false);
  }
});

test("a save for a night that is over comes back as an inline alert", async ({ page }) => {
  test.setTimeout(120_000);
  await fullUserOnPlan(page, "e2e-plan-stale");

  await openEditor(page);
  // The form as a page left open past its night would post it: a night that is no longer tonight.
  await page.locator('[data-plan-editor-save] input[name="night"]').evaluate((input: HTMLInputElement) => {
    input.value = "2000-01-01";
  });
  await page.getByRole("button", { name: t.save }).click();

  await expect(page).toHaveURL((url) => url.searchParams.get("error") === "errors.sessionPlan.nightOver");
  await expect(page.getByRole("alert").filter({ hasText: en.errors.sessionPlan.nightOver })).toBeVisible();
  await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "suggested");
});
