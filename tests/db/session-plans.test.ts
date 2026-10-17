/**
 * Session plans (roadmap M-3 S-08, adjustable-session-plan) beyond plain per-user isolation, verified outside the
 * UI through the same PostgREST + RLS path the app uses. Each refusal comes with a positive control (the same
 * write the owner makes succeeds), because under RLS and a check constraint "nothing was written" alone would
 * also pass for a table that refuses everyone:
 *
 * - a user cannot put a plan on another user's site, by insert or by repointing an own row (`42501`), nor insert one
 *   on their own site under another user's id (`42501`, the user condition alone);
 * - the unique key (user, site, night) holds, and `sessionPlanStore.save` replaces the row;
 * - deleting a site deletes its plans (`on delete cascade`);
 * - the `targets` checks accept the closed target grammar and an empty list, and refuse an unknown key, an empty or
 *   comma-carrying or null element and more than 30 keys (`23514`).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { sessionPlanStore } from "@/lib/session-plans/store";

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
  const email = `session-plans-${label}-${Date.now()}-${crypto.randomUUID()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: `pw-${crypto.randomUUID()}` });
  if (error) throw new Error(`sign-up for user ${label} failed: ${error.message}`);
  if (!data.session || !data.user) {
    throw new Error(`sign-up for user ${label} returned no session; email confirmation must be off locally`);
  }
  return { client, userId: data.user.id };
}

async function addSite(client: Client, name = "Home"): Promise<string> {
  const { data } = await client
    .from("sites")
    .insert({
      name,
      latitude_deg: 52.23,
      longitude_deg: 21.01,
      bortle: 6,
      min_altitude_deg: 15,
      time_zone: "Europe/Warsaw",
      time_zone_source: "auto",
    })
    .select("id")
    .single();
  if (!data) throw new Error("could not create a site");
  return data.id;
}

async function plans(client: Client, siteId: string, night: string) {
  const { data, error } = await client
    .from("session_plans")
    .select("id, user_id, targets")
    .eq("site_id", siteId)
    .eq("night", night);
  expect(error).toBeNull();
  return data ?? [];
}

/** The check violation code. */
const CHECK_VIOLATION = "23514";
/** An RLS refusal (a new row failing a policy's WITH CHECK). */
const RLS_REFUSAL = "42501";
/** The unique violation code. */
const UNIQUE_VIOLATION = "23505";

let a: { client: Client; userId: string };
let b: { client: Client; userId: string };
let siteA: string;
let siteB: string;

beforeAll(async () => {
  a = await signUp("a");
  b = await signUp("b");
  siteA = await addSite(a.client, "Home");
  siteB = await addSite(b.client, "Allotment");
});

describe("the site guard", () => {
  it("does not let another user put a plan on the first user's site", async () => {
    // Positive control: each user plans on their own site.
    expect(
      (await a.client.from("session_plans").insert({ site_id: siteA, night: "2026-10-01", targets: ["M31"] })).error,
    ).toBeNull();
    expect(
      (await b.client.from("session_plans").insert({ site_id: siteB, night: "2026-10-01", targets: ["M31"] })).error,
    ).toBeNull();

    // B's own user_id (the column default) on A's site: the site guard refuses it.
    const { error } = await b.client
      .from("session_plans")
      .insert({ site_id: siteA, night: "2026-10-02", targets: ["M31"] });
    expect(error?.code).toBe(RLS_REFUSAL);
    expect(await plans(a.client, siteA, "2026-10-02")).toEqual([]);
  });

  it("does not let another user repoint its own plan at the first user's site", async () => {
    const own = await b.client
      .from("session_plans")
      .insert({ site_id: siteB, night: "2026-10-03", targets: ["M42"] })
      .select("id")
      .single();
    expect(own.error).toBeNull();
    if (!own.data) throw new Error("B could not insert a plan");

    // Positive control: B can change its own plan in place.
    expect(
      (
        await b.client
          .from("session_plans")
          .update({ targets: ["M13"] })
          .eq("id", own.data.id)
      ).error,
    ).toBeNull();

    // No .select(): RETURNING would apply the SELECT policy and mask a missing WITH CHECK.
    const { error } = await b.client.from("session_plans").update({ site_id: siteA }).eq("id", own.data.id);
    expect(error?.code).toBe(RLS_REFUSAL);
    expect(await plans(b.client, siteB, "2026-10-03")).toMatchObject([{ targets: ["M13"] }]);
    expect(await plans(a.client, siteA, "2026-10-03")).toEqual([]);
  });
});

