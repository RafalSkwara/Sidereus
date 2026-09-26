/**
 * The observation log (roadmap S-06) beyond plain per-user isolation, verified outside the UI through the
 * same PostgREST + RLS path the app uses:
 *
 * - an entry can only reference the caller's own site and telescope (a foreign key check alone skips RLS);
 * - an entry outlives the deletion of its site or telescope, keeping the name snapshot (PRD FR-021);
 * - `observationStore` refuses a night later than the chosen site's current observing night and gear the
 *   caller does not own, snapshots gear names, and lists only the caller's entries for the ranking.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database, TablesInsert } from "@/lib/database.types";
import { observationStore } from "@/lib/observations/store";

type Client = SupabaseClient<Database>;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "tests/db needs SUPABASE_URL and SUPABASE_KEY (the anon/publishable key) of a running Supabase. " +
      "Locally: `npx supabase start`, then take API_URL and ANON_KEY from `npx supabase status -o env`.",
  );
}

const url: string = SUPABASE_URL;
const key: string = SUPABASE_KEY;

function newClient(): Client {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signUp(label: string): Promise<{ client: Client; userId: string }> {
  const client = newClient();
  const email = `observations-${label}-${Date.now()}-${crypto.randomUUID()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: `pw-${crypto.randomUUID()}` });
  if (error) throw new Error(`sign-up for user ${label} failed: ${error.message}`);
  if (!data.session || !data.user) {
    throw new Error(`sign-up for user ${label} returned no session; email confirmation must be off locally`);
  }
  return { client, userId: data.user.id };
}

interface Gear {
  siteId: string;
  telescopeId: string;
}

async function addGear(client: Client, siteName = "Home", telescopeName = "Dobsonian 8in"): Promise<Gear> {
  const site = await client
    .from("sites")
    .insert({
      name: siteName,
      latitude_deg: 52.23,
      longitude_deg: 21.01,
      bortle: 6,
      min_altitude_deg: 15,
      time_zone: "Europe/Warsaw",
      time_zone_source: "auto",
    })
    .select("id")
    .single();
  const telescope = await client
    .from("telescopes")
    .insert({ name: telescopeName, aperture_mm: 203, focal_length_mm: 1200 })
    .select("id")
    .single();
  if (!site.data || !telescope.data) throw new Error("could not create gear");
  return { siteId: site.data.id, telescopeId: telescope.data.id };
}

function entry(gear: Partial<Gear>): TablesInsert<"observations"> {
  return {
    messier: 13,
    night: "2026-09-26",
    rating: 4,
    site_id: gear.siteId ?? null,
    telescope_id: gear.telescopeId ?? null,
    site_name: "Home",
    telescope_name: "Dobsonian 8in",
  };
}

/** 22:00 in Warsaw on 26 September 2026: the observing night of 2026-09-26. */
const NOW = new Date("2026-09-26T20:00:00Z");

let a: { client: Client; userId: string };
let b: { client: Client; userId: string };
let gearA: Gear;
let gearB: Gear;

beforeAll(async () => {
  a = await signUp("a");
  b = await signUp("b");
  gearA = await addGear(a.client);
  gearB = await addGear(b.client);
});

describe("observations reference only the caller's gear", () => {
  it("the owner can reference its own site and telescope (positive control)", async () => {
    const { error } = await a.client.from("observations").insert(entry(gearA));
    expect(error).toBeNull();
  });

  it("another user cannot insert an entry pointing at the first user's site", async () => {
    const { error } = await b.client.from("observations").insert(entry({ siteId: gearA.siteId }));
    expect(error).not.toBeNull();
  });

  it("another user cannot insert an entry pointing at the first user's telescope", async () => {
    const { error } = await b.client.from("observations").insert(entry({ telescopeId: gearA.telescopeId }));
    expect(error).not.toBeNull();
  });

  it("another user cannot repoint its own entry at the first user's site", async () => {
    const own = await b.client.from("observations").insert(entry(gearB)).select("id").single();
    expect(own.error).toBeNull();
    if (!own.data) throw new Error("B could not insert");

    const { error } = await b.client.from("observations").update({ site_id: gearA.siteId }).eq("id", own.data.id);
    expect(error).not.toBeNull();
  });
});

describe("an entry outlives its gear", () => {
  it("deleting the site keeps the entry with a null site and the name snapshot", async () => {
    const gear = await addGear(a.client, "Dark site", "Travel refractor");
    const inserted = await a.client
      .from("observations")
      .insert({ ...entry(gear), site_name: "Dark site", telescope_name: "Travel refractor" })
      .select("id")
      .single();
    if (!inserted.data) throw new Error("A could not insert");

    expect((await a.client.from("sites").delete().eq("id", gear.siteId)).error).toBeNull();
    expect((await a.client.from("telescopes").delete().eq("id", gear.telescopeId)).error).toBeNull();

    const { data } = await a.client
      .from("observations")
      .select("site_id, telescope_id, site_name, telescope_name")
      .eq("id", inserted.data.id);
    expect(data).toEqual([
      { site_id: null, telescope_id: null, site_name: "Dark site", telescope_name: "Travel refractor" },
    ]);
  });
});

describe("observationStore", () => {
  it("saves an entry with the gear names snapshotted", async () => {
    const gear = await addGear(a.client, "Allotment", "Mak 127");
    const result = await observationStore.create(
      a.client,
      { messier: 31, night: "2026-09-26", rating: 5, ...gear },
      NOW,
    );
    expect(result).toEqual({ ok: true });

    const { data } = await a.client
      .from("observations")
      .select("messier, night, rating, site_id, telescope_id, site_name, telescope_name")
      .eq("site_id", gear.siteId);
    expect(data).toEqual([
      {
        messier: 31,
        night: "2026-09-26",
        rating: 5,
        site_id: gear.siteId,
        telescope_id: gear.telescopeId,
        site_name: "Allotment",
        telescope_name: "Mak 127",
      },
    ]);
  });

  it("refuses a night later than the site's current observing night", async () => {
    const result = await observationStore.create(
      a.client,
      { messier: 31, night: "2026-09-27", rating: 5, ...gearA },
      NOW,
    );
    expect(result).toEqual({ ok: false, message: "errors.observation.nightInFuture" });
  });

  it("accepts the current observing night after local midnight", async () => {
    // 01:30 in Warsaw on 27 September still belongs to the night of 26 September.
    const result = await observationStore.create(
      a.client,
      { messier: 57, night: "2026-09-26", rating: 3, ...gearA },
      new Date("2026-09-26T23:30:00Z"),
    );
    expect(result).toEqual({ ok: true });
  });

  it("refuses gear the caller does not own", async () => {
    const result = await observationStore.create(
      b.client,
      { messier: 31, night: "2026-09-26", rating: 5, siteId: gearA.siteId, telescopeId: gearB.telescopeId },
      NOW,
    );
    expect(result).toEqual({ ok: false, message: "errors.observation.gearNotFound" });
  });

  it("lists only the caller's entries, as the ranking needs them", async () => {
    const fresh = await signUp("list");
    const gear = await addGear(fresh.client);
    await observationStore.create(fresh.client, { messier: 42, night: "2026-09-20", rating: 2, ...gear }, NOW);
    await observationStore.create(fresh.client, { messier: 13, night: "2026-09-25", rating: 4, ...gear }, NOW);

    const entries = await observationStore.listForRanking(fresh.client);
    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        { messier: 42, night: "2026-09-20", rating: 2 },
        { messier: 13, night: "2026-09-25", rating: 4 },
      ]),
    );
  });
});
