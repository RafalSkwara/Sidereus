/**
 * Account plans (roadmap F-01, FR-045): `public.account_plans` is server-owned. A signed-in user may read only
 * their own row; every write (insert, update, upsert, delete) is refused with `42501`, and only the secret key
 * (the operator's path) can change a plan. A missing row reads as free.
 *
 * The refusals are asserted on the error code, not on "nothing changed": a table with RLS and no write policy
 * would answer a write with zero rows and no error, which cannot be told from a no-op. The positive control is
 * the owner reading the admin-seeded `full` row; after each refusal the admin re-reads the row to prove it is
 * unchanged.
 *
 * This table is read-only for users, so it is listed in `SERVER_OWNED` (tests/db/tables.ts), not `TABLES` (the
 * isolation suite writes as the owner and expects an `id` column); structure.test.ts checks its privileges.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !SUPABASE_SECRET_KEY) {
  throw new Error(
    "tests/db needs SUPABASE_URL, SUPABASE_KEY (the anon/publishable key) and SUPABASE_SECRET_KEY (the secret key) of a running Supabase. " +
      "Locally: `npx supabase start`, then take API_URL, ANON_KEY and SECRET_KEY from `npx supabase status -o env`.",
  );
}

const url: string = SUPABASE_URL;
const key: string = SUPABASE_KEY;
const secretKey: string = SUPABASE_SECRET_KEY;

const PERMISSION_DENIED = "42501";

function newClient(): Client {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** The operator's path: the secret key bypasses RLS and grants. Never used for anything a user could do. */
function newAdminClient(): Client {
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signUp(label: string): Promise<{ client: Client; userId: string }> {
  const client = newClient();
  const email = `account-plans-${label}-${Date.now()}-${crypto.randomUUID()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: `pw-${crypto.randomUUID()}` });
  if (error) throw new Error(`sign-up for user ${label} failed: ${error.message}`);
  if (!data.session || !data.user) {
    throw new Error(`sign-up for user ${label} returned no session; email confirmation must be off locally`);
  }
  return { client, userId: data.user.id };
}

describe("account_plans", () => {
  const admin = newAdminClient();
  const anon = newClient();
  let a: { client: Client; userId: string };
  let b: { client: Client; userId: string };
  let seeded: { user_id: string; plan: string; updated_at: string };

  /** The row as the operator sees it, regardless of RLS. */
  async function adminRow(userId: string) {
    const { data, error } = await admin.from("account_plans").select("user_id, plan, updated_at").eq("user_id", userId);
    expect(error).toBeNull();
    return data;
  }

  /** Proves a refused write changed nothing: the plan and updated_at are exactly as seeded. */
  async function expectAUnchanged() {
    expect(await adminRow(a.userId)).toEqual([seeded]);
  }

  beforeAll(async () => {
    a = await signUp("a");
    b = await signUp("b");

    const { error } = await admin.from("account_plans").upsert({ user_id: a.userId, plan: "full" });
    if (error) throw new Error(`admin could not seed A's plan: ${error.message}`);
    const rows = await adminRow(a.userId);
    if (rows?.length !== 1 || rows[0]?.plan !== "full") throw new Error("admin seed of A's plan did not take effect");
    seeded = rows[0];
  });

  it("the owner reads their own full plan, row and current_plan() (positive control)", async () => {
    const { data, error } = await a.client.from("account_plans").select("user_id, plan").eq("user_id", a.userId);
    expect(error).toBeNull();
    expect(data).toEqual([{ user_id: a.userId, plan: "full" }]);

    const rpc = await a.client.rpc("current_plan");
    expect(rpc.error).toBeNull();
    expect(rpc.data).toBe("full");
  });

  it("an account without a row reads as free", async () => {
    expect(await adminRow(b.userId)).toEqual([]);

    const own = await b.client.from("account_plans").select("plan");
    expect(own.error).toBeNull();
    expect(own.data).toEqual([]);

    const rpc = await b.client.rpc("current_plan");
    expect(rpc.error).toBeNull();
    expect(rpc.data).toBe("free");
  });

  it("the owner cannot insert, update, upsert or delete their plan row", async () => {
    const insert = await a.client.from("account_plans").insert({ user_id: a.userId, plan: "free" });
    expect(insert.error?.code).toBe(PERMISSION_DENIED);

    const update = await a.client.from("account_plans").update({ plan: "free" }).eq("user_id", a.userId);
    expect(update.error?.code).toBe(PERMISSION_DENIED);

    const upsert = await a.client.from("account_plans").upsert({ user_id: a.userId, plan: "free" });
    expect(upsert.error?.code).toBe(PERMISSION_DENIED);

    const remove = await a.client.from("account_plans").delete().eq("user_id", a.userId);
    expect(remove.error?.code).toBe(PERMISSION_DENIED);

    await expectAUnchanged();
  });

  it("a user without a row cannot grant themselves the full plan", async () => {
    const { error } = await b.client.from("account_plans").insert({ user_id: b.userId, plan: "full" });
    expect(error?.code).toBe(PERMISSION_DENIED);

    expect(await adminRow(b.userId)).toEqual([]);
    const rpc = await b.client.rpc("current_plan");
    expect(rpc.data).toBe("free");
  });

  it("another user cannot read the row", async () => {
    expect(await adminRow(a.userId)).toHaveLength(1);

    const { data, error } = await b.client.from("account_plans").select("*").eq("user_id", a.userId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("an anonymous caller cannot read the table or call current_plan()", async () => {
    // Since the F7 tightening `anon` holds no privilege at all, so the read is refused instead of returning no rows.
    const { data, error } = await anon.from("account_plans").select("*");
    expect(error?.code).toBe(PERMISSION_DENIED);
    expect(data).toBeNull();

    const rpc = await anon.rpc("current_plan");
    expect(rpc.error?.code).toBe(PERMISSION_DENIED);
  });

  it("a change by the operator takes effect on the owner's next call", async () => {
    const { error } = await admin.from("account_plans").upsert({
      user_id: a.userId,
      plan: "free",
      updated_at: new Date().toISOString(),
    });
    expect(error).toBeNull();

    const rpc = await a.client.rpc("current_plan");
    expect(rpc.error).toBeNull();
    expect(rpc.data).toBe("free");

    const own = await a.client.from("account_plans").select("plan").eq("user_id", a.userId);
    expect(own.data).toEqual([{ plan: "free" }]);
  });
});
