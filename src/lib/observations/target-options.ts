import { getMessages } from "@/i18n";
import { CALDWELL, MESSIER } from "@/lib/catalogue";
import { localCommonName } from "@/lib/catalogue/common-names";
import type { Locale } from "@/lib/preferences";
import { messierKey, MOON_TARGET_KEY, PLANET_TARGET_KEYS, type DeepSkyKey } from "@/lib/targets";
import type { TargetOption } from "./target-search";

/**
 * The object picker's options for one locale (roadmap S-07; planets since M-2 S-01, the Moon since S-02, Caldwell
 * since deep-sky-beyond-messier): every Messier object with its localised name as the label, then the Moon, then
 * the seven planets, then the Caldwell objects by C number ("NGC 7000 · North America Nebula", found by its
 * designation, "C 20" and "Caldwell 20" too), each with every name it can be found by. The Caldwell objects come
 * last so a planet or the Moon wins its own name over a nebula named after it ("Jupiter's Ghost"). Built by the
 * page, so the island never imports the catalogue.
 */
export function targetOptions(locale: Locale): TargetOption[] {
  const messier = MESSIER.map((object): TargetOption => {
    const local = localCommonName(object.id, object.commonName, locale);
    return {
      key: messierKey(object.messier),
      id: object.id,
      label: local ? `${object.id} · ${local}` : object.id,
      detail: `${object.designation} · ${object.constellation}`,
      names: [local, object.commonName, object.designation].filter((name): name is string => name !== null),
    };
  });
  const caldwell = [...CALDWELL]
    .sort((a, b) => a.caldwell - b.caldwell)
    .map((object): TargetOption => {
      const local = localCommonName(object.id, object.commonName, locale);
      const n = String(object.caldwell);
      return {
        key: object.id as DeepSkyKey,
        id: object.label,
        label: local ? `${object.label} · ${local}` : object.label,
        detail: `${getMessages(locale).tonight.object.caldwell({ n })} · ${object.constellation}`,
        names: [local, object.commonName, object.designation, `C ${n}`, `Caldwell ${n}`].filter(
          (name): name is string => name !== null,
        ),
      };
    });
  const targets = getMessages(locale).targets;
  const english = getMessages("en").targets;
  const moon: TargetOption = {
    key: MOON_TARGET_KEY,
    id: targets.moon,
    label: targets.moon,
    detail: targets.moonDetail,
    names: [targets.moon, english.moon],
  };
  const planets = PLANET_TARGET_KEYS.map((key): TargetOption => {
    const name = targets.planet[key];
    return { key, id: name, label: name, detail: targets.planetDetail, names: [name, english.planet[key]] };
  });
  return [...messier, moon, ...planets, ...caldwell];
}
