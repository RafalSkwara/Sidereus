import { z } from "zod";
import type { MessageKey } from "@/i18n";
import { DEFAULT_MIN_ALTITUDE_DEG } from "@/lib/engine/parameters";
import { roundCoordinate } from "./coordinates";
import { AFOV_PRESET_OPTIONS, EYEPIECE_PRESETS } from "./eyepiece-presets";
import { isValidTimeZone } from "./zones";

/**
 * One definition of valid site, telescope and eyepiece input, shared by the React forms and the
 * API routes. Input is FormData-shaped (strings), coerced to typed values. Ranges match the CHECK
 * constraints in `supabase/migrations/20260924120000_sites_and_gear.sql`.
 *
 * Every error message is a message key (`@/i18n`, e.g. "errors.site.latitudeRange"), never a
 * sentence and never the submitted value: the routes put it into a redirect URL, coordinates must
 * not end up in URLs or logs, and the islands and pages translate it for the viewer's locale.
 *
 * Island-safe: imports only zod, its gear siblings, `@/lib/engine/parameters` (never the engine
 * barrel, never the server-only `timezone.ts`) and the catalogue's key type.
 */

/** An empty form field counts as missing, not as 0 (which `Number("")` would give). */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function boundedNumber(min: number, max: number, message: MessageKey, options: { integer?: boolean } = {}) {
  const base = z.coerce.number({ error: message });
  const checked = (options.integer ? base.int({ error: message }) : base)
    .min(min, { error: message })
    .max(max, { error: message });
  return z.preprocess(emptyToUndefined, checked);
}

const nameField = z
  .string({ error: "errors.name.required" satisfies MessageKey })
  .trim()
  .min(1, { error: "errors.name.required" satisfies MessageKey })
  .max(60, { error: "errors.name.tooLong" satisfies MessageKey });

// sites -----------------------------------------------------------------------------------------

export const TIME_ZONE_MODES = ["auto", "manual"] as const;

export const siteInputSchema = z
  .object({
    name: nameField,
    latitudeDeg: boundedNumber(-90, 90, "errors.site.latitudeRange").transform(roundCoordinate),
    longitudeDeg: boundedNumber(-180, 180, "errors.site.longitudeRange").transform(roundCoordinate),
    bortle: boundedNumber(1, 9, "errors.site.bortleRange", { integer: true }),
    minAltitudeDeg: boundedNumber(0, 60, "errors.site.minAltitudeRange", {
      integer: true,
    }),
    timeZoneMode: z.enum(TIME_ZONE_MODES, { error: "errors.site.timeZoneMode" satisfies MessageKey }),
    timeZone: z.preprocess(
      emptyToUndefined,
      z
        .string({ error: "errors.site.timeZone" satisfies MessageKey })
        .trim()
        .optional(),
    ),
  })
  .transform((site, ctx) => {
    if (site.timeZoneMode === "auto") {
      return { ...site, timeZone: undefined };
    }
    if (site.timeZone === undefined || !isValidTimeZone(site.timeZone)) {
      ctx.addIssue({ code: "custom", path: ["timeZone"], message: "errors.site.timeZoneExample" satisfies MessageKey });
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
  apertureMm: boundedNumber(20, 1000, "errors.telescope.apertureRange"),
  focalLengthMm: boundedNumber(100, 5000, "errors.telescope.focalLengthRange"),
});

export type TelescopeInput = z.output<typeof telescopeInputSchema>;

// eyepieces -------------------------------------------------------------------------------------

const AFOV_MESSAGE: MessageKey = "errors.eyepiece.afovRange";
const afovDegField = boundedNumber(30, 120, AFOV_MESSAGE, { integer: true });

export const eyepieceInputSchema = z
  .object({
    name: nameField,
    focalLengthMm: boundedNumber(2, 60, "errors.eyepiece.focalLengthRange"),
    afovPreset: z.enum(AFOV_PRESET_OPTIONS, { error: "errors.eyepiece.type" satisfies MessageKey }),
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
