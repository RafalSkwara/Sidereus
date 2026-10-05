import type { Locale } from "@/lib/preferences";
import type { TonightSkyView } from "@/lib/sky-view/view";

/**
 * The interactive sky's frame times (interactive-sky): frame `i` is at `startMs + i × stepMs`, capped at `endMs`
 * (the last frame can be less than a step after the one before it).
 *
 * Pure and island-safe.
 */

export type FrameTiming = Pick<TonightSkyView, "startMs" | "stepMs" | "endMs" | "frameCount">;

/** Frame `i`'s instant, epoch ms. */
export function frameTime(view: FrameTiming, i: number): number {
  return Math.min(view.startMs + i * view.stepMs, view.endMs);
}

/** The frame nearest `nowMs`, clamped into the range; the earlier one on a tie. */
export function nearestFrame(view: FrameTiming, nowMs: number): number {
  const last = Math.max(0, view.frameCount - 1);
  const guess = Math.min(last, Math.max(0, Math.round((nowMs - view.startMs) / view.stepMs)));
  let best = guess;
  for (const i of [guess - 1, guess + 1]) {
    if (i < 0 || i > last) continue;
    const distance = Math.abs(frameTime(view, i) - nowMs);
    const bestDistance = Math.abs(frameTime(view, best) - nowMs);
    if (distance < bestDistance || (distance === bestDistance && i < best)) {
      best = i;
    }
  }
  return best;
}

const LOCALE_TAGS: Record<Locale, string> = { en: "en-GB", pl: "pl-PL" };

/** `HH:mm` in `timeZone`, 24-hour, as Tonight's formatter writes times. */
export function timeFormatter(locale: Locale, timeZone: string): (ms: number) => string {
  const format = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return (ms) => format.format(new Date(ms));
}
