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
