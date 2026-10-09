/**
 * Per-user isolation (PRD NFR): no user can read or modify another user's data, verified outside the UI
 * through the same PostgREST + RLS path the app uses.
 *
 * Every case starts from a positive control (A can read and modify its own row), because under RLS a
 * cross-user select returns [] and a cross-user update/delete returns no error and touches zero rows:
 * "B got nothing" alone would also pass for a table that rejects everyone.
 *
 * Which refusals are errors: RLS hides another user's row from UPDATE and DELETE (their USING clause), so those
 * are silent zero-row no-ops, asserted by reading the row back as its owner. A new row that fails a policy's
 * WITH CHECK (an INSERT, or an UPDATE that hands a row over) raises `42501`, asserted on `error.code`. An anonymous
 * caller keeps Supabase's default table grants and is refused by RLS alone (every policy is `to authenticated`):
 * PostgREST answers its INSERT with HTTP 401 and code `42501`, so the code is what the suite pins.
 *
 * To cover a new per-user table, add an entry to `TABLES` in `tests/db/tables.ts`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database, TablesInsert } from "@/lib/database.types";
import { TABLES } from "./tables";

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
  const email = `isolation-${label}-${Date.now()}-${crypto.randomUUID()}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: `pw-${crypto.randomUUID()}` });
  if (error) throw new Error(`sign-up for user ${label} failed: ${error.message}`);
  if (!data.session || !data.user) {
    throw new Error(`sign-up for user ${label} returned no session; email confirmation must be off locally`);
  }
  return { client, userId: data.user.id };
}

let a: { client: Client; userId: string };
let b: { client: Client; userId: string };
let anon: Client;

beforeAll(async () => {
  a = await signUp("a");
  b = await signUp("b");
  anon = newClient();
});

describe.each(TABLES)("$table isolation", ({ table, valid, change }) => {
  // The generic client cannot narrow a union of table names; each entry above is type-checked by `satisfies`.
  const from = (client: Client) => client.from(table as "eyepieces");
  const row = valid as TablesInsert<"eyepieces">;
  const patch = change as Database["public"]["Tables"]["eyepieces"]["Update"];

  async function insertAsA(): Promise<string> {
    const { data, error } = await from(a.client).insert(row).select("id, user_id").single();
    expect(error).toBeNull();
    expect(data?.user_id).toBe(a.userId);
    if (!data) throw new Error(`A could not insert into ${table}`);
    return data.id;
  }

  async function readAsA(id: string) {
    const { data, error } = await from(a.client).select("*").eq("id", id);
    expect(error).toBeNull();
    return data ?? [];
  }

  it("owner can insert, select, update and delete its own row (positive control)", async () => {
    const id = await insertAsA();

    expect(await readAsA(id)).toHaveLength(1);

    const updated = await from(a.client).update(patch).eq("id", id).select("*");
    expect(updated.error).toBeNull();
    expect(updated.data).toHaveLength(1);
    expect(updated.data?.[0]).toMatchObject({ id, ...patch });

    const deleted = await from(a.client).delete().eq("id", id).select("id");
    expect(deleted.error).toBeNull();
    expect(deleted.data).toEqual([{ id }]);
    expect(await readAsA(id)).toHaveLength(0);
  });

  it("another user cannot select the row", async () => {
    const id = await insertAsA();
    expect(await readAsA(id)).toHaveLength(1);

    const { data, error } = await from(b.client).select("*").eq("id", id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("another user's update leaves the row unchanged", async () => {
    const id = await insertAsA();
    const [before] = await readAsA(id);
    expect(before).toBeDefined();

    const { data, error } = await from(b.client).update(patch).eq("id", id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);

    expect(await readAsA(id)).toEqual([before]);
  });

  it("another user's delete leaves the row present", async () => {
    const id = await insertAsA();
    expect(await readAsA(id)).toHaveLength(1);

    const { data, error } = await from(b.client).delete().eq("id", id).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);

    expect(await readAsA(id)).toHaveLength(1);
  });

  it("another user cannot insert a row owned by the first user", async () => {
    const before = await from(a.client).select("id");
    expect(before.error).toBeNull();

    const { data, error } = await from(b.client)
      .insert({ ...row, user_id: a.userId })
      .select("id");
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();

    const after = await from(a.client).select("id");
    expect(after.error).toBeNull();
    expect(after.data).toHaveLength(before.data?.length ?? -1);
  });

  it("another user cannot hand its own row over to the first user", async () => {
    // Guards the update policy's WITH CHECK: the SELECT policy alone already hides A's rows from B's
    // update, but without WITH CHECK B could reassign its own row and plant it in A's account.
    const own = await from(b.client).insert(row).select("id").single();
    expect(own.error).toBeNull();
    if (!own.data) throw new Error(`B could not insert into ${table}`);
    const id = own.data.id;

    // No .select(): RETURNING would apply the SELECT policy to the new row and mask a missing WITH CHECK.
    const { error } = await from(b.client).update({ user_id: a.userId }).eq("id", id);
    expect(error?.code).toBe("42501");

    expect(await readAsA(id)).toHaveLength(0);
    const { data: stillB } = await from(b.client).select("id, user_id").eq("id", id);
    expect(stillB).toEqual([{ id, user_id: b.userId }]);
  });

  it("an anonymous client sees no rows", async () => {
    const id = await insertAsA();
    expect(await readAsA(id)).toHaveLength(1);

    const { data } = await from(anon).select("*");
    expect(data ?? []).toEqual([]);
  });

  it.each([
    ["as a row of the first user", () => ({ ...row, user_id: a.userId })],
    ["as a row without a user", () => row],
  ])("an anonymous client cannot insert a row %s", async (_label, anonRow) => {
    const before = await from(a.client).select("id");
    expect(before.error).toBeNull();

    // No .select(): the refusal must come from the insert itself, not from RETURNING under the SELECT policy.
    const { error } = await from(anon).insert(anonRow());
    expect(error?.code).toBe("42501");

    const after = await from(a.client).select("id");
    expect(after.error).toBeNull();
    expect(after.data).toHaveLength(before.data?.length ?? -1);
  });

  it("an anonymous client's update leaves the row unchanged", async () => {
    const id = await insertAsA();
    const [before] = await readAsA(id);
    expect(before).toBeDefined();

    const { error } = await from(anon).update(patch).eq("id", id);
    expect(error).toBeNull();

    expect(await readAsA(id)).toEqual([before]);
  });

  it("an anonymous client's delete leaves the row present", async () => {
    const id = await insertAsA();
    expect(await readAsA(id)).toHaveLength(1);

    const { error } = await from(anon).delete().eq("id", id);
    expect(error).toBeNull();

    expect(await readAsA(id)).toHaveLength(1);
  });
});
