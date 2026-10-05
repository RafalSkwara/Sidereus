import type { TonightSkyView } from "@/lib/sky-view/view";

/**
 * The interactive sky's frame times (interactive-sky): frame `i` is at `startMs + i × stepMs`, capped at `endMs`
 * (the last frame can be less than a step after the one before it). The times shown are the server's
 * (`TonightSkyView.timeLabels`), so the browser never formats one; these only find the frame for "Now".
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
