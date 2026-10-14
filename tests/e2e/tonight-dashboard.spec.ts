import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { EVENT_WINDOW_NIGHTS, OUTLOOK_NIGHTS } from "@/lib/engine/parameters";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid } from "./helpers";

/*
 * Tonight as a dashboard, end to end (tonight-dashboard, roadmap S-11): under the sky, six tiles (the second, "Sky
 * events", since sky-events) each open a focused page under /tonight/*, never an anchor on the dashboard, and each page
 * leads back to Tonight. Same setup as the other specs: a production preview on local Supabase with the all-clear
 * forecast fixture, so the Moon card and the planets tile are both shown, and place search stubbed with Madrid. The
 * clock is real, so the spec never asserts what the tiles say, only where they lead (the events tile's line is checked
 * for its shape: the empty fact or an event and its night).
 */

const t = en.tonight;

/**
 * How the verdict's event line may begin, whichever date the clock has: "Tonight: ", or for a solar eclipse, a daytime
 * event, "Today, 11:22: " or "Tomorrow, 11:22: " (owner decision A, 2026-10-14). Built from the English messages, so a
 * rewording cannot leave the spec behind; a time is any `HH:mm`.
 */
const VERDICT_LINE_START = (() => {
  const e = t.events;
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const starts = [
    e.verdictLine({ name: "" }),
    e.verdictLineToday({ time: "00:00", name: "" }),
    e.verdictLineTomorrow({ time: "00:00", name: "" }),
  ];
  return new RegExp(`^(?:${starts.map((start) => escape(start).replace("00:00", "\\d{2}:\\d{2}")).join("|")})\\S`);
})();

/** Each tile: its heading, the page it opens and that page's title ("Open …" joins the name only where they differ). */
const TILES = [
  { heading: t.summary.targets, href: "/tonight/targets", page: t.pages.targets },
  { heading: t.summary.events, href: "/tonight/events", page: t.summary.events },
  { heading: t.summary.plan, href: "/tonight/plan", page: t.summary.plan },
  { heading: t.summary.moon, href: "/tonight/moon", page: t.summary.moon },
  { heading: t.summary.planets, href: "/tonight/planets", page: t.summary.planets },
  {
    heading: t.summary.nights({ count: String(OUTLOOK_NIGHTS) }),
    href: "/tonight/nights",
    page: t.summary.nights({ count: String(OUTLOOK_NIGHTS) }),
  },
];

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("Tonight's tiles open their pages, and each page leads back", async ({ page }) => {
  await onboardInMadrid(page, "e2e-dashboard");

  // Tonight's content is a server island fetched after the page loads: the sky headline waits for it.
  await expect(page.locator("#verdict-heading [data-sky-headline]")).toBeVisible();
  const tiles = page.locator("[data-tonight-tiles]");
  await expect(tiles.getByRole("link")).toHaveCount(TILES.length);
  for (const tile of TILES) {
    await expect(
      tiles.getByRole("link", {
        name: tile.page === tile.heading ? tile.heading : `${tile.heading} ${t.pages.open({ page: tile.page })}`,
        exact: true,
      }),
    ).toHaveAttribute("href", tile.href);
  }
  // No tile jumps within the dashboard, and the detail no longer sits under the tiles.
  await expect(tiles.locator('a[href^="#"]')).toHaveCount(0);
  await expect(page.locator('section[aria-labelledby="ranking-heading"], section#nights')).toHaveCount(0);

  // "Point here first" opens Targets, under its own title.
  await tiles.getByRole("link", { name: new RegExp(`^${t.summary.targets}`) }).click();
  await expect(page).toHaveURL(/\/tonight\/targets$/);
  await expect(page).toHaveTitle(en.common.pageTitle({ title: t.pages.targets }));
  await expect(page.getByRole("heading", { level: 1, name: t.pages.targets })).toBeVisible();
  // The page's skeleton carries the title and the back link too: wait for the island's list before going back.
  await expect(page.locator('section[aria-labelledby="targets-heading"] li[data-object]').first()).toBeVisible();

  await page.locator("main").getByRole("link", { name: en.nav.tonight, exact: true }).click();
  await expect(page).toHaveURL(/\/tonight$/);
  await expect(page.locator("#verdict-heading [data-sky-headline]")).toBeVisible();
  await expect(page.locator("[data-tonight-tiles]")).toBeVisible();
});

