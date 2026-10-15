// The app's four destinations, shared by the wide-screen pill (Topbar.astro) and the phone tab bar (TabBar.astro),
// so both list the same pages in the same order and agree on which one is current. `needsNetwork`: the page cannot be
// stored for offline use (S-06), so its entry is disabled while offline (`data-needs-network`). Progress lives under
// the log (`/log/progress`), so it is the one destination nested in another (ui-tonight-nav).

export const NAV_ITEMS = [
  { href: "/tonight", label: "tonight", icon: "tonight", needsNetwork: false },
  { href: "/log", label: "log", icon: "log", needsNetwork: true },
  { href: "/log/progress", label: "progress", icon: "progress", needsNetwork: true },
  { href: "/gear", label: "myGear", icon: "gear", needsNetwork: true },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

/** A destination covers itself and everything below it, matched on whole path segments (`/log` ≠ `/login`). */
export function isCurrentPage(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The one current destination for a path: the most specific (longest) `href` that covers it, so `/log/progress` is
 * Progress and not also Log. Both bars mark only this item, since two current items would duplicate the
 * `nav-current` / `tab-current` view-transition names and abort the transition. `null` off every destination.
 */
export function currentDestination(pathname: string): NavItem["href"] | null {
  let current: NavItem["href"] | null = null;
  for (const item of NAV_ITEMS) {
    if (isCurrentPage(pathname, item.href) && (current === null || item.href.length > current.length)) {
      current = item.href;
    }
  }
  return current;
}

/**
 * The bars' `aria-current` for one destination (impl-review F6, owner 2026-10-15): `"page"` on the current
 * destination, except Tonight below `/tonight` (the six focused pages and the finder), where it is `"true"`: the
 * section, not the page, since the sub-nav's chip already names the page. One `aria-current="page"` per page.
 * Other destinations keep `"page"` on their sub-pages (`/log/sky` marks Log). `undefined` on every other item.
 */
export function ariaCurrentFor(href: NavItem["href"], pathname: string): "page" | "true" | undefined {
  if (href !== currentDestination(pathname)) return undefined;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return href === "/tonight" && path !== href ? "true" : "page";
}

/**
 * The Tonight pages' sub-nav (ui-tonight-nav): the dashboard and its six focused pages in the dashboard's tile order,
 * each with its short label in `tonight.subnav`. The same set as the offline list (`TONIGHT_PAGES`, whose order is the
 * `/offline` list's), so a new Tonight page joins both (`navigation.test.ts`). The finder chart is not on it: it is a
 * leaf opened from a row, with its own back link.
 */
export const TONIGHT_NAV = [
  { href: "/tonight", label: "tonight" },
  { href: "/tonight/targets", label: "targets" },
  { href: "/tonight/events", label: "events" },
  { href: "/tonight/plan", label: "plan" },
  { href: "/tonight/moon", label: "moon" },
  { href: "/tonight/planets", label: "planets" },
  { href: "/tonight/nights", label: "nights" },
] as const;

export type TonightNavItem = (typeof TONIGHT_NAV)[number];

/** The sub-nav's current page: an exact path match (a trailing slash aside), `null` off the seven pages. */
export function currentTonightPage(pathname: string): TonightNavItem["href"] | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return TONIGHT_NAV.find((item) => item.href === path)?.href ?? null;
}
