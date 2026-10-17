import { expect, type Locator, type Page } from "@playwright/test";

import { en } from "@/i18n/messages/en";
import { LOCALE_COOKIE } from "@/lib/preferences";

import { onboardInMadrid, test, waitForHydration } from "./helpers";

/*
 * Tonight's live sky, end to end (interactive-sky): what the screenshots can't show. The slider moves the bodies,
 * Home / End / Now reach their frames, and a marker opens its focused page with its row in view. Same setup as the
 * other Tonight specs: a production preview on local Supabase with the all-clear forecast fixture (so the ranking
 * exists) and place search stubbed with Madrid. The clock is pinned (`helpers.ts`, `clock-scenarios.mjs`): the default
 * is `evening`, and two tests pin civil dawn and the deep night. The spec never names a body: it steps the slider until
 * a marker of the wanted kind is up, and fails when none ever is.
 */

const t = en.tonight.sky;

// The sky content (a ranked object, a planet up) is the pinned evening's; the Now test sets its own fixed instants.
test.use({ clock: "evening" });

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

const MADRID = "Europe/Madrid";

/** Madrid's wall-clock minutes of the day at `instant` (epoch ms). */
function madridMinutes(instant: number): number {
  return minutes(
    new Intl.DateTimeFormat("en-GB", { timeZone: MADRID, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
      new Date(instant),
    ),
  );
}

/** The instant (epoch ms) of Madrid's wall-clock `minuteOfDay` on `date` (`YYYY-MM-DD`, plus `addDays`). */
function madridInstant(date: string, addDays: number, minuteOfDay: number): number {
  const [year, month, day] = date.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day + addDays, 0, minuteOfDay);
  const offsetAt = (instant: number) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: MADRID,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(instant))
        .map((part) => [part.type, part.value]),
    );
    const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return shown - Math.floor(instant / 1000) * 1000;
  };
  return wall - offsetAt(wall - offsetAt(wall));
}

/**
 * The slider's range as instants. The labels are wall-clock times only, so the night's own date
 * (`data-night-date`, the night the page shows) places them: sunset on that date, sunrise on the next day. Reading
 * the labels as times of the day alone would take the morning before the range for its end.
 */
async function rangeOf(page: Page) {
  const startMin = minutes((await page.locator("[data-sky-start]").textContent()) ?? "");
  const endMin = minutes((await page.locator("[data-sky-end]").textContent()) ?? "");
  const night = (await page.locator("[data-offline-copy]").first().getAttribute("data-night-date")) ?? "";
  expect(night).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  return {
    night,
    startMin,
    endMin,
    start: madridInstant(night, 0, startMin),
    end: madridInstant(night, endMin < startMin ? 1 : 0, endMin),
  };
}

/**
 * What Now must do at `now`: before the range it goes to the first frame, after it to the last, and inside it to the
 * frame within half a step (5 minutes, plus one for the clock turning between reading it and the click).
 */
async function expectNowFrame(page: Page, slider: Locator, range: Awaited<ReturnType<typeof rangeOf>>, now: number) {
  const time = page.locator("[data-sky-time]");
  const max = Number(await slider.getAttribute("max"));
  const shown = (await time.textContent()) ?? "";
  const value = await slider.inputValue();
  if (now <= range.start) {
    expect(value, "before the range, Now is the first frame").toBe("0");
    expect(shown).toBe((await page.locator("[data-sky-start]").textContent()) ?? "");
  } else if (now >= range.end) {
    expect(value, "after the range, Now is the last frame").toBe(String(max));
    expect(shown).toBe((await page.locator("[data-sky-end]").textContent()) ?? "");
  } else {
    const at = madridMinutes(now);
    const off = Math.min(forward(at, minutes(shown)), forward(minutes(shown), at));
    expect(off).toBeLessThanOrEqual(6);
  }
  await expect(slider).toHaveAttribute("aria-valuetext", shown);
}

