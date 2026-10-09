/**
 * The shape of the access boundary, read from the catalogs (test rollout Phase 4, Risk #5). isolation.test.ts
 * proves refusals table by table; this suite proves that no table or function sits outside it:
 *
 * - every base table in `public` is classified in tests/db/tables.ts, either per-user (`TABLES`) or server-owned
 *   (`SERVER_OWNED`), so a forgotten table fails here by name;
 * - a per-user table has RLS on and exactly one SELECT, INSERT, UPDATE and DELETE policy `to authenticated`, keyed
 *   on `auth.uid()` and `user_id` (UPDATE with WITH CHECK, so a row cannot be handed over);
 * - a server-owned table has RLS on, gives `authenticated` SELECT only and `anon` nothing (column grants included),
 *   and has no write policy;
 * - a view in `public` is `security_invoker`, so RLS applies to its caller, and there is no materialized view or
 *   foreign table (PostgREST exposes both, and neither has RLS of its own);
 * - every function in `public` is SECURITY INVOKER, pins `search_path`, and is not executable by `anon` or PUBLIC.
 *
 * It connects straight to the local Postgres (`DB_URL` from `npx supabase status -o env`), because PostgREST does
 * not expose the catalogs. That URL is the local stack's superuser: never put it in `.env`, `.dev.vars` or a log.
 */
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SERVER_OWNED as SERVER_OWNED_TABLES, TABLES } from "./tables";

const DB_URL = process.env.DB_URL;

if (!DB_URL) {
  throw new Error(
    "tests/db/structure.test.ts needs DB_URL, the local Postgres URL of a running Supabase. " +
      "Locally: `npx supabase start`, then take DB_URL from `npx supabase status -o env`.",
  );
}

// Short timeouts, so a stack that is down fails fast instead of at the hook timeout.
const sql = postgres(DB_URL, { max: 1, connect_timeout: 5, onnotice: () => undefined });

interface TableRow {
  name: string;
  rls: boolean;
}

interface RelationRow {
  name: string;
  kind: "v" | "m" | "f";
  options: string[] | null;
}

interface PolicyRow {
  table: string;
  name: string;
  cmd: string;
  roles: string[];
  qual: string | null;
  with_check: string | null;
}

interface PrivilegeRow {
  table: string;
  role: string;
  privilege: string;
  granted: boolean;
}

interface FunctionRow {
  signature: string;
  definer: boolean;
  config: string[] | null;
  anon_execute: boolean;
  public_execute: boolean;
}

let tables: TableRow[];
let relations: RelationRow[];
let policies: PolicyRow[];
let privileges: PrivilegeRow[];
let functions: FunctionRow[];

const PER_USER: readonly string[] = TABLES.map((entry) => entry.table);
const SERVER_OWNED: readonly string[] = SERVER_OWNED_TABLES;
const KNOWN_FUNCTIONS = ["complete_onboarding", "record_sky_verdict", "sky_check_tally", "current_plan"];

beforeAll(async () => {
  tables = await sql<TableRow[]>`
    select c.relname as name, c.relrowsecurity as rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
    order by c.relname`;

  relations = await sql<RelationRow[]>`
    select c.relname as name, c.relkind as kind, c.reloptions as options
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm', 'f')
    order by c.relname`;

  policies = await sql<PolicyRow[]>`
    select tablename as table, policyname as name, cmd, roles::text[] as roles, qual, with_check
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname`;

  // has_any_column_privilege also sees a column-level grant (`grant update (plan) ...`), which
  // has_table_privilege ignores; DELETE, TRUNCATE and TRIGGER exist only at table level.
  privileges = await sql<PrivilegeRow[]>`
    select t.relname as table, r.role, p.privilege,
           case when p.privilege in ('SELECT', 'INSERT', 'UPDATE', 'REFERENCES')
                then has_any_column_privilege(r.role, t.oid, p.privilege)
                else has_table_privilege(r.role, t.oid, p.privilege) end as granted
    from pg_class t
    join pg_namespace n on n.oid = t.relnamespace
    cross join (values ('anon'), ('authenticated')) as r(role)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'))
      as p(privilege)
    where n.nspname = 'public' and t.relkind in ('r', 'p')
    order by t.relname, r.role, p.privilege`;

  // Extension-owned functions would be excluded through pg_depend ('e'); none live in `public` today.
  // has_function_privilege('public', ...) also covers a NULL proacl, which is the default ACL granting PUBLIC.
  functions = await sql<FunctionRow[]>`
    select p.oid::regprocedure::text as signature,
           p.prosecdef as definer,
           p.proconfig as config,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
           has_function_privilege('public', p.oid, 'EXECUTE') as public_execute
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    order by signature`;
});

afterAll(async () => {
  await sql.end({ timeout: 5 });
});

function policiesOf(table: string): PolicyRow[] {
  return policies.filter((policy) => policy.table === table);
}

function keyedOnOwner(expression: string | null): boolean {
  return expression !== null && expression.includes("auth.uid()") && expression.includes("user_id");
}

