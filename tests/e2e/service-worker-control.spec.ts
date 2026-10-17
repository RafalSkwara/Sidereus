import { expect } from "@playwright/test";

import { test, waitForServiceWorker } from "./helpers";
import { Proxy } from "./offline-proxy";

/*
 * The race behind the session-plan-store flake (PR #165, CI run 38704238918): the worker registers on the first page,
 * and when it activates while a navigation is in flight, the document that navigation creates stays uncontrolled in
 * Chromium although the worker calls `clients.claim()`; a wait on `navigator.serviceWorker.controller` then never ends.
 * The race is made deterministic through the proxy: the worker's install waits on its own fetch of `/offline` (held
 * 3 s); once the proxy holds it, a navigation starts and is held 5 s, so the worker activates while it is in flight.
 */
// clock: real (the race is the real worker's install and activation, held in the proxy; no date is read).
test.use({ clock: "real" });

test("the worker helper ends with the page controlled when the worker activated during a navigation", async ({
  browser,
}, testInfo) => {
  test.setTimeout(30_000);
  const proxy = new Proxy(new URL(testInfo.project.use.baseURL ?? "http://localhost:4321"));
  await proxy.start();
  // clock: real (the race is the real worker's install and activation, held in the proxy; no date is read)
  const context = await browser.newContext({ baseURL: proxy.origin });
  try {
    const page = await context.newPage();
    proxy.delayNext((request) => request.url === "/offline", 3_000);
    await page.goto("/auth/signup");
    // The worker is installing and its `/offline` fetch is held: only now does the navigation start.
    await expect.poll(() => proxy.delayed, { timeout: 10_000 }).toBe(1);
    proxy.delayNext((request) => request.url === "/auth/signin", 5_000);
    await page.goto("/auth/signin");
    expect(proxy.delayed, "both the install fetch and the navigation were held").toBe(2);
    // The precondition the flake needs: an active worker and an uncontrolled document.
    await page.waitForFunction(async () => (await navigator.serviceWorker.ready).active?.state === "activated");
    expect(await page.evaluate(() => navigator.serviceWorker.controller === null)).toBe(true);

    await waitForServiceWorker(page);
    expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  } finally {
    await context.close();
    await proxy.stop();
  }
});