test("the slider moves the bodies, and Home, End and Now reach their frames", async ({ page, pinnedNow }) => {
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

  // Now goes to the frame nearest the current time, clamped into the range (`expectNowFrame`). The clock is pinned
  // (`pinnedNow`, the instant the browser reads), so the case is the same at any real hour; the next test pins each one.
  await slider.press("End");
  const range = await rangeOf(page);
  const now = pinnedNow().getTime();
  await page.getByRole("button", { name: t.now }).click();
  await expectNowFrame(page, slider, range, now);
});

test("Now clamps into the night's range at any hour, dawn to sunrise included", async ({ page }) => {
  const { slider } = await openSky(page, "e2e-sky-now");
  const range = await rangeOf(page);
  // Sunset and sunrise (the labels) are on a 24-hour clock, so the morning before the range reads as inside it.
  expect(range.startMin).toBeGreaterThan(range.endMin);

  const pins = [
    // From civil dawn the page shows the evening ahead: the minutes just before sunrise, on the night's own date, are
    // hours before the range (CI failed here: Now was expected within 6 minutes of a time that is 11 hours away).
    { name: "the morning before the range", instant: madridInstant(range.night, 0, range.endMin - 10) },
    { name: "inside the range", instant: range.start + 90 * 60_000 },
    { name: "after the range", instant: range.end + 10 * 60_000 },
  ];
  for (const pin of pins) {
    await page.clock.setFixedTime(pin.instant);
    await page.getByRole("button", { name: t.now }).click();
    await expectNowFrame(page, slider, range, pin.instant);
  }
});

// The hours that broke #198 (`Now` expected within minutes of a time hours away, red on main only between civil dawn and
// sunrise) are in every run: the server AND the browser are pinned there (`clock-scenarios.mjs`), so the page shows what a
// visitor sees at that hour, not what the real clock allows. The night dates are the scenario test's
// (`tonightDateFor`): civil dawn rolls to the evening ahead, the deep night is still the night in progress.
test.describe("at civil dawn", () => {
  test.use({ clock: "civilDawn" });

  test("the page shows the evening ahead, and Now goes to the first frame", async ({ page, pinnedNow }) => {
    const { slider } = await openSky(page, "e2e-sky-dawn");
    const range = await rangeOf(page);
    expect(range.night, "the evening ahead, not the night that just ended").toBe("2026-10-18");
    const now = pinnedNow().getTime();
    expect(now, "the browser's clock is the morning before the range").toBeLessThan(range.start);
    await slider.press("End");
    await page.getByRole("button", { name: t.now }).click();
    await expectNowFrame(page, slider, range, now);
  });
});

test.describe("in the deep night", () => {
  test.use({ clock: "deepNight" });

  test("the page shows the night in progress, and Now lands inside its range", async ({ page, pinnedNow }) => {
    const { slider } = await openSky(page, "e2e-sky-deep");
    const range = await rangeOf(page);
    expect(range.night, "the night in progress, the evening before the pinned instant").toBe("2026-10-17");
    const now = pinnedNow().getTime();
    expect(now, "the clock is inside the night's range").toBeGreaterThan(range.start);
    expect(now, "the clock is inside the night's range").toBeLessThan(range.end);
    await slider.press("Home");
    await page.getByRole("button", { name: t.now }).click();
    await expectNowFrame(page, slider, range, now);
  });
});

test("an object marker opens Targets with its row in view", async ({ page }) => {
  const { slider, max } = await openSky(page, "e2e-sky-object");
  const marker = await findMarker(page, slider, max, "object");
  // Every night has ranked objects above the horizon in some frame; none is a regression, never a skip.
  if (marker === null) throw new Error("no ranked object is above the horizon in any frame of the pinned evening");
  expect(marker.href).toBe(`/tonight/targets#object-${marker.key}`);

  await page.locator(`[data-sky-body="object"][data-key="${marker.key}"] rect`).click();
  await expect(page).toHaveURL(new RegExp(`/tonight/targets#object-${marker.key}$`));
  await expect(page.locator(`li#object-${marker.key}`)).toBeInViewport();
});

