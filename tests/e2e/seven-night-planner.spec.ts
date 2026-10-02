import { expect, test, type Page } from "@playwright/test";

import { translateKey } from "@/i18n";
import { en } from "@/i18n/messages/en";
import { OUTLOOK_NIGHTS } from "@/lib/engine/parameters";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * The seven-night strip and site switching on Tonight, end to end (S-05, US-03, FR-011 / FR-012), walked by one
 * user from the shared onboarding in Madrid. The forecast fixture is an all-clear sky and the clock is real, so
 * the spec never asserts which nights are go, which objects rank or which times are shown, only the strip's
 * shape and which site and time zone it is for.
 */

const SITE_FORM = 'form[action="/api/gear/sites"]';
/** A second site in another time zone; the form resolves the zone from the coordinates (Atlantic/Canary). */
const SECOND_SITE = { name: "Tenerife Plateau", latitude: "28.29", longitude: "-16.63", zone: "Atlantic/Canary" };

const t = en.tonight;
/** Every sky headline a verdict night can show (`skyHeadline`), none of which an outlook night may show. */
const HEADLINE_WORDS = [...Object.values(en.verdict.level), ...Object.values(en.verdict.sky), t.card.noDarkWindow];
/** The element carrying a night's headline; its attribute is the headline's catalogue key. */
const HEADLINE = "[data-sky-headline]";
const strip = (page: Page) => page.locator("section#nights");
const stripGroup = (page: Page, label: string) =>
  strip(page).getByRole("heading", { level: 3, name: label, exact: true }).locator("xpath=following-sibling::ol[1]");
const sitePills = (page: Page) => page.getByRole("navigation", { name: t.siteSelector.label, exact: true });

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** "Cloud ~<n>%", with or without ", down to <n>%": the same prefix in both forms. */
const CLOUD_TEXT = new RegExp(`${escapeRegExp(t.nights.cloud({ mean: "" }).replace(/%$/, ""))}\\d+%`);

async function openTonight(page: Page, query = "") {
  await page.goto(`/tonight${query}`);
  await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
}

async function expectStripFor(page: Page, site: string, zone: string) {
  await expect(
    strip(page).getByRole("heading", { level: 2, name: t.nights.heading({ count: String(OUTLOOK_NIGHTS), site }) }),
  ).toBeVisible();
  await expect(strip(page).getByText(t.nights.timesIn({ zone }), { exact: true })).toBeVisible();
}

async function addSite(page: Page) {
  await page.goto("/gear/sites/new");
  await waitForHydration(page, SITE_FORM);
  const form = page.locator(SITE_FORM);
  await form.locator("#name").fill(SECOND_SITE.name);
  await form.locator("#latitudeDeg").fill(SECOND_SITE.latitude);
  await form.locator("#longitudeDeg").fill(SECOND_SITE.longitude);
  await form.locator("#bortle").selectOption("3");
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/gear$/);
}

/** The name of the user's (only) site, as listed on `/gear`. */
async function siteName(page: Page): Promise<string> {
  await page.goto("/gear");
  const name = await page
    .locator('a[href^="/gear/sites/"]:not([href="/gear/sites/new"]) span.font-semibold')
    .first()
    .textContent();
  if (!name) throw new Error("no site listed on /gear");
  return name.trim();
}

/** Opens `/gear`, follows the edit link for the item named `name`, then deletes it (accepting the confirm). */
async function deleteGear(page: Page, name: string) {
  await page.goto("/gear");
  await page
    .locator('main a[href^="/gear/"]')
    .filter({ has: page.locator("span.font-semibold", { hasText: name }) })
    .first()
    .click();
  await expect(page).toHaveURL(/\/gear\/\w+\/[0-9a-f-]+$/);
  // DeleteButton asks for confirmation only once hydrated; clicked earlier it would post unconfirmed and leave
  // this listener waiting for the next deletion's dialog.
  await waitForHydration(page, 'form[action$="/delete"]');
  const confirmed = page.waitForEvent("dialog").then((dialog) => dialog.accept());
  await page.getByRole("button", { name: /delete/i }).click();
  await confirmed;
  await expect(page).toHaveURL(/\/gear$/);
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("the strip shows seven nights, and switching sites moves it to the other site and time zone", async ({ page }) => {
  test.setTimeout(120_000);
  await onboardInMadrid(page, "e2e-seven-nights");

  // One site: the strip for it, no site selector.
  const first = await siteName(page);
  await openTonight(page);
  await expectStripFor(page, first, "Europe/Madrid");
  await expect(sitePills(page)).toHaveCount(0);

  // Seven nights: 1-3 with a verdict, 4-7 with a cloud outlook and never a headline (invariant 5).
  await expect(strip(page).locator("ol > li")).toHaveCount(7);
  const verdictNights = stripGroup(page, t.nights.verdictLabel).locator("li");
  const outlookNights = stripGroup(page, t.nights.outlookLabel).locator("li");
  await expect(verdictNights).toHaveCount(3);
  await expect(outlookNights).toHaveCount(4);
  for (const night of await verdictNights.all()) {
    const headline = night.locator(HEADLINE);
    await expect(headline).toHaveCount(1);
    const key = await headline.getAttribute("data-sky-headline");
    if (!key) throw new Error("a verdict night's headline has no catalogue key");
    await expect(headline).toHaveText(translateKey(en, key, "errors.generic"));
    await expect(headline).toHaveText(new RegExp(`^(${HEADLINE_WORDS.map(escapeRegExp).join("|")})$`));
  }
  for (const night of await outlookNights.all()) {
    await expect(night).toContainText(CLOUD_TEXT);
    await expect(night.locator(HEADLINE)).toHaveCount(0);
    for (const word of HEADLINE_WORDS) {
      await expect(night).not.toContainText(word);
    }
  }

  // A second site in another time zone: pills, the oldest (the onboarded one) chosen by default.
  await addSite(page);
  await openTonight(page);
  await expect(sitePills(page).getByRole("link")).toHaveCount(2);
  await expect(sitePills(page).getByRole("link", { name: first, exact: true })).toHaveAttribute("aria-current", "page");
  await expectStripFor(page, first, "Europe/Madrid");

  // Picking the second moves the strip there, in its zone; plain /tonight remembers the pick.
  await sitePills(page).getByRole("link", { name: SECOND_SITE.name, exact: true }).click();
  await expect(page).toHaveURL(/\/tonight\?site=[0-9a-f-]{36}$/);
  await expect(sitePills(page).getByRole("link", { name: SECOND_SITE.name, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expectStripFor(page, SECOND_SITE.name, SECOND_SITE.zone);
  await openTonight(page);
  await expect(sitePills(page).getByRole("link", { name: SECOND_SITE.name, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expectStripFor(page, SECOND_SITE.name, SECOND_SITE.zone);

  // The remembered site is deleted: Tonight falls back to the first, without an error or a site selector.
  await deleteGear(page, SECOND_SITE.name);
  await openTonight(page);
  await expectStripFor(page, first, "Europe/Madrid");
  await expect(sitePills(page)).toHaveCount(0);
  await expect(page.locator('form[data-gear-select="site"]')).toHaveCount(0);
  await expect(page.getByText(t.failed)).toHaveCount(0);
  await expect(strip(page).locator("ol > li")).toHaveCount(7);
});
