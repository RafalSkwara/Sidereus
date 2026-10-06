/**
 * The dashboard's interactive sky data (interactive-sky): the shape `buildTonight` sends to the `TonightSkyView`
 * island. It lives here, not in `@/lib/tonight/build`, so the island and the pure sky-view maths can name it without
 * importing the server build; `build.ts` re-exports it.
 *
 * Island-safe: types only.
 */

/** One body on the interactive sky: its track on the sky view's frames. */
export interface TonightSkyBody {
  kind: "object" | "planet" | "moon";
  /** The catalogue id ("M31"), the planet key ("jupiter") or "moon". */
  key: string;
  /** The short visible label on the strip: the object's label ("M13", "NGC 7000"), or the planet's or the Moon's name. */
  label: string;
  /** The full localised name for the marker's accessible name ("M13 · Hercules Cluster"); the label otherwise. */
  name: string;
  /** The focused page (and row) the marker opens. */
  href: string;
  /** `frameCount × 2` integers: altitude then azimuth of each frame, in tenths of a degree (refracted). */
  track: number[];
}

/**
 * Columnar to stay small: sunset to sunrise (the observing night without either) every `DEFAULT_TRACK_STEP_MINUTES`.
 * Frame `i` is at `startMs + i × stepMs`, capped at `endMs`, and indexes `rotations`, `sunAltDeg` and every body's
 * track alike. The rotations let a reader recover the site's coordinates; they are rounded to 4 decimals (about
 * 600 m), and the view never goes into a URL or a log.
 */
export interface TonightSkyView {
  startMs: number;
  stepMs: number;
  endMs: number;
  frameCount: number;
  /** `frameCount × 9`: each frame's J2000→horizon rotation, `SkyFrame.rotation`'s layout, 4 decimals. */
  rotations: number[];
  /** The Sun's altitude per frame, degrees, 1 decimal. */
  sunAltDeg: number[];
  /** The frames inside the dark window, as indices; `null` without a dark window. */
  darkSpan: { from: number; to: number } | null;
  /** The frame nearest `now` when it is inside the range, else the dark span's start, else 0. */
  initialIndex: number;
  /** The panorama's centre: south, or north for a southern-hemisphere site. */
  facing: "south" | "north";
  /**
   * Each frame's time, `HH:mm` in the site's time zone, formatted on the server (`createFormatter`) as the Moon
   * slider's are, so the browser never formats one and hydration can't disagree with it.
   */
  timeLabels: string[];
  /** The range's ends, `HH:mm` in the site's time zone. */
  startLabel: string;
  endLabel: string;
  bodies: TonightSkyBody[];
}
