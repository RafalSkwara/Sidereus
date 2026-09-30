import { getMessages } from "@/i18n";
import { MESSIER } from "@/lib/catalogue";
import { localCommonName } from "@/lib/catalogue/common-names";
import type { Locale } from "@/lib/preferences";
import { messierKey, PLANET_TARGET_KEYS } from "@/lib/targets";
import type { TargetOption } from "./target-search";

/**
 * The object picker's options for one locale (roadmap S-07; planets since M-2 S-01): every Messier object with its
 * localised name as the label, then the seven planets by their localised name, each with every name it can be
 * found by. Built by the page, so the island never imports the catalogue.
 */
export function targetOptions(locale: Locale): TargetOption[] {
  const messier = MESSIER.map((object): TargetOption => {
    const local = localCommonName(object.messier, object.commonName, locale);
    return {
      key: messierKey(object.messier),
      id: object.id,
      label: local ? `${object.id} · ${local}` : object.id,
      detail: `${object.designation} · ${object.constellation}`,
      names: [local, object.commonName, object.designation].filter((name): name is string => name !== null),
    };
  });
  const targets = getMessages(locale).targets;
  const english = getMessages("en").targets.planet;
  const planets = PLANET_TARGET_KEYS.map((key): TargetOption => {
    const name = targets.planet[key];
    return { key, id: name, label: name, detail: targets.planetDetail, names: [name, english[key]] };
  });
  return [...messier, ...planets];
}
