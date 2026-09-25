/**
 * Time zone validation that is safe for the browser: it relies only on the `Intl.DateTimeFormat`
 * constructor, so schemas and React islands can import it without pulling in tz-lookup
 * (see `timezone.ts`, which is server-only).
 */

/** True when `tz` is an IANA time zone id that this runtime's `Intl` accepts, e.g. "Europe/Warsaw". */
export function isValidTimeZone(tz: string): boolean {
  if (tz.trim() === "") {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
