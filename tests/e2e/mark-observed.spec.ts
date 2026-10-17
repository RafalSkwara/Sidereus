import { expect } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { dismissCelebrationIfOpen, onboardInMadrid, test, waitForHydration } from "./helpers";

/*
 * "Mark observed", end to end, as one journey for one user (M-2 S-01 / S-02, S-06, FR-016 / FR-018): the Moon from the
 * Moon page, a planet from the Planets page and an object from the Targets page each open the log form prefilled from
 * the card or row, save through it, return to the page they came from (`from=moon`, `from=planets`, `from=targets`),
 * confirm with the save toast and leave the card or row tagged as seen; the log then lists all three by name. The Targets
 * leg also checks that the form leaves the rating to the user and turns a save without one away. Same setup as the other
 * specs: a production preview on local Supabase with FORECAST_BASE_URL pointing at `tests/e2e/forecast-fixture.mjs` (an
 * all-clear sky), and place search stubbed with Madrid.
 *
 * The clock is pinned to `evening` (17 October at Madrid: a waxing Moon, up and lit in the dark window, and a planet up),
 * so the Moon and a planet are targets at any real date and hour. Which planets qualify and in what order is pinned by
 * the engine's and the build's unit tests, and the order rule of Targets by the engine's: the journey takes the first
 * planet card and the first Targets row and never names them. What the Moon card says on a given night is pinned on
 * fixed nights by the build's unit tests.
 */

const LOG_FORM = 'form[action="/api/log"]';
const SEEN = en.tonight.object.seen.one({ count: "1", date: "" });

