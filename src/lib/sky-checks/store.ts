import type { MessageKey } from "@/i18n";
import type { Tables } from "@/lib/database.types";
import type { WriteResult } from "@/lib/gear/store";
import type { TypedSupabaseClient } from "@/lib/supabase";
import { CHECKABLE_HEADLINES, type RecordedHeadline, type SkyAnswer, type TallyRow } from "./claim";

/**
 * The sky checks' data layer (roadmap M-2 S-07, verdict-check). Follows `@/lib/gear/store.ts`'s privacy rules:
 * database error text never leaves this module, writes return a fixed, value-free message key (`@/i18n`), reads
 * throw an `Error` whose message is such a key, and this module never logs.
 *
 * Which headline a night keeps is decided in the database (`record_sky_verdict`), by the database clock, so every
 * render of Tonight agrees. A night can be answered only once its dark window has started: before that the row is
 * left out of the list and reads as not found, so nobody is asked about a night that has not happened.
 */

const SAVE_FAILED: MessageKey = "errors.save.skyCheck";
const LOAD_FAILED: MessageKey = "errors.load.skyChecks";
const NOT_FOUND: MessageKey = "errors.notFound.skyCheck";

/** Postgres `invalid_text_representation`: a malformed uuid in the id filter. Treated as "not found". */
const INVALID_TEXT = "22P02";

/** Nights per page of the sky checks list. Far below PostgREST's `max_rows`, so no page is ever cut short. */
export const SKY_CHECKS_PAGE_SIZE = 50;

/** One recorded night. A `null` site id means the site has been deleted; the name snapshot remains. */
export interface SkyCheckRecord {
  id: string;
  siteId: string | null;
  siteName: string;
  night: string;
  headline: RecordedHeadline;
  answer: SkyAnswer | null;
  skipped: boolean;
}

/** The columns' check constraints are the headline and answer vocabularies, so stored values are always ids. */
function toSkyCheckRecord(row: Tables<"sky_checks">): SkyCheckRecord {
  return {
    id: row.id,
    siteId: row.site_id,
    siteName: row.site_name,
    night: row.night,
    headline: row.headline as RecordedHeadline,
    answer: row.answer as SkyAnswer | null,
    skipped: row.skipped_at !== null,
  };
}

export const skyCheckStore = {
  /**
   * Records the headline Tonight showed for the caller's site and night. Before `darkStart` a later view overwrites
   * it; after that the first record stands; an answered night never changes. A site that is not the caller's is
   * silently skipped by the function.
   */
  async record(
    client: TypedSupabaseClient,
    input: { siteId: string; night: string; headline: RecordedHeadline; darkStart: Date },
  ): Promise<WriteResult> {
    const { error } = await client.rpc("record_sky_verdict", {
      site_id: input.siteId,
      night: input.night,
      headline: input.headline,
      dark_start: input.darkStart.toISOString(),
    });
    return error ? { ok: false, message: SAVE_FAILED } : { ok: true };
  },

  /**
   * The caller's unanswered, unskipped, checkable nights from `sinceNight` on, newest first: the candidates for
   * Tonight's question. Narrowed to a few recent nights, so it stays a handful of rows.
   */
  async openRecent(client: TypedSupabaseClient, { sinceNight }: { sinceNight: string }): Promise<SkyCheckRecord[]> {
    const { data, error } = await client
      .from("sky_checks")
      .select("*")
      .gte("night", sinceNight)
      .is("answer", null)
      .is("skipped_at", null)
      .in("headline", CHECKABLE_HEADLINES)
      .order("night", { ascending: false })
      .order("id", { ascending: true });
    if (error) {
      throw new Error(LOAD_FAILED);
    }
    return data.map(toSkyCheckRecord);
  },

  /** Saves (or changes) the answer for one of the caller's nights whose dark window has started. Clears a skip. */
  async answer(client: TypedSupabaseClient, id: string, answer: SkyAnswer, now: Date): Promise<WriteResult> {
    const at = now.toISOString();
    const { data, error } = await client
      .from("sky_checks")
      .update({ answer, answered_at: at, skipped_at: null })
      .eq("id", id)
      .lt("dark_start", at)
      .select("id");
    if (error) {
      return { ok: false, message: error.code === INVALID_TEXT ? NOT_FOUND : SAVE_FAILED };
    }
    return data.length > 0 ? { ok: true } : { ok: false, message: NOT_FOUND };
  },

  /** Hides one of the caller's nights from Tonight's question. It stays answerable on the sky checks page. */
  async skip(client: TypedSupabaseClient, id: string, now: Date): Promise<WriteResult> {
    const at = now.toISOString();
    const { data, error } = await client
      .from("sky_checks")
      .update({ skipped_at: at })
      .eq("id", id)
      .lt("dark_start", at)
      .select("id");
    if (error) {
      return { ok: false, message: error.code === INVALID_TEXT ? NOT_FOUND : SAVE_FAILED };
    }
    return data.length > 0 ? { ok: true } : { ok: false, message: NOT_FOUND };
  },

  /**
   * One page of the caller's checkable nights whose dark window has started, newest night first, then by site name;
   * the id makes the order total, so paging is deterministic. Reads one row beyond the page to tell whether older
   * nights exist.
   */
  async list(
    client: TypedSupabaseClient,
    { page, now }: { page: number; now: Date },
  ): Promise<{ entries: SkyCheckRecord[]; hasOlder: boolean }> {
    const offset = (Math.max(1, Math.floor(page)) - 1) * SKY_CHECKS_PAGE_SIZE;
    const { data, error } = await client
      .from("sky_checks")
      .select("*")
      .in("headline", CHECKABLE_HEADLINES)
      .lt("dark_start", now.toISOString())
      .order("night", { ascending: false })
      .order("site_name", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + SKY_CHECKS_PAGE_SIZE);
    if (error) {
      throw new Error(LOAD_FAILED);
    }
    return {
      entries: data.slice(0, SKY_CHECKS_PAGE_SIZE).map(toSkyCheckRecord),
      hasOlder: data.length > SKY_CHECKS_PAGE_SIZE,
    };
  },

  /** The caller's answered nights grouped by headline and answer, counted in the database (`sky_check_tally`). */
  async tally(client: TypedSupabaseClient): Promise<TallyRow[]> {
    const { data, error } = await client.rpc("sky_check_tally");
    if (error) {
      throw new Error(LOAD_FAILED);
    }
    return data;
  },
};
