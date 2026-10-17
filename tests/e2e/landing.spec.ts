import { expect } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";
import { test } from "./helpers";

/*
 * The landing page (ui-landing): `/` is for signed-out visitors only. Its look is checked by screenshots; this pins
 * what they can't show: that the credit ESA asked for ("Credit: ESA", the stars of the preview are Hipparcos stars,
 * star-source-switch) sits in the footer and wraps without sideways scroll at 320 and 360 px in both languages. Where
 * the two calls to action lead and that a signed-in user is sent on to Tonight are smoke steps (test-suite-diet).
 */

const LOCALES = ["en", "pl"] as const;
const NARROW_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 780 },
];

test("signed out, the landing page footer credits ESA and the Hipparcos stars", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
  await page.goto("/");

  // The footer credits the stars, as every view that draws stars does.
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText("Credit: ESA");
  await expect(footer).toContainText(en.tonight.attribution.hipparcosCitation);
});

test("the footer credit wraps without sideways scroll at 320 and 360 px, in English and Polish", async ({
  page,
  context,
  baseURL,
}) => {
  const url = baseURL ?? "http://localhost:4321";
  const problems: string[] = [];
  for (const locale of LOCALES) {
    await context.addCookies([{ name: LOCALE_COOKIE, value: locale, url }]);
    for (const viewport of NARROW_VIEWPORTS) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      const credit = page.locator("footer p", { hasText: "Credit: ESA" });
      await expect(credit).toBeVisible();
      await page.evaluate(() => document.fonts.ready);

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      const box = await credit.boundingBox();
      const label = `${locale} ${String(viewport.width)}×${String(viewport.height)}`;
      if (scrollWidth > clientWidth) {
        problems.push(`${label}: scrollWidth ${String(scrollWidth)} > clientWidth ${String(clientWidth)}`);
      }
      if (!box || box.x < 0 || box.x + box.width > clientWidth) {
        problems.push(`${label}: the credit line leaves the screen (${JSON.stringify(box)})`);
      }
    }
  }
  expect(problems, "landing credit problems").toEqual([]);
});
