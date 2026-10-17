/**
 * Observing milestones (roadmap M-3 S-06, observing-milestones) beyond plain per-user isolation, verified outside
 * the UI through the same PostgREST + RLS path the app uses:
 *
 * - `milestoneStore.record` stores each milestone once per user: a second record of a key returns nothing and
 *   keeps the first `reached_night` (the once-only insert the celebration relies on);
 * - the key check accepts every key in `MILESTONES` and refuses anything else with `23514`, so the SQL list and
 *   the TypeScript set stay in step;
 * - the accepted self-only direct write is pinned: an owner can insert a milestone row directly, and it is theirs
 *   alone;
 * - one user's record never touches another's rows.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { milestoneStore } from "@/lib/observations/milestone-store";
import { MILESTONES } from "@/lib/progress/milestones";

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

function newClient(fetchImpl?: typeof fetch): Client {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
  });
}

async function signUp(label: string, fetchImpl?: typeof fetch): Promise<{ client: Client; userId: string }> {
  const client = newClient(fetchImpl);
  const email = `milestones-${label}-${Date.now()}-${crypto.randomUUID()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: `pw-${crypto.randomUUID()}` });
  if (error) throw new Error(`sign-up for user ${label} failed: ${error.message}`);
  if (!data.session || !data.user) {
    throw new Error(`sign-up for user ${label} returned no session; email confirmation must be off locally`);
  }
  return { client, userId: data.user.id };
}

async function rows(client: Client) {
  const { data, error } = await client.from("observing_milestones").select("key, reached_night, user_id");
  expect(error).toBeNull();
  return data ?? [];
}

describe("observing milestones", () => {
  let a: { client: Client; userId: string };
  let b: { client: Client; userId: string };

  // Fresh users per test: the unique key is per user, so each test starts from an empty table for both.
  beforeEach(async () => {
    a = await signUp("a");
    b = await signUp("b");
  });

  it("stores new keys and returns them, then returns nothing for a key already stored", async () => {
    expect(await milestoneStore.record(a.client, [{ key: "first-moon", reachedNight: "2026-09-26" }])).toEqual([
      "first-moon",
    ]);

    // The same key again, with a later night, plus one new key: only the new one is inserted and returned.
    expect(
      await milestoneStore.record(a.client, [
        { key: "first-moon", reachedNight: "2026-10-01" },
        { key: "first-planet", reachedNight: "2026-10-01" },
      ]),
    ).toEqual(["first-planet"]);

    expect(await milestoneStore.record(a.client, [{ key: "first-moon", reachedNight: "2026-10-02" }])).toEqual([]);

    // The first reached night stays, and each key is stored once.
    expect(await milestoneStore.listReached(a.client)).toEqual(
      new Map([
        ["first-moon", "2026-09-26"],
        ["first-planet", "2026-10-01"],
      ]),
    );
    expect(await rows(a.client)).toHaveLength(2);
  });

  it("gives a milestone to exactly one of two records at the same moment (two saves can't both celebrate)", async () => {
    const results = await Promise.all([
      milestoneStore.record(a.client, [{ key: "first-moon", reachedNight: "2026-09-26" }]),
      milestoneStore.record(a.client, [{ key: "first-moon", reachedNight: "2026-09-27" }]),
    ]);
    expect(results.filter((keys) => keys.includes("first-moon"))).toHaveLength(1);
    expect(results.filter((keys) => keys.length === 0)).toHaveLength(1);
    expect(await rows(a.client)).toHaveLength(1);
  });

  it("accepts every milestone key and lists them all", async () => {
    const inserted = await milestoneStore.record(
      a.client,
      MILESTONES.map((milestone) => ({ key: milestone.key, reachedNight: "2026-09-26" })),
    );
    expect([...inserted].sort()).toEqual(MILESTONES.map((milestone) => milestone.key).sort());

    const listed = await milestoneStore.listReached(a.client);
    // The database's collation decides the list's order, so compare the set, not the sequence.
    expect([...listed.keys()].sort()).toEqual(MILESTONES.map((milestone) => milestone.key).sort());
  });

  it("refuses a key outside the set with a check violation", async () => {
    // Direct insert: the store's type already forbids an unknown key, and the check is what guards the table.
    const { error } = await a.client
      .from("observing_milestones")
      .insert({ key: "first-comet", reached_night: "2026-09-26" });
    expect(error?.code).toBe("23514");
    expect(await rows(a.client)).toEqual([]);
  });

  // Accepted, pinned (observing-milestones plan, "Self-only writes", owner decision of 2026-10-13 following the
  // 2026-10-09 acceptance for sky_checks and observations): RLS lets an owner write their own milestone rows
  // directly, so a user can give themselves a milestone. It fools only its author: B never sees it. If this
  // is ever hardened, change this test on purpose.
  it("lets the owner insert a milestone row directly, and it is the owner's alone", async () => {
    const { data, error } = await a.client
      .from("observing_milestones")
      .insert({ key: "messier-110", reached_night: "2026-09-26" })
      .select("key, reached_night, user_id")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ key: "messier-110", reached_night: "2026-09-26", user_id: a.userId });

    expect(await milestoneStore.listReached(a.client)).toEqual(new Map([["messier-110", "2026-09-26"]]));
    expect(await rows(b.client)).toEqual([]);
    expect(await milestoneStore.listReached(b.client)).toEqual(new Map());
  });

  it("never lets one user's record touch another's rows", async () => {
    expect(await milestoneStore.record(a.client, [{ key: "first-moon", reachedNight: "2026-09-26" }])).toEqual([
      "first-moon",
    ]);

    // B records the same key (a different user, so it is inserted: A's row does not count) and another one.
    expect(
      await milestoneStore.record(b.client, [
        { key: "first-moon", reachedNight: "2026-10-05" },
        { key: "first-galaxy", reachedNight: "2026-10-05" },
      ]),
    ).toEqual(["first-moon", "first-galaxy"]);

    expect(await milestoneStore.listReached(a.client)).toEqual(new Map([["first-moon", "2026-09-26"]]));
    expect(await milestoneStore.listReached(b.client)).toEqual(
      new Map([
        ["first-galaxy", "2026-10-05"],
        ["first-moon", "2026-10-05"],
      ]),
    );
  });
});
