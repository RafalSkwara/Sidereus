import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, test, waitForHydration, waitForServiceWorker } from "./helpers";
import { Proxy } from "./offline-proxy";

/*
 * risk: offline-site-switch (FR-012, offline-night-plan; GearCard.astro "Offline"): a user with two sites who opened
 * Tonight online at both picks the other site in the Site card while offline, and gets that site's stored Tonight page,
 * never the other site's copy and never /offline. The only protection of the browser path: the card's select submitting
 * offline (only the Telescope select is `data-needs-network`), the service worker choosing the stored copy by `?site=`
 * (`chooseCopy` in src/lib/offline/copies.ts; its unit tests hold the pure rule, not the wiring) and the page being the
 * device's. Seed: tests/e2e/auth-continue.spec.ts. Offline the way offline.spec.ts goes (lessons: a proxy closed under
 * the worker, `setOffline` only for `navigator.onLine`). Cleanup: the user is a throwaway on the local stack, like every
 * spec's; nothing else is written.
 */

const TONIGHT_CACHE = "sidereus-tonight-v1";
const INDEX_KEY = "/__offline/index.json";
const SITE_FORM = 'form[action="/api/gear/sites"]';
const SECOND_SITE = { name: "Tenerife Plateau", latitude: "28.29", longitude: "-16.63" };

/** The Site card's select; the card's title is its label. Exact, so no other "Site" label can match. */
const siteSelect = (page: Page) => page.getByLabel(en.tonight.siteSelector.label, { exact: true });
const chosenSite = (page: Page) => siteSelect(page).locator("option:checked");

/** The sites that have a stored dashboard copy for tonight, from the worker's index. */
function sitesStoredForTonight(page: Page) {
  return page.evaluate(
    async ({ cacheName, indexKey }) => {
      const index = await (await caches.open(cacheName)).match(indexKey);
      if (!index) return [];
      const { copies }: { copies: { siteId: string; page: string; kind: string }[] } = await index.json();
      return [...new Set(copies.filter((c) => c.page === "/tonight" && c.kind === "tonight").map((c) => c.siteId))];
    },
    { cacheName: TONIGHT_CACHE, indexKey: INDEX_KEY },
  );
}

async function addSecondSite(page: Page) {
  await page.goto("/gear/sites/new");
  await waitForHydration(page, SITE_FORM);
  const form = page.locator(SITE_FORM);
  await form.locator("#name").fill(SECOND_SITE.name);
  await form.locator("#latitudeDeg").fill(SECOND_SITE.latitude);
  await form.locator("#longitudeDeg").fill(SECOND_SITE.longitude);
  await form.locator("#bortle").selectOption("3");
  await form.locator('button[type="submit"]').click();
  await expect(page.getByRole("status").filter({ hasText: en.gear.notice.saved.site })).toBeVisible();
}

/** Picks a site in the Site card online and waits until that site's page is the one shown. */
async function pickSiteOnline(page: Page, name: string) {
  await siteSelect(page).selectOption({ label: name });
  await expect(page).toHaveURL(/\/tonight\?site=[0-9a-f-]{36}$/);
  await expect(chosenSite(page)).toHaveText(name);
  await expect(page.locator("[data-offline-copy]")).toBeAttached();
}

// clock: real (the service worker compares each copy's `preparedAt` with its own real clock to expire it, and `page.clock`
// does not reach the worker's scope); nothing here depends on the hour.
test.use({ clock: "real" });

test("offline, picking the other site serves that site's stored Tonight page", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const proxy = new Proxy(new URL(testInfo.project.use.baseURL ?? "http://localhost:4321"));
  await proxy.start();
  // Its own context on the proxy's origin, so the service worker registers there.
  // clock: real (the worker's own clock decides expiry; see the `test.use` above)
  const context = await browser.newContext({ baseURL: proxy.origin });
  try {
    await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: proxy.origin }]);
    const page = await context.newPage();
    const email = await onboardInMadrid(page, "e2e-offline-site");
    testInfo.annotations.push({ type: "test-data", description: email });
    await waitForServiceWorker(page);

    // Online: a second site, then Tonight opened at each, the onboarded site last, so the worker's last site is the
    // one the user is NOT about to pick.
    await addSecondSite(page);
    await page.goto("/tonight");
    const first = (await chosenSite(page).textContent())?.trim();
    if (!first || first === SECOND_SITE.name) throw new Error("the onboarded site is not the one Tonight opens on");
    await pickSiteOnline(page, SECOND_SITE.name);
    await pickSiteOnline(page, first);
    await expect.poll(() => sitesStoredForTonight(page), { timeout: 30_000 }).toHaveLength(2);
    await expect(page.locator("html")).not.toHaveAttribute("data-from-device");

    // Offline: the server is unreachable for the worker, and the page knows it is offline.
    await proxy.stop();
    await context.setOffline(true);
    await expect(page.locator("html")).toHaveAttribute("data-offline");

    // Picking the second site still navigates, and the device answers with that site's page.
    await siteSelect(page).selectOption({ label: SECOND_SITE.name });
    await expect(page.locator("html")).toHaveAttribute("data-from-device");
    await expect(page).toHaveURL(/\/tonight\?site=[0-9a-f-]{36}$/);
    await expect(chosenSite(page)).toHaveText(SECOND_SITE.name);
    await expect(page.getByRole("heading", { level: 1, name: en.offline.page.title })).toHaveCount(0);
  } finally {
    await context.close();
    await proxy.stop();
  }
});
