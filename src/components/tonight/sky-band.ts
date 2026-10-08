/**
 * What Tonight's static sky (`TonightSky.astro`) and the live one (the `TonightSkyView` island, interactive-sky)
 * share, so the two bands can't drift: the verdict's container and minimum height, the horizon silhouette, and the
 * fixed heights of the panorama strip and the slider row that the skeleton reserves.
 *
 * Island-safe: plain strings and numbers.
 */

/** The gear row under the sky (the two gear cards) and the gap before the tiles, shared with the skeleton. */
export const GEAR_ROW_GAP_CLASS = "pt-2 sm:pt-4";
export const TILES_GAP_CLASS = "pt-3 sm:pt-6";

/** The gear row's grid: the Site and Telescope cards side by side from `sm`, stacked below it. Shared with the skeleton. */
export const GEAR_ROW_GRID_CLASS = "grid gap-3 sm:grid-cols-2";

/**
 * Every gear card's minimum height, the skeleton's bars too, so the swap doesn't jump whichever variant arrives. The
 * tallest variant is the single-item card: the title line (`text-label`) 20, then the name (`text-body`, its own line,
 * as wide as the card allows) 24 + `gap-1` 4 + the 44 px Manage link under it (user, 2026-10-08).
 * - Below `sm`: p-3 24 + 20 + `mt-2` 8 + 72 = 124 px, `min-h-31`. Stacked on a phone, the Telescope card starts above
 *   the TabBar at 390×844 and its lower part needs a short scroll (`tonight-phone.spec.ts`).
 * - From `sm`: p-4 32 + 20 + `mt-3` 12 + 72 = 136 px, `min-h-34`.
 * The select card (title, then the 44 px select) is shorter and stretches to it. Polish "Manage telescopes" can wrap on
 * the narrowest cards (the link wraps). Measured 2026-10-08 at 390 and 640 px; re-measure after changing the card.
 */
export const GEAR_CARD_MIN_HEIGHT_CLASS = "min-h-31 sm:min-h-34";

/** The slot's container over the sky: the shared `max-w-3xl px-4` column. */
export const VERDICT_CONTAINER_CLASS = "relative mx-auto w-full max-w-3xl px-4 pt-3 pb-10 sm:pt-12 sm:pb-14";

/**
 * The go/clear verdict's height (padding included), so the skeleton paints the same sky and nothing jumps.
 * Measured 2026-10-08 (ui-user-adjustments, EN and PL go on the all-clear fixture); re-measure at 360 px and 640 px after any
 * change to the verdict's lines, sizes or copy, never compute it. The arithmetic, from the type roles and spacing:
 *  - 360 px: pt-3 12 + date (`text-label`) 20 + h2 `mt-2` 8 + headline (`text-display` line, 36 px at 360 px) 36 + reason
 *    `mt-1` 4 + the reason on two `text-body` lines (24 px each: 53 characters do not fit the 328 px column) 48 + pb-10 40
 *    = 168 px, `min-h-42`. The fresh forecast line is `max-sm:hidden`.
 *  - 640 px: pt-12 48 + 20 + 8 + headline (44 px) 44 + 4 + the reason on one line 24 + forecast line `mt-3` 12 + 20 + pb-14 56
 *    = 236 px, `min-h-59`.
 */
export const VERDICT_MIN_HEIGHT_CLASS = "min-h-42 sm:min-h-59";

/** The horizon silhouette in the ground colour, stretched to the band's width. */
export const SILHOUETTE_VIEWBOX = "0 0 390 40";
export const SILHOUETTE_PATH = "M0 40V22C40 14 72 28 112 21C152 14 182 3 232 12C282 21 324 8 390 17V40Z";
export const SILHOUETTE_CLASS = "relative block h-8 w-full fill-background sm:h-12";

/** The panorama strip: `h-52`, 208 px, which the projection draws into. */
export const STRIP_HEIGHT_CLASS = "h-52";
export const STRIP_HEIGHT_PX = 208;

/**
 * The live panorama's star field reaches this far up behind the verdict's empty lower area (`-mt-16`, 64 px: the
 * user's value, ui-user-adjustments), so no blank sky sits between the verdict and the strip and the forecast line
 * stays clear of the star field. The band's total height is unchanged: the skeleton's `h-52` still matches. Altitude
 * 0–90° spans the strip plus the overlap; the overlap holds stars only, never a label. The verdict above it takes no
 * pointer events, so a marker in the overlap stays tappable and a swipe there scrolls.
 */
export const STRIP_OVERLAP_CLASS = "-mt-16";
export const STRIP_OVERLAP_PX = 64;

/**
 * The slider row on the ground under the silhouette, at a fixed height so the skeleton can reserve it. On a phone it
 * is one row (time and zone, track, Now) plus the labels under the track: pt-2 8 + h-11 44 + mt-1 4 + the label line
 * 20 = 76 px. From `sm` it is today's two rows, 128 px. The labels are positioned under the track (see
 * `SLIDER_LABELS_CLASS`), so the row's height is its own and nothing the labels do can move the page.
 */
export const SLIDER_ROW_CLASS = "mx-auto h-19 w-full max-w-3xl px-4 pt-2 sm:h-32";

/**
 * The slider row's inner layout, shared by the island and the skeleton: one flex-wrap row whose children are placed
 * with `order`. Phone: time and zone, track (the rest of the row), then Now. From `sm`: time and Now on the first
 * line, the full-width track beneath. The skeleton also stands a bar in for the label line (`SLIDER_LEGEND_CLASS`).
 */
export const SLIDER_LAYOUT_CLASS = "flex flex-wrap items-center gap-x-3";
export const SLIDER_TIME_CLASS = "order-1 shrink-0";
export const SLIDER_TRACK_CLASS = "order-2 min-w-0 flex-1 sm:order-3 sm:mt-1 sm:w-full sm:flex-none";
export const SLIDER_NOW_CLASS = "order-3 shrink-0 sm:order-2 sm:ml-auto";
export const SLIDER_LEGEND_CLASS = "order-4 mt-1 w-full sm:mt-0";
/**
 * The edge labels' layer, inside the track's own box so its x positions are the track's (on a phone the track is only
 * the middle of the row): directly under the track, 20 px tall like the old legend line.
 */
export const SLIDER_LABELS_CLASS = "pointer-events-none absolute inset-x-0 top-full mt-1 h-5 sm:mt-0";
