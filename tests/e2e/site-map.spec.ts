import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, stubMapTiles, waitForHydration } from "./helpers";

/*
 * "Pick from map" on the add/edit site form (S-09). Choosing it is the user's consent, so before the click the
 * page must request no map tile and no map code or CSS; after it, a tap drops a pin that fills the fields rounded
 * to about 1 km. Tiles are stubbed; the screenshots in the change's evidence use the real ones.
 */

const NEW_SITE_FORM = 'form[action="/api/gear/sites"]';
const EDIT_SITE_FORM = 'form[action^="/api/gear/sites/"]';
const TWO_DECIMALS = /^-?\d+(\.\d{1,2})?$/;

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

/** Counts the page's requests for the map's lazy chunk and Leaflet's stylesheet. */
function countMapAssets(page: Page): { count(): number } {
  let requests = 0;
  page.on("request", (request) => {
    if (/\/_astro\/(map-panel|leaflet)/.test(request.url())) requests += 1;
  });
  return { count: () => requests };
}

test("a new site loads the map only on click and saves a tapped point rounded", async ({ page }) => {
  await onboardInMadrid(page, "e2e-site-map");
  const tiles = await stubMapTiles(page);
  const mapAssets = countMapAssets(page);

  await page.goto("/gear/sites/new");
  await waitForHydration(page, NEW_SITE_FORM);
  const form = page.locator(NEW_SITE_FORM);
  // A preload would start after hydration (an effect), so let the page settle before counting.
  await page.waitForLoadState("networkidle");
  expect(tiles.count()).toBe(0);
  expect(mapAssets.count()).toBe(0);

  await form.getByRole("button", { name: en.location.pickFromMap }).click();
  const map = form.getByRole("region", { name: en.location.mapLabel });
  await expect(map).toBeVisible();
  await expect.poll(() => tiles.count()).toBeGreaterThan(0);
  expect(mapAssets.count()).toBeGreaterThan(0);

  const box = await map.locator(".leaflet-container").boundingBox();
  if (!box) throw new Error("the map has no box");
  await page.mouse.click(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40);

  const latitude = form.locator("#latitudeDeg");
  const longitude = form.locator("#longitudeDeg");
  await expect(latitude).toHaveValue(TWO_DECIMALS);
  await expect(longitude).toHaveValue(TWO_DECIMALS);
  const picked = { latitude: Number(await latitude.inputValue()), longitude: Number(await longitude.inputValue()) };
  expect(picked).not.toEqual({ latitude: 50, longitude: 15 });
  await expect(form.getByText(en.location.usingMap)).toBeVisible();

  // A map pick fills neither the name nor the sky class.
  await expect(form.locator("#name")).toHaveValue("");
  await form.locator("#name").fill("Map pick");
  await form.locator("#bortle").selectOption("5");
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/gear\?saved=site$/);
  await expect(page.getByText(`${picked.latitude.toFixed(2)}, ${picked.longitude.toFixed(2)}`)).toBeVisible();
});

test("editing a site: the map opens on the saved point, and Undo restores it and closes the map", async ({ page }) => {
  await onboardInMadrid(page, "e2e-site-map");
  await stubMapTiles(page);

  await page.goto("/gear");
  await page.locator('a[href^="/gear/sites/"]:not([href="/gear/sites/new"])').first().click();
  await waitForHydration(page, EDIT_SITE_FORM);
  const form = page.locator(EDIT_SITE_FORM);
  const latitude = form.locator("#latitudeDeg");
  const longitude = form.locator("#longitudeDeg");

  await form.getByRole("button", { name: en.location.pickFromMap }).click();
  const map = form.getByRole("region", { name: en.location.mapLabel });
  await expect(map.locator(".leaflet-container")).toBeFocused();
  await expect(map.locator(".map-pin")).toBeVisible();
  await expect(latitude).toHaveValue("40.42");
  await expect(longitude).toHaveValue("-3.7");

  // Pan with the keyboard, then pick the new centre.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await form.getByRole("button", { name: en.location.pinAtCentre }).click();
  await expect(longitude).not.toHaveValue("-3.7");
  const previous = form.getByText(en.siteForm.previousLocation({ latitude: "40.42", longitude: "-3.7" }));
  await expect(previous).toBeVisible();

  await form.getByRole("button", { name: en.siteForm.undoLocation }).click();
  await expect(latitude).toHaveValue("40.42");
  await expect(longitude).toHaveValue("-3.7");
  await expect(map).toBeHidden();
  await expect(previous).toBeHidden();
});