test("a planet marker opens Planets", async ({ page }) => {
  const { slider, max } = await openSky(page, "e2e-sky-planet");
  const marker = await findMarker(page, slider, max, "planet");
  // Saturn is up on the pinned evening (the scenario test asserts a planet is); none is a regression, never a skip.
  if (marker === null) throw new Error("no planet is above the horizon in any frame of the pinned evening");

  await page.locator(`[data-sky-body="planet"][data-key="${marker.key}"] rect`).click();
  await expect(page).toHaveURL(/\/tonight\/planets(#planet-[a-z]+)?$/);
  // A planet listed on the page links to its row, which comes into view once the page's island renders.
  if (marker.href.includes("#")) {
    await expect(page.locator(`li#planet-${marker.key}`)).toBeInViewport();
  } else {
    await expect(page.getByRole("heading", { level: 1, name: en.tonight.summary.planets })).toBeVisible();
  }
});

// The only browser-level protection of the mouse drag (ui-sky-modes, Phase 3): a mouse user can pan the sky, and a drag
// that starts and ends over a marker never opens it. Plain marker clicks stay covered by the two tests above.
// It protects the outcome on Chromium, not each mechanism (impl review F3): once `setPointerCapture` runs on the
// strip, Chromium sends the click that ends the drag to the strip, not the marker's `<a>`, so removing the click
// swallow (`onClickCapture`) alone leaves this test green; it fails only if both the capture and the swallow go. The
// swallow is the defence for WebKit, which no test here exercises.
test("a mouse drag pans the panorama without opening a marker, and the arrow keys still pan it", async ({ page }) => {
  const { slider, max } = await openSky(page, "e2e-sky-drag");
  const marker = await findMarker(page, slider, max, "object");
  if (marker === null) throw new Error("no ranked object is above the horizon in any frame of the pinned evening");
  const strip = page.locator("[data-sky-strip]");
  const scrollLeft = () => strip.evaluate((element) => element.scrollLeft);
  const compassNow = () => page.locator("[data-sky-compass-current]").getAttribute("data-sky-compass-current");

  const hit = page.locator(`[data-sky-body="object"][data-key="${marker.key}"] rect`);
  // Hover first: Playwright scrolls the marker on screen and waits until it is the hit target, as a click does.
  await hit.hover();
  const box = await hit.boundingBox();
  const before = await scrollLeft();
  const compassBefore = await compassNow();
  if (box === null) throw new Error(`marker ${marker.key} has no box`);
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("no viewport");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  // Drag 200 px whichever way the strip has room to scroll and the pointer stays on the page: a drag to the left
  // scrolls the strip forward (scrollLeft grows), to the right back.
  const room = await strip.evaluate((element) => ({
    back: element.scrollLeft,
    forward: element.scrollWidth - element.clientWidth - element.scrollLeft,
  }));
  const dx = room.forward >= 200 && x - 200 > 0 ? -200 : room.back >= 200 && x + 200 < viewport.width ? 200 : 0;
  if (dx === 0) throw new Error(`no room to drag 200 px from marker ${marker.key} at x ${String(x)}`);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 10 });
  await page.mouse.move(x + dx, y, { steps: 10 });
  // The strip follows the mouse, so the marker moves with it: the press and the release are both over the marker.
  await page.mouse.up();

  await expect(strip).not.toHaveAttribute("data-sky-dragging");
  expect(Math.abs((await scrollLeft()) - (before - dx)), "the strip follows the mouse").toBeLessThanOrEqual(2);
  expect(await compassNow(), "the compass row's middle point moves with the view").not.toBe(compassBefore);

  // The arrow keys still pan the focused strip (native scrolling), and nothing navigated meanwhile.
  await strip.focus();
  const afterDrag = await scrollLeft();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(scrollLeft, { message: "ArrowLeft scrolls the strip" }).toBeLessThan(afterDrag);
  expect(new URL(page.url()).pathname, "a drag never opens a marker").toBe("/tonight");
});