// The Moon and the planet are the pinned evening's (17 October at Madrid), whatever the real date or hour.
test.use({ clock: "evening" });

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("marking the Moon, a planet and a target observed saves each, tags it as seen and lists it in the log", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await onboardInMadrid(page, "e2e-mark-observed");

  // 1. The Moon, from the Moon page.
  await page.goto("/tonight/moon");
  // The page's content is a server island fetched after the page loads: wait for the card (it always renders in
  // Madrid) before deciding the Moon is no target, or the count below would always be 0.
  const moonCard = page.locator('section[aria-labelledby="moon-heading"]');
  await expect(moonCard.getByRole("heading", { level: 2 })).toBeVisible();
  const moonName = en.targets.moon;
  const markMoon = moonCard.getByRole("link", { name: en.tonight.moon.markObserved({ name: moonName }) });
  // On the pinned evening the Moon is up and lit in the dark window, so it is a target; none is a regression.
  await expect(markMoon, "the Moon is a target on the pinned evening").toHaveCount(1);
  await markMoon.click();

  // The form arrives prefilled with the Moon's target key and tonight's night, site and telescope.
  await expect(page).toHaveURL(/\/log\/new\?object=moon&night=\d{4}-\d{2}-\d{2}&site=.*&from=moon$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(en.log.title({ object: moonName }));
  await waitForHydration(page, LOG_FORM);
  let form = page.locator(LOG_FORM);
  // The radios are visually hidden inside their labels; click the label, as a user does.
  await form.locator("label").filter({ hasText: /^4$/ }).click();
  await form.locator('button[type="submit"]').click();

  // The save returns to the page it came from (`from=moon`).
  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object: moonName }) })).toBeVisible();
  await expect(page).toHaveURL(/\/tonight\/moon$/);
  // A fresh user's first Moon reaches a milestone: close its celebration before using the page.
  await dismissCelebrationIfOpen(page);
  // The log never reorders the Moon: the card stays and carries the "seen" tag.
  await expect(moonCard).toContainText(SEEN);

  // 2. The first planet card, from the Planets page.
  await page.goto("/tonight/planets");
  // The page's content is a server island fetched after the page loads: the heading below waits for it.
  const section = page.locator('section[aria-labelledby="planets-heading"]');
  await expect(section.getByRole("heading", { level: 2 })).toHaveText(en.tonight.planets.heading);
  const planetList = section.getByRole("list", { name: en.tonight.planets.listLabel });
  const cards = planetList.getByRole("listitem");
  // The pinned evening has a planet up (Saturn; the scenario test asserts it), so there is one to mark; none is a regression.
  expect(await cards.count(), "a planet is up on the pinned evening").toBeGreaterThan(0);

  const firstCard = cards.first();
  // The heading also holds the "not seen yet" button; the name sits in its own span.
  const planetName = ((await firstCard.locator("[data-target-name]").textContent()) ?? "").trim();
  const markPlanet = firstCard.getByRole("link", { name: en.tonight.object.markObserved });
  const planetKey = new URL((await markPlanet.getAttribute("href")) ?? "", "http://localhost").searchParams.get(
    "object",
  );
  const planetNames: Record<string, string> = en.targets.planet;
  if (!planetKey || planetNames[planetKey] !== planetName) {
    throw new Error(`the first planet card links "${String(planetKey)}" but is named "${planetName}"`);
  }
  await markPlanet.click();

  // The form arrives prefilled with the planet's target key and tonight's night, site and telescope.
  await expect(page).toHaveURL(
    new RegExp(`/log/new\\?object=${planetKey}&night=\\d{4}-\\d{2}-\\d{2}&site=.*&from=planets$`),
  );
  await expect(page.getByRole("heading", { level: 1 })).toContainText(en.log.title({ object: planetName }));
  await waitForHydration(page, LOG_FORM);
  form = page.locator(LOG_FORM);
  await form.locator("label").filter({ hasText: /^4$/ }).click();
  await form.locator('button[type="submit"]').click();

  // The save returns to the page it came from (`from=planets`).
  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object: planetName }) })).toBeVisible();
  await expect(page).toHaveURL(/\/tonight\/planets$/);
  // A fresh user's first planet reaches a milestone: close its celebration before using the page.
  await dismissCelebrationIfOpen(page);
  // Planets are never pushed down by the log, so the card stays and carries the "seen" tag.
  const loggedCard = planetList
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: planetName, exact: true }) });
  await expect(loggedCard).toContainText(SEEN);

  // 3. The first of the best objects, from the Targets page.
  await page.goto("/tonight/targets");
  // The list is a server island fetched after the page loads: the first of the best objects waits for it. Those are
  // shown in full, so "Mark observed" is right there.
  const firstRow = page.locator("li[data-object]").first();
  await expect(firstRow).toBeVisible();
  // The first row can be a Messier or a Caldwell object: the key ("M31", "NGC7000") is the row's `data-object` and the
  // link's `object`, the label ("M31", "NGC 7000") is what pages name it by.
  const id = await firstRow.getAttribute("data-object");
  if (!id || !/^(M\d{1,3}|(NGC|IC)\d{1,4})$/.test(id))
    throw new Error(`no catalogue key on the first row: ${String(id)}`);
  const label = await firstRow.getAttribute("data-label");
  if (!label) throw new Error("the first row has no data-label");

  await firstRow.getByRole("link", { name: new RegExp(en.tonight.object.markObserved) }).click();

  // The form arrives prefilled from the row (the object by its target key), with the rating left to the user, and
  // returns to the Targets page (`from=targets`).
  await expect(page).toHaveURL(new RegExp(`/log/new\\?object=${id}&night=\\d{4}-\\d{2}-\\d{2}&site=.*&from=targets$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText(en.log.title({ object: label }));
  await waitForHydration(page, LOG_FORM);
  form = page.locator(LOG_FORM);
  await expect(form.locator("#night")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await expect(form.getByRole("radio", { checked: true })).toHaveCount(0);

  // Without a rating the form stays put and says why.
  await form.locator('button[type="submit"]').click();
  await expect(form.getByText(en.errors.observation.ratingRequired)).toBeVisible();
  await expect(page).toHaveURL(/\/log\/new/);

  await form.locator("label").filter({ hasText: /^4$/ }).click();
  await expect(form.getByRole("radio", { name: "4", exact: true })).toBeChecked();
  await form.locator('button[type="submit"]').click();

  await expect(page.getByRole("status").filter({ hasText: en.tonight.logged({ object: label }) })).toBeVisible();
  await expect(page).toHaveURL(/\/tonight\/targets$/);
  await dismissCelebrationIfOpen(page);
  // Rated 4, the object moves down the list (maybe behind "Show the other …") but still cleared the bar, so its row
  // is there with the "seen" tag (the tag's wording up to the date, taken from the catalogue).
  await expect(page.locator(`li[data-object="${id}"]`)).toContainText(SEEN);

  // 4. The log lists all three by name.
  await page.getByRole("link", { name: en.nav.log }).click();
  await expect(page).toHaveURL(/\/log$/);
  for (const name of [moonName, planetName, label]) {
    await expect(page.locator('main a[href^="/log/"]').filter({ hasText: name })).toBeVisible();
  }
});
