import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { madridDateDaysAgo, onboardInMadrid, seedSkyCheck } from "./helpers";

/*
 * The verdict check end to end (verdict-check, roadmap M-2 S-07): a past night Tonight judged "Clear" is asked about
 * on Tonight, answered, tallied on the sky checks page and changed there. Same setup as the other specs: a
 * production preview on local Supabase with the all-clear forecast fixture and place search stubbed with Madrid.
 *
 * A fresh user has no past night, so the spec seeds one through PostgREST (`seedSkyCheck`, which needs
 * SUPABASE_URL / SUPABASE_KEY). The clock is real: the seeded night is two days back in Madrid, which falls in
 * Tonight's two-night window whether or not civil dawn has passed, so the spec never asserts "last night" wording.
 * Tonight also records its own night on every view; whether that row is listed depends on the hour, so the spec
 * only looks at the seeded night's row.
 */

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

test("a past night is asked about on Tonight, answered, tallied and changed on the sky checks page", async ({
  page,
}) => {
  const email = await onboardInMadrid(page, "e2e-sky");
  const night = madridDateDaysAgo(2);
  await seedSkyCheck(email, { night, headline: "go" });

  await page.goto("/tonight");
  const card = page.locator("[data-sky-check]");
  await expect(card.getByText(en.skyChecks.card.weSaid({ site: "Home", headline: en.verdict.level.go }))).toBeVisible();

  await card.getByRole("button", { name: en.verdict.level.marginal }).click();
  // The answer shows a toast, then the toast script removes `skyChecked` from the URL.
  await expect(page.getByRole("status").filter({ hasText: en.skyChecks.saved })).toBeVisible();
  await expect(page).toHaveURL(/\/tonight$/);
  await expect(page.locator("[data-sky-headline]").first()).toBeVisible();
  await expect(page.locator("[data-sky-check]")).toHaveCount(0);

  // The log links to the sky checks page.
  await page.goto("/log");
  await page.getByRole("link", { name: en.log.list.skyChecks }).click();
  await expect(page).toHaveURL(/\/log\/sky$/);

  const tally = page.locator("[data-sky-tally]");
  await expect(tally).toContainText(en.skyChecks.tally.matched.one({ matched: "0", answered: "1" }));
  await expect(tally).toContainText(en.skyChecks.tally.misses({ optimistic: "1", pessimistic: "0" }));
  const row = page.locator(`[data-sky-check-row="${night}"]`);
  await expect(row).toContainText(en.skyChecks.page.youSaw({ answer: en.verdict.level.marginal }));
  await expect(row).toContainText(en.skyChecks.outcome.optimistic);

  // Changing the answer on the page re-tallies it.
  await row.getByRole("button", { name: en.verdict.level.go, exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: en.skyChecks.saved })).toBeVisible();
  await expect(page).toHaveURL(/\/log\/sky$/);
  await expect(tally).toContainText(en.skyChecks.tally.matched.one({ matched: "1", answered: "1" }));
  await expect(row.getByRole("button", { name: en.verdict.level.go, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(row).toContainText(en.skyChecks.outcome.match);
});
