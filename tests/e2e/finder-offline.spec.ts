import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { finderLink, inNoDarknessWindow, onboardInMadrid, requirePlanGrant, setPlan } from "./helpers";
import { Proxy } from "./offline-proxy";

/*
 * Finder charts offline, end to end (finder-chart Phase 5, O-4, D-13 to D-15): a chart a full-plan account opened
 * online is stored on the device with the Tonight copies, opens from the device offline from the same link and is
 * listed on /offline; once the account is demoted, the first Tonight page opened online clears every stored chart, and
 * offline the chart's URL lands on /offline again.
 *
 * Going offline: the same proxy as offline.spec.ts (`offline-proxy.ts`); closing it makes the server unreachable for
 * the worker, `setOffline` only sets `navigator.onLine`, and every offline assertion first checks
 * `html[data-from-device]`, the worker's mark on a page it served from storage.
 *
 * The plan is granted and removed through the operator command (`node scripts/account-plan.mjs <email> full|free`) as a
 * child process with the inherited SUPABASE_URL and SUPABASE_SECRET_KEY of the local stack (finder-chart D-9). Without
 * the key the spec fails under CI and skips locally. Each test signs up a fresh user, because it demotes it.
 */

const TONIGHT_CACHE = "sidereus-tonight-v1";
const INDEX_KEY = "/__offline/index.json";

/** M13 is a pinned target: a bright globular cluster that Madrid's all-clear fixture night ranks for most of the year. */
const TARGET = "M13";
const FINDER_TITLE = en.tonight.finder.title({ target: TARGET });

/** The pages (and chart targets) the worker's index holds right now: "<page> <target or -> <kind>", sorted. */
function storedCopies(page: Page) {
  return page.evaluate(
    async ({ cacheName, indexKey }) => {
      const cache = await caches.open(cacheName);
      const index = await cache.match(indexKey);
      if (!index) return [];
      const { copies }: { copies: { page: string; target?: string | null; kind: string }[] } = await index.json();
      return copies.map((copy) => `${copy.page} ${copy.target ?? "-"} ${copy.kind}`).sort();
    },
    { cacheName: TONIGHT_CACHE, indexKey: INDEX_KEY },
  );
}

async function storedCharts(page: Page) {
  return (await storedCopies(page)).filter((copy) => copy.startsWith("/tonight/finder "));
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("a chart opened online opens from the device offline, and is gone once the plan is lost", async ({
  browser,
}, testInfo) => {
  requirePlanGrant("finder-offline");
  test.skip(inNoDarknessWindow(), "no astronomical darkness (8 June to 2 July): the ranking can be empty");
  test.setTimeout(180_000);
  const proxy = new Proxy(new URL(testInfo.project.use.baseURL ?? "http://localhost:4321"));
  await proxy.start();
  // Its own context on the proxy's origin, so the service worker registers there.
  const context = await browser.newContext({ baseURL: proxy.origin });
  try {
    await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: proxy.origin }]);
    const page = await context.newPage();
    const email = await onboardInMadrid(page, "e2e-finder-offline");
    await setPlan(email, "full");
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    // Online: Targets, then M13's chart from its link; both pairs are committed.
    await page.goto("/tonight/targets");
    await expect(page.locator("[data-offline-copy]")).toBeAttached();
    await (await finderLink(page, TARGET)).click();
    await expect(page.locator("[data-finder-chart]")).toBeVisible();
    await expect(page.locator("[data-offline-copy]")).toHaveAttribute("data-plan", "full");
    await expect(page.locator("[data-offline-copy]")).toHaveAttribute("data-target", TARGET);
    await expect(page.getByRole("heading", { level: 1, name: FINDER_TITLE })).toBeVisible();
    await expect
      .poll(() => storedCopies(page), { timeout: 30_000 })
      .toEqual(expect.arrayContaining([`/tonight/finder ${TARGET} tonight`, "/tonight/targets - tonight"]));
    // Online, the page is the network's: no mark, no notice.
    await expect(page.locator("html")).not.toHaveAttribute("data-from-device");
    await expect(page.locator("[data-offline-notice]:visible")).toHaveCount(0);
    const chartUrl = new URL(page.url());
    const chartPath = chartUrl.pathname + chartUrl.search;

    await proxy.stop();
    await context.setOffline(true);

    // The chart's URL opens from the device, with its island, the chart and the "prepared" notice.
    await page.goto(chartPath);
    await expect(page.locator("html")).toHaveAttribute("data-from-device");
    await expect(page.locator("html")).toHaveAttribute("data-offline");
    await expect(page.locator("[data-finder-chart]")).toBeVisible();
    const prepared = page.locator('[data-offline-notice="prepared"]');
    await expect(prepared).toBeVisible();
    await expect(prepared).toContainText(en.offline.notice.prepared({ when: "" }).trim());

    // The same link on the stored Targets page opens it too: the link needs no network.
    await page.goto("/tonight/targets");
    await expect(page.locator("html")).toHaveAttribute("data-from-device");
    await (await finderLink(page, TARGET)).click();
    await expect(page.locator("html")).toHaveAttribute("data-from-device");
    await expect(page.locator("[data-finder-chart]")).toBeVisible();

    // A chart never opened online is not on the device: its URL lands on /offline.
    await page.goto("/tonight/finder?object=NGC7000");
    await expect(page.locator("html")).toHaveAttribute("data-from-device");
    await expect(page.getByRole("heading", { level: 1, name: en.offline.page.title })).toBeVisible();
    await expect(page.locator("[data-finder-chart]")).toHaveCount(0);

    // /offline lists the stored chart below the Tonight pages, linking to it.
    const saved = page.locator("[data-offline-list] a");
    await expect(saved.filter({ hasText: FINDER_TITLE })).toHaveCount(1);
    await expect(saved.filter({ hasText: FINDER_TITLE })).toHaveAttribute(
      "href",
      new RegExp(`^/tonight/finder\\?object=${TARGET}&site=[0-9a-f-]{36}$`),
    );
    await expect(saved.last()).toContainText(FINDER_TITLE);

    // Back online (same origin), the account is demoted and Tonight is opened: its pair, rendered for a free account,
    // takes every stored chart with it.
    await proxy.start();
    await context.setOffline(false);
    await setPlan(email, "free");
    await page.goto("/tonight");
    await expect(page.locator("[data-offline-copy]")).toHaveAttribute("data-plan", "free");
    await expect.poll(() => storedCharts(page), { timeout: 30_000 }).toEqual([]);
    // The Tonight pages stay: only the charts follow the plan.
    expect(await storedCopies(page)).toEqual(expect.arrayContaining(["/tonight - tonight"]));

    // Offline again, the chart's URL is no longer served from the device: the stored /offline page answers instead.
    await proxy.stop();
    await context.setOffline(true);
    await page.goto(chartPath);
    await expect(page.locator("html")).toHaveAttribute("data-from-device");
    await expect(page.getByRole("heading", { level: 1, name: en.offline.page.title })).toBeVisible();
    await expect(page.locator("[data-finder-chart]")).toHaveCount(0);
    await expect(page.locator("[data-offline-list] a").filter({ hasText: FINDER_TITLE })).toHaveCount(0);
  } finally {
    await context.close();
    await proxy.stop();
  }
});
