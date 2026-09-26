import type { PostgrestError } from "@supabase/supabase-js";
import type { MessageKey } from "@/i18n";
import type { Tables } from "@/lib/database.types";
import type { Site } from "@/lib/engine/types";
import type { TypedSupabaseClient } from "@/lib/supabase";
import type { EyepieceInput, SiteInput, TelescopeInput } from "./schemas";
import { resolveTimeZone, type TimeZoneMode, type TimeZoneResolution } from "./timezone";

/**
 * The data layer for sites, telescopes and eyepieces: every Supabase call and error mapping lives
 * here, so pages and routes stay thin. It maps camelCase domain types to snake_case columns.
 *
 * Privacy rules (PRD NFR): database error text can echo submitted values, coordinates included, so
 * it never leaves this module. Writes return a fixed, value-free message key (`@/i18n`); reads throw
 * an `Error` whose message is such a key. This module never logs.
 *
 * Ownership is enforced by RLS: `user_id` defaults to `auth.uid()`, so writes never send it, and a
 * row owned by someone else behaves exactly like a missing one.
 */

export type WriteResult = { ok: true } | { ok: false; message: MessageKey };

export interface SiteRecord {
  id: string;
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
  bortle: number;
  minAltitudeDeg: number;
  timeZone: string;
  timeZoneSource: TimeZoneMode;
  createdAt: string;
}

export interface TelescopeRecord {
  id: string;
  name: string;
  apertureMm: number;
  focalLengthMm: number;
  createdAt: string;
}

export interface EyepieceRecord {
  id: string;
  name: string;
  focalLengthMm: number;
  afovDeg: number;
  createdAt: string;
}

const OUT_OF_RANGE: MessageKey = "errors.outOfRange";

/** Postgres `invalid_text_representation`: a malformed uuid in the id filter. Treated as "not found". */
const INVALID_TEXT = "22P02";
/** Postgres `check_violation`. */
const CHECK_VIOLATION = "23514";

interface EntityMessages {
  loadFailed: MessageKey;
  saveFailed: MessageKey;
  deleteFailed: MessageKey;
  notFound: MessageKey;
}

function writeFailure(error: PostgrestError, fallback: MessageKey, messages: EntityMessages): WriteResult {
  if (error.code === INVALID_TEXT) {
    return { ok: false, message: messages.notFound };
  }
  if (error.code === CHECK_VIOLATION) {
    return { ok: false, message: OUT_OF_RANGE };
  }
  return { ok: false, message: fallback };
}

function affected(
  data: unknown[] | null,
  error: PostgrestError | null,
  fallback: MessageKey,
  messages: EntityMessages,
): WriteResult {
  if (error) {
    return writeFailure(error, fallback, messages);
  }
  if (!data || data.length === 0) {
    return { ok: false, message: messages.notFound };
  }
  return { ok: true };
}

// sites -----------------------------------------------------------------------------------------

type SiteRow = Tables<"sites">;

const SITE_MESSAGES: EntityMessages = {
  loadFailed: "errors.load.sites",
  saveFailed: "errors.save.site",
  deleteFailed: "errors.delete.site",
  notFound: "errors.notFound.site",
};

function toSiteRecord(row: SiteRow): SiteRecord {
  return {
    id: row.id,
    name: row.name,
    latitudeDeg: row.latitude_deg,
    longitudeDeg: row.longitude_deg,
    bortle: row.bortle,
    minAltitudeDeg: row.min_altitude_deg,
    timeZone: row.time_zone,
    timeZoneSource: row.time_zone_source === "manual" ? "manual" : "auto",
    createdAt: row.created_at,
  };
}

/** Returns `null` when the zone cannot be resolved (tz-lookup throws on out-of-range coordinates). */
function toSiteColumns(input: SiteInput) {
  let zone: TimeZoneResolution;
  try {
    zone = resolveTimeZone({
      mode: input.timeZoneMode,
      timeZone: input.timeZone,
      latitudeDeg: input.latitudeDeg,
      longitudeDeg: input.longitudeDeg,
    });
  } catch {
    return null;
  }
  return {
    name: input.name,
    latitude_deg: input.latitudeDeg,
    longitude_deg: input.longitudeDeg,
    bortle: input.bortle,
    min_altitude_deg: input.minAltitudeDeg,
    time_zone: zone.timeZone,
    time_zone_source: zone.source,
  };
}

/** Hands a stored site to the sky engine (S-02). */
export function toEngineSite(site: Pick<SiteRecord, "latitudeDeg" | "longitudeDeg" | "timeZone">): Site {
  return { latitudeDeg: site.latitudeDeg, longitudeDeg: site.longitudeDeg, timeZone: site.timeZone };
}

export const siteStore = {
  async list(client: TypedSupabaseClient): Promise<SiteRecord[]> {
    const { data, error } = await client.from("sites").select("*").order("created_at", { ascending: true });
    if (error) {
      throw new Error(SITE_MESSAGES.loadFailed);
    }
    return data.map(toSiteRecord);
  },

  async get(client: TypedSupabaseClient, id: string): Promise<SiteRecord | null> {
    const { data, error } = await client.from("sites").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (error.code === INVALID_TEXT) {
        return null;
      }
      throw new Error(SITE_MESSAGES.loadFailed);
    }
    return data ? toSiteRecord(data) : null;
  },

  async create(client: TypedSupabaseClient, input: SiteInput): Promise<WriteResult> {
    const columns = toSiteColumns(input);
    if (!columns) {
      return { ok: false, message: SITE_MESSAGES.saveFailed };
    }
    const { error } = await client.from("sites").insert(columns);
    return error ? writeFailure(error, SITE_MESSAGES.saveFailed, SITE_MESSAGES) : { ok: true };
  },

  async update(client: TypedSupabaseClient, id: string, input: SiteInput): Promise<WriteResult> {
    const columns = toSiteColumns(input);
    if (!columns) {
      return { ok: false, message: SITE_MESSAGES.saveFailed };
    }
    const { data, error } = await client.from("sites").update(columns).eq("id", id).select("id");
    return affected(data, error, SITE_MESSAGES.saveFailed, SITE_MESSAGES);
  },

  async remove(client: TypedSupabaseClient, id: string): Promise<WriteResult> {
    const { data, error } = await client.from("sites").delete().eq("id", id).select("id");
    return affected(data, error, SITE_MESSAGES.deleteFailed, SITE_MESSAGES);
  },
};

