import { expect, type Locator, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";
import type { MilestoneKey } from "@/lib/progress/milestones";
import { createFormatter } from "@/lib/tonight/format";
import { TOAST_MS } from "@/lib/toasts";

import { madridDateDaysAgo, onboardInMadrid, test, waitForHydration } from "./helpers";

/*
 * Observing milestones (M-3 S-06, FR-041, US-06): the record half and the celebration. A milestone is stored at save,
 * never for an entry rated 1-2, and stays listed on `/log/progress` after the entry that reached it was edited away or
 * deleted; the save that stores it opens the celebration dialog, once. The record test also carries the progress page's
 * counts (M-3 S-05, FR-039 / FR-040): only entries rated 3 or above count and tick, a planet's first night is shown, and
 * the counts follow edits and deletes. Each test signs up its own fresh Madrid user on
 * the all-clear forecast fixture, so nothing depends on test order. The copy is read from the catalogue and the dates
 * go through the same formatter the page uses.
 *
 * Progress rewards (ui-progress-rewards) adds what a screenshot cannot show: a tile's screen-reader sentence carries
 * its type and seen state (exact text: "not seen" contains "seen"), the legend's per-type count follows the log both
 * ways, the dialog shows the milestone's badge, and the checklist markup stays inside its measured budget.
 */

const progress = en.progress;
const copy = progress.milestones;
const count = (seen: number, total: number) => progress.count({ seen: String(seen), total: String(total) });
const LOG_FORM = 'form[action="/api/log"]';
const EDIT_FORM = 'form[action^="/api/log/"]:not([action$="/delete"])';
const DELETE_FORM = 'form[action$="/delete"]';
const format = createFormatter("en");
/** M31's English common name, from `messier.json` (the catalogue JSON does not load in Playwright). */
const M31_NAME = "Andromeda Galaxy";
/** A tile's screen-reader sentence: "M31, Andromeda Galaxy, galaxy, seen". */
const tileSr = (seen: boolean) => [M31_NAME, progress.types.galaxy.one, seen ? progress.seen : progress.notSeen];
/**
 * The two checklist grids plus the icon sprite, in `outerHTML` characters, in this journey's state at step 3 (M31 seen):
 * measured at 103,758 on the preview build (implementation-notes.md), pinned at about +10 %, so a tile that grows
 * fails here and not in a user's data plan. The measure covers this change's markup only, never the page shell.
 */
const CHECKLIST_MARKUP_BUDGET = 114_000;

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

async function rate(form: Locator, rating: number) {
  // The radios are visually hidden inside their labels; click the label, as a user does.
  await form
    .locator("label")
    .filter({ hasText: new RegExp(`^${rating}$`) })
    .click();
}

/**
 * Fills the new-entry form for `url`, rates it and saves; returns the night it saved: the one the form proposed, or
 * `pinnedNight` when the form's night is set to it first.
 */
async function logEntry(
  page: Page,
  url: string,
  rating: number,
  returnsTo: RegExp,
  pinnedNight?: string,
): Promise<string> {
  await page.goto(url);
  await waitForHydration(page, LOG_FORM);
  const form = page.locator(LOG_FORM);
  if (pinnedNight) await form.locator("#night").fill(pinnedNight);
  const night = await form.locator("#night").inputValue();
  expect(night).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await rate(form, rating);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(returnsTo);
  return night;
}

/** Opens the log entry for `id` (the entry's link in the log) and waits for its edit form. */
async function openEntry(page: Page, id: string): Promise<Locator> {
  await page.goto("/log");
  await page.locator('main a[href^="/log/"]').filter({ hasText: id }).click();
  await expect(page).toHaveURL(/\/log\/[0-9a-f-]{36}$/);
  await waitForHydration(page, EDIT_FORM);
  return page.locator(EDIT_FORM);
}

/** The celebration, found by its own attribute (never by the toast region): open, and the one dialog on the page. */
const celebration = (page: Page) => page.locator("[data-milestone-celebration]");
const openCelebration = (page: Page) => page.locator("dialog[data-milestone-celebration][open]");

/** The page the save returned to has loaded, and it carries no celebration at all (none is rendered without a key). */
async function expectNoCelebration(page: Page) {
  await page.waitForLoadState("load");
  await expect(celebration(page)).toHaveCount(0);
}

/** The `milestone` param is gone from the address bar (the dialog removes it as it opens). */
async function expectMilestoneParamCleared(page: Page) {
  await expect.poll(() => new URL(page.url()).searchParams.has("milestone")).toBe(false);
}

const row = (page: Page, key: MilestoneKey) => page.locator(`[data-milestone="${key}"]`);

/** The row is reached, on `night`, with its name and a check. */
async function expectReached(page: Page, key: MilestoneKey, night: string) {
  const milestone = row(page, key);
  await expect(milestone).toHaveCount(1);
  await expect(milestone).toHaveAttribute("data-reached", "");
  await expect(milestone).toContainText(copy.name[key]);
  await expect(milestone).toContainText(copy.reachedOn({ date: format.formatShortDate(night) }));
}

/** The row is still ahead: no `data-reached`, and `status` (Not yet, or "x / N") as its note. */
async function expectAhead(page: Page, key: MilestoneKey, status: string) {
  const milestone = row(page, key);
  await expect(milestone).toHaveCount(1);
  await expect(milestone).not.toHaveAttribute("data-reached", /.*/);
  await expect(milestone).toContainText(copy.name[key]);
  await expect(milestone).toContainText(status);
}

test("records a milestone once, at save, keeps it listed, and the progress page counts only entries rated 3 or above", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await onboardInMadrid(page, "e2e-milestones");
  const messierHeading = page.locator("#progress-messier-heading");
  const chip = (key: string) => page.locator(`[data-checklist-item="${key}"]`);
  const tileSrText = (key: string) => chip(key).locator("[data-tile-sr]");
  const messierLegend = (family: string) =>
    page
      .locator('section[aria-labelledby="progress-messier-heading"] [data-checklist-legend]')
      .locator(`[data-legend-family="${family}"] [data-legend-count]`);

  // 1. Progress in the primary nav opens the page; nothing is seen yet, but every band shows, and no milestone is reached.
  await page.goto("/log");
  await page.getByRole("navigation", { name: en.nav.primary }).getByRole("link", { name: en.nav.progress }).click();
  await expect(page).toHaveURL(/\/log\/progress$/);
  await expect(messierHeading).toContainText(count(0, 110));
  await expect(page.locator("#progress-caldwell-heading")).toContainText(count(0, 61));
  await expect(page.locator("[data-progress-firsts] li")).toHaveCount(8);
  await expect(page.locator("[data-checklist-item]")).toHaveCount(171);
  await expect(page.locator("[data-progress-empty]")).toContainText(progress.empty);
  await expect(page.getByRole("link", { name: progress.toTonight })).toBeVisible();
  await expect(page.locator("#progress-milestones-heading")).toHaveText(copy.title);
  await expect(page.locator("[data-milestone]")).toHaveCount(11);

  // 2. M31 rated 2 reaches nothing and ticks nothing: the first galaxy is still ahead, the count stays 0.
  await logEntry(page, "/log/new?object=M31&from=log", 2, /\/log(\?|$)/);
  await page.goto("/log/progress");
  await expectAhead(page, "first-galaxy", copy.notYet);
  await expect(messierHeading).toContainText(count(0, 110));
  await expect(chip("M31")).toHaveCount(1);
  await expect(chip("M31")).not.toHaveAttribute("data-seen", /.*/);
  await expect(chip("M31")).toHaveAttribute("data-family", "galaxy");
  await expect(tileSrText("M31")).toHaveText(["M31", ...tileSr(false)].join(", "));
  await expect(messierLegend("galaxy")).toHaveText(count(0, 40));

  // 3. Edited to 4, the entry reaches the milestone on the entry's own night, counts, its chip is ticked and it is
  // listed under seen.
  let form = await openEntry(page, "M31");
  const galaxyNight = await form.locator("#night").inputValue();
  await expect(form.getByRole("radio", { name: "2", exact: true })).toBeChecked();
  await rate(form, 4);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/log(\?|$)/);
  await page.goto("/log/progress");
  await expectReached(page, "first-galaxy", galaxyNight);
  await expect(messierHeading).toContainText(count(1, 110));
  await expect(chip("M31")).toHaveAttribute("data-seen", "");
  await expect(tileSrText("M31")).toHaveText(["M31", ...tileSr(true)].join(", "));
  await expect(messierLegend("galaxy")).toHaveText(count(1, 40));
  await expect(page.locator('[data-seen-item="M31"]')).toHaveCount(1);
  await expect(page.locator("[data-progress-empty]")).toHaveCount(0);
  // The checklist markup budget, in this state: the two grids and the sprite only (never the shell).
  const checklistMarkup = await page.evaluate(() =>
    [...document.querySelectorAll("[data-checklist-grid], [data-object-type-sprite]")]
      .map((element) => element.outerHTML.length)
      .reduce((sum, length) => sum + length, 0),
  );
  expect(checklistMarkup).toBeGreaterThan(0);
  expect(checklistMarkup).toBeLessThan(CHECKLIST_MARKUP_BUDGET);

  // 3b. Re-rated to 2, the entry un-sees M31: the tile, the legend and the count go back, while the first galaxy stays
  // reached on its stored night. Then back to 4 (the galaxy is stored, so nothing celebrates), as step 5 expects.
  form = await openEntry(page, "M31");
  await rate(form, 2);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/log(\?|$)/);
  await page.goto("/log/progress");
  await expect(chip("M31")).not.toHaveAttribute("data-seen", /.*/);
  await expect(tileSrText("M31")).toHaveText(["M31", ...tileSr(false)].join(", "));
  await expect(messierLegend("galaxy")).toHaveText(count(0, 40));
  await expect(messierHeading).toContainText(count(0, 110));
  await expectReached(page, "first-galaxy", galaxyNight);
  form = await openEntry(page, "M31");
  await rate(form, 4);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/log(\?|$)/);
  // "First galaxy" is stored, so the save that reaches it again celebrates nothing (impl review F4).
  await expectNoCelebration(page);

  // 4. Jupiter, logged from the planets page's form (straight to the form: it does not depend on Jupiter being up
  // tonight), reaches the first planet and shows the night it was logged as its first. It is no Messier object, so the
  // Messier count stays at the galaxy alone.
  const jupiterNight = await logEntry(page, "/log/new?object=jupiter&from=planets", 3, /\/tonight\/planets(\?|$)/);
  await page.goto("/log/progress");
  await expectReached(page, "first-planet", jupiterNight);
  await expectAhead(page, "messier-10", copy.progress({ seen: "1", total: "10" }));
  await expect(page.locator('[data-first="jupiter"]')).toContainText(
    progress.firstSeen({ date: format.formatShortDate(jupiterNight) }),
  );
  await expect(page.locator('[data-first="saturn"]')).toContainText(progress.notYet);

  // 5. The M31 entry becomes M13, still rated 4: the globular is reached, and the first galaxy stays, on its stored
  // night, though no entry holds a galaxy any more.
  form = await openEntry(page, "M31");
  const picker = form.getByRole("combobox", { name: en.log.picker.label });
  await picker.fill("m13");
  await expect(form.getByRole("option").first()).toContainText("M13");
  await picker.press("Enter");
  await expect(picker).toHaveValue(/^M13 · /);
  await expect(form.getByRole("radio", { name: "4", exact: true })).toBeChecked();
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/log(\?|$)/);
  await page.goto("/log/progress");
  await expectReached(page, "first-galaxy", galaxyNight);
  await expectReached(page, "first-globular", galaxyNight);
  await expect(messierLegend("galaxy")).toHaveText(count(0, 40));
  await expect(messierLegend("globular")).toHaveText(count(1, 29));
  await expect(chip("M31")).not.toHaveAttribute("data-seen", /.*/);

  // 6. Deleting the M13 entry takes the entries away, not the record: both milestones stay, on their stored nights,
  // while the counts follow the log and go back to 0.
  await openEntry(page, "M13");
  await waitForHydration(page, DELETE_FORM);
  await page.getByRole("button", { name: en.log.delete }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: en.log.delete }).click();
  await expect(page).toHaveURL(/\/log(\?|$)/);
  await page.goto("/log/progress");
  await expectReached(page, "first-galaxy", galaxyNight);
  await expectReached(page, "first-globular", galaxyNight);
  await expectAhead(page, "messier-10", copy.progress({ seen: "0", total: "10" }));
  await expect(messierHeading).toContainText(count(0, 110));
  await expect(chip("M13")).not.toHaveAttribute("data-seen", /.*/);
});

