import { z } from "zod";
import type { MessageKey } from "@/i18n";
import { roundCoordinate } from "@/lib/gear/coordinates";
import type { Locale } from "@/lib/preferences";

/**
 * Open-Meteo Geocoding client for the onboarding place search, called from the browser. The fetch
 * function is passed in so tests need no network.
 *
 * Privacy (PRD NFR): result coordinates are rounded with `roundCoordinate` before they leave this
 * module. Every failure throws an `Error` with the one fixed message key (no URL, no query, no
 * response text, no cause), and this module never logs. Place names come back in the viewer's
 * language.
 *
 * Island-safe: imports only zod, `@/lib/gear/coordinates` and types.
 */

export const GEOCODING_BASE_URL = "https://geocoding-api.open-meteo.com";

/** Abort the request (including reading the body) after this long. */
export const GEOCODING_TIMEOUT_MS = 3000;

/** A message key (`@/i18n`); the island translates it. */
export const GEOCODING_FAILED: MessageKey = "errors.geocoding.failed";

/** Open-Meteo returns nothing for a 1-character name, so shorter queries are not sent. */
export const PLACE_QUERY_MIN_LENGTH = 2;

export const PLACE_RESULT_COUNT = 5;

export interface PlaceResult {
  id: number;
  label: string;
  latitudeDeg: number;
  longitudeDeg: number;
}

const responseSchema = z.object({
  // Open-Meteo leaves the key out entirely when nothing matches.
  results: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        admin1: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .optional(),
});

export function geocodingUrl(query: string, language: Locale, baseUrl: string = GEOCODING_BASE_URL): URL {
  const url = new URL("/v1/search", baseUrl);
  url.searchParams.set("name", query);
  url.searchParams.set("count", String(PLACE_RESULT_COUNT));
  url.searchParams.set("language", language);
  url.searchParams.set("format", "json");
  return url;
}

function label(parts: (string | undefined)[]): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter((part) => part !== "")
    .join(", ");
}

/**
 * Searches places by name, with place names in `language`. A trimmed query under `PLACE_QUERY_MIN_LENGTH` characters returns `[]`
 * without a request. Throws `Error(GEOCODING_FAILED)` on a network error, non-2xx status, timeout,
 * non-JSON body or schema mismatch. An abort through `signal` rejects the same way, so a caller that
 * cancels a stale search should check `signal.aborted` before showing the error.
 */
export async function searchPlaces(
  query: string,
  language: Locale,
  fetchFn: typeof fetch,
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  const name = query.trim();
  if (name.length < PLACE_QUERY_MIN_LENGTH) {
    return [];
  }
  const timeout = AbortSignal.timeout(GEOCODING_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let body: unknown;
  try {
    const response = await fetchFn(geocodingUrl(name, language), { signal: requestSignal });
    if (!response.ok) {
      throw new Error(GEOCODING_FAILED);
    }
    body = await response.json();
  } catch (_error) {
    // eslint-disable-next-line preserve-caught-error -- the cause can quote the request URL, which carries the query.
    throw new Error(GEOCODING_FAILED);
  }

  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(GEOCODING_FAILED);
  }
  return (parsed.data.results ?? []).map((place) => ({
    id: place.id,
    label: label([place.name, place.admin1, place.country]),
    latitudeDeg: roundCoordinate(place.latitude),
    longitudeDeg: roundCoordinate(place.longitude),
  }));
}
