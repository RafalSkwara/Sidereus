import type { APIRoute } from "astro";

import { targetsRedirectPath } from "@/lib/tonight/all-objects";

/*
 * Retired (tonight-dashboard): every cleared object now lives on /tonight/targets. Old links and bookmarks are sent
 * there for good, keeping a valid `?sort=`; a `#washed-out` fragment survives the redirect on its own (the browser
 * re-applies it), and the targets page scrolls to it once its island arrives. Still gated (`/tonight` in
 * PROTECTED_ROUTES), so a signed-out visitor signs in first.
 */
export const GET: APIRoute = ({ url, redirect }) => redirect(targetsRedirectPath(url.searchParams), 301);
