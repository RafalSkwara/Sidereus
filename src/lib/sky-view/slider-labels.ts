/**
 * Where the slider's edge labels go (ui-user-adjustments): up to four times under the track, sunset and sunrise at its
 * ends and the dark window's start and end under the edges of the dark stretch. The island measures the labels'
 * widths and the track's width in the browser; this decides which of them fit, from the server's fractions. The texts
 * are always the server's.
 *
 * One collision rule: a label that would overlap its neighbour is dropped, sunset and sunrise first. When the dark
 * window's start and end collide with each other they merge into one label ("21:40–05:10") centred under the span.
 *
 * Island-safe: pure numbers, no imports.
 */

export type SliderLabelId = "sunset" | "darkStart" | "darkEnd" | "darkMerged" | "sunrise";

/** The shown labels and the left edge of each, in px from the track's left edge; a label that is absent is hidden. */
export type SliderLabelPlacement = Partial<Record<SliderLabelId, number>>;

export interface SliderLabelInput {
  /** The track's box width, px. */
  trackWidth: number;
  /** The range thumb's width, px: the fraction 0 and 1 sit under the thumb's centre, half of it inside each end. */
  thumbPx: number;
  /** The least gap between two labels, px. */
  gapPx: number;
  /** Each label's measured width, px. */
  widths: Record<SliderLabelId, number>;
  /** The dark stretch as fractions of the axis; `null` without a dark window (then only sunset and sunrise show). */
  dark: { from: number; to: number } | null;
}

interface Box {
  left: number;
  right: number;
}

/** Where `fraction` of the axis falls under the thumb's centre. */
export function fractionToX(fraction: number, trackWidth: number, thumbPx: number): number {
  return thumbPx / 2 + (trackWidth - thumbPx) * fraction;
}

export function placeSliderLabels(input: SliderLabelInput): SliderLabelPlacement {
  const { trackWidth, thumbPx, gapPx, widths, dark } = input;
  if (!(trackWidth > 0)) return {};

  const boxAt = (left: number, id: SliderLabelId): Box => ({ left, right: left + widths[id] });
  const centredAt = (x: number, id: SliderLabelId): number =>
    Math.round(Math.min(Math.max(x - widths[id] / 2, 0), Math.max(trackWidth - widths[id], 0)));
  const collide = (a: Box, b: Box) => a.left < b.right + gapPx && b.left < a.right + gapPx;

  const placement: SliderLabelPlacement = {};
  const taken: Box[] = [];
  const claim = (id: SliderLabelId, left: number) => {
    placement[id] = left;
    taken.push(boxAt(left, id));
  };

  // The dark window's labels come first: they are the ones that must stay.
  if (dark) {
    const startLeft = centredAt(fractionToX(dark.from, trackWidth, thumbPx), "darkStart");
    const endLeft = centredAt(fractionToX(dark.to, trackWidth, thumbPx), "darkEnd");
    if (collide(boxAt(startLeft, "darkStart"), boxAt(endLeft, "darkEnd"))) {
      claim("darkMerged", centredAt(fractionToX((dark.from + dark.to) / 2, trackWidth, thumbPx), "darkMerged"));
    } else {
      claim("darkStart", startLeft);
      claim("darkEnd", endLeft);
    }
  }

  // Sunset and sunrise sit at the track's ends, and give way to anything that collides with them.
  const sunset = boxAt(0, "sunset");
  if (!taken.some((box) => collide(box, sunset))) claim("sunset", 0);
  const sunriseLeft = Math.round(Math.max(trackWidth - widths.sunrise, 0));
  const sunrise = boxAt(sunriseLeft, "sunrise");
  if (!taken.some((box) => collide(box, sunrise))) claim("sunrise", sunriseLeft);

  return placement;
}

/** Whether two placements show the same labels at the same places (so the island keeps its state on a no-op). */
export function samePlacement(a: SliderLabelPlacement | null, b: SliderLabelPlacement): boolean {
  if (a === null) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<SliderLabelId>;
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
