import type { Locale } from "@/lib/preferences";

/**
 * Localised bright-star names. The generated catalogue (`bright-stars.json`) carries HYG's English
 * proper names and is never edited; a locale lists every named star here by its English name.
 * A name that reads the same in the locale maps to itself, so `stars.test.ts` can tell a deliberate
 * match from a missing entry. Anything not listed falls back to the English name.
 *
 * Island-safe: no imports beyond types.
 */

export const STAR_NAMES: Record<Exclude<Locale, "en">, Readonly<Partial<Record<string, string>>>> = {
  // Established Polish forms; IAU names that Polish uses unchanged map to themselves.
  pl: {
    Sirius: "Syriusz",
    Polaris: "Gwiazda Polarna",
    Canopus: "Kanopus",
    Arcturus: "Arktur",
    "Rigil Kentaurus": "Rigil Kentaurus",
    Vega: "Wega",
    Capella: "Kapella",
    Rigel: "Rigel",
    Procyon: "Procjon",
    Achernar: "Achernar",
    Betelgeuse: "Betelgeza",
    Hadar: "Hadar",
    Altair: "Altair",
    Acrux: "Akruks",
    Aldebaran: "Aldebaran",
    Spica: "Spika",
    Antares: "Antares",
    Pollux: "Polluks",
    Fomalhaut: "Fomalhaut",
    Mimosa: "Mimoza",
    Deneb: "Deneb",
    Toliman: "Toliman",
    Regulus: "Regulus",
    Adhara: "Adara",
    Castor: "Kastor",
    Gacrux: "Gakruks",
    Shaula: "Szaula",
    Bellatrix: "Bellatriks",
    Elnath: "Elnath",
    Miaplacidus: "Miaplacidus",
    Alnilam: "Alnilam",
    Alnair: "Alnair",
    Alnitak: "Alnitak",
    Alioth: "Alioth",
    Mirfak: "Mirfak",
    "Kaus Australis": "Kaus Australis",
    Dubhe: "Dubhe",
    Wezen: "Wezen",
    Alkaid: "Alkaid",
    Avior: "Avior",
    Sargas: "Sargas",
  },
};

/** The name of the star HYG calls `name` for `locale`, or `name` itself. */
export function starName(name: string, locale: Locale): string {
  if (locale === "en") {
    return name;
  }
  return STAR_NAMES[locale][name] ?? name;
}
