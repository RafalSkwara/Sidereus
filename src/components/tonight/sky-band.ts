/**
 * What Tonight's static sky (`TonightSky.astro`) and the live one (the `TonightSkyView` island, interactive-sky)
 * share, so the two bands can't drift: the verdict's container and minimum height, the horizon silhouette, and the
 * fixed heights of the panorama strip and the slider row that the skeleton reserves.
 *
 * Island-safe: plain strings and numbers.
 */

/** The gear row under the sky (link and selectors) and the gap before the tiles, shared with the skeleton. */
export const GEAR_ROW_GAP_CLASS = "pt-2 sm:pt-4";
export const TILES_GAP_CLASS = "pt-3 sm:pt-6";

/** The slot's container over the sky: the shared `max-w-3xl px-4` column. */
export const VERDICT_CONTAINER_CLASS = "relative mx-auto w-full max-w-3xl px-4 pt-3 pb-10 sm:pt-12 sm:pb-14";

/**
 * The go/clear verdict's height (padding included), so the skeleton paints the same sky and nothing jumps. Measured
 * (ui-mobile-pass, 2026-10-07, EN go on the all-clear fixture): 244 px at 360 px and 388 px at 640 px. Re-measure at
 * those two widths after any change to the verdict's lines, sizes or copy; never compute it.
 */
export const VERDICT_MIN_HEIGHT_CLASS = "min-h-61 sm:min-h-97";

/** The horizon silhouette in the ground colour, stretched to the band's width. */
export const SILHOUETTE_VIEWBOX = "0 0 390 40";
export const SILHOUETTE_PATH = "M0 40V22C40 14 72 28 112 21C152 14 182 3 232 12C282 21 324 8 390 17V40Z";
export const SILHOUETTE_CLASS = "relative block h-8 w-full fill-background sm:h-12";

/** The panorama strip: `h-52`, 208 px, which the projection draws into. */
export const STRIP_HEIGHT_CLASS = "h-52";
export const STRIP_HEIGHT_PX = 208;

/**
 * The live panorama's star field reaches this far up behind the verdict's empty lower area (`-mt-24`, 96 px), so no
 * blank sky sits between the verdict and the strip. The band's total height is unchanged: the skeleton's `h-52`
 * still matches. Altitude 0–90° spans the strip plus the overlap; the overlap holds stars only, never a label. The
 * verdict above it takes no pointer events, so a marker in the overlap stays tappable and a swipe there scrolls.
 */
export const STRIP_OVERLAP_CLASS = "-mt-24";
export const STRIP_OVERLAP_PX = 96;

/**
 * The slider row on the ground under the silhouette, at a fixed height so the skeleton can reserve it. On a phone it
 * is one row (time, track, Now) plus the legend: pt-2 8 + h-11 44 + mt-1 4 + the legend line 20 = 76 px. From `sm`
 * it is today's two rows, 128 px.
 */
export const SLIDER_ROW_CLASS = "mx-auto h-19 w-full max-w-3xl px-4 pt-2 sm:h-32";

/**
 * The slider row's inner layout, shared by the island and the skeleton: one flex-wrap row whose children are placed
 * with `order`. Phone: time, track (the rest of the row), Now, then the legend on a line of its own. From `sm`: time
 * and Now on the first line, the full-width track beneath, then the legend.
 */
export const SLIDER_LAYOUT_CLASS = "flex flex-wrap items-center gap-x-3";
export const SLIDER_TIME_CLASS = "order-1 shrink-0";
export const SLIDER_TRACK_CLASS = "order-2 min-w-0 flex-1 sm:order-3 sm:mt-1 sm:w-full sm:flex-none";
export const SLIDER_NOW_CLASS = "order-3 shrink-0 sm:order-2 sm:ml-auto";
export const SLIDER_LEGEND_CLASS = "order-4 mt-1 w-full sm:mt-0";
