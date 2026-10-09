/**
 * The operator command `scripts/account-plan.mjs` (roadmap F-01): proved against local Supabase without a TTY by
 * calling the exported `run` with a real admin client, a stubbed `readPassword` and a captured `out`, plus pure
 * unit cases for `parseArgs`.
 *
 * Every case that touches an account asserts through the user's own `current_plan()`, the path the app reads, not
 * only through the command's output. The output is also checked for secrets: neither the secret key nor a typed
 * password may appear, except the single line `--generate` prints on purpose (asserted separately).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { parseArgs, run } from "../../scripts/account-plan.mjs";

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
const host = new URL(url).host;

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const admin: Client = createClient<Database>(url, secretKey, { auth: authOptions });

function uniqueEmail(label: string): string {
  return `plan-cmd-${label}-${Date.now()}-${crypto.randomUUID()}@example.com`;
}

function newPassword(): string {
  return `Pw-${crypto.randomUUID()}`;
}

/** A confirmed account made by the operator's own path, so a case does not depend on another case's run. */
async function makeAccount(label: string): Promise<{ email: string; password: string; userId: string }> {
  const email = uniqueEmail(label);
  const password = newPassword();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`could not create the ${label} account: ${error.message}`);
  return { email, password, userId: data.user.id };
}

/** What the app itself sees: sign in as the user and call `current_plan()`. */
async function currentPlan(email: string, password: string): Promise<unknown> {
  const client = createClient<Database>(url, key, { auth: authOptions });
  const signIn = await client.auth.signInWithPassword({ email, password });
  expect(signIn.error).toBeNull();
  const rpc = await client.rpc("current_plan");
  expect(rpc.error).toBeNull();
  return rpc.data;
}

async function storedPlan(userId: string): Promise<string | undefined> {
  const { data, error } = await admin.from("account_plans").select("plan").eq("user_id", userId);
  expect(error).toBeNull();
  return data?.[0]?.plan;
}

function capture() {
  const lines: string[] = [];
  return { lines, out: (line: string) => lines.push(line), text: () => lines.join("\n") };
}

function parsed(argv: string[]) {
  const result = parseArgs(argv);
  if (!result.ok) throw new Error(`parseArgs rejected ${argv.join(" ")}: ${result.error}`);
  return result;
}

/** Options for `run` from CLI-style arguments; the target is the local stack unless the case overrides it. */
function options(argv: string[], overrides: Record<string, unknown> = {}) {
  const { ok: _ok, ...args } = parsed(argv);
  const output = capture();
  const readPassword = vi.fn(() => Promise.resolve(newPassword()));
  return { output, readPassword, opts: { admin, url, readPassword, out: output.out, ...args, ...overrides } };
}

function expectNoSecrets(text: string, ...passwords: string[]) {
  expect(text).not.toContain(secretKey);
  for (const password of passwords) expect(text).not.toContain(password);
}

describe("parseArgs", () => {
  it("accepts an email, an action and the flags that fit it", () => {
    expect(parseArgs(["a@example.com", "full"])).toEqual({
      ok: true,
      email: "a@example.com",
      action: "full",
      create: false,
      dryRun: false,
      generate: false,
      hosted: false,
    });
    expect(parseArgs(["A@Example.com", "full", "--create", "--generate", "--dry-run", "--hosted"])).toEqual({
      ok: true,
      email: "a@example.com",
      action: "full",
      create: true,
      dryRun: true,
      generate: true,
      hosted: true,
    });
    expect(parsed(["a@example.com", "free", "--dry-run"]).action).toBe("free");
    expect(parsed(["a@example.com", "show"]).action).toBe("show");
  });

  it("rejects an unknown action, an unknown flag and a wrong number of arguments", () => {
    for (const argv of [
      [],
      ["a@example.com"],
      ["a@example.com", "premium"],
      ["a@example.com", "full", "--force"],
      ["a@example.com", "full", "extra"],
      ["not-an-email", "full"],
    ]) {
      const result = parseArgs(argv);
      expect(result.ok, argv.join(" ")).toBe(false);
      if (!result.ok) expect(result.error).not.toBe("");
    }
  });

  it("rejects --create with free or show, and --generate without --create", () => {
    expect(parseArgs(["a@example.com", "free", "--create"]).ok).toBe(false);
    expect(parseArgs(["a@example.com", "show", "--create"]).ok).toBe(false);
    expect(parseArgs(["a@example.com", "full", "--generate"]).ok).toBe(false);
  });
});

