/**
 * What Tonight's static sky (`TonightSky.astro`) and the live one (the `TonightSkyView` island, interactive-sky)
 * share, so the two bands can't drift: the verdict's container and minimum height, the horizon silhouette, and the
 * fixed heights of the panorama strip and the slider row that the skeleton reserves.
 *
 * Island-safe: plain strings and numbers.
 */

/** The slot's container over the sky: the shared `max-w-3xl px-4` column. */
export const VERDICT_CONTAINER_CLASS = "relative mx-auto w-full max-w-3xl px-4 pt-6 pb-10 sm:pt-12 sm:pb-14";

/** The go/clear verdict's content height, so the skeleton paints the same sky and nothing jumps. */
export const VERDICT_MIN_HEIGHT_CLASS = "min-h-109 sm:min-h-111";

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
 * still matches. Altitude 0–90° spans the strip plus the overlap; the overlap holds stars only, never a label.
 */
export const STRIP_OVERLAP_CLASS = "-mt-24";
export const STRIP_OVERLAP_PX = 96;

/** The slider row on the ground under the silhouette, at a fixed height so the skeleton can reserve it. */
export const SLIDER_ROW_CLASS = "mx-auto h-32 w-full max-w-3xl px-4 pt-2";
