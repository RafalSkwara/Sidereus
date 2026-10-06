import { getMessages } from "@/i18n";
import { findDeepSky } from "@/lib/catalogue";
import { localCommonName } from "@/lib/catalogue/common-names";
import type { Locale } from "@/lib/preferences";
import { isMoonKey, isPlanetKey, type TargetKey } from "./index";

/**
 * How the log pages, notices and picker name a target (M-2 S-01).
 *
 * - `id`: what stands for the target in a heading or a notice. A catalogue object's display label ("M31",
 *   "NGC 7000", "NGC 869 / 884"; never the space-free key), or a planet's or the Moon's localised name
 *   ("Jowisz", "Księżyc").
 * - `name`: a deep-sky object's localised common name ("Galaktyka Andromedy"), shown after the id; `null` for an
 *   object without one and for a planet or the Moon, whose `id` is already its name.
 *
 * Server-side: reads the deep-sky catalogue.
 */
export interface TargetLabel {
  id: string;
  name: string | null;
}

export function targetLabel(key: TargetKey, locale: Locale): TargetLabel {
  if (isPlanetKey(key)) {
    return { id: getMessages(locale).targets.planet[key], name: null };
  }
  if (isMoonKey(key)) {
    return { id: getMessages(locale).targets.moon, name: null };
  }
  const object = findDeepSky(key);
  return {
    id: object?.label ?? key,
    name: object ? localCommonName(object.id, object.commonName, locale) : null,
  };
}

/**
 * Whether `key` names something the app has: a planet, the Moon, or a Messier / Caldwell object the catalogue
 * lists. The key grammar (`@/lib/targets`) only checks shape, so "NGC1" passes it; this is the existence check
 * the log's routes and pages add. Server-side, like `targetLabel`.
 */
export function isKnownTarget(key: TargetKey): boolean {
  return isPlanetKey(key) || isMoonKey(key) || findDeepSky(key) !== undefined;
}