test("the Sky events tile states the next event or that there is none, and opens the events page", async ({ page }) => {
  await onboardInMadrid(page, "e2e-dashboard-events");
  await expect(page.locator("#verdict-heading [data-sky-headline]")).toBeVisible();

  // The second tile, straight after "Point here first". The clock is real, so the line is whichever the sky holds: the
  // empty fact, or an event with its night ("Perseids peak · night of 12/13 Aug").
  const tiles = page.locator("[data-tonight-tiles]");
  await expect(tiles.getByRole("link").nth(1)).toHaveAttribute("href", "/tonight/events");
  const line = tiles.locator("[data-events-tile-line]");
  await expect(line).toBeVisible();
  const text = ((await line.textContent()) ?? "").trim();
  const none = t.summary.eventsNone({ count: String(EVENT_WINDOW_NIGHTS) });
  expect(text === none || text.includes(" · "), `the tile says "${text}"`).toBe(true);

  // The verdict's own line exists only on a night with a notable event, as plain text: no link, no control.
  const verdictLine = page.locator("[data-verdict-event]");
  if ((await verdictLine.count()) > 0) {
    await expect(verdictLine).toHaveText(VERDICT_LINE_START);
    await expect(verdictLine.locator("a, button")).toHaveCount(0);
    // An event tonight is also the next one, so the tile cannot say there is none.
    expect(text).not.toBe(none);
  }

  await tiles.getByRole("link", { name: t.summary.events, exact: true }).click();
  await expect(page).toHaveURL(/\/tonight\/events$/);
  await expect(page).toHaveTitle(en.common.pageTitle({ title: t.summary.events }));
});

test("The Session plan page lists rows that lead to their targets", async ({ page }) => {
  await onboardInMadrid(page, "e2e-plan");
  await expect(page.locator("#verdict-heading [data-sky-headline]")).toBeVisible();

  await page.locator("[data-tonight-tiles]").getByRole("link", { name: t.summary.plan, exact: true }).click();
  await expect(page).toHaveURL(/\/tonight\/plan$/);
  await expect(page).toHaveTitle(en.common.pageTitle({ title: t.summary.plan }));

  // The plan page is a server island: the skeleton carries the title, so wait for the timeline's text line.
  await expect(page.locator("[data-session-plan-text]")).toBeVisible();
  const rows = page.locator("[data-session-plan-row]");
  await expect(rows.first()).toBeVisible();
  for (const href of await rows.evaluateAll((links) => links.map((link) => link.getAttribute("href")))) {
    expect(href).toMatch(/^\/tonight\/(targets#object-|planets#planet-|moon)/);
  }

  // ui-user-adjustments: a legend explains the curves, and every row says its best time in words above its curve.
  const legend = page.getByRole("list", { name: t.pages.plan.legendLabel });
  await expect(legend).toBeVisible();
  await expect(legend).toContainText(t.pages.plan.legendLine);
  // Onboarding keeps the default minimum altitude, 15°.
  await expect(legend).toContainText(t.pages.plan.legendMin({ deg: "15" }));
  await expect(legend).toContainText(t.pages.plan.legendWindow);
  await expect(legend).toContainText(t.pages.plan.legendBest);
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    await expect(row.locator("[data-session-plan-line]")).toHaveText(/^Best \d\d:\d\d · window \d\d:\d\d–\d\d:\d\d · /);
    await expect(row.locator("[data-session-plan-curve] svg path").first()).toHaveAttribute("d", /^M[\d.]+ [\d.]+ L/);
  }
});