describe("catalog snapshot (non-vacuity)", () => {
  it("sees the known tables and functions", () => {
    const names = tables.map((table) => table.name);
    for (const known of [...PER_USER, ...SERVER_OWNED]) {
      expect(names, `${known} is listed in tests/db/tables.ts but missing from public`).toContain(known);
    }
    expect(names.length).toBeGreaterThanOrEqual(6);

    const signatures = functions.map((fn) => fn.signature);
    for (const known of KNOWN_FUNCTIONS) {
      expect(
        signatures.some((signature) => signature.startsWith(`${known}(`)),
        `function ${known} missing from public`,
      ).toBe(true);
    }
    expect(policies.length).toBeGreaterThanOrEqual(PER_USER.length * 4);
  });
});

describe("table classification", () => {
  it("lists every table in public as per-user or server-owned, and nothing that does not exist", () => {
    const actual = tables.map((table) => table.name).sort();
    const classified = [...PER_USER, ...SERVER_OWNED].sort();
    const unclassified = actual.filter((name) => !classified.includes(name));
    const stale = classified.filter((name) => !actual.includes(name));

    expect(
      unclassified,
      "add each to TABLES (per-user) or SERVER_OWNED in tests/db/tables.ts, and give it RLS and policies",
    ).toEqual([]);
    expect(stale, "listed in tests/db/tables.ts but not a table in public").toEqual([]);
    expect(
      PER_USER.filter((name) => SERVER_OWNED.includes(name)),
      "listed as both kinds",
    ).toEqual([]);
  });

  it("has RLS enabled on every table in public", () => {
    const withoutRls = tables.filter((table) => !table.rls).map((table) => table.name);
    expect(withoutRls, "tables without row level security").toEqual([]);
  });

  it("has no view that runs as its owner, and no materialized view or foreign table", () => {
    const definerViews = relations
      .filter((relation) => relation.kind === "v" && !(relation.options ?? []).includes("security_invoker=true"))
      .map((relation) => relation.name);
    expect(definerViews, "views without security_invoker=true bypass RLS").toEqual([]);
    const unguarded = relations
      .filter((relation) => relation.kind !== "v")
      .map((relation) => `${relation.name} (${relation.kind === "m" ? "materialized view" : "foreign table"})`);
    expect(unguarded, "relations PostgREST exposes without RLS").toEqual([]);
  });
});

describe.each(PER_USER)("per-user table %s", (table) => {
  it("has exactly one SELECT, INSERT, UPDATE and DELETE policy, all to authenticated", () => {
    const own = policiesOf(table);
    const commands = own.map((policy) => policy.cmd).sort();
    expect(commands, `${table}: policy commands`).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"]);
    for (const policy of own) {
      expect(policy.roles, `${table}.${policy.name}: roles`).toEqual(["authenticated"]);
    }
  });

  it("keys every policy on auth.uid() and user_id, and checks new rows on INSERT and UPDATE", () => {
    for (const policy of policiesOf(table)) {
      if (policy.cmd !== "INSERT") {
        expect(keyedOnOwner(policy.qual), `${table}.${policy.name} (${policy.cmd}): USING ${policy.qual}`).toBe(true);
      }
      if (policy.cmd === "INSERT" || policy.cmd === "UPDATE") {
        expect(
          keyedOnOwner(policy.with_check),
          `${table}.${policy.name} (${policy.cmd}): WITH CHECK ${policy.with_check}`,
        ).toBe(true);
      }
    }
  });
});

describe.each(SERVER_OWNED)("server-owned table %s", (table) => {
  it("gives authenticated SELECT only and anon nothing", () => {
    const granted = privileges
      .filter((row) => row.table === table && row.granted)
      .map((row) => `${row.role} ${row.privilege}`);
    expect(granted, `${table}: table privileges of anon and authenticated`).toEqual(["authenticated SELECT"]);
  });

  it("has no write policy", () => {
    const writes = policiesOf(table)
      .filter((policy) => policy.cmd !== "SELECT")
      .map((policy) => `${policy.name} (${policy.cmd})`);
    expect(writes, `${table}: write policies`).toEqual([]);
  });
});

describe("functions in public", () => {
  it("are SECURITY INVOKER", () => {
    const definers = functions.filter((fn) => fn.definer).map((fn) => fn.signature);
    expect(definers, "SECURITY DEFINER functions").toEqual([]);
  });

  it("pin search_path", () => {
    const unpinned = functions
      .filter((fn) => !(fn.config ?? []).some((setting) => setting.startsWith("search_path=")))
      .map((fn) => fn.signature);
    expect(unpinned, "functions without a search_path setting").toEqual([]);
  });

  it("are not executable by anon or PUBLIC", () => {
    const open = functions
      .filter((fn) => fn.anon_execute || fn.public_execute)
      .map((fn) => `${fn.signature}${fn.anon_execute ? " anon" : ""}${fn.public_execute ? " PUBLIC" : ""}`);
    expect(open, "revoke execute from public, anon").toEqual([]);
  });
});
