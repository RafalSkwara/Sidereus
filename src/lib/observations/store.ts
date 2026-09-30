import type { MessageKey } from "@/i18n";
import type { Tables } from "@/lib/database.types";
import { LOG_PENALTY_MIN_RATING } from "@/lib/engine";
import { siteStore, telescopeStore, type SiteRecord, type WriteResult } from "@/lib/gear/store";
import { tonightDateForSite } from "@/lib/tonight/tonight-date";
import type { TypedSupabaseClient } from "@/lib/supabase";
import type { ObservationInput, ObservationUpdateInput } from "./schemas";

/**
 * The observation log's data layer (roadmap S-06). Follows `@/lib/gear/store.ts`'s privacy rules:
 * database error text never leaves this module, writes return a fixed, value-free message key
 * (`@/i18n`), reads throw an `Error` whose message is such a key, and this module never logs.
 *
 * The chosen site and telescope are read through RLS before inserting: that proves they are the
 * caller's (the table's policies check it again), supplies the name snapshots that keep an entry
 * readable after its gear is deleted (FR-021), and gives the site's time zone for the night check.
 */

const SAVE_FAILED: MessageKey = "errors.save.observation";
const LOAD_FAILED: MessageKey = "errors.load.observations";
const GEAR_NOT_FOUND: MessageKey = "errors.observation.gearNotFound";
const NIGHT_IN_FUTURE: MessageKey = "errors.observation.nightInFuture";
const SITE_REQUIRED: MessageKey = "errors.observation.siteRequired";
const TELESCOPE_REQUIRED: MessageKey = "errors.observation.telescopeRequired";
const NOT_FOUND: MessageKey = "errors.notFound.observation";
const DELETE_FAILED: MessageKey = "errors.delete.observation";

/** Postgres `invalid_text_representation`: a malformed uuid in the id filter. Treated as "not found". */
const INVALID_TEXT = "22P02";

/**
 * A log entry as the ranking reads it (`listForRanking`). Still keyed by Messier number: Tonight maps it
 * to the engine's target-keyed `LogEntry` until the log itself stores target keys.
 */
export interface RankingLogEntry {
  messier: number;
  night: string;
  rating: number;
}

/** Entries per page of the log (S-07). Far below PostgREST's `max_rows`, so no page is ever cut short. */
export const LOG_PAGE_SIZE = 50;

/** One log entry as the log pages show it. A `null` gear id means that site or telescope has been deleted. */
export interface ObservationRecord {
  id: string;
  messier: number;
  night: string;
  rating: number;
  siteId: string | null;
  telescopeId: string | null;
  siteName: string;
  telescopeName: string;
  createdAt: string;
}

export type DeleteResult = { ok: true; messier: number } | { ok: false; message: MessageKey };

function toObservationRecord(row: Tables<"observations">): ObservationRecord {
  return {
    id: row.id,
    messier: row.messier,
    night: row.night,
    rating: row.rating,
    siteId: row.site_id,
    telescopeId: row.telescope_id,
    siteName: row.site_name,
    telescopeName: row.telescope_name,
    createdAt: row.created_at,
  };
}

/** Today's calendar date at UTC+14, the latest date anywhere on Earth: no real observing night can be later. */
function latestDateOnEarth(now: Date): string {
  // en-CA formats a date as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Etc/GMT-14" }).format(now);
}

/**
 * The latest night an entry kept on a deleted site may have (S-07). Its time zone is gone with the site, so the
 * bound is the latest night Tonight shows for any of the user's current sites, or the latest date on Earth when
 * they have none. ISO dates compare correctly as strings.
 */
export function latestNightBound(
  sites: readonly Pick<SiteRecord, "latitudeDeg" | "longitudeDeg" | "timeZone" | "bortle">[],
  now: Date,
): string {
  if (sites.length === 0) {
    return latestDateOnEarth(now);
  }
  return sites.map((site) => tonightDateForSite(site, now)).reduce((a, b) => (b > a ? b : a));
}

