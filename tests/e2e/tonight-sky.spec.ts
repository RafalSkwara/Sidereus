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

/**
 * The markers of `kind` drawn now, with the dot's position. `covered` marks one whose hit area's centre lies under a
 * marker drawn later (on top), as when two planets sit close together low in the sky: a click there opens the other.
 */
function markers(page: Page, kind?: string) {
  return page.locator(kind ? `[data-sky-body="${kind}"]` : "[data-sky-body]").evaluateAll((elements) => {
    const all = [...document.querySelectorAll("[data-sky-body]")];
    return elements.map((element) => {
      const dot = element.querySelector("circle");
      const box = element.querySelector("rect")?.getBoundingClientRect();
      const x = box ? box.x + box.width / 2 : 0;
      const y = box ? box.y + box.height / 2 : 0;
      const covered = all.slice(all.indexOf(element) + 1).some((other) => {
        const o = other.querySelector("rect")?.getBoundingClientRect();
        return o !== undefined && x >= o.left && x <= o.right && y >= o.top && y <= o.bottom;
      });
      return {
        key: element.getAttribute("data-key") ?? "",
        href: element.getAttribute("href") ?? "",
        name: element.getAttribute("aria-label") ?? "",
        cx: dot?.getAttribute("cx") ?? "",
        cy: Number(dot?.getAttribute("cy") ?? "0"),
        covered,
      };
    });
  });
}

/**
 * Steps from the first frame until an uncovered marker of `kind` is up, and returns it; `null` when none is in any frame. A
 * marker in the overlap behind the verdict counts too: the verdict passes pointer events through to the panorama.
 */
async function findMarker(page: Page, slider: Locator, max: number, kind: string) {
  await slider.focus();
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
  for (let index = 0; index <= max; index++) {
    if (index > 0) await stepTo(page, slider, index, index - 1);
    const found = (await markers(page, kind)).find((marker) => !marker.covered);
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

test("the edge chevrons pan the panorama and hide at its ends", async ({ page }) => {
  // Reduced motion pans at once, so the next step never races a smooth scroll still under way.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openSky(page, "e2e-sky-pan");
  const strip = page.locator("[data-sky-strip]");
  const left = page.getByRole("button", { name: t.panLeft });
  const right = page.getByRole("button", { name: t.panRight });
  const scrollLeft = () => strip.evaluate((element) => element.scrollLeft);

  // Centred at load, so both ways are open.
  await expect(left).toBeVisible();
  await expect(right).toBeVisible();
  const start = await scrollLeft();
  await right.click();
  await expect.poll(scrollLeft).toBeGreaterThan(start);

  // At the left end the left chevron hides and the right one stays.
  await strip.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await expect(left).toBeHidden();
  await expect(right).toBeVisible();

  // Reaching the right end with the right chevron focused hands the focus to the left one, not to the page.
  await right.focus();
  await strip.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(right).toBeHidden();
  await expect(left).toBeFocused();
});

test("the slider marks the dark window at its exact edges, and the zone sits beside the current time", async ({
  page,
}) => {
  // A wide track, so no edge label gives way to its neighbour.
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSky(page, "e2e-sky-dark");
  const span = page.locator("[data-dark-span]");
  const darkStart = page.locator("[data-sky-dark-start]");
  const darkEnd = page.locator("[data-sky-dark-end]");
  await expect(span).toBeVisible();
  await expect(darkStart).toBeVisible();
  await expect(darkEnd).toBeVisible();
  const start = (await darkStart.textContent()) ?? "";
  const end = (await darkEnd.textContent()) ?? "";
  expect(start).toMatch(/^\d{2}:\d{2}$/);
  expect(end).toMatch(/^\d{2}:\d{2}$/);

  // Each time is centred under its edge of the dark stretch.
  const spanBox = await span.boundingBox();
  const startBox = await darkStart.boundingBox();
  const endBox = await darkEnd.boundingBox();
  if (!spanBox || !startBox || !endBox) throw new Error("a box to measure is missing (dark span or its labels)");
  expect(Math.abs(startBox.x + startBox.width / 2 - spanBox.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(endBox.x + endBox.width / 2 - (spanBox.x + spanBox.width))).toBeLessThanOrEqual(2);

  // The zone is muted text right after the current time, outside the element that holds the time.
  const zone = page.locator("[data-sky-zone]");
  await expect(zone).toBeVisible();
  await expect(zone).toHaveText(/^(CEST|CET)$/);
  await expect(page.locator("[data-sky-time] [data-sky-zone]")).toHaveCount(0);
  const timeBox = await page.locator("[data-sky-time]").boundingBox();
  const zoneBox = await zone.boundingBox();
  if (!timeBox || !zoneBox) throw new Error("a box to measure is missing (time or zone)");
  expect(zoneBox.x).toBeGreaterThanOrEqual(timeBox.x + timeBox.width);
  expect(zoneBox.x - (timeBox.x + timeBox.width)).toBeLessThanOrEqual(12);

  // The times are the server's: the Session plan's dark line shows the very same window.
  await page.goto("/tonight/plan");
  const planText = page.locator("[data-session-plan-text]");
  await expect(planText).toBeVisible();
  await expect(planText).toContainText(`Dark ${start}–${end}`);
});

test("the compass row marks the point nearest the middle of the view, and follows the strip", async ({ page }) => {
  await openSky(page, "e2e-sky-compass");
  const strip = page.locator("[data-sky-strip]");
  const current = page.locator("[data-sky-compass-current]");
  const bar = page.locator("[data-sky-compass] rect");

  // Centred on the south at load: one point is marked, with its bar under the label.
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("data-sky-compass-current", "S");
  await expect(bar).toHaveCount(1);

  // Scrolled to the left end, the middle of the view looks east: another point is marked.
  await strip.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await expect(current).toHaveCount(1);
  await expect.poll(() => current.getAttribute("data-sky-compass-current")).not.toBe("S");
  const east = await current.getAttribute("data-sky-compass-current");

  // And scrolled to the right end, a third: the marker follows the strip both ways.
  await strip.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect.poll(() => current.getAttribute("data-sky-compass-current")).not.toBe(east);
  await expect(current).toHaveCount(1);
  await expect(bar).toHaveCount(1);
});

test("the panorama shows no scrollbar, and its chevrons are bare icons", async ({ page }) => {
  await openSky(page, "e2e-sky-bare");
  const strip = page.locator("[data-sky-strip]");
  await expect(strip).toHaveCSS("scrollbar-width", "none");
  // No scrollbar thickness is left under the strip: its outer and inner heights agree.
  const thickness = await strip.evaluate(
    (element) => Math.round(element.getBoundingClientRect().height) - element.clientHeight,
  );
  expect(thickness).toBe(0);

  const face = page.locator('[data-sky-pan="right"] > span');
  await expect(face).toBeVisible();
  await expect(face).toHaveCSS("border-top-width", "0px");
  await expect(face).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});
