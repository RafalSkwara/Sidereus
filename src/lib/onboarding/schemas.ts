import { z } from "zod";
import type { MessageKey } from "@/i18n";
import { DEFAULT_MIN_ALTITUDE_DEG } from "@/lib/engine/parameters";
import { eyepieceInputSchema, siteInputSchema, telescopeInputSchema } from "@/lib/gear/schemas";

/**
 * Validates one onboarding submit, both in the island (before submit) and again in the route. It
 * reuses the S-01 field rules from `@/lib/gear/schemas`: coordinate ranges and rounding, the Bortle
 * range, the telescope fields and the whole eyepiece schema. The site name and minimum altitude are
 * not form fields: FR-004 fixes the minimum altitude to the PRD default here, and the route passes
 * the localised site name (`onboarding.homeSiteName`) to `completeOnboarding`.
 *
 * Input is FormData-shaped (strings). `eyepieces` is a JSON string holding an array of 0-10 objects
 * shaped like the `/gear` eyepiece form (`{ name, focalLengthMm, afovPreset, afovDeg? }`).
 *
 * Every error message is a message key (`@/i18n`) and never contains a submitted value (the route
 * puts messages into a redirect URL, and coordinates must not end up in URLs or logs).
 *
 * Island-safe: imports only zod, `@/lib/gear/schemas`, `@/lib/engine/parameters` and the
 * catalogue's key type (never the server-only `timezone.ts` or any `store.ts`).
 */

export const MAX_ONBOARDING_EYEPIECES = 10;

const EYEPIECES_MALFORMED: MessageKey = "errors.onboarding.eyepiecesMalformed";
/** Its English text names `MAX_ONBOARDING_EYEPIECES`; keep the two in step. */
const EYEPIECES_TOO_MANY: MessageKey = "errors.onboarding.eyepiecesTooMany";

// The site schema is an object piped into a transform; its `in` side holds the individual field rules.
const siteFields = siteInputSchema.in.shape;
const telescopeFields = telescopeInputSchema.shape;

function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses the JSON string into an array of objects; anything else is the one fixed message. */
const eyepiecesField = z
  .string({ error: EYEPIECES_MALFORMED })
  .transform((json, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      parsed = undefined;
    }
    if (!Array.isArray(parsed) || !parsed.every(isPlainObject)) {
      ctx.addIssue({ code: "custom", message: EYEPIECES_MALFORMED });
      return z.NEVER;
    }
    return parsed as unknown[];
  })
  .pipe(z.array(eyepieceInputSchema).max(MAX_ONBOARDING_EYEPIECES, { error: EYEPIECES_TOO_MANY }));

export const onboardingInputSchema = z
  .object({
    latitudeDeg: siteFields.latitudeDeg,
    longitudeDeg: siteFields.longitudeDeg,
    bortle: siteFields.bortle,
    telescopeName: telescopeFields.name,
    apertureMm: telescopeFields.apertureMm,
    focalLengthMm: telescopeFields.focalLengthMm,
    eyepieces: eyepiecesField,
  })
  .transform((form) => ({
    site: {
      latitudeDeg: form.latitudeDeg,
      longitudeDeg: form.longitudeDeg,
      bortle: form.bortle,
      minAltitudeDeg: DEFAULT_MIN_ALTITUDE_DEG,
    },
    telescope: { name: form.telescopeName, apertureMm: form.apertureMm, focalLengthMm: form.focalLengthMm },
    eyepieces: form.eyepieces,
  }));

export type OnboardingInput = z.output<typeof onboardingInputSchema>;
