import { z } from "zod";
import type { MessageKey } from "@/i18n";
import { isTargetKey, type TargetKey } from "@/lib/targets";

/**
 * One definition of a valid observation log entry (roadmap S-06, PRD FR-016), shared by the log form
 * and `POST /api/log`. Input is FormData-shaped (strings), coerced to typed values. Ranges match the
 * CHECK constraints of `public.observations`.
 *
 * Every error message is a message key (`@/i18n`), never a sentence and never the submitted value:
 * the route puts it into a redirect URL. Whether the night lies in the future depends on the chosen
 * site's time zone, so the store checks that, not this schema.
 *
 * Island-safe: imports only zod, the catalogue's key type and the target key grammar (`@/lib/targets`).
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

const OBJECT_INVALID: MessageKey = "errors.observation.objectInvalid";

export const observationInputSchema = z.object({
  /** The target key (`@/lib/targets`): "M31" or "jupiter". */
  target: z.preprocess(emptyToUndefined, z.custom<TargetKey>(isTargetKey, { error: OBJECT_INVALID })),
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

/** An empty gear field on edit means "keep the deleted site or telescope" (FR-021); the store checks it was one. */
function keptGearId(message: MessageKey) {
  return z.preprocess((value) => emptyToUndefined(value) ?? null, z.uuid({ error: message }).nullable());
}

/**
 * An edited entry (roadmap S-07, FR-017): the same fields, except that the site or telescope may be `null`
 * when the entry's own gear has been deleted since. Creating an entry always needs live gear.
 */
export const observationUpdateSchema = observationInputSchema.extend({
  siteId: keptGearId("errors.observation.siteRequired"),
  telescopeId: keptGearId("errors.observation.telescopeRequired"),
});

export type ObservationUpdateInput = z.infer<typeof observationUpdateSchema>;

/** Where `/log/new` returns after a save: absent → Tonight (the ranking flow), `log` → the log (manual entry). */
export const returnTargetSchema = z.enum(["log"]).optional();

export type ReturnTarget = z.infer<typeof returnTargetSchema>;
