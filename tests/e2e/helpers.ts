import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { en } from "@/i18n/messages/en";
import type { Database } from "@/lib/database.types";

/*
 * Shared steps for the e2e specs. They run against a production preview on local Supabase with
 * FORECAST_BASE_URL pointing at `tests/e2e/forecast-fixture.mjs` (an all-clear sky); place search is stubbed
 * with Madrid, so no spec depends on Open-Meteo's geocoding.
 */

export const MADRID_RESULT = {
  id: 3117735,
  name: "Madrid",
  latitude: 40.4168,
  longitude: -3.7038,
  admin1: "Madrid",
  country: "Spain",
};
export const MADRID_LABEL = "Madrid, Madrid, Spain";

export const PASSWORD = "E2e-Test-Passw0rd!";

export const SIGNUP_FORM = 'form[action="/api/auth/signup"]';
export const ONBOARDING_FORM = 'form[action="/api/onboarding"]';

/**
 * Waits until React has hydrated the element matching `selector` inside an island, so typing and clicks reach
 * its handlers. Astro drops the island's `ssr` attribute as soon as it *starts* React's concurrent hydration, so
 * that alone leaves a window where input is silently lost (the parallel-load flakes of #45). React marks every
 * element it has hydrated with an own `__reactProps$<key>` property, bottom-up, so seeing it on the target means
 * the target and everything inside it are live.
 */
export async function waitForHydration(page: Page, selector: string) {
  await expect(page.locator(`astro-island[ssr]:has(${selector})`)).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactProps$"))),
    )
    .toBe(true);
}

/** Signs out through the top bar's settings popover (Sign out is no longer in the bar itself). */
export async function signOut(page: Page) {
  await page.getByRole("button", { name: en.nav.settings }).click();
  await page.getByRole("button", { name: en.nav.signOut }).click();
}

/** Answers Open-Meteo's place search with Madrid. */
export async function stubPlaceSearch(page: Page) {
  await page.route("https://geocoding-api.open-meteo.com/**", (route) =>
    route.fulfill({ json: { results: [MADRID_RESULT] }, headers: { "Access-Control-Allow-Origin": "*" } }),
  );
}

/** Signs up a fresh user (`<emailPrefix>-<uuid>@example.com`), lands on /onboarding and returns the email. */
export async function signUp(page: Page, emailPrefix: string): Promise<string> {
  const email = `${emailPrefix}-${randomUUID()}@example.com`;
  await page.goto("/auth/signup");
  await waitForHydration(page, SIGNUP_FORM);
  const signup = page.locator(SIGNUP_FORM);
  await signup.locator("#email").fill(email);
  await signup.locator("#password").fill(PASSWORD);
  await signup.locator("#confirmPassword").fill(PASSWORD);
  await signup.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await waitForHydration(page, ONBOARDING_FORM);
  return email;
}

/** Signs up a fresh user and completes onboarding in Madrid with the default kit, landing on Tonight; returns the email. */
export async function onboardInMadrid(page: Page, emailPrefix: string): Promise<string> {
  await stubPlaceSearch(page);
  const email = await signUp(page, emailPrefix);

  await page.locator("#place-search").fill("Madrid");
  await page.getByRole("list", { name: en.location.resultsLabel }).getByRole("button", { name: MADRID_LABEL }).click();
  await page.locator(`${ONBOARDING_FORM} button[type="submit"]`).click();
  await expect(page).toHaveURL(/\/tonight$/);
  return email;
}

/**
 * Records a past night's sky check for the user signed up as `email` (verdict-check), as Tonight would have the
 * evening it was shown: signs in through PostgREST as that user, finds their (only) site and calls
 * `record_sky_verdict` with a dark window that has already started. Needs SUPABASE_URL and SUPABASE_KEY of the
 * local stack the preview uses, as tests/db does.
 */
export async function seedSkyCheck(email: string, { night, headline }: { night: string; headline: string }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      "the sky-checks e2e needs SUPABASE_URL and SUPABASE_KEY (the anon/publishable key) of the preview's Supabase. " +
        "Locally: take API_URL and ANON_KEY from `npx supabase status -o env`.",
    );
  }
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw new Error(`sign-in for seeding failed: ${signIn.error.message}`);
  const { data: site, error: siteError } = await client.from("sites").select("id").single();
  if (siteError) throw new Error(`no single site to seed for: ${siteError.message}`);
  const { error } = await client.rpc("record_sky_verdict", {
    site_id: site.id,
    night,
    headline,
    dark_start: new Date(Date.UTC(...isoDateParts(night), 19)).toISOString(),
  });
  if (error) throw new Error(`seeding the sky check failed: ${error.message}`);
}

/** The date `days` before today in Madrid, `YYYY-MM-DD` (the e2e site's time zone). */
export function madridDateDaysAgo(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const [year, month, day] = isoDateParts(today);
  return new Date(Date.UTC(year, month, day - days)).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` as [year, zero-based month, day] for `Date.UTC`. */
function isoDateParts(date: string): [number, number, number] {
  const [year, month, day] = date.split("-").map(Number);
  return [year, month - 1, day];
}