describe("the user guard", () => {
  it("does not let another user insert a plan on its own site under the first user's id", async () => {
    // The one row that only the INSERT policy's user condition refuses: the site is B's own (so the site guard passes),
    // the `user_id` is A's. The generic isolation case cannot isolate it, since it sends A's site as well.
    // Positive control: the same insert under B's own user_id succeeds.
    expect(
      (
        await b.client
          .from("session_plans")
          .insert({ site_id: siteB, user_id: b.userId, night: "2026-10-09", targets: ["M31"] })
      ).error,
    ).toBeNull();

    // No .select(): RETURNING would apply the SELECT policy and could mask a missing WITH CHECK.
    const { error } = await b.client
      .from("session_plans")
      .insert({ site_id: siteB, user_id: a.userId, night: "2026-10-10", targets: ["M31"] });
    expect(error?.code).toBe(RLS_REFUSAL);

    // Nothing was planted: neither user has a row for that night.
    expect(await plans(b.client, siteB, "2026-10-10")).toEqual([]);
    expect(await plans(a.client, siteB, "2026-10-10")).toEqual([]);
  });
});

describe("the unique key", () => {
  it("allows one plan per user, site and night, and a second insert is refused", async () => {
    expect(
      (await a.client.from("session_plans").insert({ site_id: siteA, night: "2026-10-04", targets: ["M31"] })).error,
    ).toBeNull();
    const { error } = await a.client
      .from("session_plans")
      .insert({ site_id: siteA, night: "2026-10-04", targets: ["M42"] });
    expect(error?.code).toBe(UNIQUE_VIOLATION);
    expect(await plans(a.client, siteA, "2026-10-04")).toMatchObject([{ targets: ["M31"] }]);
  });

  it("replaces the row when the store saves the same night again, and a reset deletes it", async () => {
    expect(await sessionPlanStore.save(a.client, siteA, "2026-10-05", ["M31", "jupiter"])).toEqual({ ok: true });
    expect(await sessionPlanStore.get(a.client, siteA, "2026-10-05")).toEqual(["M31", "jupiter"]);
    const [first] = await plans(a.client, siteA, "2026-10-05");

    expect(await sessionPlanStore.save(a.client, siteA, "2026-10-05", ["moon", "NGC7000", "IC405"])).toEqual({
      ok: true,
    });
    expect(await sessionPlanStore.get(a.client, siteA, "2026-10-05")).toEqual(["moon", "NGC7000", "IC405"]);
    // One row, replaced in place (the upsert's conflict target is the unique key).
    expect(await plans(a.client, siteA, "2026-10-05")).toHaveLength(1);
    const [replaced] = await plans(a.client, siteA, "2026-10-05");
    expect(replaced.id).toBe(first.id);

    // Another night has no row.
    expect(await sessionPlanStore.get(a.client, siteA, "2026-10-06")).toBeNull();

    expect(await sessionPlanStore.reset(a.client, siteA, "2026-10-05")).toEqual({ ok: true });
    expect(await sessionPlanStore.get(a.client, siteA, "2026-10-05")).toBeNull();
    // A reset of a night with no row is still a success.
    expect(await sessionPlanStore.reset(a.client, siteA, "2026-10-05")).toEqual({ ok: true });
  });

  it("never lets one user's save touch another user's plan", async () => {
    expect(await sessionPlanStore.save(a.client, siteA, "2026-10-07", ["M31"])).toEqual({ ok: true });

    // B saving on A's site is refused, and A's plan is unchanged; a reset by B deletes nothing of A's.
    expect(await sessionPlanStore.save(b.client, siteA, "2026-10-07", ["M42"])).toEqual({
      ok: false,
      message: "errors.save.sessionPlan",
      fault: { kind: "refused", code: "42501" },
    });
    expect(await sessionPlanStore.reset(b.client, siteA, "2026-10-07")).toEqual({ ok: true });
    expect(await sessionPlanStore.get(a.client, siteA, "2026-10-07")).toEqual(["M31"]);
    expect(await sessionPlanStore.get(b.client, siteA, "2026-10-07")).toBeNull();
  });
});

