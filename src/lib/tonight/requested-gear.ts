// FR-012 / FR-019: a site or telescope picked in a selector (`?site=<id>`, `?telescope=<id>`) is remembered on this
// device, so a plain /tonight (the post-log redirect included) and /tonight/all keep it. Only the shape is checked
// here; the island resolves each id against the user's own sites and telescopes and falls back to the oldest. Set in
// the page shell, not the island: the island's request carries no page query, so the ids reach it as props. Only ids
// travel (island props are serialised into its URL), never a site's coordinates.

import type { AstroCookies } from "astro";
import { PREFERENCE_COOKIE_MAX_AGE } from "@/lib/preferences";
import { isGearId, SITE_COOKIE, TELESCOPE_COOKIE } from "@/lib/tonight/gear-choice";

function requested(url: URL, cookies: AstroCookies, param: string, cookie: string): string | undefined {
  const value = url.searchParams.get(param);
  if (isGearId(value)) {
    cookies.set(cookie, value, {
      path: "/",
      maxAge: PREFERENCE_COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
      secure: url.protocol === "https:",
    });
    return value;
  }
  const remembered = cookies.get(cookie)?.value;
  return isGearId(remembered) ? remembered : undefined;
}

/** The site and telescope ids the page asks for: the query first (and remembered), else the remembered cookies. */
export function requestedGear(url: URL, cookies: AstroCookies): { siteId?: string; telescopeId?: string } {
  return {
    siteId: requested(url, cookies, "site", SITE_COOKIE),
    telescopeId: requested(url, cookies, "telescope", TELESCOPE_COOKIE),
  };
}
