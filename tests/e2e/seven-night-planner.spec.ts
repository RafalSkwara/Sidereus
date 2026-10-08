import { expect, test, type Page } from "@playwright/test";

import { translateKey } from "@/i18n";
import { en } from "@/i18n/messages/en";
import { OUTLOOK_NIGHTS } from "@/lib/engine/parameters";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * The seven-night strip and site switching, end to end (S-05, US-03, FR-011 / FR-012), walked by one user from the
 * shared onboarding in Madrid. Since tonight-dashboard the strip lives on /tonight/nights while the site pickers stay
 * on Tonight: a site picked there (and remembered in its cookie) carries to the nights page. The forecast fixture is
 * an all-clear sky and the clock is real, so the spec never asserts which nights are go, which objects rank or which
 * times are shown, only the strip's shape and which site and time zone it is for.
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
/** The Site card on the dashboard (ui-user-adjustments): a select for two or more sites, else the name plus Manage. */
const siteCard = (page: Page) => page.locator('[data-gear-card="site"]');
/** The card's select; the card's title is its label. Exact, so no other "Site" label can match. */
const siteSelect = (page: Page) => page.getByLabel(t.siteSelector.label, { exact: true });
const chosenSite = (page: Page) => siteSelect(page).locator("option:checked");

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** "Cloud ~<n>%", with or without ", down to <n>%": the same prefix in both forms. */
const CLOUD_TEXT = new RegExp(`${escapeRegExp(t.nights.cloud({ mean: "" }).replace(/%$/, ""))}\\d+%`);

async function openTonight(page: Page, query = "") {
  await page.goto(`/tonight${query}`);
  await expect(page.getByRole("heading", { level: 1, name: t.title })).toBeVisible();
  // The skeleton already carries the title: wait for the island (the verdict always renders) before counting pickers.
  await expect(page.locator('section[aria-labelledby="verdict-heading"]')).toBeVisible();
}

/** Opens the Next 7 nights page; its skeleton already carries the title, so `expectStripFor` waits for the island. */
async function openNights(page: Page) {
  await page.goto("/tonight/nights");
  await expect(
    page.getByRole("heading", { level: 1, name: t.summary.nights({ count: String(OUTLOOK_NIGHTS) }) }),
  ).toBeVisible();
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
  await expect(page.getByRole("status").filter({ hasText: en.gear.notice.saved.site })).toBeVisible();
  await expect(page).toHaveURL(/\/gear$/);
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
  await page.getByRole("alertdialog").getByRole("button", { name: label }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page).toHaveURL(/\/gear$/);
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("the strip shows seven nights, and switching sites moves it to the other site and time zone", async ({ page }) => {
  test.setTimeout(120_000);
  await onboardInMadrid(page, "e2e-seven-nights");

  // One site: no site selector on Tonight, and the strip for it on the nights page.
  const first = await siteName(page);
  await openTonight(page);
  await expect(siteCard(page).locator("[data-gear-name]")).toHaveText(first);
  await expect(siteSelect(page)).toHaveCount(0);
  await openNights(page);
  await expectStripFor(page, first, "Europe/Madrid");

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

  // A second site in another time zone: a select, the oldest (the onboarded one) chosen by default.
  await addSite(page);
  await openTonight(page);
  await expect(siteSelect(page).locator("option")).toHaveCount(2);
  await expect(chosenSite(page)).toHaveText(first);
  await openNights(page);
  await expectStripFor(page, first, "Europe/Madrid");

  // Picking the second on Tonight moves the nights page there, in its zone; plain /tonight remembers the pick.
  await openTonight(page);
  await siteSelect(page).selectOption({ label: SECOND_SITE.name });
  await expect(page).toHaveURL(/\/tonight\?site=[0-9a-f-]{36}$/);
  await expect(chosenSite(page)).toHaveText(SECOND_SITE.name);
  await openNights(page);
  await expectStripFor(page, SECOND_SITE.name, SECOND_SITE.zone);
  await openTonight(page);
  await expect(chosenSite(page)).toHaveText(SECOND_SITE.name);

  // The remembered site is deleted: Tonight and the nights page fall back to the first, without an error or a site
  // selector.
  await deleteGear(page, SECOND_SITE.name);
  await openTonight(page);
  await expect(siteCard(page).locator("[data-gear-name]")).toHaveText(first);
  await expect(siteSelect(page)).toHaveCount(0);
  await expect(page.locator('form[data-gear-select="site"]')).toHaveCount(0);
  await openNights(page);
  await expectStripFor(page, first, "Europe/Madrid");
  await expect(page.getByText(t.failed)).toHaveCount(0);
  await expect(strip(page).locator("ol > li")).toHaveCount(7);
});