describe("deleting a site", () => {
  it("deletes its plans", async () => {
    const user = await signUp("cascade");
    const cabin = await addSite(user.client, "Cabin");
    const field = await addSite(user.client, "Field");
    expect(await sessionPlanStore.save(user.client, cabin, "2026-10-08", ["M31"])).toEqual({ ok: true });
    expect(await sessionPlanStore.save(user.client, field, "2026-10-08", ["M42"])).toEqual({ ok: true });

    expect((await user.client.from("sites").delete().eq("id", cabin)).error).toBeNull();

    expect(await plans(user.client, cabin, "2026-10-08")).toEqual([]);
    // Positive control: the other site's plan is still there.
    expect(await plans(user.client, field, "2026-10-08")).toMatchObject([{ targets: ["M42"] }]);
  });
});

describe("the targets checks", () => {
  async function insert(targets: string[], night: string) {
    return a.client.from("session_plans").insert({ site_id: siteA, night, targets });
  }

  it("accepts the whole key grammar and an empty list", async () => {
    const everyKind = [
      "M1",
      "M9",
      "M10",
      "M99",
      "M100",
      "M110",
      "NGC1",
      "NGC7000",
      "NGC9999",
      "IC1",
      "IC405",
      "mercury",
      "venus",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
      "moon",
    ];
    expect((await insert(everyKind, "2026-11-01")).error).toBeNull();
    expect((await insert([], "2026-11-02")).error).toBeNull();
    expect(await plans(a.client, siteA, "2026-11-02")).toMatchObject([{ targets: [] }]);
    expect((await insert(["M31"], "2026-11-03")).error).toBeNull();
    expect(await sessionPlanStore.get(a.client, siteA, "2026-11-02")).toEqual([]);
  });

  it.each([
    ["a Messier number out of range", ["M111"]],
    ["a Messier number with a leading zero", ["M031"]],
    ["M0", ["M0"]],
    ["an NGC number of zero", ["NGC0"]],
    ["an NGC number with five digits", ["NGC10000"]],
    ["an NGC number with a leading zero", ["NGC0123"]],
    ["an unknown word", ["Foo"]],
    ["a key in the wrong case", ["Jupiter"]],
    ["a key with a space", ["M 31"]],
    ["an empty element", [""]],
    ["an empty element between keys", ["M31", "", "M42"]],
    ["an element carrying a comma", ["M31,M42"]],
    ["a valid key next to a bad one", ["M31", "M111"]],
  ])("refuses %s", async (_label, targets) => {
    // Nothing is stored on a refusal, so one night serves every case.
    const { error } = await insert(targets, "2026-12-20");
    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(await plans(a.client, siteA, "2026-12-20")).toEqual([]);
  });

  it("refuses a null element", async () => {
    // The typed client cannot spell a null element: the JSON array carries it through PostgREST into the column.
    const { error } = await a.client
      .from("session_plans")
      .insert({ site_id: siteA, night: "2026-12-01", targets: ["M31", null] as unknown as string[] });
    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(await plans(a.client, siteA, "2026-12-01")).toEqual([]);
  });

  it("accepts 30 keys and refuses 31", async () => {
    const keys = (n: number) => Array.from({ length: n }, (_, i) => `M${i + 1}`);
    expect((await insert(keys(30), "2026-12-02")).error).toBeNull();
    expect((await insert(keys(31), "2026-12-03")).error?.code).toBe(CHECK_VIOLATION);
    expect(await plans(a.client, siteA, "2026-12-03")).toEqual([]);
  });

  it("refuses a change to an invalid list as well", async () => {
    expect((await insert(["M31"], "2026-12-04")).error).toBeNull();
    const { error } = await a.client
      .from("session_plans")
      .update({ targets: ["M111"] })
      .eq("site_id", siteA)
      .eq("night", "2026-12-04");
    expect(error?.code).toBe(CHECK_VIOLATION);
    expect(await sessionPlanStore.get(a.client, siteA, "2026-12-04")).toEqual(["M31"]);
  });
});
