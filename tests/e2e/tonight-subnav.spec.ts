import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { TONIGHT_NAV } from "@/lib/navigation";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, requirePlanGrant, setPlan, test } from "./helpers";

/*
 * The Tonight sub-nav, end to end (ui-tonight-nav Phase 2, 4A): the six focused pages carry one row of seven chips in
 * the shell's sky strip, in the dashboard's tile order, the current page's chip marked, and no back link; the dashboard
 * and the finder chart have no sub-nav, and the finder keeps its back link. On a phone the current chip is scrolled
 * into view without scrolling the page. The main bars (Topbar pill and TabBar) mark Tonight `aria-current="true"` (the
 * section) below `/tonight` and `"page"` on the dashboard only, so a focused page has one `"page"`: its chip
 * (impl-review F6, owner 2026-10-15). Same setup as the other Tonight specs: a production preview on local Supabase
 * with the all-clear forecast fixture and place search stubbed with Madrid. Every chip is found with `exact: true`:
 * "Plan" is a substring of "Planets", so a substring match hits two links. Each test signs up a fresh user.
 */

const t = en.tonight;
/** The six focused pages: the sub-nav's items without the dashboard. */
const FOCUSED = TONIGHT_NAV.filter((item) => item.href !== "/tonight");
/** The main bars, as in `navigation.spec.ts`. Both are in the DOM at every width (one is hidden by CSS). */
const BARS = ["[data-tabbar]", "header nav"] as const;

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

const subnav = (page: Page) => page.getByRole("navigation", { name: t.subnav.label });

/** Waits until the island has replaced the page's skeleton, so an assertion sees the real page and not the stand-in. */
async function waitForIsland(page: Page) {
  await expect(page.locator("[data-skeleton-content]")).toHaveCount(0);
}

/** Each main bar marks Tonight with `aria-current` `value`, and no item of the bar as the page unless that is it. */
async function expectBarsMarkTonight(page: Page, value: "page" | "true") {
  for (const bar of BARS) {
    await expect(page.locator(`${bar} a[href="/tonight"]`), `${bar}: Tonight`).toHaveAttribute("aria-current", value);
    await expect(page.locator(`${bar} [aria-current]`), `${bar}: one current item`).toHaveCount(1);
  }
}

test("each focused page has one sub-nav of seven chips with its own chip current, and no back link", async ({
  page,
}) => {
  // Onboarding plus six islands: more than the default 30 s on a slow runner.
  test.setTimeout(120_000);
  await onboardInMadrid(page, "e2e-subnav");

  for (const item of FOCUSED) {
    await page.goto(item.href);
    const nav = subnav(page);
    await expect(nav).toHaveCount(1);
    // Seven links, in the dashboard's tile order, with their short labels.
    await expect(nav.getByRole("link")).toHaveText(TONIGHT_NAV.map((entry) => t.subnav[entry.label]));
    // Exactly one current chip, and it is this page's.
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    const chip = nav.getByRole("link", { name: t.subnav[item.label], exact: true });
    await expect(chip).toHaveAttribute("aria-current", "page");
    await expect(chip).toHaveAttribute("href", item.href);

    // The island is in: neither it nor the skeleton draws a back link to Tonight any more.
    await waitForIsland(page);
    await expect(page.locator("main").getByRole("link", { name: en.nav.tonight, exact: true })).toHaveCount(0);

    // The bars mark Tonight as the section, so the chip is the page's one `aria-current="page"`. Targets' own Order
    // control marks its current order the same way (its links carry `?sort=`): that is not the page's mark.
    await expectBarsMarkTonight(page, "true");
    const pageMarks = await page
      .locator('[aria-current="page"]')
      .evaluateAll((marks) => marks.map((mark) => mark.getAttribute("href")));
    expect(pageMarks.filter((href) => !href?.startsWith("/tonight/targets?sort="))).toEqual([item.href]);
  }
});

test("the dashboard has no sub-nav", async ({ page }) => {
  await onboardInMadrid(page, "e2e-subnav-dashboard");

  await expect(page.locator("#verdict-heading [data-sky-headline]")).toBeVisible();
  await expect(page.locator("[data-tonight-subnav]")).toHaveCount(0);
  await expect(subnav(page)).toHaveCount(0);
  // The dashboard is Tonight itself: the bars mark it as the page.
  await expectBarsMarkTonight(page, "page");
});

test("the finder chart has no sub-nav and keeps its back link to Targets", async ({ page }) => {
  requirePlanGrant("tonight-subnav");
  const email = await onboardInMadrid(page, "e2e-subnav-finder");
  await setPlan(email, "full");

  await page.goto("/tonight/finder?object=M31&from=targets");
  // Whichever state the night gives (a chart, or M31 not ranked), the page sky carries the back link.
  await expect(page.locator("[data-finder-state]")).toBeAttached();
  await expect(page.locator("[data-tonight-subnav]")).toHaveCount(0);
  await expect(page.locator("main").getByRole("link", { name: t.pages.targets, exact: true })).toHaveAttribute(
    "href",
    "/tonight/targets",
  );
  // Below `/tonight`, so the bars mark Tonight as the section; with no sub-nav, nothing on the page is the page.
  await expectBarsMarkTonight(page, "true");
  await expect(page.locator('[aria-current="page"]')).toHaveCount(0);
});

test("on a phone the current chip is scrolled into view without scrolling the page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await onboardInMadrid(page, "e2e-subnav-phone");

  for (const href of ["/tonight/nights", "/tonight/events"]) {
    await page.goto(href);
    const row = page.locator("[data-subnav-row]");
    const chip = subnav(page).locator('[aria-current="page"]');
    await expect(chip).toHaveAttribute("href", href);

    // The chip's box lies inside the row's box and inside the viewport.
    await expect
      .poll(async () => {
        const [rowBox, chipBox] = [await row.boundingBox(), await chip.boundingBox()];
        if (!rowBox || !chipBox) return false;
        return (
          chipBox.x >= rowBox.x - 1 &&
          chipBox.x + chipBox.width <= rowBox.x + rowBox.width + 1 &&
          chipBox.x >= 0 &&
          chipBox.x + chipBox.width <= 390
        );
      })
      .toBe(true);
    // Seven chips never fit 390 px: the row was scrolled, so its start fades.
    if (href === "/tonight/nights") {
      await expect(row).toHaveAttribute("data-more-start", "");
    }
    // Events is already in view before any scroll, so only its centring proves the script ran for it.
    if (href === "/tonight/events") {
      await expect
        .poll(async () => {
          const [rowBox, chipBox] = [await row.boundingBox(), await chip.boundingBox()];
          if (!rowBox || !chipBox) return Infinity;
          return Math.abs(chipBox.x + chipBox.width / 2 - (rowBox.x + rowBox.width / 2));
        })
        .toBeLessThanOrEqual(2);
    }

    // The row scrolled sideways only: the page itself is still at the top, with the island in too.
    await waitForIsland(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});

test("Plan is one tap from Targets", async ({ page }) => {
  await onboardInMadrid(page, "e2e-subnav-tap");

  await page.goto("/tonight/targets");
  await subnav(page).getByRole("link", { name: t.subnav.plan, exact: true }).click();
  await expect(page).toHaveURL(/\/tonight\/plan$/);
  await expect(page.getByRole("heading", { level: 1, name: t.summary.plan })).toBeVisible();
  await expect(subnav(page).getByRole("link", { name: t.subnav.plan, exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
