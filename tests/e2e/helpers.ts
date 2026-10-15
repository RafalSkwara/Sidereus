import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test, type Locator, type Page } from "@playwright/test";
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

/**
 * Closes the milestone celebration (observing-milestones, M-3 S-06) when the page a save returned to opened one.
 * A save rated 3 or above can reach a milestone (a fresh user's first planet, first Moon, first galaxy …), and the
 * page then opens a modal dialog over itself that makes everything else inert, so a spec that goes on to click the
 * page closes it first, with Continue, as a user does. The dialog is server-rendered in the page shell and its script
 * opens it before `DOMContentLoaded`, so once the document has loaded, no dialog means no celebration. Call it after
 * every save rated 3 or above; it does nothing when the save reached no new milestone. The celebration itself is
 * asserted in `observing-milestones.spec.ts`.
 */
export async function dismissCelebrationIfOpen(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  const dialog = page.locator("dialog[data-milestone-celebration]");
  if ((await dialog.count()) === 0) return;
  await expect(dialog).toHaveAttribute("open", "");
  await dialog.locator("[data-milestone-close]").click();
  await expect(dialog).not.toHaveAttribute("open");
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

// A 1×1 transparent PNG: what the stubbed map tiles answer with.
const BLANK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/**
 * Answers OpenStreetMap's tile requests ("Pick from map", S-09) with a blank PNG, so no spec depends on the tile
 * servers, and counts them: `count()` is how many tiles the page asked for.
 */
export async function stubMapTiles(page: Page): Promise<{ count(): number }> {
  let requests = 0;
  await page.route("https://tile.openstreetmap.org/**", (route) => {
    requests += 1;
    return route.fulfill({ body: BLANK_PNG, contentType: "image/png" });
  });
  return { count: () => requests };
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

const ACCOUNT_PLAN_SCRIPT = fileURLToPath(new URL("../../scripts/account-plan.mjs", import.meta.url));
const execFileAsync = promisify(execFile);

/**
 * Fails under CI and skips locally when there is no way to grant the full plan (finder-chart D-9): the operator command
 * needs the local stack's SUPABASE_URL and SUPABASE_SECRET_KEY, passed inline on the e2e command (never exported).
 * Call it first inside a test; `spec` names the spec in the failure.
 */
export function requirePlanGrant(spec: string) {
  if (process.env.SUPABASE_SECRET_KEY) return;
  if (process.env.CI) {
    throw new Error(
      `${spec} needs SUPABASE_SECRET_KEY (and SUPABASE_URL) of the local stack to grant the full plan: ` +
        "pass them inline on the e2e command.",
    );
  }
  test.skip(true, "no SUPABASE_SECRET_KEY");
}

/** Grants or removes the full plan with the operator command; the key stays in the child's inherited environment. */
export async function setPlan(email: string, plan: "full" | "free") {
  try {
    await execFileAsync(process.execPath, [ACCOUNT_PLAN_SCRIPT, email, plan], { env: process.env });
  } catch (error) {
    const stderr = error instanceof Error && "stderr" in error ? String(error.stderr).trim() : "";
    throw new Error(`account-plan ${plan} failed${stderr ? `: ${stderr}` : ""}`, { cause: error });
  }
}

/**
 * Whether tonight's Session plan can be edited (adjustable-session-plan, F10, F8): waits for the plan island's readiness
 * marker (`data-session-plan-state`, not `[data-offline-copy]` alone, which the failure states omit) and says whether it
 * reads `suggested` or `edited`, the two states the edits apply in. Only `held` (a list saved for a night that does not
 * pass, the one legitimate reason) is `false`, and a spec skips on it with
 * `test.skip(!(await planEditable(page)), "…")`. `locked`, `unavailable` or a missing marker fail the test: for a
 * full-plan user on the fixture's clear night they mean a regression (a broken plan or `session_plans` read), never a
 * reason to skip.
 */
export async function planEditable(page: Page): Promise<boolean> {
  const area = page.locator("[data-session-plan-state]");
  await expect(area, "the plan island must render its readiness marker").toBeAttached();
  const state = await area.getAttribute("data-session-plan-state");
  expect(
    state,
    "tonight's plan must be editable (suggested or edited) or held; locked or unavailable means the plan or the saved list could not be read",
  ).toMatch(/^(suggested|edited|held)$/);
  return state !== "held";
}

/**
 * Smoke's no-darkness window at its 52° N site (8 June to 2 July), where the ranking can be empty. Madrid keeps its
 * darkness all year, so this only errs on the safe side.
 */
export function inNoDarknessWindow(now = new Date()): boolean {
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  return (month === 6 && day >= 8) || (month === 7 && day <= 2);
}

/** The "Finder chart" link of `target`'s row on Targets: in the best five, or in the rest behind its button. */
export async function finderLink(page: Page, target: string): Promise<Locator> {
  const row = page.locator(`[data-object="${target}"]`);
  await expect(row, `${target} must be on tonight's Targets list`).toHaveCount(1);
  if ((await row.locator("xpath=ancestor::details[@id='more']").count()) > 0) {
    await page.locator("details#more > summary").click();
    await row.locator("summary").click();
  }
  return row.getByRole("link", { name: en.tonight.finder.linkLabel({ target }) });
}