describe("account-plan command", () => {
  beforeAll(async () => {
    const { error } = await admin.from("account_plans").select("user_id").limit(1);
    if (error) throw new Error(`the secret key cannot read account_plans: ${error.message}`);
  });

  it("--create full makes a confirmed account that signs in and reads full", async () => {
    const email = uniqueEmail("create");
    const { output, readPassword, opts } = options([email, "full", "--create"]);
    const password = newPassword();
    readPassword.mockResolvedValue(password);

    expect(await run(opts)).toBe(0);
    expect(readPassword).toHaveBeenCalledTimes(1);
    expect(output.text()).toContain(host);
    expect(await currentPlan(email, password)).toBe("full");
    expectNoSecrets(output.text(), password);
  });

  it("rejects a typed password shorter than 12 characters without creating the account", async () => {
    const email = uniqueEmail("short");
    const { output, readPassword, opts } = options([email, "full", "--create"]);
    readPassword.mockResolvedValue("short-pw");

    expect(await run(opts)).toBe(2);
    expect(output.text()).not.toContain("short-pw");
    const found = await admin.auth.admin.listUsers({ perPage: 1000 });
    expect(found.data.users.some((user) => user.email === email)).toBe(false);
  });

  it("--create --generate prints a random 20-character password once, and it signs in", async () => {
    const email = uniqueEmail("generate");
    const { output, readPassword, opts } = options([email, "full", "--create", "--generate"]);

    expect(await run(opts)).toBe(0);
    expect(readPassword).not.toHaveBeenCalled();

    const withPassword = output.lines.filter((line) => /[A-Za-z0-9]{20}\b/.test(line));
    expect(withPassword).toHaveLength(1);
    const password = /([A-Za-z0-9]{20})\s*$/.exec(withPassword[0] ?? "")?.[1];
    expect(password).toBeDefined();
    expect(await currentPlan(email, password ?? "")).toBe("full");
    expect(output.lines.filter((line) => line.includes(password ?? "")).length).toBe(1);
    expect(output.text()).not.toContain(secretKey);
  });

  it("toggles free and full, each visible on the user's next current_plan()", async () => {
    const account = await makeAccount("toggle");

    const toFull = options([account.email, "full"]);
    expect(await run(toFull.opts)).toBe(0);
    expect(await currentPlan(account.email, account.password)).toBe("full");

    const toFree = options([account.email, "free"]);
    expect(await run(toFree.opts)).toBe(0);
    expect(await currentPlan(account.email, account.password)).toBe("free");
    expect(await storedPlan(account.userId)).toBe("free");

    const again = options([account.email, "full"]);
    expect(await run(again.opts)).toBe(0);
    expect(await currentPlan(account.email, account.password)).toBe("full");

    for (const { output } of [toFull, toFree, again]) {
      expect(output.text()).toContain(host);
      expectNoSecrets(output.text(), account.password);
    }
  });

  it("finds the account whatever the case of the email", async () => {
    const account = await makeAccount("case");
    const { opts } = options([account.email.toUpperCase(), "full"]);

    expect(await run(opts)).toBe(0);
    expect(await storedPlan(account.userId)).toBe("full");
  });

  it("a repeat prints `no change` and exits 0", async () => {
    const account = await makeAccount("repeat");
    expect(await run(options([account.email, "full"]).opts)).toBe(0);
    const before = await admin.from("account_plans").select("updated_at").eq("user_id", account.userId);

    const { output, opts } = options([account.email, "full"]);
    expect(await run(opts)).toBe(0);
    expect(output.text()).toContain("no change");

    const after = await admin.from("account_plans").select("updated_at").eq("user_id", account.userId);
    expect(after.data).toEqual(before.data);
  });

  it("an account without a row is already free: `free` is no change and writes no row", async () => {
    const account = await makeAccount("already-free");
    const { output, opts } = options([account.email, "free"]);

    expect(await run(opts)).toBe(0);
    expect(output.text()).toContain("no change");
    expect(await storedPlan(account.userId)).toBeUndefined();
  });

  it("--dry-run reports the change and leaves the row alone", async () => {
    const account = await makeAccount("dry");
    expect(await run(options([account.email, "full"]).opts)).toBe(0);

    const { output, opts } = options([account.email, "free", "--dry-run"]);
    expect(await run(opts)).toBe(0);
    expect(output.text()).toContain("full");
    expect(output.text()).toContain("free");
    expect(await storedPlan(account.userId)).toBe("full");
    expect(await currentPlan(account.email, account.password)).toBe("full");
  });

  it("--dry-run --create writes nothing and asks for no password", async () => {
    const email = uniqueEmail("dry-create");
    const { readPassword, opts } = options([email, "full", "--create", "--dry-run"]);

    expect(await run(opts)).toBe(0);
    expect(readPassword).not.toHaveBeenCalled();
    const found = await admin.auth.admin.listUsers({ perPage: 1000 });
    expect(found.data.users.some((user) => user.email === email)).toBe(false);
  });

  it("an unknown email exits 1 and creates nothing", async () => {
    const email = uniqueEmail("unknown");
    for (const action of ["full", "free", "show"]) {
      const { output, readPassword, opts } = options([email, action]);
      expect(await run(opts)).toBe(1);
      expect(readPassword).not.toHaveBeenCalled();
      expect(output.text()).toContain(host);
    }
    const found = await admin.auth.admin.listUsers({ perPage: 1000 });
    expect(found.data.users.some((user) => user.email === email)).toBe(false);
  });

  it("--create on an existing account prints `account exists`, sets full and never asks for a password", async () => {
    const account = await makeAccount("exists");
    const { output, readPassword, opts } = options([account.email, "full", "--create"]);

    expect(await run(opts)).toBe(0);
    expect(output.text()).toContain("account exists");
    expect(readPassword).not.toHaveBeenCalled();
    expect(await currentPlan(account.email, account.password)).toBe("full");
    expectNoSecrets(output.text(), account.password);
  });

  it("show prints the email, the user id, the host and the plan", async () => {
    const account = await makeAccount("show");

    const free = options([account.email, "show"]);
    expect(await run(free.opts)).toBe(0);
    expect(free.output.text()).toContain(`${account.email} (${account.userId}) on ${host}: free`);

    expect(await run(options([account.email, "full"]).opts)).toBe(0);
    const full = options([account.email, "show"]);
    expect(await run(full.opts)).toBe(0);
    expect(full.output.text()).toContain(`${account.email} (${account.userId}) on ${host}: full`);
    expect(await storedPlan(account.userId)).toBe("full");
    expectNoSecrets(full.output.text(), account.password);
  });

  it("a non-local URL without --hosted exits 2 before any admin call", async () => {
    const touched: string[] = [];
    const trap = new Proxy(
      {},
      {
        get(_target, property) {
          touched.push(String(property));
          throw new Error(`admin.${String(property)} was used`);
        },
      },
    );
    const { output, readPassword, opts } = options(["someone@example.com", "full", "--create"], {
      admin: trap,
      url: "https://abcdefgh.supabase.co",
    });

    expect(await run(opts)).toBe(2);
    expect(touched).toEqual([]);
    expect(readPassword).not.toHaveBeenCalled();
    expect(output.text()).toContain("--hosted");
    expect(output.text()).toContain("abcdefgh.supabase.co");
  });

  it("a non-local URL with --hosted names the host and proceeds", async () => {
    const calls: string[] = [];
    const fake = {
      auth: {
        admin: {
          listUsers: () => {
            calls.push("listUsers");
            return Promise.resolve({ data: { users: [] }, error: null });
          },
        },
      },
    };
    const { output, opts } = options(["someone@example.com", "show", "--hosted"], {
      admin: fake,
      url: "https://abcdefgh.supabase.co",
    });

    expect(await run(opts)).toBe(1);
    expect(calls).toEqual(["listUsers"]);
    expect(output.lines[0]).toContain("abcdefgh.supabase.co");
  });

  it("a malformed URL exits 2 before any admin call", async () => {
    const { opts } = options(["someone@example.com", "show"], { url: "not a url", admin: {} });
    expect(await run(opts)).toBe(2);
  });
});
