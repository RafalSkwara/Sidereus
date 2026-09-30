import { TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG, tonightDateFor } from "@/lib/engine";
import { toEngineSite, type SiteRecord } from "@/lib/gear/store";

/**
 * The evening date Tonight shows for a stored site at `now`: the night in progress until civil dawn
 * (`TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG`), then the coming evening. Also the latest night the log accepts for that
 * site, so "Mark observed" never prefills a night the log would reject.
 */
export function tonightDateForSite(
  site: Pick<SiteRecord, "latitudeDeg" | "longitudeDeg" | "timeZone" | "bortle">,
  now: Date,
): string {
  return tonightDateFor(toEngineSite(site), now, TONIGHT_ROLLOVER_SUN_ALTITUDE_DEG);
}
