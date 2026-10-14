import { expect, test, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { finderLink, inNoDarknessWindow, onboardInMadrid, requirePlanGrant, setPlan } from "./helpers";

/*
 * What to expect on /tonight/targets (what-to-expect Phase 2, M-3 S-04, FR-038): a full-plan account sees an eye line
 * in each ranked object's details; a free account sees one muted locked line under the count and no phrase. The
 * plan boundary over HTTP (the island itself, free and full) is scripts/smoke.mjs; this spec covers what the browser
 * renders. Assertions go through the markers (`data-expect="<key>"`, `data-expect-locked`) and the catalogue's own
 * phrases, never literal English.
 *
 * The plan is granted through the operator command with the inherited local SUPABASE_URL and SUPABASE_SECRET_KEY, as
 * in finder-chart.spec.ts (the spec fails under CI and skips locally without them). The ranked tests need a ranking,
 * so they skip in the no-darkness window like the finder spec. Each test signs up a fresh user.
 */

const NO_DARKNESS = "no astronomical darkness (8 June to 2 July): the ranking can be empty";
const LOCALES = [
  { locale: "en", messages: en },
  { locale: "pl", messages: pl },
] as const;

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

/** Waits for Targets' island to paint its best objects (the first card), then for the fonts. */
async function waitForTargets(page: Page) {
  await expect(page.locator("li[data-object-card]").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test("a free account sees the locked line once and no phrase", async ({ page }) => {
  test.skip(inNoDarknessWindow(), NO_DARKNESS);
  await onboardInMadrid(page, "e2e-expect-free");

  await page.goto("/tonight/targets");
  await waitForTargets(page);

  await expect(page.locator("[data-expect-locked]")).toHaveCount(1);
  await expect(page.locator("[data-expect-locked]")).toContainText(en.tonight.expect.locked);
  await expect(page.locator("[data-expect]")).toHaveCount(0);
  // Not only no marker: no phrase anywhere in the page, open or folded, except the one the locked line quotes (O-1).
  const body = await page.evaluate(() => document.body.textContent);
  const { galaxySmudge, ...others } = en.tonight.expect.phrase;
  for (const phrase of Object.values(others)) {
    expect(body, "a free account's page must hold no phrase").not.toContain(phrase);
  }
  expect(en.tonight.expect.locked).toContain(galaxySmudge);
});

test("a full-plan account sees a phrase from the catalogue in the first object's details", async ({ page }) => {
  requirePlanGrant("what-to-expect");
  test.skip(inNoDarknessWindow(), NO_DARKNESS);
  const email = await onboardInMadrid(page, "e2e-expect-full");
  await setPlan(email, "full");

  await page.goto("/tonight/targets");
  await waitForTargets(page);

  const line = page.locator("li[data-object-card]").first().locator("[data-expect]");
  await expect(line).toHaveCount(1);
  const text = ((await line.textContent()) ?? "").trim();
  expect(Object.values(en.tonight.expect.phrase)).toContain(text);
  await expect(line).toHaveAttribute("data-expect", /^[A-Za-z]+$/);
  // The full plan never shows the free line.
  await expect(page.locator("[data-expect-locked]")).toHaveCount(0);
});

test("at 320 px with the full plan, the best five's and an opened row's lines fit without scrolling sideways, in English and Polish", async ({
  page,
  context,
  baseURL,
}) => {
  requirePlanGrant("what-to-expect");
  test.skip(inNoDarknessWindow(), NO_DARKNESS);
  const email = await onboardInMadrid(page, "e2e-expect-phone");
  await setPlan(email, "full");
  const url = baseURL ?? "http://localhost:4321";
  await page.setViewportSize({ width: 320, height: 568 });

  for (const { locale, messages } of LOCALES) {
    await context.addCookies([{ name: LOCALE_COOKIE, value: locale, url }]);
    await page.goto("/tonight/targets");
    await waitForTargets(page);

    // The best five's details are open at once: every card carries exactly one line, one of this language's phrases.
    const cards = await page.locator("li[data-object-card]").count();
    expect(cards, `${locale}: Targets shows its best objects`).toBeGreaterThan(0);
    const lines = page.locator("li[data-object-card] [data-expect]");
    await expect(lines, `${locale}: every best object carries a line`).toHaveCount(cards);
    const phrases = Object.values(messages.tonight.expect.phrase);
    for (const line of await lines.all()) {
      await expect(line).toBeVisible();
      expect(phrases, `${locale}: a line must be one of the catalogue's phrases`).toContain(
        ((await line.textContent()) ?? "").trim(),
      );
    }

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `${locale}: Targets must not scroll sideways at 320 px`).toBeLessThanOrEqual(clientWidth);

    // The rest sit narrower (indented rows in a bordered, scrolling region whose overflow the page width would hide):
    // open the list and one row, and check that row's line fits its own box.
    if ((await page.locator("details#more").count()) > 0) {
      await page.locator("details#more > summary").click();
      const row = page.locator("details#more li[data-object]").first();
      await row.locator("summary").click();
      const restLine = row.locator("[data-expect]");
      await expect(restLine, `${locale}: an opened row shows its line`).toBeVisible();
      const fits = await restLine.evaluate((element) => element.scrollWidth <= element.clientWidth);
      expect(fits, `${locale}: a row's line must not overflow at 320 px`).toBe(true);
    }
  }
});

test("a full-plan account's finder chart for M13 says what it will look like, above the chart", async ({ page }) => {
  requirePlanGrant("what-to-expect");
  test.skip(inNoDarknessWindow(), NO_DARKNESS);
  const email = await onboardInMadrid(page, "e2e-expect-finder");
  await setPlan(email, "full");

  await page.goto("/tonight/targets");
  await (await finderLink(page, "M13")).click();
  await expect(page.locator("[data-finder-chart]")).toBeVisible();

  const line = page.locator("[data-expect]");
  await expect(line).toHaveCount(1);
  const text = ((await line.textContent()) ?? "").trim();
  const { globularResolved, globularGrainy, globularGlow } = en.tonight.expect.phrase;
  expect([globularResolved, globularGrainy, globularGlow]).toContain(text);
  // The line sits above the chart, outside its root.
  await expect(page.locator("[data-finder-chart] [data-expect]")).toHaveCount(0);
});
