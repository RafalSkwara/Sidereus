import { z } from "zod";
import { DEFAULT_MIN_ALTITUDE_DEG } from "@/lib/engine/parameters";
import { roundCoordinate } from "./coordinates";
import { AFOV_PRESET_OPTIONS, EYEPIECE_PRESETS } from "./eyepiece-presets";
import { isValidTimeZone } from "./zones";

/**
 * One definition of valid site, telescope and eyepiece input, shared by the React forms and the
 * API routes. Input is FormData-shaped (strings), coerced to typed values. Ranges match the CHECK
 * constraints in `supabase/migrations/20260924120000_sites_and_gear.sql`.
 *
 * Every error message is a static English string that never contains the submitted value: the
 * routes put messages into a redirect URL, and coordinates must not end up in URLs or logs.
 *
 * Island-safe: imports only zod, its gear siblings and `@/lib/engine/parameters` (never the engine
 * barrel, never the server-only `timezone.ts`).
 */

/** An empty form field counts as missing, not as 0 (which `Number("")` would give). */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function boundedNumber(min: number, max: number, message: string, options: { integer?: boolean } = {}) {
  const base = z.coerce.number({ error: message });
  const checked = (options.integer ? base.int({ error: message }) : base)
    .min(min, { error: message })
    .max(max, { error: message });
  return z.preprocess(emptyToUndefined, checked);
}

const nameField = z
  .string({ error: "Enter a name." })
  .trim()
  .min(1, { error: "Enter a name." })
  .max(60, { error: "Keep the name to 60 characters or fewer." });

// sites -----------------------------------------------------------------------------------------

export const TIME_ZONE_MODES = ["auto", "manual"] as const;

export const siteInputSchema = z
  .object({
    name: nameField,
    latitudeDeg: boundedNumber(-90, 90, "Enter a latitude between -90 and 90 degrees.").transform(roundCoordinate),
    longitudeDeg: boundedNumber(-180, 180, "Enter a longitude between -180 and 180 degrees.").transform(
      roundCoordinate,
    ),
    bortle: boundedNumber(1, 9, "Choose a Bortle class from 1 to 9.", { integer: true }),
    minAltitudeDeg: boundedNumber(0, 60, "Enter a minimum altitude as a whole number from 0 to 60 degrees.", {
      integer: true,
    }),
    timeZoneMode: z.enum(TIME_ZONE_MODES, { error: "Choose how the time zone is set." }),
    timeZone: z.preprocess(emptyToUndefined, z.string({ error: "Choose a valid time zone." }).trim().optional()),
  })
  .transform((site, ctx) => {
    if (site.timeZoneMode === "auto") {
      return { ...site, timeZone: undefined };
    }
    if (site.timeZone === undefined || !isValidTimeZone(site.timeZone)) {
      ctx.addIssue({ code: "custom", path: ["timeZone"], message: "Choose a valid time zone, e.g. Europe/Warsaw." });
      return z.NEVER;
    }
    return site;
  });

export type SiteInput = z.output<typeof siteInputSchema>;

/** Initial values of the site form. `minAltitudeDeg` is the PRD candidate, also the column default. */
export const SITE_FORM_DEFAULTS = {
  minAltitudeDeg: DEFAULT_MIN_ALTITUDE_DEG,
  timeZoneMode: "auto",
} as const satisfies Partial<SiteInput>;

// telescopes ------------------------------------------------------------------------------------

export const telescopeInputSchema = z.object({
  name: nameField,
  apertureMm: boundedNumber(20, 1000, "Enter an aperture between 20 and 1000 mm."),
  focalLengthMm: boundedNumber(100, 5000, "Enter a focal length between 100 and 5000 mm."),
});

export type TelescopeInput = z.output<typeof telescopeInputSchema>;

// eyepieces -------------------------------------------------------------------------------------

const AFOV_MESSAGE = "Enter an apparent field of view as a whole number from 30 to 120°.";
const afovDegField = boundedNumber(30, 120, AFOV_MESSAGE, { integer: true });

export const eyepieceInputSchema = z
  .object({
    name: nameField,
    focalLengthMm: boundedNumber(2, 60, "Enter a focal length between 2 and 60 mm."),
    afovPreset: z.enum(AFOV_PRESET_OPTIONS, { error: "Choose an eyepiece type." }),
    // Only read for `other`; a stale value left in the form for a preset is ignored, not rejected.
    afovDeg: z.unknown().optional(),
  })
  .transform((eyepiece, ctx) => {
    if (eyepiece.afovPreset !== "other") {
      return { ...eyepiece, afovDeg: EYEPIECE_PRESETS[eyepiece.afovPreset].afovDeg };
    }
    const afov = afovDegField.safeParse(eyepiece.afovDeg);
    if (!afov.success) {
      ctx.addIssue({ code: "custom", path: ["afovDeg"], message: AFOV_MESSAGE });
      return z.NEVER;
    }
    return { ...eyepiece, afovDeg: afov.data };
  });

export type EyepieceInput = z.output<typeof eyepieceInputSchema>;
