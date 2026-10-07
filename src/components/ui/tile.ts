import { cn } from "@/lib/utils";

/*
 * The class strings behind `Tile.astro`, kept in a plain module so the dashboard's skeleton (`TonightSkeleton.astro`)
 * and the /design specimens draw the same row from the same source. Island-safe: only `cn`.
 */

/** A tile's row: full width, at least 44 px, ruled below, the phone padding one step tighter than `sm`. */
export const TILE_ROW_CLASS = "min-h-11 border-b border-border px-4 py-3 sm:py-4";

/** The tile link: the row plus the token hover and the ring focus. Rules run between the tiles. */
export const TILE_CLASS = cn(
  "block text-heading transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
  TILE_ROW_CLASS,
);

/** The muted heading row of a tile; the arrow sits at its end. */
export const TILE_HEADING_CLASS =
  "flex items-center justify-between gap-3 text-label font-semibold text-muted-foreground";
