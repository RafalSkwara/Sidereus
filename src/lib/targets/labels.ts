import { getMessages } from "@/i18n";
import { findMessier } from "@/lib/catalogue";
import { localCommonName } from "@/lib/catalogue/common-names";
import type { Locale } from "@/lib/preferences";
import { isMoonKey, isPlanetKey, messierNumber, type TargetKey } from "./index";

/**
 * How the log pages, notices and picker name a target (M-2 S-01).
 *
 * - `id`: what stands for the target in a heading or a notice. A Messier object's catalogue id ("M31"), or a
 *   planet's or the Moon's localised name ("Jowisz", "Księżyc").
 * - `name`: a Messier object's localised common name ("Galaktyka Andromedy"), shown after the id; `null` for an
 *   object without one and for a planet or the Moon, whose `id` is already its name.
 *
 * Server-side: reads the Messier catalogue.
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
  const messier = messierNumber(key);
  const object = messier === null ? undefined : findMessier(messier);
  return {
    id: object?.id ?? key,
    name: object ? localCommonName(object.messier, object.commonName, locale) : null,
  };
}
