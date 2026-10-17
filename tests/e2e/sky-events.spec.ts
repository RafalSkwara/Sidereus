import { expect, type Locator, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { pl } from "@/i18n/messages/pl";
import { EVENT_WINDOW_NIGHTS } from "@/lib/engine/parameters";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, test } from "./helpers";

/*
 * The sky events page, end to end (M-3 S-07, sky-events Phase 4): a fresh user in Madrid on the all-clear forecast
 * fixture opens /tonight/events. The clock is real, so the spec never asserts which events occur (the next 30 nights
 * hold anywhere from none to a handful); it asserts the page's shape for whatever the real sky holds: the title and its
 * sub-nav chip, then either rows that each state a time and either the "Visible" mark or a reason, or the honest empty
 * state, with no not-visible row carrying the visible mark and every solar eclipse carrying its safety line. Engine
 * correctness is pinned by the unit tests against published dates, not here.
 */

const ROWS = "[data-event-kind]";
const EMPTY = "[data-events-empty]";

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

/** Opens the page and waits for the island: the skeleton already carries the title, the copy metadata is the island's. */
async function openEvents(page: Page) {
  await page.goto("/tonight/events");
  await expect(page.locator("[data-offline-copy]")).toBeAttached();
}

/** One row's facts. */
async function readRow(row: Locator) {
  const text = async (selector: string) => ((await row.locator(selector).first().textContent()) ?? "").trim();
  const safety = row.locator("[data-event-safety]");
  return {
    kind: await row.getAttribute("data-event-kind"),
    visible: await row.getAttribute("data-visible"),
    name: await text("h4"),
    when: await text("[data-event-when]"),
    visibility: await text("[data-event-visibility]"),
    visibleMarks: await row.locator("[data-event-visible-mark]").count(),
    notVisibleMarks: await row.locator("[data-event-not-visible-mark]").count(),
    safety: (await safety.count()) === 0 ? null : ((await safety.textContent()) ?? "").trim(),
  };
}

test("the events page lists the next nights' events with their visibility, or says there are none", async ({
  page,
}) => {
  const t = en.tonight;
  await onboardInMadrid(page, "e2e-events");
  await openEvents(page);

  await expect(page).toHaveTitle(en.common.pageTitle({ title: t.summary.events }));
  await expect(page.getByRole("heading", { level: 1, name: t.summary.events })).toBeVisible();
  // The sub-nav in the shell's strip names this page as the current one (ui-tonight-nav); exact, as a label can be a
  // substring of another ("Plan" of "Planets").
  await expect(
    page.getByRole("navigation", { name: t.subnav.label }).getByRole("link", { name: t.subnav.events, exact: true }),
  ).toHaveAttribute("aria-current", "page");
  // Times are the site's: Madrid's zone is named.
  await expect(page.getByText(t.pages.events.timesIn({ zone: "Europe/Madrid" }), { exact: true })).toBeVisible();

  const rows = page.locator(ROWS);
  const empty = page.locator(EMPTY);
  await expect(rows.first().or(empty)).toBeVisible();

  if ((await rows.count()) === 0) {
    await expect(empty).toHaveText(t.events.empty({ count: String(EVENT_WINDOW_NIGHTS) }));
    return;
  }
  await expect(empty).toHaveCount(0);

  const reasons = Object.values(t.events.reason);
  for (const row of await rows.all()) {
    const facts = await readRow(row);
    // A name and a time (a meteor peak is a night, never a minute) on every row.
    expect(facts.name, "every row has a name").not.toBe("");
    expect(facts.when, `${facts.name} states when`).not.toBe("");
    if (facts.visible === "true") {
      expect(facts.visibleMarks, `${facts.name} carries the Visible mark`).toBe(1);
      expect(facts.notVisibleMarks).toBe(0);
      // The best time, altitude and direction; never one of the not-visible reasons.
      expect(reasons).not.toContain(facts.visibility);
      expect(facts.visibility, `${facts.name} says when to look`).not.toBe("");
      await expect(row.locator("[data-event-visible-mark]")).toHaveText(t.events.visible);
    } else {
      expect(facts.visible).toBe("false");
      expect(facts.visibleMarks, `${facts.name} is not visible, so it has no Visible mark`).toBe(0);
      expect(facts.notVisibleMarks).toBe(1);
      expect(reasons, `${facts.name} says why it cannot be seen`).toContain(facts.visibility);
    }
    // Every solar eclipse, visible or not, carries the eye-safety line; nothing else does.
    if (facts.kind === "solar-eclipse") {
      expect(facts.safety, `${facts.name} carries the safety line`).toContain(t.events.solarSafety);
    } else {
      expect(facts.safety).toBeNull();
    }
  }
  // Nothing marked visible sits inside a not-visible row, anywhere on the page.
  await expect(page.locator('[data-visible="false"] [data-event-visible-mark]')).toHaveCount(0);
  await expect(page.locator('[data-visible="true"] [data-event-not-visible-mark]')).toHaveCount(0);
  // Rows are grouped under a heading per night.
  await expect(page.locator("[data-events-night] h3").first()).toBeVisible();
});

test("the events page is in Polish for a Polish user, with the same shape", async ({ page, context, baseURL }) => {
  const t = pl.tonight;
  await onboardInMadrid(page, "e2e-events-pl");
  await context.addCookies([{ name: LOCALE_COOKIE, value: "pl", url: baseURL ?? "http://localhost:4321" }]);
  await openEvents(page);

  await expect(page.getByRole("heading", { level: 1, name: t.summary.events })).toBeVisible();
  const rows = page.locator(ROWS);
  const empty = page.locator(EMPTY);
  await expect(rows.first().or(empty)).toBeVisible();
  if ((await rows.count()) === 0) {
    await expect(empty).toHaveText(t.events.empty({ count: String(EVENT_WINDOW_NIGHTS) }));
  } else {
    const marks = await page.locator("[data-event-visible-mark], [data-event-not-visible-mark]").allTextContents();
    expect(marks.length).toBe(await rows.count());
    for (const mark of marks) {
      expect([t.events.visible, t.events.notVisible]).toContain(mark.trim());
    }
  }
});