test("celebrates a milestone once, at save", async ({ page, pinnedNow }) => {
  test.setTimeout(180_000);
  await onboardInMadrid(page, "e2e-milestones-celebration");
  const celebrationCopy = copy.celebration;

  // 1. M31 rated 2 reaches nothing: no celebration, open or not.
  await logEntry(page, "/log/new?object=M31&from=log", 2, /\/log(\?|$)/);
  await expectNoCelebration(page);

  // 2. Edited to 4, it reaches the first galaxy: exactly one open dialog names it, and the save's own toast is there
  // beside it. The param is already out of the address bar once the dialog is open.
  const form = await openEntry(page, "M31");
  await expect(form.getByRole("radio", { name: "2", exact: true })).toBeChecked();
  await rate(form, 4);
  // The clock fixture's fake clock (helpers.ts) lets the toast's 10 s timer be run past while the dialog covers it
  // (impl review F1).
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/log(\?|$)/);
  await expect(celebration(page)).toHaveCount(1);
  await expect(openCelebration(page)).toHaveCount(1);
  await expect(openCelebration(page)).toContainText(copy.name["first-galaxy"]);
  await expect(openCelebration(page).locator('[data-milestone-badge="first-galaxy"]')).toHaveCount(1);
  await expect(openCelebration(page).getByRole("link", { name: celebrationCopy.seeProgress })).toHaveAttribute(
    "href",
    "/log/progress",
  );
  await expect(page.locator("[data-toast]")).toContainText(en.log.list.updated({ object: "M31" }));
  await expectMilestoneParamCleared(page);

  // 3. Continue closes it, and a reload shows nothing: no dialog, and no `milestone` in the URL.
  // The toast waits behind the dialog: past its 10 s, it is still there.
  const toast = page.locator("[data-toast]").filter({ hasText: en.log.list.updated({ object: "M31" }) });
  await page.clock.runFor(TOAST_MS + 1_000);
  await expect(toast).toHaveCount(1);
  // The dialog's `close` event, which releases the toast's timer, is dispatched as a task after the click: wait for it
  // before running the clock (the toast's listener was added first, so it has run by then).
  const closed = page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        document.querySelector("dialog[data-milestone-celebration]")?.addEventListener(
          "close",
          () => {
            resolve();
          },
          { once: true },
        );
      }),
  );
  await openCelebration(page).getByRole("button", { name: celebrationCopy.continue }).click();
  await closed;
  await expect(openCelebration(page)).toHaveCount(0);
  // Focus goes to <main>, the toasts' pattern, never left on the closed dialog's hidden button or on <body>.
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("MAIN");
  // The toast is visible once the dialog has closed, and only then does its timer run out.
  await expect(toast).toBeVisible();
  await page.clock.runFor(TOAST_MS + 1_000);
  await expect(toast).toHaveCount(0);
  await page.reload();
  await expectNoCelebration(page);
  await expectMilestoneParamCleared(page);

  // 4. Jupiter, logged from the planets page's form, reaches the first planet: the dialog names it on /tonight/planets
  // (and not the galaxy, which was celebrated once and is stored).
  await logEntry(page, "/log/new?object=jupiter&from=planets", 3, /\/tonight\/planets(\?|$)/);
  await expect(openCelebration(page)).toHaveCount(1);
  await expect(openCelebration(page)).toContainText(copy.name["first-planet"]);
  await expect(openCelebration(page)).not.toContainText(copy.name["first-galaxy"]);
  await expectMilestoneParamCleared(page);

  // 5. Delete the M31 entry, then log M31 again rated 5 on a night three days back: the first galaxy is already stored,
  // so the save celebrates nothing.
  await openEntry(page, "M31");
  await waitForHydration(page, DELETE_FORM);
  await page.getByRole("button", { name: en.log.delete }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: en.log.delete }).click();
  await expect(page).toHaveURL(/\/log(\?|$)/);
  const night = await logEntry(
    page,
    "/log/new?object=M31&from=log",
    5,
    /\/log(\?|$)/,
    madridDateDaysAgo(3, pinnedNow()),
  );
  expect(night).toBe(madridDateDaysAgo(3, pinnedNow()));
  await expect(page.locator("[data-toast]")).toContainText(en.log.list.saved({ object: "M31" }));
  await expectNoCelebration(page);
});
