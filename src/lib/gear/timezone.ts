import tzlookup from "@photostructure/tz-lookup";
import { roundCoordinate } from "./coordinates";

/**
 * Resolves the IANA time zone a site is stored with. Server-only: this is the one module that
 * imports tz-lookup (a large boundary table), so API routes and the store import it, while
 * `schemas.ts` and React islands never do.
 */

export type TimeZoneMode = "auto" | "manual";

export interface TimeZoneResolution {
  timeZone: string;
  source: TimeZoneMode;
}

/**
 * `auto` looks the zone up from the rounded coordinates (the ones actually stored); `manual`
 * returns the zone the user picked, even when the coordinates point elsewhere. Callers validate
 * input with `siteInputSchema` first, which guarantees a valid zone in manual mode.
 */
export function resolveTimeZone(input: {
  mode: TimeZoneMode;
  timeZone?: string;
  latitudeDeg: number;
  longitudeDeg: number;
}): TimeZoneResolution {
  if (input.mode === "manual") {
    if (input.timeZone === undefined || input.timeZone === "") {
      throw new Error("A manual time zone mode needs a time zone.");
    }
    return { timeZone: input.timeZone, source: "manual" };
  }
  return {
    timeZone: tzlookup(roundCoordinate(input.latitudeDeg), roundCoordinate(input.longitudeDeg)),
    source: "auto",
  };
}
