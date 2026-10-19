import type { Page, Route } from "@playwright/test";

import { expect, onboardInMadrid, test, waitForHydration } from "./helpers";

/*
 * The page's error reporting, end to end (error-visibility Phase 9, D9, D13, D15): what the global handlers in
 * `Layout.astro` send to `POST /api/client-error`, and what they leave out. The endpoint is answered by `page.route`
 * with a 204, so nothing reaches the server and no limiter token is spent; each spec reads the beacon's body there.
 *
 * Own-script filter: the probe scripts are served from `/_astro/` (where the build's own files live) through
 * `page.route`, because a script's file name is what tells our code from an extension's or the console's. Nothing here
 * uses a timer (the pinned browser clock fakes them): a script throws at its top level, `reportError` is the call
 * React 19 makes for a render or event error, and a rejection settles at once.
 */

// The preview's service worker would answer `/_astro/` requests itself, and `page.route` does not see requests a
// worker handles, so the probe scripts would never be served.
test.use({ serviceWorkers: "block" });

// What a real failure could carry, and must never travel: a coordinate pair and an email.
const SECRET = "52.2297,21.0122 ada.lovelace@example.test";
const MARKER = "MarkerError";

interface Captured {
  step: string;
  name?: string;
}

/**
 * Answers the endpoint with 204 and records each body as it arrives. `settle()` is the barrier for "nothing else was
 * sent": it raises one marker report of its own and waits for it, and since reports reach the endpoint in the order
 * they were made, everything reported before it is already in the list it returns (without the marker).
 */
async function captureReports(page: Page) {
  const bodies: string[] = [];
  await page.route("**/api/client-error", async (route) => {
    bodies.push(route.request().postData() ?? "");
    await route.fulfill({ status: 204 });
  });
  const parsed = () => bodies.map((body) => JSON.parse(body) as Captured);
  return {
    bodies: () => bodies,
    reports: parsed,
    async settle(): Promise<Captured[]> {
      await page.evaluate((name) => {
        const marker = new Error("marker");
        marker.name = name;
        void Promise.reject(marker);
      }, MARKER);
      await expect.poll(() => parsed().some((report) => report.name === MARKER)).toBe(true);
      return parsed().filter((report) => report.name !== MARKER);
    },
  };
}

/** Serves `body` as a classic script at `/_astro/<name>` and adds it to the page, as the build's own scripts are. */
async function runOwnScript(page: Page, name: string, body: string) {
  await page.route(`**/_astro/${name}`, (route) => route.fulfill({ contentType: "text/javascript", body }));
  await page.evaluate((src) => {
    const script = document.createElement("script");
    script.src = src;
    document.head.appendChild(script);
  }, `/_astro/${name}`);
}

/** Each body holds `step` and `name` and nothing else, and none of the text the failure carried. */
function expectOnlyStepAndName(bodies: string[]) {
  expect(bodies.length).toBeGreaterThan(0);
  for (const body of bodies) {
    expect(Object.keys(JSON.parse(body) as object).sort()).toEqual(["name", "step"]);
    expect(body).not.toContain("52.2297");
    expect(body).not.toContain("ada.lovelace");
    expect(body).not.toContain("probe-");
  }
}

