import { isMessageKey, type MessageKey } from "@/i18n";
import { findDeepSky } from "@/lib/catalogue";
import { isPlanetKey, MOON_TARGET_KEY, type TargetKey } from "@/lib/targets";
import { deepSkyWindow, solarSystemWindow, type PlanWindowSite } from "@/lib/tonight/plan-window";

/**
 * The pure checks the Session plan's save route makes after the plan, the site and the night (adjustable-session-plan,
 * F4): which keys are new, and which of them have no window at the site that night. Server-side: reads the catalogue.
 * A key that was already on the stored list is never checked again, so a list the user saved while a target had a
 * window stays saved after the site's minimum altitude rises (it then shows under "Not on tonight's plan").
 */

/** The keys of `targets` the stored list did not have: the ones this save adds. `null` stored means none saved. */
export function newKeys(stored: readonly TargetKey[] | null, targets: readonly TargetKey[]): TargetKey[] {
  const had = new Set<string>(stored ?? []);
  return targets.filter((key) => !had.has(key));
}

/**
 * The keys with no window at `site` on `night`, by the build's own helpers (`plan-window.ts`): a deep-sky key needs a
 * best window over the dark window, a planet or the Moon one over the planet window. The route has no telescope, so
 * the ice giants are not held to the aperture rule here (the planets' own rule is the build's); the telescope's reach is
 * the build's too, where a saved key the telescope cannot reach is simply not drawn (D4). A key the catalogue lacks
 * counts as having no window.
 */
export function keysWithoutWindow(site: PlanWindowSite, night: string, keys: readonly TargetKey[]): TargetKey[] {
  return keys.filter((key) => {
    if (key === MOON_TARGET_KEY || isPlanetKey(key)) {
      return solarSystemWindow(site, night, key) === null;
    }
    const object = findDeepSky(key);
    return object === undefined || deepSkyWindow(site, night, object) === null;
  });
}

/**
 * The message key of a thrown store error: stores throw an `Error` whose message is a fixed key (`@/i18n`) and whose
 * `cause` is the database's error, which never leaves the store. Anything else becomes `fallback`.
 */
export function thrownKey(error: unknown, fallback: MessageKey): MessageKey {
  return error instanceof Error && isMessageKey(error.message) ? error.message : fallback;
}
