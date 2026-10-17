import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE, THEME_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, signOut, test, waitForServiceWorker } from "./helpers";
import { Proxy } from "./offline-proxy";

/*
 * Tonight offline, end to end (S-06, offline-night-plan): the dashboard and the Session plan opened online are served
 * from the device offline with the "prepared" notice and network-only controls disabled, a page that needs the network
 * lands on /offline listing both, and signing out leaves no Tonight copy behind.
 *
 * Going offline: Playwright's `context.setOffline(true)` does not reliably cut the service worker's own fetches
 * (Phase 3: under emulation `/log` still rendered from the server and a never-opened page was stored), so the test
 * runs through a reverse proxy in front of BASE_URL and goes offline by closing it, which the worker sees as a refused
 * connection. `setOffline` is still applied so `navigator.onLine` is false for the page. Every offline assertion first
 * checks `html[data-from-device]`, the worker's mark on a stored copy.
 */

const TONIGHT_CACHE = "sidereus-tonight-v1";
const ASSETS_CACHE = "sidereus-assets-v1";
const INDEX_KEY = "/__offline/index.json";

/** The Tonight pages and kinds the worker's index holds right now (empty without an index). */
function storedCopies(page: Page) {
  return page.evaluate(
    async ({ cacheName, indexKey }) => {
      const cache = await caches.open(cacheName);
      const index = await cache.match(indexKey);
      if (!index) return [];
      const { copies }: { copies: { page: string; kind: string }[] } = await index.json();
      return copies.map((copy) => `${copy.page} ${copy.kind}`).sort();
    },
    { cacheName: TONIGHT_CACHE, indexKey: INDEX_KEY },
  );
}

// clock: real (the service worker compares each copy's `preparedAt` with its own real clock to expire it, and `page.clock`
// does not reach the worker's scope); the expectations come from page data (`data-night-date`, `html[data-from-device]`).
test.use({ clock: "real" });

