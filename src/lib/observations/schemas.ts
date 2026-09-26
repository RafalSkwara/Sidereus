import { z } from "zod";
import type { MessageKey } from "@/i18n";

/**
 * One definition of a valid observation log entry (roadmap S-06, PRD FR-016), shared by the log form
 * and `POST /api/log`. Input is FormData-shaped (strings), coerced to typed values. Ranges match the
 * CHECK constraints of `public.observations`.
 *
 * Every error message is a message key (`@/i18n`), never a sentence and never the submitted value:
 * the route puts it into a redirect URL. Whether the night lies in the future depends on the chosen
 * site's time zone, so the store checks that, not this schema.
 *
 * Island-safe: imports only zod and the catalogue's key type.
 */

/** An empty form field counts as missing, not as 0 (which `Number("")` would give). */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function boundedInteger(min: number, max: number, message: MessageKey) {
  return z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: message })
      .int({ error: message })
      .min(min, { error: message })
      .max(max, { error: message }),
  );
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` naming a real calendar date (no 30 February). */
export function isCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const NIGHT_INVALID: MessageKey = "errors.observation.nightInvalid";

/** The earliest observing night the log accepts, so a mistyped year cannot count as "seen". */
export const MIN_NIGHT = "1900-01-01";

function gearId(message: MessageKey) {
  return z.preprocess(emptyToUndefined, z.uuid({ error: message }));
}

export const observationInputSchema = z.object({
  messier: boundedInteger(1, 110, "errors.observation.objectInvalid"),
  night: z.preprocess(
    emptyToUndefined,
    z
      .string({ error: NIGHT_INVALID })
      .refine(isCalendarDate, { error: NIGHT_INVALID })
      // ISO dates compare correctly as strings.
      .refine((night) => night >= MIN_NIGHT, { error: "errors.observation.nightTooEarly" satisfies MessageKey }),
  ),
  rating: boundedInteger(1, 5, "errors.observation.ratingRequired"),
  siteId: gearId("errors.observation.siteRequired"),
  telescopeId: gearId("errors.observation.telescopeRequired"),
});

export type ObservationInput = z.infer<typeof observationInputSchema>;
