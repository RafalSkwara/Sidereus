/**
 * Sky checks (roadmap M-2 S-07, verdict-check) beyond plain per-user isolation, verified outside the UI through the
 * same PostgREST + RLS path the app uses:
 *
 * - `record_sky_verdict` keeps one row per (user, site, night): a view before the dark window starts overwrites the
 *   headline, a view after it does not, and an answered night never changes;
 * - it writes nothing for another user's site, and a check can only reference the caller's own site;
 * - a check outlives its site, including two deleted sites that share a night;
 * - `skyCheckStore` hides and refuses nights whose dark window has not started, and the tally counts only the
 *   caller's answered nights.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import type { RecordedHeadline } from "@/lib/sky-checks/claim";
import { skyCheckStore } from "@/lib/sky-checks/store";

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

async function signUp(label: string): Promise<Client> {
  const client = newClient();
  const email = `sky-checks-${label}-${Date.now()}-${crypto.randomUUID()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: `pw-${crypto.randomUUID()}` });
  if (error) throw new Error(`sign-up for user ${label} failed: ${error.message}`);
  if (!data.session) {
    throw new Error(`sign-up for user ${label} returned no session; email confirmation must be off locally`);
  }
  return client;
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

const HOUR = 60 * 60 * 1000;
/** A dark window that has not started yet (the database clock decides), and one that already has. */
const future = () => new Date(Date.now() + 6 * HOUR);
const past = () => new Date(Date.now() - 6 * HOUR);

async function record(client: Client, siteId: string, night: string, headline: RecordedHeadline, darkStart: Date) {
  expect(await skyCheckStore.record(client, { siteId, night, headline, darkStart })).toEqual({ ok: true });
}

async function rows(client: Client, siteId: string | null, night: string) {
  const query = client.from("sky_checks").select("id, headline, answer, site_id, site_name").eq("night", night);
  const { data, error } = await (siteId === null ? query.is("site_id", null) : query.eq("site_id", siteId));
  expect(error).toBeNull();
  return data ?? [];
}

let a: Client;
let b: Client;
let siteA: string;

beforeAll(async () => {
  a = await signUp("a");
  b = await signUp("b");
  siteA = await addSite(a);
});

describe("record_sky_verdict", () => {
  it("keeps one row per site and night", async () => {
    await record(a, siteA, "2026-09-01", "go", future());
    await record(a, siteA, "2026-09-01", "go", future());
    expect(await rows(a, siteA, "2026-09-01")).toMatchObject([{ headline: "go", answer: null, site_name: "Home" }]);
  });

  it("overwrites the headline while the dark window has not started", async () => {
    await record(a, siteA, "2026-09-02", "go", future());
    await record(a, siteA, "2026-09-02", "marginal", future());
    expect(await rows(a, siteA, "2026-09-02")).toMatchObject([{ headline: "marginal" }]);
  });

  it("keeps the first headline recorded after the dark window started", async () => {
    await record(a, siteA, "2026-09-03", "no-go", past());
    await record(a, siteA, "2026-09-03", "go", past());
    expect(await rows(a, siteA, "2026-09-03")).toMatchObject([{ headline: "no-go" }]);
  });

  it("never overwrites an answered night", async () => {
    await record(a, siteA, "2026-09-04", "go", past());
    const [row] = await rows(a, siteA, "2026-09-04");
    expect(await skyCheckStore.answer(a, row.id, "cloudy", new Date())).toEqual({ ok: true });

    // Even a view that claims a later dark window (a moved site, say) leaves the answered night alone.
    await record(a, siteA, "2026-09-04", "marginal", future());
    expect(await rows(a, siteA, "2026-09-04")).toMatchObject([{ headline: "go", answer: "cloudy" }]);
  });

  it("writes nothing for another user's site", async () => {
    expect(
      await skyCheckStore.record(b, { siteId: siteA, night: "2026-09-05", headline: "go", darkStart: past() }),
    ).toEqual({ ok: true });
    expect(await rows(a, siteA, "2026-09-05")).toEqual([]);
    expect(await rows(b, siteA, "2026-09-05")).toEqual([]);
  });

  it("does not let another user point a check at the first user's site directly", async () => {
    const { error } = await b.from("sky_checks").insert({
      site_id: siteA,
      site_name: "Home",
      night: "2026-09-06",
      headline: "go",
      dark_start: past().toISOString(),
    });
    expect(error).not.toBeNull();
  });
  it("does not let another user repoint its own check at the first user's site", async () => {
    const siteB = await addSite(b, "Allotment");
    await record(b, siteB, "2026-09-07", "go", past());
    const [own] = await rows(b, siteB, "2026-09-07");

    // No .select(): RETURNING would apply the SELECT policy and mask a missing WITH CHECK.
    const { error } = await b.from("sky_checks").update({ site_id: siteA }).eq("id", own.id);
    expect(error).not.toBeNull();
    expect(await rows(b, siteB, "2026-09-07")).toHaveLength(1);
  });

  it("cannot be executed by an anonymous client", async () => {
    const anon = newClient();
    const recorded = await anon.rpc("record_sky_verdict", {
      site_id: siteA,
      night: "2026-09-08",
      headline: "go",
      dark_start: past().toISOString(),
    });
    expect(recorded.error?.code).toBe("42501");
    const tallied = await anon.rpc("sky_check_tally");
    expect(tallied.error?.code).toBe("42501");
  });
});