test.describe("page error reporting", () => {
  test("an error thrown by a script under /_astro/ reports its step and name, never its message", async ({ page }) => {
    const capture = await captureReports(page);
    // The landing page runs the layout's script, which installs the handlers before the load event ends.
    await page.goto("/");
    await runOwnScript(page, "probe-throw.js", `throw new TypeError("probe-throw ${SECRET}");`);
    await expect.poll(() => capture.reports().length).toBe(1);

    expect(await capture.settle()).toEqual([{ step: "island.uncaught", name: "TypeError" }]);
    expectOnlyStepAndName(capture.bodies().slice(0, 1));
  });

  test("a reportError from a script under /_astro/, the call React 19 makes, is reported once", async ({ page }) => {
    const capture = await captureReports(page);
    await page.goto("/");
    await runOwnScript(page, "probe-report.js", `window.reportError(new TypeError("probe-report ${SECRET}"));`);
    await expect.poll(() => capture.reports().length).toBe(1);

    expect(await capture.settle()).toEqual([{ step: "island.uncaught", name: "TypeError" }]);
    expectOnlyStepAndName(capture.bodies().slice(0, 1));
  });

  test("the same errors raised from console-style input, with no /_astro/ file name, report nothing", async ({
    page,
  }) => {
    const capture = await captureReports(page);
    await page.goto("/");
    await page.evaluate((secret) => {
      window.reportError(new TypeError(`probe-console ${secret}`));
      queueMicrotask(() => {
        throw new TypeError(`probe-console ${secret}`);
      });
    }, SECRET);

    // Both are window errors by now, so a report would already be in the list ahead of the marker's.
    expect(await capture.settle()).toEqual([]);
  });

  test("a rejected promise is reported by name only, with no file name to filter on", async ({ page }) => {
    const capture = await captureReports(page);
    await page.goto("/");
    await page.evaluate((secret) => {
      void Promise.reject(new RangeError(`probe-rejection ${secret}`));
    }, SECRET);
    await expect.poll(() => capture.reports().length).toBe(1);

    expect(await capture.settle()).toEqual([{ step: "island.unhandled-rejection", name: "RangeError" }]);
    expectOnlyStepAndName(capture.bodies().slice(0, 1));
  });

  test("a catalogue chunk that fails to load is reported as island.import and the form stays usable", async ({
    page,
  }) => {
    const capture = await captureReports(page);
    await onboardInMadrid(page, "client-errors");
    // The telescope list is its own lazy chunk (`telescopes.<hash>.js`), fetched when the form mounts: refuse it.
    await page.route(/\/_astro\/telescopes\.[^/]+\.js(\?.*)?$/, (route) => route.abort());
    await page.goto("/gear/telescopes/new");
    await waitForHydration(page, 'form[action="/api/gear/telescopes"]');
    await expect.poll(() => capture.reports().some((report) => report.step === "island.import")).toBe(true);

    const reports = await capture.settle();
    expect(reports.filter((report) => report.step === "island.import")).toEqual([
      { step: "island.import", name: "TypeError" },
    ]);
    // The form keeps its own fields (the failure only drops the catalogue's suggestions).
    await expect(page.locator('form[action="/api/gear/telescopes"] #name')).toBeEditable();
  });

  test("a place search the next keystroke cancelled reports nothing, and the current one that fails reports once", async ({
    page,
  }) => {
    const capture = await captureReports(page);
    await onboardInMadrid(page, "client-errors-geocode");
    // Open-Meteo's geocoding is held by hand (no timer: the browser clock is pinned), so the test decides when each
    // search answers. Every keystroke aborts the previous request, which rejects too; only the current one may report.
    const held: Route[] = [];
    await page.route("https://geocoding-api.open-meteo.com/**", (route) => {
      held.push(route);
    });
    await page.goto("/gear/sites/new");
    await waitForHydration(page, 'form[action="/api/gear/sites"]');
    const search = page.locator("#place-search");
    await search.fill("ma");
    await expect.poll(() => held.length).toBe(1);
    await search.fill("mad");
    await expect.poll(() => held.length).toBe(2);

    // The first search was cancelled by the second: its rejection is not a failed place search.
    expect((await capture.settle()).filter((report) => report.step === "island.geocode")).toEqual([]);

    // The current search fails (HTTP 500): exactly one report, with the name only.
    await held[1].fulfill({ status: 500, contentType: "application/json", body: "{}" });
    await expect.poll(() => capture.reports().some((report) => report.step === "island.geocode")).toBe(true);
    const reports = await capture.settle();
    expect(reports.filter((report) => report.step === "island.geocode")).toEqual([
      { step: "island.geocode", name: "Error" },
    ]);
    expectOnlyStepAndName(capture.bodies().filter((body) => !body.includes(MARKER)));
    await held[0].abort().catch(() => undefined);
  });
});
