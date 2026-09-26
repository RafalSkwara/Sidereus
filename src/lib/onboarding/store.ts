import { resolveTimeZone, type TimeZoneResolution } from "@/lib/gear/timezone";
import type { TypedSupabaseClient } from "@/lib/supabase";
import type { OnboardingInput } from "./schemas";

/**
 * The onboarding data layer: the only caller of the `complete_onboarding` database function, which
 * saves the site, telescope and eyepieces in one transaction and refuses a user who already has a
 * site or telescope.
 *
 * Server-only (imports `timezone.ts`). Follows `@/lib/gear/store.ts`'s privacy rules: database
 * error text can echo submitted values, coordinates included, so it never leaves this module.
 * Failures return a fixed, value-free message, reads throw a fixed-message `Error`, and this module
 * never logs.
 */

export type OnboardingResult =
  { ok: true } | { ok: false; reason: "alreadyOnboarded" } | { ok: false; reason: "failed"; message: string };

const SAVE_FAILED = "Could not save your setup. Please try again.";
const OUT_OF_RANGE = "Some values are out of the allowed range.";
const LOAD_FAILED = "Could not load your setup. Please try again.";

/** Postgres `raise_exception`, raised by `complete_onboarding` with the message below. */
const RAISE_EXCEPTION = "P0001";
const ALREADY_ONBOARDED = "already_onboarded";
/** Postgres `check_violation`. */
const CHECK_VIOLATION = "23514";

function failed(message: string): OnboardingResult {
  return { ok: false, reason: "failed", message };
}

export async function completeOnboarding(
  client: TypedSupabaseClient,
  input: OnboardingInput,
): Promise<OnboardingResult> {
  const { site, telescope, eyepieces } = input;
  let zone: TimeZoneResolution;
  try {
    zone = resolveTimeZone({ mode: "auto", latitudeDeg: site.latitudeDeg, longitudeDeg: site.longitudeDeg });
  } catch {
    return failed(SAVE_FAILED);
  }

  const { error } = await client.rpc("complete_onboarding", {
    site_name: site.name,
    latitude_deg: site.latitudeDeg,
    longitude_deg: site.longitudeDeg,
    bortle: site.bortle,
    min_altitude_deg: site.minAltitudeDeg,
    time_zone: zone.timeZone,
    time_zone_source: zone.source,
    telescope_name: telescope.name,
    aperture_mm: telescope.apertureMm,
    focal_length_mm: telescope.focalLengthMm,
    eyepieces: eyepieces.map((eyepiece) => ({
      name: eyepiece.name,
      focal_length_mm: eyepiece.focalLengthMm,
      afov_deg: eyepiece.afovDeg,
    })),
  });

  if (!error) {
    return { ok: true };
  }
  if (error.code === RAISE_EXCEPTION && error.message === ALREADY_ONBOARDED) {
    return { ok: false, reason: "alreadyOnboarded" };
  }
  if (error.code === CHECK_VIOLATION) {
    return failed(OUT_OF_RANGE);
  }
  return failed(SAVE_FAILED);
}

/** Whether the user has any site or telescope, i.e. has been through onboarding or `/gear`. */
export async function hasAnyGear(client: TypedSupabaseClient): Promise<boolean> {
  const [sites, telescopes] = await Promise.all([
    client.from("sites").select("id").limit(1),
    client.from("telescopes").select("id").limit(1),
  ]);
  if (sites.error || telescopes.error) {
    throw new Error(LOAD_FAILED);
  }
  return sites.data.length > 0 || telescopes.data.length > 0;
}
