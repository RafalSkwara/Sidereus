import { expect, type Browser, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, planEditable, requirePlanGrant, setPlan, test, waitForServiceWorker } from "./helpers";
import { Proxy } from "./offline-proxy";

/*
 * A saved Session plan is on the device at once (adjustable-session-plan Phase 4, D7 b): after a save the shell shows
 * the toast, the page asks the service worker to store the clean `/tonight/plan?site=<id>` (the toast's own URL is never
 * stored), and with the server then unreachable that page opens from the device with the edited list. The editor does
 * not exist yet in this phase, so the save is a POST form the test builds in the page, exactly what the editor will
 * submit: the site, the night (both from the island's `OfflineCopy`) and the keys to keep, here the first row only.
 *
 * Going offline: the same proxy as offline.spec.ts (`offline-proxy.ts`): closing it makes the server unreachable for the
 * worker, `setOffline` only sets `navigator.onLine`, and the offline assertion first checks `html[data-from-device]`,
 * the worker's mark on a page it served from storage. The full plan is granted through the operator command with the
 * local stack's key (`requirePlanGrant`), on a fresh user each run.
 *
 * Three cases: a save is stored and opens offline; a reset is stored the same way (the suggested plan comes back on
 * the device); and a save whose landing is slow (the redirect's GET answered after 6 s, past the worker's 4 s race) is
 * waited for, not answered from the stored pre-save copy (impl review F2 a). The slow one holds one response in the
 * proxy (`delayNext`), the level the worker's own fetch sees, and it fails if the worker races the timeout again.
 */

const TONIGHT_CACHE = "sidereus-tonight-v1";
const INDEX_KEY = "/__offline/index.json";
const PLAN_PAGE = "/tonight/plan";

/**
 * `data-session-plan-state` of the stored `/tonight/plan` island (tonight's copy), read from the worker's cache the way
 * offline.spec.ts reads its index: `null` while nothing is stored for the page.
 */
function storedPlanState(page: Page) {
  return page.evaluate(
    async ({ cacheName, indexKey, path }) => {
      const cache = await caches.open(cacheName);
      const index = await cache.match(indexKey);
      if (!index) return null;
      const { copies }: { copies: { page: string; kind: string; islandUrl: string }[] } = await index.json();
      const copy = copies.find((entry) => entry.page === path && entry.kind === "tonight");
      if (!copy) return null;
      const island = await cache.match(copy.islandUrl, { ignoreVary: true });
      const html = island ? await island.text() : "";
      return /data-session-plan-state="([a-z]+)"/.exec(html)?.[1] ?? null;
    },
    { cacheName: TONIGHT_CACHE, indexKey: INDEX_KEY, path: PLAN_PAGE },
  );
}

/** Posts a plain hidden-field form from the page, as the editor and its reset button submit. */
function postForm(page: Page, action: string, fields: [string, string][]) {
  return page.evaluate(
    ({ to, entries }) => {
      const form = document.createElement("form");
      form.method = "post";
      form.action = to;
      for (const [name, value] of entries) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    },
    { to: action, entries: fields },
  );
}

interface Opened {
  page: Page;
  context: BrowserContext;
  proxy: Proxy;
  site: string;
  night: string;
  /** Every row key of the suggested plan, in order. */
  keys: string[];
}

// clock: real (the service worker compares each copy's `preparedAt` with its own real clock to expire it, and `page.clock`
// does not reach the worker's scope); the expectations come from page data (`data-night-date`, `html[data-from-device]`).
test.use({ clock: "real" });

/**
 * A fresh full-plan user on the proxy's origin with the suggested plan opened and its pair stored; fails when the plan
 * is not editable. The caller closes the context and stops the proxy.
 */
async function openSuggestedPlan(browser: Browser, testInfo: TestInfo, prefix: string): Promise<Opened> {
  const proxy = new Proxy(new URL(testInfo.project.use.baseURL ?? "http://localhost:4321"));
  await proxy.start();
  // Its own context on the proxy's origin, so the service worker registers there.
  // clock: real (the worker's own clock decides expiry; see the `test.use` above)
  const context = await browser.newContext({ baseURL: proxy.origin });
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: proxy.origin }]);
  try {
    const page = await context.newPage();
    const email = await onboardInMadrid(page, prefix);
    await setPlan(email, "full");
    await waitForServiceWorker(page);

    // Online: the suggested plan is drawn and its pair stored.
    await page.goto(PLAN_PAGE);
    // A fresh full-plan user has saved nothing, so tonight's plan is `suggested` at every hour (`held` needs a saved list
    // for a night that does not pass): asserted from the page, never skipped.
    expect(await planEditable(page), "a fresh full-plan user's plan is editable").toBe(true);
    await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "suggested");
    const rows = page.locator("[data-session-plan-row]");
    expect(await rows.count(), "the fixture's clear night recommends several targets").toBeGreaterThan(1);
    const keys = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-session-plan-row") ?? ""),
    );
    const copy = page.locator("[data-offline-copy]");
    const site = await copy.getAttribute("data-site-id");
    const night = await copy.getAttribute("data-night-date");
    expect(keys[0]).toBeTruthy();
    expect(site).toBeTruthy();
    expect(night).toBeTruthy();
    await expect.poll(() => storedPlanState(page), { timeout: 30_000 }).toBe("suggested");
    return { page, context, proxy, site: site ?? "", night: night ?? "", keys };
  } catch (error) {
    // A failed step: nothing returned, so the caller cannot close these; the error itself carries on.
    await context.close();
    await proxy.stop();
    throw error;
  }
}

