import type { Locale } from "@/lib/preferences";

/**
 * Localised Messier common names. The generated catalogue (`messier.json`) carries OpenNGC's
 * English names and is never edited; a locale lists its own names here by Messier number, and any
 * object it leaves out falls back to the catalogue's English name.
 *
 * Island-safe: no imports beyond types.
 */

const COMMON_NAMES: Record<Exclude<Locale, "en">, Readonly<Partial<Record<number, string>>>> = {
  // Established Polish names; `common-names.test.ts` checks that every named object has one.
  pl: {
    1: "Mgławica Krab",
    6: "Gromada Motyl",
    7: "Gromada Ptolemeusza",
    8: "Mgławica Laguna",
    11: "Gromada Dzika Kaczka",
    13: "Wielka Gromada Kulista w Herkulesie",
    16: "Mgławica Orzeł",
    17: "Mgławica Omega",
    20: "Mgławica Trójdzielna",
    24: "Mały Obłok Gwiazd w Strzelcu",
    27: "Mgławica Hantle",
    31: "Galaktyka Andromedy",
    33: "Galaktyka Trójkąta",
    42: "Wielka Mgławica w Orionie",
    43: "Mgławica de Mairana",
    44: "Żłóbek",
    45: "Plejady",
    51: "Galaktyka Wir",
    57: "Mgławica Pierścień",
    63: "Galaktyka Słonecznik",
    64: "Galaktyka Czarne Oko",
    76: "Mgławica Mała Hantla",
    81: "Galaktyka Bodego",
    82: "Galaktyka Cygaro",
    83: "Galaktyka Południowy Wiatraczek",
    87: "Virgo A",
    97: "Mgławica Sowa",
    99: "Galaktyka Wiatraczek w Warkoczu",
    104: "Galaktyka Sombrero",
  },
};

/** The common name of Messier object `messier` for `locale`, or the catalogue's `englishName`. */
export function localCommonName(messier: number, englishName: string | null, locale: Locale): string | null {
  if (locale === "en" || englishName === null) {
    return englishName;
  }
  return COMMON_NAMES[locale][messier] ?? englishName;
}
