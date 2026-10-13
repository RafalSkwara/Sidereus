import type { Messages } from "@/i18n";

/**
 * The Tonight page a finder chart was opened from (finder-chart Phase 4), carried as `?from=` on the chart's URL so
 * its back link returns there. A fixed set, so it travels as is; anything else means Tonight itself.
 */
export type FinderFrom = "targets" | "planets";

/** `?from=` as the fixed set, or `null` for anything else. */
export function parseFinderFrom(value: string | null | undefined): FinderFrom | null {
  return value === "targets" || value === "planets" ? value : null;
}

/** The page the back link opens: the page the chart was opened from, else Tonight. */
export function finderBackHref(from: FinderFrom | null): string {
  return from === null ? "/tonight" : `/tonight/${from}`;
}

/** What the back link says: the page's own title, or Tonight's label when it came from none. */
export function finderBackLabel(from: FinderFrom | null, m: Messages): string {
  if (from === "targets") {
    return m.tonight.pages.targets;
  }
  return from === "planets" ? m.tonight.summary.planets : m.nav.tonight;
}
