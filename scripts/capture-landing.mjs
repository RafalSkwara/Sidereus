// Captures the landing page's Tonight screenshot (`public/landing/tonight.png`, shown by `src/components/Welcome.astro`).
// It was `tests/e2e/landing-screenshot.spec.ts` (an opt-in spec that CI never ran); test-suite-diet Phase 5 made it a
// script, so the e2e suite holds only tests. Same setup as `tests/e2e/onboarding.spec.ts`: a production preview on LOCAL
// Supabase with FORECAST_BASE_URL pointing at `tests/e2e/forecast-fixture.mjs`, and place search stubbed with Madrid
// (it signs up a throwaway user, so point it at the local stack only, never hosted).
//
//   BASE_URL=http://localhost:4321 npm run capture:landing
//
// Dark theme and English, 1280x1117: the verdict, the live sky, the slider and the first tile ("Point here first"),
// ending on that tile's rule (ui-landing). Tonight shows the site's name and time zone, never its coordinates.

/* global document -- the page.evaluate / waitForFunction callbacks run in the browser */
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const OUTPUT = fileURLToPath(new URL("../public/landing/tonight.png", import.meta.url));
const VIEWPORT = { width: 1280, height: 1117 };
const PASSWORD = "Capture-Passw0rd!";
const SIGNUP_FORM = 'form[action="/api/auth/signup"]';
const ONBOARDING_FORM = 'form[action="/api/onboarding"]';
// The catalogue strings the page renders (`src/i18n/messages/en.ts`): scripts do not import the TypeScript catalogue.
const RESULTS_LABEL = "Matching places";
const GO_HEADLINE = "Clear";
const MADRID_RESULT = {
  id: 3117735,
  name: "Madrid",
  latitude: 40.4168,
  longitude: -3.7038,
  admin1: "Madrid",
  country: "Spain",
};
const MADRID_LABEL = "Madrid, Madrid, Spain";

/** Waits until React has hydrated the element: it marks every element it has hydrated with `__reactProps$<key>`. */
async function waitForHydration(page, selector) {
  await page.waitForFunction((sel) => document.querySelector(`astro-island[ssr]:has(${sel})`) === null, selector);
  await page.waitForFunction((sel) => {
    const element = document.querySelector(sel);
    return element !== null && Object.keys(element).some((key) => key.startsWith("__reactProps$"));
  }, selector);
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: "dark", baseURL: BASE_URL });
  await context.addCookies([
    { name: "sidereus-lang", value: "en", url: BASE_URL },
    { name: "sidereus-theme", value: "dark", url: BASE_URL },
  ]);
  const page = await context.newPage();
  await page.route("https://geocoding-api.open-meteo.com/**", (route) =>
    route.fulfill({ json: { results: [MADRID_RESULT] }, headers: { "Access-Control-Allow-Origin": "*" } }),
  );

  // Sign up and onboard with the defaults, as onboarding.spec.ts test (a) does.
  await page.goto("/auth/signup");
  await waitForHydration(page, SIGNUP_FORM);
  const signup = page.locator(SIGNUP_FORM);
  await signup.locator("#email").fill(`capture-${randomUUID()}@example.com`);
  await signup.locator("#password").fill(PASSWORD);
  await signup.locator("#confirmPassword").fill(PASSWORD);
  await signup.locator('button[type="submit"]').click();
  await page.waitForURL(/\/onboarding$/);
  await waitForHydration(page, ONBOARDING_FORM);

  await page.locator("#place-search").fill("Madrid");
  await page.getByRole("list", { name: RESULTS_LABEL }).getByRole("button", { name: MADRID_LABEL }).click();
  await page.locator(`${ONBOARDING_FORM} button[type="submit"]`).click();

  await page.waitForURL(/\/tonight$/);
  const theme = await page.locator("html").getAttribute("data-theme");
  if (theme !== "dark") throw new Error(`expected the dark theme, the page has ${theme}`);
  // The fixture's all-clear sky: the "Clear" headline, by its catalogue key and its text.
  const headline = page.locator("#verdict-heading [data-sky-headline]");
  await headline.waitFor();
  if (
    (await headline.getAttribute("data-sky-headline")) !== "verdict.level.go" ||
    (await headline.textContent()) !== GO_HEADLINE
  ) {
    throw new Error(
      "the verdict is not the fixture's all-clear 'Clear'; is FORECAST_BASE_URL on the forecast fixture?",
    );
  }
  // The dashboard's tiles (tonight-dashboard): the screenshot is of /tonight, so wait for "Point here first".
  await page.locator('[data-tonight-tiles] a[href="/tonight/targets"] li').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  // The onboarding click leaves the pointer over the first tile, which would draw its hover state.
  await page.mouse.move(0, 0);

  await page.screenshot({ path: OUTPUT, clip: { x: 0, y: 0, ...VIEWPORT } });
  console.log(`captured ${OUTPUT}`);
} finally {
  await browser.close();
}
