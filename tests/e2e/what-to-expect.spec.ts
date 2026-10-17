import { expect, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, requirePlanGrant, setPlan, test } from "./helpers";

/*
 * What to expect on /tonight/targets (what-to-expect Phase 2, M-3 S-04, FR-038): a full-plan account sees an eye line
 * in each ranked object's details; a free account sees one muted locked line under the count and no phrase. The
 * plan boundary over HTTP (the island itself, free and full) is scripts/smoke.mjs; this spec covers what the browser
 * renders. Assertions go through the markers (`data-expect="<key>"`, `data-expect-locked`) and the catalogue's own
 * phrases, never literal English.
 *
 * The plan is granted through the operator command with the inherited local SUPABASE_URL and SUPABASE_SECRET_KEY, as
 * in finder-chart.spec.ts (the spec fails under CI and skips locally without them). The ranked test needs a ranking:
 * Madrid has darkness every night, and the clock is pinned to `evening`, so there is always one. Each test signs up a
 * fresh user.
 */

const LOCALES = [
  { locale: "en", messages: en },
  { locale: "pl", messages: pl },
] as const;

test.use({ clock: "evening" });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

/** Waits for Targets' island to paint its best objects (the first card), then for the fonts. */
async function waitForTargets(page: Page) {
  await expect(page.locator("li[data-object-card]").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test("at 320 px with the full plan, the best five's and an opened row's lines fit without scrolling sideways, in English and Polish", async ({
  page,
  context,
  baseURL,
}) => {
  requirePlanGrant("what-to-expect");
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

      // The narrowest stat pair (ui-fact-rhythm): Window and Best stacked in the indented row, about 222 px wide.
      // Every label and value fits its own box, and each value keeps to one line (the owner stacked the cards for it).
      const pair = row.locator("dl");
      await expect(pair, `${locale}: an opened row shows its stat pair`).toBeVisible();
      const cells = await pair.locator("dt, dd").evaluateAll((elements) =>
        elements.map((element) => ({
          text: element.textContent.trim(),
          tag: element.tagName,
          fits: element.scrollWidth <= element.clientWidth,
          oneLine:
            element.getBoundingClientRect().height < 1.5 * Number.parseFloat(getComputedStyle(element).lineHeight),
        })),
      );
      expect(cells.length, `${locale}: the pair holds Window and Best`).toBeGreaterThanOrEqual(4);
      for (const cell of cells) {
        expect(cell.fits, `${locale}: "${cell.text}" must not overflow its card at 320 px`).toBe(true);
        if (cell.tag === "DD") {
          expect(cell.oneLine, `${locale}: "${cell.text}" must stay on one line at 320 px`).toBe(true);
        }
      }

      // The cells' own boxes cannot overflow (a grid's `auto` column grows the card instead), so also check the card:
      // the `dl` has no sideways overflow, and every card ends within the row's scroll region, whose right edge is
      // the region's box minus its border and padding.
      const geometry = await pair.evaluate((dl) => {
        let region: HTMLElement | null = dl.parentElement;
        while (region && !/auto|scroll/.test(getComputedStyle(region).overflowY)) region = region.parentElement;
        if (!region) return null;
        const style = getComputedStyle(region);
        return {
          dlScrollWidth: dl.scrollWidth,
          dlClientWidth: dl.clientWidth,
          regionInnerRight:
            region.getBoundingClientRect().right -
            Number.parseFloat(style.borderRightWidth) -
            Number.parseFloat(style.paddingRight),
          cardRights: [...dl.children].map((card) => card.getBoundingClientRect().right),
        };
      });
      expect(geometry, `${locale}: the opened row sits in a scrolling region`).not.toBeNull();
      if (geometry) {
        expect(
          geometry.dlScrollWidth,
          `${locale}: the stat pair must not scroll sideways at 320 px`,
        ).toBeLessThanOrEqual(geometry.dlClientWidth);
        expect(
          geometry.cardRights.length,
          `${locale}: the pair holds a card each for Window and Best`,
        ).toBeGreaterThanOrEqual(2);
        for (const right of geometry.cardRights) {
          expect(right, `${locale}: a stat card must end within the row at 320 px`).toBeLessThanOrEqual(
            geometry.regionInnerRight + 0.5,
          );
        }
      }
    }

    // No lost space after a label's colon ("Do szczegółów:10 mm"): in Polish, no fact on Targets runs a letter, a
    // colon and a non-space together. Times such as "22:10" pass (a digit before the colon). The all-clear fixture
    // always ranks targets, so this holds on any date outside the no-darkness window.
    if (locale === "pl") {
      const facts = await page
        .locator("[data-fact]")
        .evaluateAll((elements) => elements.map((element) => element.textContent));
      expect(facts.length, "pl: Targets shows facts").toBeGreaterThan(0);
      // The eyepiece fact is among them, so the check below really runs over a label that ends in a colon.
      expect(
        facts.some((text) => text.includes(pl.tonight.object.findWith)),
        "pl: Targets shows an eyepiece fact (the 'Do szukania:' label)",
      ).toBe(true);
      for (const text of facts) {
        expect(text, "pl: a fact must keep the space after a label's colon").not.toMatch(/\p{L}:\S/u);
      }
    }
  }
});