test("Tonight pages opened online are there offline, and signing out removes them", async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const proxy = new Proxy(new URL(testInfo.project.use.baseURL ?? "http://localhost:4321"));
  await proxy.start();
  // Its own context on the proxy's origin, so the service worker registers there.
  // clock: real (the worker's own clock decides expiry; see the `test.use` above)
  const context = await browser.newContext({ baseURL: proxy.origin });
  try {
    // Red night mode: offline, a quiet link must lose the resting underline red mode gives it (ui-quiet-actions).
    await context.addCookies([
      { name: LOCALE_COOKIE, value: "en", url: proxy.origin },
      { name: THEME_COOKIE, value: "red", url: proxy.origin },
    ]);
    const page = await context.newPage();
    const email = await onboardInMadrid(page, "e2e-offline");

    // Online: the worker controls the page, then both pages are opened and their pairs committed.
    await waitForServiceWorker(page);
    await page.goto("/tonight");
    await expect(page.locator("#verdict-heading [data-sky-headline]")).toBeVisible();
    await page.goto("/tonight/plan");
    await expect(page.locator("[data-offline-copy]")).toBeAttached();
    await expect
      .poll(() => storedCopies(page), { timeout: 30_000 })
      .toEqual(expect.arrayContaining(["/tonight tonight", "/tonight/plan tonight"]));
    // Online, the page is the network's: no mark, no notice, controls enabled.
    await expect(page.locator("html")).not.toHaveAttribute("data-from-device");
    await expect(page.locator("[data-offline-notice]:visible")).toHaveCount(0);

    await proxy.stop();
    await context.setOffline(true);

    // Each stored page is served from the device, with its island, the notice and Log disabled.
    for (const path of ["/tonight", "/tonight/plan"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-from-device");
      await expect(page.locator("html")).toHaveAttribute("data-offline");
      await expect(page.locator("[data-offline-copy]")).toBeAttached();
      const prepared = page.locator('[data-offline-notice="prepared"]');
      await expect(prepared).toBeVisible();
      await expect(prepared).toContainText(en.offline.notice.prepared({ when: "" }).trim());
      await expect(page.locator("[data-offline-notice]:visible")).toHaveCount(1);
      // The notice closes with its × and stays closed while the page re-applies its state on a DOM change.
      await prepared.getByRole("button", { name: en.common.close }).click();
      await expect(prepared).toBeHidden();
      await page.evaluate(() => {
        document.body.appendChild(document.createElement("div"));
      });
      // The page script re-applies its state on the next animation frame: wait for two before asserting it stayed hidden.
      await page.evaluate(
        () =>
          new Promise<void>((done) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                done();
              });
            });
          }),
      );
      await expect(page.locator("[data-offline-notice]:visible")).toHaveCount(0);
      const log = page.getByRole("navigation", { name: en.nav.primary }).getByRole("link", { name: en.nav.log });
      await expect(log).toHaveAttribute("aria-disabled", "true");
      await expect(log).toHaveAccessibleDescription(en.offline.needsConnection);
      if (path === "/tonight") {
        // The gear card's Manage link (a `quiet` action that needs the network) mutes with its icon and drops red
        // mode's resting underline: the offline rule in global.css outranks the variant (ui-quiet-actions).
        const manage = page.getByRole("link", { name: en.tonight.gear.manageSites });
        await expect(manage).toHaveAttribute("aria-disabled", "true");
        await expect
          .poll(() =>
            manage.evaluate((el) => {
              const style = getComputedStyle(el);
              const icon = el.querySelector("svg");
              return {
                underline: style.textDecorationLine,
                iconMatches: icon !== null && getComputedStyle(icon).color === style.color,
              };
            }),
          )
          .toEqual({ underline: "none", iconMatches: true });
      }
      // A navigation would land on /log, or /offline with the network gone. The click's default is what starts it, so
      // the proof is that the page prevented it: a capture listener at the window sees the click first, and a task
      // queued from it reads `defaultPrevented` once every other handler has run. Polled, never a fixed wait.
      await page.evaluate(() => {
        window.addEventListener(
          "click",
          (event) => {
            setTimeout(() => {
              Object.assign(window, { clickPrevented: event.defaultPrevented });
            }, 0);
          },
          { capture: true, once: true },
        );
      });
      await log.click({ force: true });
      await expect
        .poll(() => page.evaluate(() => (window as unknown as { clickPrevented?: boolean }).clickPrevented), {
          message: "the offline page swallows the click on a link that needs the network",
        })
        .toBe(true);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1, name: en.log.list.title })).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1, name: en.offline.page.title })).toHaveCount(0);
    }
    await expect(page.getByRole("heading", { level: 1, name: en.tonight.summary.plan })).toBeVisible();

    // A page that needs the network lands on /offline, which lists both stored pages.
    await page.goto("/log");
    await expect(page.getByRole("heading", { level: 1, name: en.offline.page.title })).toBeVisible();
    const saved = page.locator("[data-offline-list] a");
    await expect(saved).toHaveCount(2);
    await expect(saved.nth(0)).toContainText(en.tonight.title);
    await expect(saved.nth(1)).toContainText(en.tonight.summary.plan);

    // Back online (same origin), signing out purges every copy: checked before any Tonight visit stores one again.
    await proxy.start();
    await context.setOffline(false);
    await page.goto("/gear");
    await signOut(page);
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(() => storedCopies(page)).toEqual([]);
    const keys = await page.evaluate(async (cacheName) => {
      const cache = await caches.open(cacheName);
      return (await cache.keys()).map((request) => new URL(request.url).pathname);
    }, TONIGHT_CACHE);
    expect(keys.filter((key) => key !== "/offline" && key !== INDEX_KEY)).toEqual([]);
    // The /offline page stored again after the sign-out is the signed-out one: no trace of the user's email.
    await expect
      .poll(() =>
        page.evaluate(async (cacheName) => {
          const stored = await (await caches.open(cacheName)).match("/offline", { ignoreVary: true });
          return stored ? await stored.text() : null;
        }, TONIGHT_CACHE),
      )
      .toMatch(/data-signed-out/);
    const offlinePage = await page.evaluate(async (cacheName) => {
      const stored = await (await caches.open(cacheName)).match("/offline", { ignoreVary: true });
      return stored ? await stored.text() : "";
    }, TONIGHT_CACHE);
    expect(offlinePage).not.toContain(email);
    // And no /_astro file kept for a stored page.
    const assets = await page.evaluate(
      async (cacheName) => (await (await caches.open(cacheName)).keys()).length,
      ASSETS_CACHE,
    );
    expect(assets).toBe(0);
  } finally {
    await context.close();
    await proxy.stop();
  }
});
