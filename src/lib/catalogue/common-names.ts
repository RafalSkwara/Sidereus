import type { Locale } from "@/lib/preferences";

/**
 * Localised Messier common names. The generated catalogue (`messier.json`) carries OpenNGC's
 * English names and is never edited; a locale lists its own names here by Messier number, and any
 * object it leaves out falls back to the catalogue's English name.
 *
 * Island-safe: no imports beyond types.
 */

const COMMON_NAMES: Record<Exclude<Locale, "en">, Readonly<Partial<Record<number, string>>>> = {
  // Filled with the established Polish names in F-03 phase 4.
  pl: {},
};

/** The common name of Messier object `messier` for `locale`, or the catalogue's `englishName`. */
export function localCommonName(messier: number, englishName: string | null, locale: Locale): string | null {
  if (locale === "en" || englishName === null) {
    return englishName;
  }
  return COMMON_NAMES[locale][messier] ?? englishName;
}
