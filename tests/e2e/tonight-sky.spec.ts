import { expect, test, type Locator, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, waitForHydration } from "./helpers";

/*
 * Tonight's live sky, end to end (interactive-sky): what the screenshots can't show. The slider moves the bodies,
 * Home / End / Now reach their frames, and a marker opens its focused page with its row in view. Same setup as the
 * other Tonight specs: a production preview on local Supabase with the all-clear forecast fixture (so the ranking
 * exists) and place search stubbed with Madrid. The clock is real, so the spec never names a body: it steps the
 * slider until a marker of the wanted kind is up, and skips a step when none ever is.
 */

const t = en.tonight.sky;

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: LOCALE_COOKIE, value: "en", url: baseURL ?? "http://localhost:4321" }]);
});

/** Onboards a fresh user and waits for the hydrated live sky on Tonight; returns its slider. */
async function openSky(page: Page, emailPrefix: string) {
  await onboardInMadrid(page, emailPrefix);
  // Tonight's content is a server island fetched after the page loads, and the sky inside it is a React island.
  await expect(page.locator("[data-sky-band]")).toBeVisible();
  await waitForHydration(page, "[data-sky-strip]");
  const slider = page.getByRole("slider", { name: t.slider });
  await waitForHydration(page, 'input[type="range"]');
  return { slider, max: Number(await slider.getAttribute("max")) };
}

/** Moves the slider to `index` with the keyboard and waits for the panorama to draw that frame. */
async function stepTo(page: Page, slider: Locator, index: number, from: number) {
  await slider.press(index > from ? "ArrowRight" : "ArrowLeft");
  await expect(page.locator("svg[data-sky-frame]")).toHaveAttribute("data-sky-frame", String(index));
}

/** The markers of `kind` drawn now, with the dot's position. */
function markers(page: Page, kind?: string) {
  return page.locator(kind ? `[data-sky-body="${kind}"]` : "[data-sky-body]").evaluateAll((elements) =>
    elements.map((element) => {
      const dot = element.querySelector("circle");
      return {
        key: element.getAttribute("data-key") ?? "",
        href: element.getAttribute("href") ?? "",
        name: element.getAttribute("aria-label") ?? "",
        cx: dot?.getAttribute("cx") ?? "",
        cy: Number(dot?.getAttribute("cy") ?? "0"),
      };
    }),
  );
}

/**
 * Steps from the first frame until a marker of `kind` is up, and returns it; `null` when none is in any frame. A
 * marker in the overlap behind the verdict counts too: the verdict passes pointer events through to the panorama.
 */
async function findMarker(page: Page, slider: Locator, max: number, kind: string) {
  await slider.focus();
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
  for (let index = 0; index <= max; index++) {
    if (index > 0) await stepTo(page, slider, index, index - 1);
    const found = (await markers(page, kind)).at(0);
    if (found) return found;
  }
  return null;
}

/** Minutes since midnight of `HH:mm`. */
function minutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

/** Minutes from `a` forward to `b` on a 24-hour clock. */
function forward(a: number, b: number): number {
  return (((b - a) % 1440) + 1440) % 1440;
}

test("the slider moves the bodies, and Home, End and Now reach their frames", async ({ page }) => {
  const { slider, max } = await openSky(page, "e2e-sky-slider");
  expect(max).toBeGreaterThan(1);
  const time = page.locator("[data-sky-time]");
  const startLabel = (await page.locator("[data-sky-start]").textContent()) ?? "";
  const endLabel = (await page.locator("[data-sky-end]").textContent()) ?? "";

  // Home and End reach the range's start and end, and the slider's spoken time follows.
  await slider.focus();
  await slider.press("End");
  await expect(slider).toHaveValue(String(max));
  await expect(time).toHaveText(endLabel);
  await expect(slider).toHaveAttribute("aria-valuetext", endLabel);
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
  await expect(time).toHaveText(startLabel);
  await expect(slider).toHaveAttribute("aria-valuetext", startLabel);

  // Step until a marker is up in two neighbouring frames: the step moves it and renames it for the new time.
  let moved = false;
  let before = await markers(page);
  for (let index = 1; index <= max && !moved; index++) {
    await stepTo(page, slider, index, index - 1);
    const after = await markers(page);
    for (const marker of before) {
      const next = after.find((candidate) => candidate.key === marker.key);
      if (!next) continue;
      expect(next.name).not.toBe(marker.name);
      expect(`${next.cx},${String(next.cy)}`).not.toBe(`${marker.cx},${String(marker.cy)}`);
      moved = true;
      break;
    }
    before = after;
  }
  expect(moved, "no body was up in two neighbouring frames").toBe(true);

  // Now goes to the frame nearest the current time, clamped into the range: inside it, a frame within half a step
  // (5 minutes, plus one for the clock turning between reading it and the click); outside it, an end of the range.
  await slider.press("End");
  const now = minutes(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  await page.getByRole("button", { name: t.now }).click();
  const shown = (await time.textContent()) ?? "";
  const start = minutes(startLabel);
  if (forward(start, now) <= forward(start, minutes(endLabel))) {
    const off = Math.min(forward(now, minutes(shown)), forward(minutes(shown), now));
    expect(off).toBeLessThanOrEqual(6);
  } else {
    const value = await slider.inputValue();
    expect(value === "0" || value === String(max)).toBe(true);
    expect(shown).toBe(value === "0" ? startLabel : endLabel);
  }
  await expect(slider).toHaveAttribute("aria-valuetext", shown);
});

test("an object marker opens Targets with its row in view", async ({ page }) => {
  const { slider, max } = await openSky(page, "e2e-sky-object");
  const marker = await findMarker(page, slider, max, "object");
  test.skip(marker === null, "no ranked object is above the horizon in any frame tonight");
  if (!marker) return;
  expect(marker.href).toBe(`/tonight/targets#object-${marker.key}`);

  await page.locator(`[data-sky-body="object"][data-key="${marker.key}"] rect`).click();
  await expect(page).toHaveURL(new RegExp(`/tonight/targets#object-${marker.key}$`));
  await expect(page.locator(`li#object-${marker.key}`)).toBeInViewport();
});

test("a planet marker opens Planets", async ({ page }) => {
  const { slider, max } = await openSky(page, "e2e-sky-planet");
  const marker = await findMarker(page, slider, max, "planet");
  test.skip(marker === null, "no planet is above the horizon in any frame tonight");
  if (!marker) return;

  await page.locator(`[data-sky-body="planet"][data-key="${marker.key}"] rect`).click();
  await expect(page).toHaveURL(/\/tonight\/planets(#planet-[a-z]+)?$/);
  // A planet listed on the page links to its row, which comes into view once the page's island renders.
  if (marker.href.includes("#")) {
    await expect(page.locator(`li#planet-${marker.key}`)).toBeInViewport();
  } else {
    await expect(page.getByRole("heading", { level: 1, name: en.tonight.summary.planets })).toBeVisible();
  }
});
