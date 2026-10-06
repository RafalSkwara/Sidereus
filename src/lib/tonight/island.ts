// The wiring every Tonight server island repeats around `loadTonight` (tonight-dashboard): the signed-out guard, the
// Worker's KV forecast cache, the forecast base URL and `waitUntil`, so each island loads in one call. Server-only:
// it reaches `cloudflare:workers` through `kv-cache.ts` and `astro:env/server`, so no test or browser island imports it.
import { FORECAST_BASE_URL } from "astro:env/server";

import { kvForecastCache } from "@/lib/forecast/kv-cache";
import { loadTonight, type TonightLoad } from "@/lib/tonight/load";

export interface TonightIslandLoad {
  /** The site and telescope picked on the page shell (`?site=` / `?telescope=` or the remembered cookies). */
  siteId?: string;
  telescopeId?: string;
  /** How many cleared objects get full entries; see `buildTonight`. */
  limit?: number;
  /** Also read the open sky checks; only the page that asks the sky question sets it. */
  withSkyChecks?: boolean;
  /** Also build the interactive sky; only the dashboard sets it. */
  withSkyView?: boolean;
  /** Also build the Session plan; the dashboard and the plan page set it. */
  withSessionPlan?: boolean;
  /** `"next"` renders the evening after tonight, from the same forecast, and never reads sky checks. */
  night?: "tonight" | "next";
}

/** Runs work after the response is sent (the Worker's `waitUntil`): the forecast's KV write, the sky check's record. */
export function islandDefer(locals: App.Locals): (task: Promise<void>) => void {
  return (task) => {
    locals.cfContext.waitUntil(task);
  };
}

/**
 * Loads Tonight for an island's request. The island route (/_server-islands/...) sits outside PROTECTED_ROUTES, so
 * it guards itself: signed out (or with no database configured) it loads nothing and returns `null`, and the island
 * renders nothing.
 */
export async function loadTonightFor(locals: App.Locals, options: TonightIslandLoad): Promise<TonightLoad | null> {
  const supabase = locals.user ? locals.supabase : null;
  if (!supabase) {
    return null;
  }
  return loadTonight({
    supabase,
    locale: locals.locale,
    siteId: options.siteId,
    telescopeId: options.telescopeId,
    now: new Date(),
    cache: kvForecastCache(),
    forecastBaseUrl: FORECAST_BASE_URL,
    defer: islandDefer(locals),
    limit: options.limit,
    // The next-night copy is a background fetch for offline use: it must not read the open sky checks.
    withSkyChecks: options.night === "next" ? false : options.withSkyChecks,
    withSkyView: options.withSkyView,
    withSessionPlan: options.withSessionPlan,
    night: options.night,
  });
}
