import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import type { TelescopeEntry } from "@/lib/gear/catalogue/types";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * The gear catalogue on the telescope form, end to end (gear-catalogue): typing a model and pressing Enter fills the
 * form's own fields, which then save like hand-typed ones. Enter, not ArrowDown: typing already highlights the best match.
 */

const TELESCOPE_FORM = 'form[action="/api/gear/telescopes"]';

const catalogue = JSON.parse(
  readFileSync(path.join(process.cwd(), "src/lib/gear/catalogue/telescopes.json"), "utf8"),
) as TelescopeEntry[];
const heritage = catalogue.find((entry) => entry.id === "skywatcher-heritage-130p");

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL }]);
});

test("a catalogue pick fills the telescope form, which then saves", async ({ page }) => {
  if (!heritage) throw new Error("Heritage-130P is missing from the telescope catalogue");
  await onboardInMadrid(page, "gear-catalogue");

  await page.goto("/gear/telescopes/new");
  await waitForHydration(page, TELESCOPE_FORM);
  const form = page.locator(TELESCOPE_FORM);

  // Options load after hydration; focusing opens the full list once they have, and Enter on an empty list would submit.
  const combobox = form.getByRole("combobox", { name: en.gearCatalogue.telescope.label });
  await combobox.click();
  await expect(page.getByRole("option").first()).toBeVisible();

  await combobox.fill("heritage 130");
  await combobox.press("Enter");

  await expect(form.locator("#name")).toHaveValue(heritage.name);
  await expect(form.locator("#apertureMm")).toHaveValue(String(heritage.apertureMm));
  await expect(form.locator("#focalLengthMm")).toHaveValue(String(heritage.focalLengthMm));

  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/gear\?saved=telescope$/);
  await expect(page.getByText(en.gear.notice.saved.telescope)).toBeVisible();
});
