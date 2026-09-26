import type { MessageKey } from "@/i18n";
import { LOG_PENALTY_MIN_RATING, observingNightDateFor, type LogEntry } from "@/lib/engine";
import { siteStore, telescopeStore, type WriteResult } from "@/lib/gear/store";
import type { TypedSupabaseClient } from "@/lib/supabase";
import type { ObservationInput } from "./schemas";

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

export const observationStore = {
  /**
   * Saves one entry. `now` decides the latest night allowed: the chosen site's current observing night
   * (local noon to noon), so an entry made after midnight still belongs to the evening before.
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
    if (input.night > observingNightDateFor(now, site.timeZone)) {
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
   * The caller's entries that can count as seen (rated `LOG_PENALTY_MIN_RATING` or above; lower ones
   * never affect the ranking), newest night first, reduced to what the ranking needs. The order makes
   * any cut by PostgREST's `max_rows` deterministic: it drops only the oldest nights, which can
   * undercount "seen N times" but never removes an object's penalty.
   */
  async listForRanking(client: TypedSupabaseClient): Promise<LogEntry[]> {
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
