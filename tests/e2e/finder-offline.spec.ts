import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import {
  finderLink,
  firstTargetKey,
  onboardInMadrid,
  requirePlanGrant,
  setPlan,
  test,
  waitForServiceWorker,
} from "./helpers";
import { Proxy } from "./offline-proxy";

/*
 * Finder charts offline, end to end (finder-chart Phase 5, O-4, D-13 to D-15): a chart a full-plan account opened
 * online is stored on the device with the Tonight copies, opens from the device offline from the same link and is
 * listed on /offline; once the account is demoted, the first Tonight page opened online clears every stored chart, and
 * offline the chart's URL lands on /offline again. A second purge path follows: after the plan is granted again and the
 * chart is stored again, a demotion and one online visit to the finder URL itself (the locked shell) clear it too.
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

// clock: real (the service worker compares the copy's `preparedAt` with its own real clock to expire it, and `page.clock`
// does not reach the worker); the expectations come from page data, the first Targets row and the copy's own markers.
test.use({ clock: "real" });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("a chart opened online opens from the device offline, and is gone once the plan is lost", async ({
  browser,
}, testInfo) => {
  requirePlanGrant("finder-offline");
  test.setTimeout(240_000);
  const proxy = new Proxy(new URL(testInfo.project.use.baseURL ?? "http://localhost:4321"));
  await proxy.start();
  // Its own context on the proxy's origin, so the service worker registers there.
  // clock: real (the worker's own clock decides expiry; see the `test.use` above)
  const context = await browser.newContext({ baseURL: proxy.origin });
  try {
    await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: proxy.origin }]);
    const page = await context.newPage();
    const email = await onboardInMadrid(page, "e2e-finder-offline");
    await setPlan(email, "full");
    await waitForServiceWorker(page);

    // Online: Targets, then the first row's chart from its link; both pairs are committed. The object is read from the
    // page (whatever ranks first tonight), never a literal: no season or date decides the test.
    await page.goto("/tonight/targets");
    await expect(page.locator("[data-offline-copy]")).toBeAttached();
    const TARGET = await firstTargetKey(page);
    const FINDER_TITLE = en.tonight.finder.title({ target: TARGET });
    const NEVER_OPENED = TARGET === "NGC7000" ? "M31" : "NGC7000";
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
    // The new page's own marker first: the Targets page just left is a stored page too, so `data-from-device` alone
    // proves nothing right after the click.
    await expect(page.locator("[data-finder-chart]")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-from-device");

    // A chart never opened online is not on the device: its URL lands on /offline.
    await page.goto(`/tonight/finder?object=${NEVER_OPENED}`);
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

    // The second purge path, the locked shell. The plan comes back and the chart is opened online again: stored again,
    // because its plan was read after the demotion was seen.
    await proxy.start();
    await context.setOffline(false);
    await setPlan(email, "full");
    await page.goto(chartPath);
    await expect(page.locator("[data-finder-chart]")).toBeVisible();
    await expect(page.locator("[data-offline-copy]")).toHaveAttribute("data-plan", "full");
    await expect.poll(() => storedCharts(page), { timeout: 30_000 }).toEqual([`/tonight/finder ${TARGET} tonight`]);

    // Demoted again, the finder URL itself is opened online: its shell is the locked explainer (no island), and
    // answering "free" takes the stored chart with it.
    await setPlan(email, "free");
    await page.goto(chartPath);
    await expect(page.locator('[data-finder-state="locked"]')).toHaveAttribute("data-plan", "free");
    await expect(page.locator('[data-finder-state="locked"]')).toHaveAttribute("data-plan-at", /^\d{4}-\d\d-\d\dT/);
    await expect.poll(() => storedCharts(page), { timeout: 30_000 }).toEqual([]);

    // Offline again: the chart's URL lands on /offline, as after the Tonight path.
    await proxy.stop();
    await context.setOffline(true);
    await page.goto(chartPath);
    await expect(page.getByRole("heading", { level: 1, name: en.offline.page.title })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-from-device");
    await expect(page.locator("[data-finder-chart]")).toHaveCount(0);
  } finally {
    await context.close();
    await proxy.stop();
  }
});
