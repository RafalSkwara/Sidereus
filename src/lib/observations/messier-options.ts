import { MESSIER } from "@/lib/catalogue";
import { localCommonName } from "@/lib/catalogue/common-names";
import type { Locale } from "@/lib/preferences";
import type { MessierOption } from "./messier-search";

/**
 * The object picker's options for one locale (roadmap S-07): every Messier object with its localised name as the
 * label, and every name it can be found by. Built by the page, so the island never imports the catalogue.
 */
export function messierOptions(locale: Locale): MessierOption[] {
  return MESSIER.map((object) => {
    const local = localCommonName(object.messier, object.commonName, locale);
    return {
      messier: object.messier,
      id: object.id,
      label: local ? `${object.id} · ${local}` : object.id,
      detail: `${object.designation} · ${object.constellation}`,
      names: [local, object.commonName, object.designation].filter((name): name is string => name !== null),
    };
  });
}