describe("a check outlives its site", () => {
  it("keeps the row with a null site and the name snapshot, also for two deleted sites on one night", async () => {
    const user = await signUp("orphans");
    const cabin = await addSite(user, "Cabin");
    const field = await addSite(user, "Field");
    await record(user, cabin, "2026-09-10", "go", past());
    await record(user, field, "2026-09-10", "no-go", past());

    expect((await user.from("sites").delete().eq("id", cabin)).error).toBeNull();
    expect((await user.from("sites").delete().eq("id", field)).error).toBeNull();

    const kept = await rows(user, null, "2026-09-10");
    expect(kept.map((row) => row.site_name).sort()).toEqual(["Cabin", "Field"]);
  });
});

describe("skyCheckStore", () => {
  it("hides and refuses a night whose dark window has not started", async () => {
    const user = await signUp("early");
    const site = await addSite(user);
    await record(user, site, "2026-09-20", "go", future());
    const [row] = await rows(user, site, "2026-09-20");
    const now = new Date();

    expect((await skyCheckStore.list(user, { page: 1, now })).entries).toEqual([]);
    expect(await skyCheckStore.answer(user, row.id, "clear", now)).toEqual({
      ok: false,
      message: "errors.notFound.skyCheck",
    });
    expect(await skyCheckStore.skip(user, row.id, now)).toEqual({ ok: false, message: "errors.notFound.skyCheck" });
  });

  it("lists checkable nights newest first, leaving out nights with no forecast", async () => {
    const user = await signUp("list");
    const home = await addSite(user, "Home");
    const cabin = await addSite(user, "Cabin");
    await record(user, home, "2026-09-21", "go", past());
    await record(user, cabin, "2026-09-22", "marginal", past());
    await record(user, home, "2026-09-22", "no-go", past());
    await record(user, home, "2026-09-23", "noForecast", past());

    const { entries, hasOlder } = await skyCheckStore.list(user, { page: 1, now: new Date() });
    expect(hasOlder).toBe(false);
    expect(entries.map((e) => [e.night, e.siteName, e.headline])).toEqual([
      ["2026-09-22", "Cabin", "marginal"],
      ["2026-09-22", "Home", "no-go"],
      ["2026-09-21", "Home", "go"],
    ]);
  });

  it("offers recent open nights for Tonight's question, without answered or skipped ones", async () => {
    const user = await signUp("open");
    const site = await addSite(user);
    for (const night of ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]) {
      await record(user, site, night, "go", past());
    }
    await record(user, site, "2026-09-28", "noForecast", past());
    const all = await skyCheckStore.list(user, { page: 1, now: new Date() });
    const id = (night: string) => all.entries.find((e) => e.night === night)?.id ?? "";
    expect(await skyCheckStore.answer(user, id("2026-09-27"), "clear", new Date())).toEqual({ ok: true });
    expect(await skyCheckStore.skip(user, id("2026-09-26"), new Date())).toEqual({ ok: true });

    const open = await skyCheckStore.openRecent(user, { sinceNight: "2026-09-25" });
    expect(open.map((e) => e.night)).toEqual(["2026-09-25"]);
  });

  it("clears a skip when the night is answered", async () => {
    const user = await signUp("unskip");
    const site = await addSite(user);
    await record(user, site, "2026-09-29", "go", past());
    const [row] = await rows(user, site, "2026-09-29");
    expect(await skyCheckStore.skip(user, row.id, new Date())).toEqual({ ok: true });
    expect(await skyCheckStore.answer(user, row.id, "partly", new Date())).toEqual({ ok: true });
    const { entries } = await skyCheckStore.list(user, { page: 1, now: new Date() });
    expect(entries).toMatchObject([{ id: row.id, answer: "partly", skipped: false }]);
  });

  it("refuses to answer a night with no forecast, and to skip an answered night", async () => {
    const user = await signUp("unoffered");
    const site = await addSite(user);
    await record(user, site, "2026-09-18", "noForecast", past());
    await record(user, site, "2026-09-19", "go", past());
    const [noForecast] = await rows(user, site, "2026-09-18");
    const [answered] = await rows(user, site, "2026-09-19");
    expect(await skyCheckStore.answer(user, answered.id, "clear", new Date())).toEqual({ ok: true });

    expect(await skyCheckStore.answer(user, noForecast.id, "clear", new Date())).toEqual({
      ok: false,
      message: "errors.notFound.skyCheck",
    });
    expect(await skyCheckStore.skip(user, answered.id, new Date())).toEqual({
      ok: false,
      message: "errors.notFound.skyCheck",
    });
    expect(await rows(user, site, "2026-09-18")).toMatchObject([{ answer: null }]);
  });

  it("cannot answer another user's night, and treats a malformed id as not found", async () => {
    await record(a, siteA, "2026-09-30", "go", past());
    const [row] = await rows(a, siteA, "2026-09-30");
    expect(await skyCheckStore.answer(b, row.id, "clear", new Date())).toEqual({
      ok: false,
      message: "errors.notFound.skyCheck",
    });
    expect(await skyCheckStore.answer(a, "not-a-uuid", "clear", new Date())).toEqual({
      ok: false,
      message: "errors.notFound.skyCheck",
    });
    expect(await rows(a, siteA, "2026-09-30")).toMatchObject([{ answer: null }]);
  });

  it("counts only the caller's answered nights, grouped by headline and answer", async () => {
    const user = await signUp("tally");
    const site = await addSite(user);
    const answers: [string, RecordedHeadline, "clear" | "partly" | "cloudy" | null][] = [
      ["2026-08-01", "go", "clear"],
      ["2026-08-02", "go", "clear"],
      ["2026-08-03", "go", "cloudy"],
      ["2026-08-04", "marginal", "partly"],
      ["2026-08-05", "no-go", null],
    ];
    for (const [night, headline, answer] of answers) {
      await record(user, site, night, headline, past());
      if (answer) {
        const [row] = await rows(user, site, night);
        expect(await skyCheckStore.answer(user, row.id, answer, new Date())).toEqual({ ok: true });
      }
    }

    expect(await skyCheckStore.tally(user)).toEqual([
      { headline: "go", answer: "clear", nights: 2 },
      { headline: "go", answer: "cloudy", nights: 1 },
      { headline: "marginal", answer: "partly", nights: 1 },
    ]);
    expect(await skyCheckStore.tally(await signUp("tally-empty"))).toEqual([]);
  });
});
