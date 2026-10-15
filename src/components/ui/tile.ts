import { cn } from "@/lib/utils";

/*
 * The class strings behind `Tile.astro`, kept in a plain module so the dashboard's skeleton (`TonightSkeleton.astro`)
 * and the /design specimens draw the same row from the same source. Island-safe: only `cn`.
 *
 * The tile rhythm (ui-dashboard-tiles D1): a tile is one Tonight list row on the `item` role (`py-item`, 40 px between
 * two tiles' contents, at every width); the heading and the content under it are one group (`TILE_CONTENT_CLASS`,
 * `line`); an explanatory caption under the content (the targets' legend and caption, the nights caption) is a second
 * group (`mt-group`). Tile headings carry no icon.
 */

/** A tile's row: full width, at least 44 px, ruled below, on the `item` role like every Tonight list row. */
export const TILE_ROW_CLASS = "min-h-11 border-b border-border px-4 py-item";

/** The gap from a tile's heading to its content (the `line` role), for the tiles, the skeleton and /design alike. */
export const TILE_CONTENT_CLASS = "mt-line";

/** The tile link: the row plus the token hover and the ring focus. Rules run between the tiles. */
export const TILE_CLASS = cn(
  "block text-heading transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
  TILE_ROW_CLASS,
);

/** The muted heading row of a tile; the arrow sits at its end. */
export const TILE_HEADING_CLASS =
  "flex items-center justify-between gap-3 text-label font-semibold text-muted-foreground";

/**
 * The tile's cue: a bare muted arrow (ui-quiet-actions), no border and no fill: the whole row is the link, so the arrow
 * only points. 24 px with a -2 px margin top and bottom, so it never makes the heading row taller than one line.
 */
export const TILE_CUE_CLASS = "-my-0.5 inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground";
