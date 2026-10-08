import { observingNightDateFor } from "@/lib/engine";
import type { SiteRecord } from "@/lib/gear/store";
import { latestNightBound } from "./store";

/**
 * The two nights the log's manual form needs (`/log/new`): the default night and the date picker's maximum.
 *
 * The latest night matches what Tonight shows (the evening ahead once civil dawn has passed), so its "Mark observed"
 * prefill is always accepted; ISO dates compare correctly as strings. Without a prefill the form defaults to the
 * night in progress or just ended (noon to noon, `observingNightDateFor`), the one most likely being logged. The
 * maximum is only a hint: it is the latest night over all the user's sites, and the store checks the chosen site's
 * own night.
 *
 * Server-only: islands never import it (it reaches gear/store through `./store`, the observations DB layer). `maxNight` is `""` when the user
 * has no sites, and `night` is `""` when no `site` is chosen.
 */
export function logFormNights(
  sites: readonly Pick<SiteRecord, "latitudeDeg" | "longitudeDeg" | "timeZone" | "bortle">[],
  site: Pick<SiteRecord, "timeZone"> | undefined,
  now: Date,
): { night: string; maxNight: string } {
  return {
    night: site ? observingNightDateFor(now, site.timeZone) : "",
    maxNight: sites.length === 0 ? "" : latestNightBound(sites, now),
  };
}
