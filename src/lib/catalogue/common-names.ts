import type { Locale } from "@/lib/preferences";

/**
 * Localised deep-sky common names. The generated catalogue (`messier.json`, `caldwell.json`)
 * carries OpenNGC's English names and is never edited; a locale lists its own names here by object
 * id ("M31", "NGC7000"), and any object it leaves out falls back to the catalogue's English name.
 *
 * Island-safe: no imports beyond types, so the ids are not checked against the catalogue here;
 * `common-names.test.ts` checks that every key is a real catalogue id and every name is non-empty.
 */

export const COMMON_NAMES: Record<Exclude<Locale, "en">, Readonly<Partial<Record<string, string>>>> = {
  // Only names with established Polish usage; every other object keeps its English name.
  pl: {
    M1: "Mgławica Krab",
    M6: "Gromada Motyl",
    M7: "Gromada Ptolemeusza",
    M8: "Mgławica Laguna",
    M11: "Gromada Dzika Kaczka",
    M13: "Wielka Gromada Kulista w Herkulesie",
    M16: "Mgławica Orzeł",
    M17: "Mgławica Omega",
    M20: "Mgławica Trójdzielna",
    M24: "Mały Obłok Gwiazd w Strzelcu",
    M27: "Mgławica Hantle",
    M31: "Galaktyka Andromedy",
    M33: "Galaktyka Trójkąta",
    M42: "Wielka Mgławica w Orionie",
    M43: "Mgławica de Mairana",
    M44: "Żłóbek",
    M45: "Plejady",
    M51: "Galaktyka Wir",
    M57: "Mgławica Pierścień",
    M63: "Galaktyka Słonecznik",
    M64: "Galaktyka Czarne Oko",
    M76: "Mgławica Mała Hantla",
    M81: "Galaktyka Bodego",
    M82: "Galaktyka Cygaro",
    M83: "Galaktyka Południowy Wiatraczek",
    M87: "Virgo A",
    M97: "Mgławica Sowa",
    M99: "Galaktyka Wiatraczek w Warkoczu",
    M104: "Galaktyka Sombrero",
    // Caldwell objects.
    NGC869: "Gromada podwójna w Perseuszu",
    NGC6543: "Mgławica Kocie Oko",
    NGC7023: "Mgławica Irys",
    NGC7635: "Mgławica Bąbel",
    NGC6946: "Galaktyka Fajerwerki",
    IC5146: "Mgławica Kokon",
    NGC7000: "Mgławica Ameryka Północna",
    NGC6888: "Mgławica Półksiężyc",
    IC405: "Mgławica Płonąca Gwiazda",
    NGC4631: "Galaktyka Wieloryb",
    NGC6992: "Mgławica Welon (część wschodnia)",
    NGC6960: "Mgławica Welon (część zachodnia)",
    NGC4565: "Galaktyka Igła",
    NGC2392: "Mgławica Eskimos",
    NGC7009: "Mgławica Saturn",
    NGC6826: "Mgławica Mrugająca",
    NGC2238: "Mgławica Rozeta",
    NGC3115: "Galaktyka Wrzeciono",
    NGC6822: "Galaktyka Barnarda",
    NGC3242: "Duch Jowisza",
    NGC4038: "Galaktyki Czułki",
    NGC4039: "Galaktyki Czułki",
    NGC7293: "Mgławica Ślimak",
  },
};

/** The common name of the catalogue object `id` ("M31", "NGC7000") for `locale`, or the catalogue's `englishName`. */
export function localCommonName(id: string, englishName: string | null, locale: Locale): string | null {
  if (locale === "en" || englishName === null) {
    return englishName;
  }
  return COMMON_NAMES[locale][id] ?? englishName;
}