// telescopes ------------------------------------------------------------------------------------

type TelescopeRow = Tables<"telescopes">;

const TELESCOPE_MESSAGES: EntityMessages = {
  loadFailed: "errors.load.telescopes",
  saveFailed: "errors.save.telescope",
  deleteFailed: "errors.delete.telescope",
  notFound: "errors.notFound.telescope",
};

function toTelescopeRecord(row: TelescopeRow): TelescopeRecord {
  return {
    id: row.id,
    name: row.name,
    apertureMm: row.aperture_mm,
    focalLengthMm: row.focal_length_mm,
    createdAt: row.created_at,
  };
}

function toTelescopeColumns(input: TelescopeInput) {
  return { name: input.name, aperture_mm: input.apertureMm, focal_length_mm: input.focalLengthMm };
}

export const telescopeStore = {
  async list(client: TypedSupabaseClient): Promise<TelescopeRecord[]> {
    const { data, error } = await client.from("telescopes").select("*").order("created_at", { ascending: true });
    if (error) {
      throw new Error(TELESCOPE_MESSAGES.loadFailed);
    }
    return data.map(toTelescopeRecord);
  },

  async get(client: TypedSupabaseClient, id: string): Promise<TelescopeRecord | null> {
    const { data, error } = await client.from("telescopes").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (error.code === INVALID_TEXT) {
        return null;
      }
      throw new Error(TELESCOPE_MESSAGES.loadFailed);
    }
    return data ? toTelescopeRecord(data) : null;
  },

  async create(client: TypedSupabaseClient, input: TelescopeInput): Promise<WriteResult> {
    const { error } = await client.from("telescopes").insert(toTelescopeColumns(input));
    return error ? writeFailure(error, TELESCOPE_MESSAGES.saveFailed, TELESCOPE_MESSAGES) : { ok: true };
  },

  async update(client: TypedSupabaseClient, id: string, input: TelescopeInput): Promise<WriteResult> {
    const { data, error } = await client.from("telescopes").update(toTelescopeColumns(input)).eq("id", id).select("id");
    return affected(data, error, TELESCOPE_MESSAGES.saveFailed, TELESCOPE_MESSAGES);
  },

  async remove(client: TypedSupabaseClient, id: string): Promise<WriteResult> {
    const { data, error } = await client.from("telescopes").delete().eq("id", id).select("id");
    return affected(data, error, TELESCOPE_MESSAGES.deleteFailed, TELESCOPE_MESSAGES);
  },
};

// eyepieces -------------------------------------------------------------------------------------

type EyepieceRow = Tables<"eyepieces">;

const EYEPIECE_MESSAGES: EntityMessages = {
  loadFailed: "errors.load.eyepieces",
  saveFailed: "errors.save.eyepiece",
  deleteFailed: "errors.delete.eyepiece",
  notFound: "errors.notFound.eyepiece",
};

function toEyepieceRecord(row: EyepieceRow): EyepieceRecord {
  return {
    id: row.id,
    name: row.name,
    focalLengthMm: row.focal_length_mm,
    afovDeg: row.afov_deg,
    createdAt: row.created_at,
  };
}

function toEyepieceColumns(input: EyepieceInput) {
  return { name: input.name, focal_length_mm: input.focalLengthMm, afov_deg: input.afovDeg };
}

export const eyepieceStore = {
  async list(client: TypedSupabaseClient): Promise<EyepieceRecord[]> {
    const { data, error } = await client.from("eyepieces").select("*").order("created_at", { ascending: true });
    if (error) {
      throw new Error(EYEPIECE_MESSAGES.loadFailed);
    }
    return data.map(toEyepieceRecord);
  },

  async get(client: TypedSupabaseClient, id: string): Promise<EyepieceRecord | null> {
    const { data, error } = await client.from("eyepieces").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (error.code === INVALID_TEXT) {
        return null;
      }
      throw new Error(EYEPIECE_MESSAGES.loadFailed);
    }
    return data ? toEyepieceRecord(data) : null;
  },

  async create(client: TypedSupabaseClient, input: EyepieceInput): Promise<WriteResult> {
    const { error } = await client.from("eyepieces").insert(toEyepieceColumns(input));
    return error ? writeFailure(error, EYEPIECE_MESSAGES.saveFailed, EYEPIECE_MESSAGES) : { ok: true };
  },

  async update(client: TypedSupabaseClient, id: string, input: EyepieceInput): Promise<WriteResult> {
    const { data, error } = await client.from("eyepieces").update(toEyepieceColumns(input)).eq("id", id).select("id");
    return affected(data, error, EYEPIECE_MESSAGES.saveFailed, EYEPIECE_MESSAGES);
  },

  async remove(client: TypedSupabaseClient, id: string): Promise<WriteResult> {
    const { data, error } = await client.from("eyepieces").delete().eq("id", id).select("id");
    return affected(data, error, EYEPIECE_MESSAGES.deleteFailed, EYEPIECE_MESSAGES);
  },
};
