// The app's three destinations, shared by the wide-screen pill (Topbar.astro) and the phone tab bar
// (TabBar.astro), so both list the same pages in the same order and agree on which one is current. `needsNetwork`:
// the page cannot be stored for offline use (S-06), so its entry is disabled while offline (`data-needs-network`).

export const NAV_ITEMS = [
  { href: "/tonight", label: "tonight", icon: "tonight", needsNetwork: false },
  { href: "/log", label: "log", icon: "log", needsNetwork: true },
  { href: "/gear", label: "myGear", icon: "gear", needsNetwork: true },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

/** A destination covers itself and everything below it, matched on whole path segments (`/log` ≠ `/login`). */
export function isCurrentPage(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
