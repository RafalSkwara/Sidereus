import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * The telescope selector and the gear-deletion empty states on Tonight, end to end (S-08, FR-019 / FR-021),
 * walked by one user from the shared onboarding in Madrid (default kit: one telescope, two eyepieces).
 * The clock is real, so the spec never asserts which objects rank, only that a ranking is shown.
 */

const TELESCOPE_FORM = 'form[action="/api/gear/telescopes"]';

const t = en.tonight;
const ranking = (page: Page) => page.locator('section[aria-labelledby="ranking-heading"]');
const pills = (page: Page) => page.getByRole("navigation", { name: t.selector.label });

async function addTelescope(page: Page, name: string) {
  await page.goto("/gear/telescopes/new");
  await waitForHydration(page, TELESCOPE_FORM);
  const form = page.locator(TELESCOPE_FORM);
  await form.locator("#name").fill(name);
  await form.locator("#apertureMm").fill("90");
  await form.locator("#focalLengthMm").fill("1250");
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/gear\?saved=telescope$/);
}

/** Opens `/gear`, follows the edit link for the item named `name`, then deletes it (confirming in the dialog). */
async function deleteGear(page: Page, name: string) {
  await page.goto("/gear");
  await page
    .locator('main a[href^="/gear/"]')
    .filter({ has: page.locator("[data-item-name]", { hasText: name }) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/gear\/\w+\/[0-9a-f-]+$/);
  const kind = /\/gear\/(sites|telescopes|eyepieces)\//.exec(page.url())?.[1] as "sites" | "telescopes" | "eyepieces";
  const label = en.gear[kind].delete;
  // DeleteButton opens its confirm dialog only once hydrated; clicked earlier it would post unconfirmed.
  await waitForHydration(page, 'form[action$="/delete"]');
  await page.getByRole("button", { name: label }).click();
  await page.getByRole("dialog").getByRole("button", { name: label }).click();
  await expect(page).toHaveURL(/\/gear\?deleted=(site|telescope|eyepiece)$/);
}

/** The names of the user's eyepieces, as listed on `/gear`. */
async function eyepieceNames(page: Page): Promise<string[]> {
  await page.goto("/gear");
  const links = page.locator('a[href^="/gear/eyepieces/"]:not([href="/gear/eyepieces/new"]) [data-item-name]');
  return (await links.allTextContents()).map((name) => name.trim());
}

/** The name of the user's (only) site, as listed on `/gear`. */
async function siteName(page: Page): Promise<string> {
  await page.goto("/gear");
  const name = await page
    .locator('a[href^="/gear/sites/"]:not([href="/gear/sites/new"]) [data-item-name]')
    .first()
    .textContent();
  if (!name) throw new Error("no site listed on /gear");
  return name.trim();
}

async function openTonight(page: Page, query = "") {
  await page.goto(`/tonight${query}`);
  await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("the ranking follows the chosen telescope, and deleting gear leaves honest empty states", async ({ page }) => {
  test.setTimeout(120_000);
  await onboardInMadrid(page, "e2e-selector");

  // One telescope: no selector, no "For your …" line.
  await expect(ranking(page).locator("ol > li").first()).toBeVisible();
  await expect(pills(page)).toHaveCount(0);
  await expect(page.locator('form[data-gear-select="telescope"]')).toHaveCount(0);
  const onboarded = (await page.locator("main").getByRole("link", { name: /·/ }).textContent())?.split("·")[1]?.trim();
  if (!onboarded) throw new Error("no telescope named under the Tonight title");

  // Two telescopes: pills, the oldest (the onboarded one) chosen by default.
  await addTelescope(page, "Second Scope");
  await openTonight(page);
  await expect(pills(page).getByRole("link")).toHaveCount(2);
  await expect(pills(page).getByRole("link", { name: onboarded })).toHaveAttribute("aria-current", "page");
  await expect(ranking(page)).toContainText(t.rankingFor({ telescope: onboarded }));

  // Picking the second re-ranks for it, and plain /tonight remembers the pick.
  await pills(page).getByRole("link", { name: "Second Scope" }).click();
  await expect(page).toHaveURL(/\/tonight\?telescope=[0-9a-f-]{36}$/);
  await expect(pills(page).getByRole("link", { name: "Second Scope" })).toHaveAttribute("aria-current", "page");
  await expect(ranking(page)).toContainText(t.rankingFor({ telescope: "Second Scope" }));
  await openTonight(page);
  await expect(pills(page).getByRole("link", { name: "Second Scope" })).toHaveAttribute("aria-current", "page");

  // Four telescopes: a dropdown instead of pills, switching as soon as one is picked.
  await addTelescope(page, "Third Scope");
  await addTelescope(page, "Fourth Scope");
  await openTonight(page);
  await expect(pills(page)).toHaveCount(0);
  const select = page.getByLabel(t.selector.label);
  await expect(select.locator("option")).toHaveCount(4);
  await expect(
    page.locator('form[data-gear-select="telescope"]').getByRole("button", { name: t.selector.show }),
  ).toBeHidden();
  await select.selectOption({ label: "Third Scope" });
  await expect(page).toHaveURL(/\/tonight\?telescope=[0-9a-f-]{36}$/);
  await expect(ranking(page)).toContainText(t.rankingFor({ telescope: "Third Scope" }));

  // The remembered telescope is deleted: Tonight falls back to the oldest, without an error.
  await deleteGear(page, "Third Scope");
  await deleteGear(page, "Fourth Scope");
  await openTonight(page);
  await expect(pills(page).getByRole("link", { name: onboarded })).toHaveAttribute("aria-current", "page");
  await expect(ranking(page).locator("ol > li").first()).toBeVisible();
  await expect(page.getByText(t.failed)).toHaveCount(0);

  // No eyepieces: the ranking still shows, without pairs, and the page says how to get them back, once, above the
  // planets and the ranking (the notice speaks for both).
  for (const eyepiece of await eyepieceNames(page)) {
    await deleteGear(page, eyepiece);
  }
  await openTonight(page);
  await expect(ranking(page).locator("ol > li").first()).toBeVisible();
  await expect(ranking(page)).not.toContainText(t.object.findWith);
  await expect(ranking(page)).not.toContainText(t.object.noneFit({ name: "" }).split("(")[0] ?? "");
  await expect(page.locator("main").getByText(t.noEyepiecesPrompt)).toHaveCount(1);
  await expect(page.locator("main").getByText(t.noEyepiecesPrompt)).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: t.addEyepieces })).toHaveAttribute(
    "href",
    "/gear/eyepieces/new",
  );

  // Back to one telescope: no selector. No telescope: the add-telescope prompt.
  await deleteGear(page, "Second Scope");
  await openTonight(page);
  await expect(pills(page)).toHaveCount(0);
  await deleteGear(page, onboarded);
  await openTonight(page);
  await expect(page.getByText(t.addTelescopePrompt)).toBeVisible();
  await expect(page.getByRole("link", { name: t.addTelescope })).toHaveAttribute("href", "/gear/telescopes/new");
  await expect(ranking(page)).toHaveCount(0);

  // No site either: one route back to setup.
  await deleteGear(page, await siteName(page));
  await openTonight(page);
  await expect(page.getByText(t.setupPrompt)).toBeVisible();
  await expect(page.getByRole("link", { name: t.setup })).toHaveAttribute("href", "/onboarding");
});