test("a saved plan is stored at once and opens from the device offline", async ({ browser }, testInfo) => {
  requirePlanGrant("session-plan-store");
  test.setTimeout(180_000);
  let opened: Opened | undefined;
  try {
    opened = await openSuggestedPlan(browser, testInfo, "e2e-plan-store");
    const { page, context, proxy, site, night, keys } = opened;
    const first = keys[0];

    // Saves the list with the first row only: a plain form POST, as the editor sends it.
    await postForm(page, "/api/tonight/plan", [
      ["site", site],
      ["night", night],
      ["targets", first],
    ]);

    // The toast first, then its param is gone from the URL, and the page is the network's, not the device's.
    await expect(page.locator("[data-toast]").filter({ hasText: en.tonight.pages.plan.saved })).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === PLAN_PAGE && url.search === `?site=${site}`);
    await expect(page.locator("html")).not.toHaveAttribute("data-from-device");
    await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "edited");
    await expect(page.locator("[data-session-plan-row]")).toHaveCount(1);

    // The worker replaces the stored pair with the new one: its island is the edited plan.
    await expect.poll(() => storedPlanState(page), { timeout: 30_000 }).toBe("edited");

    await proxy.stop();
    await context.setOffline(true);

    await page.goto(`${PLAN_PAGE}?site=${site}`);
    await expect(page.locator("html")).toHaveAttribute("data-from-device");
    await expect(page.locator("html")).toHaveAttribute("data-offline");
    await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "edited");
    await expect(page.locator("[data-session-plan-row]")).toHaveCount(1);
    await expect(page.locator("[data-session-plan-row]")).toHaveAttribute("data-session-plan-row", first);
  } finally {
    await opened?.context.close();
    await opened?.proxy.stop();
  }
});

test("a reset plan is stored at once: the suggested plan opens from the device offline", async ({
  browser,
}, testInfo) => {
  requirePlanGrant("session-plan-store");
  test.setTimeout(180_000);
  let opened: Opened | undefined;
  try {
    opened = await openSuggestedPlan(browser, testInfo, "e2e-plan-reset-store");
    const { page, context, proxy, site, night, keys } = opened;

    // First an edited list, stored as in the case above.
    await postForm(page, "/api/tonight/plan", [
      ["site", site],
      ["night", night],
      ["targets", keys[0]],
    ]);
    await expect(page.locator("[data-toast]").filter({ hasText: en.tonight.pages.plan.saved })).toBeVisible();
    await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "edited");
    await expect.poll(() => storedPlanState(page), { timeout: 30_000 }).toBe("edited");

    // Then the reset, as the reset button posts it: the reset toast, a clean URL, the suggested plan from the server.
    await postForm(page, "/api/tonight/plan/reset", [
      ["site", site],
      ["night", night],
    ]);
    await expect(page.locator("[data-toast]").filter({ hasText: en.tonight.pages.plan.resetDone })).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === PLAN_PAGE && url.search === `?site=${site}`);
    await expect(page.locator("html")).not.toHaveAttribute("data-from-device");
    await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "suggested");
    await expect(page.locator("[data-session-plan-row]")).toHaveCount(keys.length);

    // The stored pair is replaced by the suggested one.
    await expect.poll(() => storedPlanState(page), { timeout: 30_000 }).toBe("suggested");

    await proxy.stop();
    await context.setOffline(true);

    await page.goto(`${PLAN_PAGE}?site=${site}`);
    await expect(page.locator("html")).toHaveAttribute("data-from-device");
    await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "suggested");
    await expect(page.locator("[data-session-plan-row]")).toHaveCount(keys.length);
  } finally {
    await opened?.context.close();
    await opened?.proxy.stop();
  }
});

test("a slow landing after a save is waited for, not answered from the old stored copy", async ({
  browser,
}, testInfo) => {
  requirePlanGrant("session-plan-store");
  test.setTimeout(180_000);
  let opened: Opened | undefined;
  try {
    opened = await openSuggestedPlan(browser, testInfo, "e2e-plan-slow-save");
    const { page, proxy, site, night, keys } = opened;
    const saved = keys.slice(0, 2);

    // The redirect's GET (`/tonight/plan?site=<id>&saved=plan`) is answered after 6 s, longer than the worker's 4 s
    // race with the stored copy. The proxy sees the worker's own fetch, which is the one that matters.
    proxy.delayNext(
      (request) =>
        request.method === "GET" &&
        (request.url ?? "").startsWith(`${PLAN_PAGE}?`) &&
        new URLSearchParams((request.url ?? "").split("?")[1]).get("saved") === "plan",
      6000,
    );

    await postForm(page, "/api/tonight/plan", [
      ["site", site],
      ["night", night],
      ...saved.map((key): [string, string] => ["targets", key]),
    ]);

    // The landing is the server's answer, however late: the toast, no stored-copy mark, the edited rows.
    await expect(page.locator("[data-toast]").filter({ hasText: en.tonight.pages.plan.saved })).toBeVisible({
      timeout: 40_000,
    });
    expect(proxy.delayed, "the redirect's GET was the one held back").toBe(1);
    await expect(page.locator("html")).not.toHaveAttribute("data-from-device");
    await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "edited");
    await expect(page.locator("[data-session-plan-row]")).toHaveCount(saved.length);
    await expect(page).toHaveURL((url) => url.pathname === PLAN_PAGE && url.search === `?site=${site}`);

    // And the page's `store-page` followed: the stored copy now holds the saved list.
    await expect.poll(() => storedPlanState(page), { timeout: 30_000 }).toBe("edited");
  } finally {
    await opened?.context.close();
    await opened?.proxy.stop();
  }
});
