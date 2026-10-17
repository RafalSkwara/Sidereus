import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { finderLink, onboardInMadrid, requirePlanGrant, setPlan, test } from "./helpers";

/*
 * The finder chart for a full-plan account (finder-chart Phase 6, FR-037): the "Finder chart" link of the M13 row on
 * /tonight/targets opens the chart state with both panels, the numbered steps and the context line; at 360 px nothing
 * scrolls sideways; in red mode the page renders with the red theme. The plan boundary itself (free, demoted, signed
 * out) is proven over HTTP in scripts/smoke.mjs; the stored copy is finder-offline.spec.ts.
 *
 * The plan is granted through the operator command (`node scripts/account-plan.mjs <email> full`) as a child process
 * with the inherited SUPABASE_URL and SUPABASE_SECRET_KEY of the local stack (finder-chart D-9); without the key the
 * spec fails under CI and skips locally. Each test signs up a fresh user (nothing is shared between tests), and a
 * flaky pass is a bug to fix, not a reason for retries (test-plan 6.5).
 */

/** M13 is a pinned target (not the first link on the page): a bright globular cluster Madrid's fixture night ranks. */
const TARGET = "M13";

/**
 * M13 can culminate above the overhead rule's 80° at southern sites, so either orientation is valid; what must hold is
 * that the context line says the same thing as the root's `data-finder-orientation`.
 */
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const FACING = new RegExp(
  `^${escapeRegExp(en.tonight.finder.contextFacing({ direction: "@@", time: "##" }))
    .replace("@@", ".+")
    .replace("##", ".+")}$`,
);
const OVERHEAD = new RegExp(`^${escapeRegExp(en.tonight.finder.contextOverhead({ time: "##" })).replace("##", ".+")}$`);

// The chart tests need a ranked M13 link on Targets: the pinned `evening` (17 October at Madrid) ranks it, whatever the
// real date or hour (test-suite-diet Phase 6). The no-darkness page is held by smoke (`finder 3`).
test.use({ clock: "evening" });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

/** A fresh full-plan account on Targets, then M13's "Finder chart" link followed to the chart. */
async function openChart(page: Page) {
  requirePlanGrant("finder-chart");
  const email = await onboardInMadrid(page, "e2e-finder-chart");
  await setPlan(email, "full");

  await page.goto("/tonight/targets");
  await (await finderLink(page, TARGET)).click();
  await expect(page).toHaveURL(new RegExp(`/tonight/finder\\?object=${TARGET}&`));
  await expect(page.locator("[data-finder-chart]")).toBeVisible();
}

test("the M13 row opens a chart with both panels, the steps and a context line that matches its orientation", async ({
  page,
}) => {
  await openChart(page);

  await expect(
    page.getByRole("heading", { level: 1, name: en.tonight.finder.title({ target: TARGET }) }),
  ).toBeVisible();
  await expect(page.locator("[data-finder-state]")).toHaveAttribute("data-finder-state", "chart");
  await expect(page.locator('[data-finder-panel="overview"]')).toBeVisible();
  await expect(page.locator('[data-finder-panel="finder"]')).toBeVisible();
  // Each panel is a picture with its own spoken description.
  await expect(page.locator("[data-finder-panel] svg[role='img'][aria-label]")).toHaveCount(2);

  const steps = page.locator("[data-finder-steps]");
  await expect(steps.getByRole("heading", { name: en.tonight.finder.stepsHeading })).toBeVisible();
  expect(await steps.locator("ol > li").count()).toBeGreaterThanOrEqual(2);

  const orientation = await page.locator("[data-finder-orientation]").getAttribute("data-finder-orientation");
  expect(["facing", "overhead"]).toContain(orientation);
  const context = ((await page.locator("[data-finder-context]").textContent()) ?? "").trim();
  expect(context).toMatch(orientation === "overhead" ? OVERHEAD : FACING);
});

test("at 360 px the chart fits the screen without scrolling sideways", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openChart(page);

  await expect(page.locator('[data-finder-panel="overview"]')).toBeVisible();
  await expect(page.locator('[data-finder-panel="finder"]')).toBeVisible();
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});