export const observationStore = {
  /**
   * Saves one entry. `now` decides the latest night allowed: the night Tonight shows for the chosen site
   * (`tonightDateForSite`), so an entry made after midnight still belongs to the evening before, and one made
   * from the morning's ranking (already the evening ahead) is accepted.
   */
  async create(client: TypedSupabaseClient, input: ObservationInput, now: Date): Promise<WriteResult> {
    let site;
    let telescope;
    try {
      [site, telescope] = await Promise.all([
        siteStore.get(client, input.siteId),
        telescopeStore.get(client, input.telescopeId),
      ]);
    } catch {
      return { ok: false, message: SAVE_FAILED };
    }
    if (!site || !telescope) {
      return { ok: false, message: GEAR_NOT_FOUND };
    }
    // ISO dates compare correctly as strings.
    if (input.night > tonightDateForSite(site, now)) {
      return { ok: false, message: NIGHT_IN_FUTURE };
    }
    const { error } = await client.from("observations").insert({
      messier: input.messier,
      night: input.night,
      rating: input.rating,
      site_id: site.id,
      telescope_id: telescope.id,
      site_name: site.name,
      telescope_name: telescope.name,
    });
    return error ? { ok: false, message: SAVE_FAILED } : { ok: true };
  },

  /**
   * One page of the caller's log (S-07), newest night first, then newest entry; the id makes the order total, so
   * paging is deterministic. Reads one row beyond the page to tell whether older entries exist.
   */
  async list(
    client: TypedSupabaseClient,
    { page }: { page: number },
  ): Promise<{ entries: ObservationRecord[]; hasOlder: boolean }> {
    const offset = (Math.max(1, Math.floor(page)) - 1) * LOG_PAGE_SIZE;
    const { data, error } = await client
      .from("observations")
      .select("*")
      .order("night", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + LOG_PAGE_SIZE);
    if (error) {
      throw new Error(LOAD_FAILED);
    }
    return { entries: data.slice(0, LOG_PAGE_SIZE).map(toObservationRecord), hasOlder: data.length > LOG_PAGE_SIZE };
  },

  /** One of the caller's entries; another user's entry and a malformed id both read as `null` (RLS). */
  async get(client: TypedSupabaseClient, id: string): Promise<ObservationRecord | null> {
    const { data, error } = await client.from("observations").select("*").eq("id", id).maybeSingle();
    if (error) {
      if (error.code === INVALID_TEXT) {
        return null;
      }
      throw new Error(LOAD_FAILED);
    }
    return data ? toObservationRecord(data) : null;
  },

  /**
   * Edits one entry (S-07, FR-017). A `null` site or telescope keeps the entry's deleted one, which is allowed only
   * when the entry's reference is already `null`: an edit never detaches live gear. Chosen live gear is read through
   * RLS (proving it is the caller's) and its current name snapshotted; a kept deleted one keeps its old snapshot.
   * The night may not be later than Tonight's night for the chosen site, or `latestNightBound` for a deleted one.
   */
  async update(
    client: TypedSupabaseClient,
    id: string,
    input: ObservationUpdateInput,
    now: Date,
  ): Promise<WriteResult> {
    let existing;
    let site;
    let telescope;
    try {
      [existing, site, telescope] = await Promise.all([
        observationStore.get(client, id),
        input.siteId ? siteStore.get(client, input.siteId) : null,
        input.telescopeId ? telescopeStore.get(client, input.telescopeId) : null,
      ]);
    } catch {
      return { ok: false, message: SAVE_FAILED };
    }
    if (!existing) {
      return { ok: false, message: NOT_FOUND };
    }
    if (!input.siteId && existing.siteId) {
      return { ok: false, message: SITE_REQUIRED };
    }
    if (!input.telescopeId && existing.telescopeId) {
      return { ok: false, message: TELESCOPE_REQUIRED };
    }
    if ((input.siteId && !site) || (input.telescopeId && !telescope)) {
      return { ok: false, message: GEAR_NOT_FOUND };
    }

    let latestNight;
    try {
      latestNight = site ? tonightDateForSite(site, now) : latestNightBound(await siteStore.list(client), now);
    } catch {
      return { ok: false, message: SAVE_FAILED };
    }
    // ISO dates compare correctly as strings.
    if (input.night > latestNight) {
      return { ok: false, message: NIGHT_IN_FUTURE };
    }

    const { data, error } = await client
      .from("observations")
      .update({
        messier: input.messier,
        night: input.night,
        rating: input.rating,
        site_id: site?.id ?? null,
        telescope_id: telescope?.id ?? null,
        ...(site ? { site_name: site.name } : {}),
        ...(telescope ? { telescope_name: telescope.name } : {}),
      })
      .eq("id", id)
      .select("id");
    if (error) {
      return { ok: false, message: SAVE_FAILED };
    }
    return data.length > 0 ? { ok: true } : { ok: false, message: NOT_FOUND };
  },

  /** Deletes one entry and names its object for the log's notice. Another user's entry reads as not found. */
  async remove(client: TypedSupabaseClient, id: string): Promise<DeleteResult> {
    const { data, error } = await client.from("observations").delete().eq("id", id).select("messier");
    if (error) {
      return { ok: false, message: error.code === INVALID_TEXT ? NOT_FOUND : DELETE_FAILED };
    }
    const deleted = data.at(0);
    return deleted ? { ok: true, messier: deleted.messier } : { ok: false, message: NOT_FOUND };
  },

  /**
   * The caller's entries that can count as seen (rated `LOG_PENALTY_MIN_RATING` or above; lower ones
   * never affect the ranking), newest night first, reduced to what the ranking needs. The order makes
   * any cut by PostgREST's `max_rows` deterministic: it drops only the oldest nights, which can
   * undercount "seen N times" but never removes an object's penalty.
   */
  async listForRanking(client: TypedSupabaseClient): Promise<RankingLogEntry[]> {
    const { data, error } = await client
      .from("observations")
      .select("messier, night, rating")
      .gte("rating", LOG_PENALTY_MIN_RATING)
      .order("night", { ascending: false })
      .order("messier", { ascending: true });
    if (error) {
      throw new Error(LOAD_FAILED);
    }
    return data;
  },
};
