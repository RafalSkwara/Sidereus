import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, planEditable, requirePlanGrant, setPlan } from "./helpers";
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

test("a saved plan is stored at once and opens from the device offline", async ({ browser }, testInfo) => {
  requirePlanGrant("session-plan-store");
  test.setTimeout(180_000);
  const proxy = new Proxy(new URL(testInfo.project.use.baseURL ?? "http://localhost:4321"));
  await proxy.start();
  // Its own context on the proxy's origin, so the service worker registers there.
  const context = await browser.newContext({ baseURL: proxy.origin });
  try {
    await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: proxy.origin }]);
    const page = await context.newPage();
    const email = await onboardInMadrid(page, "e2e-plan-store");
    await setPlan(email, "full");
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    // Online: the suggested plan is drawn and its pair stored.
    await page.goto(PLAN_PAGE);
    const editable = await planEditable(page);
    test.skip(!editable, "tonight's plan is not editable (the night does not pass)");
    await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "suggested");
    const rows = page.locator("[data-session-plan-row]");
    expect(await rows.count(), "the fixture's clear night recommends several targets").toBeGreaterThan(1);
    const first = await rows.first().getAttribute("data-session-plan-row");
    const copy = page.locator("[data-offline-copy]");
    const site = await copy.getAttribute("data-site-id");
    const night = await copy.getAttribute("data-night-date");
    expect(first).toBeTruthy();
    expect(site).toBeTruthy();
    expect(night).toBeTruthy();
    await expect.poll(() => storedPlanState(page), { timeout: 30_000 }).toBe("suggested");

    // Saves the list with the first row only: a plain form POST, as the editor will send it.
    await page.evaluate(
      ({ siteId, nightDate, key }) => {
        const form = document.createElement("form");
        form.method = "post";
        form.action = "/api/tonight/plan";
        for (const [name, value] of [
          ["site", siteId],
          ["night", nightDate],
          ["targets", key],
        ]) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }
        document.body.appendChild(form);
        form.submit();
      },
      { siteId: site ?? "", nightDate: night ?? "", key: first ?? "" },
    );

    // The toast first, then its param is gone from the URL, and the page is the network's, not the device's.
    await expect(page.locator("[data-toast]").filter({ hasText: en.tonight.pages.plan.saved })).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === PLAN_PAGE && url.search === `?site=${String(site)}`);
    await expect(page.locator("html")).not.toHaveAttribute("data-from-device");
    await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "edited");
    await expect(page.locator("[data-session-plan-row]")).toHaveCount(1);

    // The worker replaces the stored pair with the new one: its island is the edited plan.
    await expect.poll(() => storedPlanState(page), { timeout: 30_000 }).toBe("edited");

    await proxy.stop();
    await context.setOffline(true);

    await page.goto(`${PLAN_PAGE}?site=${String(site)}`);
    await expect(page.locator("html")).toHaveAttribute("data-from-device");
    await expect(page.locator("html")).toHaveAttribute("data-offline");
    await expect(page.locator("[data-session-plan-state]")).toHaveAttribute("data-session-plan-state", "edited");
    await expect(page.locator("[data-session-plan-row]")).toHaveCount(1);
    await expect(page.locator("[data-session-plan-row]")).toHaveAttribute("data-session-plan-row", first ?? "");
  } finally {
    await context.close();
    await proxy.stop();
  }
});
