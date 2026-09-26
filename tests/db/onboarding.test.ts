/**
 * `complete_onboarding` (roadmap S-03): the first-run save is all-or-nothing and runs once per user,
 * verified outside the UI through the same PostgREST + RLS path the app uses.
 *
 * Every user here is fresh, because the function refuses anyone who already has a site or telescope.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { completeOnboarding } from "@/lib/onboarding/store";

type Client = SupabaseClient<Database>;
type Args = Database["public"]["Functions"]["complete_onboarding"]["Args"];

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
  const email = `onboarding-${label}-${Date.now()}-${crypto.randomUUID()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: `pw-${crypto.randomUUID()}` });
  if (error) throw new Error(`sign-up for user ${label} failed: ${error.message}`);
  if (!data.session || !data.user) {
    throw new Error(`sign-up for user ${label} returned no session; email confirmation must be off locally`);
  }
  return { client, userId: data.user.id };
}

const EYEPIECES = [
  { name: "25 mm Plössl", focal_length_mm: 25, afov_deg: 50 },
  { name: "10 mm Plössl", focal_length_mm: 10, afov_deg: 50 },
  { name: "6 mm Plössl", focal_length_mm: 6, afov_deg: 50 },
];

const VALID: Args = {
  site_name: "Home",
  latitude_deg: 52.23,
  longitude_deg: 21.01,
  bortle: 6,
  min_altitude_deg: 15,
  time_zone: "Europe/Warsaw",
  time_zone_source: "auto",
  telescope_name: "150 mm reflector",
  aperture_mm: 150,
  focal_length_mm: 750,
  eyepieces: EYEPIECES,
};

async function ownedIds(client: Client) {
  const [sites, telescopes, eyepieces] = await Promise.all([
    client.from("sites").select("id"),
    client.from("telescopes").select("id"),
    client.from("eyepieces").select("id"),
  ]);
  expect(sites.error).toBeNull();
  expect(telescopes.error).toBeNull();
  expect(eyepieces.error).toBeNull();
  return {
    sites: (sites.data ?? []).map((row) => row.id),
    telescopes: (telescopes.data ?? []).map((row) => row.id),
    eyepieces: (eyepieces.data ?? []).map((row) => row.id),
  };
}

async function counts(client: Client) {
  const ids = await ownedIds(client);
  return { sites: ids.sites.length, telescopes: ids.telescopes.length, eyepieces: ids.eyepieces.length };
}

let a: { client: Client; userId: string };
let b: { client: Client; userId: string };

beforeAll(async () => {
  a = await signUp("a");
  b = await signUp("b");
});

describe("complete_onboarding", () => {
  it("creates exactly one site, one telescope and every eyepiece, owned by and visible to the caller only", async () => {
    const { error } = await a.client.rpc("complete_onboarding", VALID);
    expect(error).toBeNull();

    const ids = await ownedIds(a.client);
    expect({ sites: ids.sites.length, telescopes: ids.telescopes.length, eyepieces: ids.eyepieces.length }).toEqual({
      sites: 1,
      telescopes: 1,
      eyepieces: EYEPIECES.length,
    });

    const site = await a.client.from("sites").select("*").single();
    expect(site.data).toMatchObject({
      user_id: a.userId,
      name: "Home",
      latitude_deg: 52.23,
      longitude_deg: 21.01,
      bortle: 6,
      min_altitude_deg: 15,
      time_zone: "Europe/Warsaw",
      time_zone_source: "auto",
    });
    const telescope = await a.client.from("telescopes").select("*").single();
    expect(telescope.data).toMatchObject({
      user_id: a.userId,
      name: "150 mm reflector",
      aperture_mm: 150,
      focal_length_mm: 750,
    });
    const eyepieces = await a.client.from("eyepieces").select("user_id, name, focal_length_mm, afov_deg");
    expect(eyepieces.data).toEqual(expect.arrayContaining(EYEPIECES.map((e) => ({ ...e, user_id: a.userId }))));

    const seenByB = await Promise.all([
      b.client.from("sites").select("id").in("id", ids.sites),
      b.client.from("telescopes").select("id").in("id", ids.telescopes),
      b.client.from("eyepieces").select("id").in("id", ids.eyepieces),
    ]);
    for (const result of seenByB) {
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    }
  });

  it("leaves zero rows when the third eyepiece violates a check constraint", async () => {
    const c = await signUp("c");
    const eyepieces = [...EYEPIECES.slice(0, 2), { name: "Too wide", focal_length_mm: 6, afov_deg: 200 }];

    const { error } = await c.client.rpc("complete_onboarding", { ...VALID, eyepieces });
    expect(error?.code).toBe("23514");

    expect(await counts(c.client)).toEqual({ sites: 0, telescopes: 0, eyepieces: 0 });
  });

  it("refuses a second call by the same user with already_onboarded and changes nothing", async () => {
    const d = await signUp("d");
    expect((await d.client.rpc("complete_onboarding", VALID)).error).toBeNull();
    const before = await counts(d.client);
    expect(before).toEqual({ sites: 1, telescopes: 1, eyepieces: EYEPIECES.length });

    const { error } = await d.client.rpc("complete_onboarding", { ...VALID, site_name: "Second home" });
    expect(error?.code).toBe("P0001");
    expect(error?.message).toBe("already_onboarded");

    expect(await counts(d.client)).toEqual(before);
  });

  it("cannot be executed by an anonymous client", async () => {
    const { error } = await newClient().rpc("complete_onboarding", VALID);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
  });
});

describe("completeOnboarding (store)", () => {
  const input = {
    site: { name: "Home", latitudeDeg: 40.42, longitudeDeg: -3.7, bortle: 5, minAltitudeDeg: 15 },
    telescope: { name: "8-inch Dobsonian", apertureMm: 200, focalLengthMm: 1200 },
    eyepieces: [{ name: "25 mm Plössl", focalLengthMm: 25, afovPreset: "plossl" as const, afovDeg: 50 }],
  };

  it("saves with the looked-up zone, then maps a repeat to alreadyOnboarded", async () => {
    const e = await signUp("e");

    expect(await completeOnboarding(e.client, input)).toEqual({ ok: true });
    const site = await e.client.from("sites").select("time_zone, time_zone_source").single();
    expect(site.data).toEqual({ time_zone: "Europe/Madrid", time_zone_source: "auto" });

    expect(await completeOnboarding(e.client, input)).toEqual({ ok: false, reason: "alreadyOnboarded" });
    expect(await counts(e.client)).toEqual({ sites: 1, telescopes: 1, eyepieces: 1 });
  });

  it("maps a check violation to the fixed out-of-range message", async () => {
    const f = await signUp("f");
    const tooWide = { ...input, eyepieces: [{ ...input.eyepieces[0], afovPreset: "other" as const, afovDeg: 200 }] };

    expect(await completeOnboarding(f.client, tooWide)).toEqual({
      ok: false,
      reason: "failed",
      message: "Some values are out of the allowed range.",
    });
    expect(await counts(f.client)).toEqual({ sites: 0, telescopes: 0, eyepieces: 0 });
  });
});
