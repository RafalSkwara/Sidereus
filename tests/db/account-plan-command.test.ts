/**
 * The operator command `scripts/account-plan.mjs` (roadmap F-01): proved against local Supabase without a TTY by
 * calling the exported `run` with a real admin client, a stubbed `readPassword` and a captured `out`, plus one
 * spawn of the script itself for the entry checks (a malformed URL and a refused argument list). `parseArgs` has no
 * unit cases of its own: every case below builds its options through it, and the spawn proves its refusals.
 *
 * Every case that touches an account asserts through the user's own `current_plan()`, the path the app reads, not
 * only through the command's output. The output is also checked for secrets: neither the secret key nor a typed
 * password may appear, except the single line `--generate` prints on purpose (asserted separately).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/database.types";
import { parseArgs, run, UsageError } from "../../scripts/account-plan.mjs";

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

async function accountExists(email: string): Promise<boolean> {
  const found = await admin.auth.admin.listUsers({ perPage: 1000 });
  return found.data.users.some((user) => user.email === email);
}

describe("account-plan command", () => {
  beforeAll(async () => {
    const { error } = await admin.from("account_plans").select("user_id").limit(1);
    if (error) throw new Error(`the secret key cannot read account_plans: ${error.message}`);
  });

  it("grants and demotes, each visible on the user's next current_plan(); a repeat or a dry run changes nothing", async () => {
    const account = await makeAccount("toggle");

    // Grant, finding the account whatever the case of the email.
    const toFull = options([account.email.toUpperCase(), "full"]);
    expect(await run(toFull.opts)).toBe(0);
    expect(await currentPlan(account.email, account.password)).toBe("full");
    expect(await storedPlan(account.userId)).toBe("full");

    // A repeat prints `no change` and leaves the row untouched.
    const before = await admin.from("account_plans").select("updated_at").eq("user_id", account.userId);
    const repeat = options([account.email, "full"]);
    expect(await run(repeat.opts)).toBe(0);
    expect(repeat.output.text()).toContain("no change");
    const after = await admin.from("account_plans").select("updated_at").eq("user_id", account.userId);
    expect(after.data).toEqual(before.data);

    // A dry run reports the change and leaves the row alone.
    const dry = options([account.email, "free", "--dry-run"]);
    expect(await run(dry.opts)).toBe(0);
    expect(dry.output.text()).toContain("full");
    expect(dry.output.text()).toContain("free");
    expect(await storedPlan(account.userId)).toBe("full");
    expect(await currentPlan(account.email, account.password)).toBe("full");

    // Demote, then grant again.
    const toFree = options([account.email, "free"]);
    expect(await run(toFree.opts)).toBe(0);
    expect(await currentPlan(account.email, account.password)).toBe("free");
    expect(await storedPlan(account.userId)).toBe("free");

    const again = options([account.email, "full"]);
    expect(await run(again.opts)).toBe(0);
    expect(await currentPlan(account.email, account.password)).toBe("full");

    for (const { output } of [toFull, repeat, dry, toFree, again]) {
      expect(output.text()).toContain(host);
      expectNoSecrets(output.text(), account.password);
    }

    // An account without a row is already free: `free` is no change and writes no row.
    const fresh = await makeAccount("already-free");
    const alreadyFree = options([fresh.email, "free"]);
    expect(await run(alreadyFree.opts)).toBe(0);
    expect(alreadyFree.output.text()).toContain("no change");
    expect(await storedPlan(fresh.userId)).toBeUndefined();
  });

  it("--create makes a confirmed account that signs in and reads full, and every refused or dry run creates nothing", async () => {
    // A typed password.
    const email = uniqueEmail("create");
    const typed = options([email, "full", "--create"]);
    const password = newPassword();
    typed.readPassword.mockResolvedValue(password);
    expect(await run(typed.opts)).toBe(0);
    expect(typed.readPassword).toHaveBeenCalledTimes(1);
    expect(typed.output.text()).toContain(host);
    expect(await currentPlan(email, password)).toBe("full");
    expectNoSecrets(typed.output.text(), password);

    // A generated password is printed once, 20 characters long, and signs in.
    const generatedEmail = uniqueEmail("generate");
    const generated = options([generatedEmail, "full", "--create", "--generate"]);
    expect(await run(generated.opts)).toBe(0);
    expect(generated.readPassword).not.toHaveBeenCalled();
    const withPassword = generated.output.lines.filter((line) => /[A-Za-z0-9]{20}\b/.test(line));
    expect(withPassword).toHaveLength(1);
    const generatedPassword = /([A-Za-z0-9]{20})\s*$/.exec(withPassword[0] ?? "")?.[1];
    expect(generatedPassword).toBeDefined();
    expect(await currentPlan(generatedEmail, generatedPassword ?? "")).toBe("full");
    expect(generated.output.lines.filter((line) => line.includes(generatedPassword ?? "")).length).toBe(1);
    expect(generated.output.text()).not.toContain(secretKey);

    // An existing account prints `account exists`, gets the plan and is never asked for a password.
    const account = await makeAccount("exists");
    const exists = options([account.email, "full", "--create"]);
    expect(await run(exists.opts)).toBe(0);
    expect(exists.output.text()).toContain("account exists");
    expect(exists.readPassword).not.toHaveBeenCalled();
    expect(await currentPlan(account.email, account.password)).toBe("full");
    expectNoSecrets(exists.output.text(), account.password);

    // A typed password shorter than 12 characters is refused without creating the account.
    const shortEmail = uniqueEmail("short");
    const short = options([shortEmail, "full", "--create"]);
    short.readPassword.mockResolvedValue("short-pw");
    expect(await run(short.opts)).toBe(2);
    expect(short.output.text()).not.toContain("short-pw");
    expect(await accountExists(shortEmail)).toBe(false);

    // A dry run writes nothing and asks for no password.
    const dryEmail = uniqueEmail("dry-create");
    const dry = options([dryEmail, "full", "--create", "--dry-run"]);
    expect(await run(dry.opts)).toBe(0);
    expect(dry.readPassword).not.toHaveBeenCalled();
    expect(await accountExists(dryEmail)).toBe(false);

    // A prompt refused as a usage error (mismatch, no terminal) exits 2; any other failure exits 1; neither creates.
    const mismatchEmail = uniqueEmail("mismatch");
    const mismatch = options([mismatchEmail, "full", "--create"]);
    mismatch.readPassword.mockRejectedValue(new UsageError("the two passwords do not match"));
    expect(await run(mismatch.opts)).toBe(2);
    expect(mismatch.output.text()).toContain("do not match");
    expect(await accountExists(mismatchEmail)).toBe(false);

    const cancelEmail = uniqueEmail("cancel");
    const cancelled = options([cancelEmail, "full", "--create"]);
    cancelled.readPassword.mockRejectedValue(new Error("cancelled"));
    expect(await run(cancelled.opts)).toBe(1);
    expect(await accountExists(cancelEmail)).toBe(false);
  });

  it("show prints the email, the user id, the host and the plan; an unknown email exits 1 and creates nothing", async () => {
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

    const email = uniqueEmail("unknown");
    for (const action of ["full", "free", "show"]) {
      const { output, readPassword, opts } = options([email, action]);
      expect(await run(opts)).toBe(1);
      expect(readPassword).not.toHaveBeenCalled();
      expect(output.text()).toContain(host);
    }
    expect(await accountExists(email)).toBe(false);
  });

  it("refuses a non-local URL without --hosted before any admin call, names the host with it, and refuses a malformed URL", async () => {
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
    const refused = options(["someone@example.com", "full", "--create"], {
      admin: trap,
      url: "https://abcdefgh.supabase.co",
    });
    expect(await run(refused.opts)).toBe(2);
    expect(touched).toEqual([]);
    expect(refused.readPassword).not.toHaveBeenCalled();
    expect(refused.output.text()).toContain("--hosted");
    expect(refused.output.text()).toContain("abcdefgh.supabase.co");

    // Positive control: --hosted lets the same URL through to the first admin call, which finds no such user.
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
    const proceeds = options(["someone@example.com", "show", "--hosted"], {
      admin: fake,
      url: "https://abcdefgh.supabase.co",
    });
    expect(await run(proceeds.opts)).toBe(1);
    expect(calls).toEqual(["listUsers"]);
    expect(proceeds.output.lines[0]).toContain("abcdefgh.supabase.co");

    const malformed = options(["someone@example.com", "show"], { url: "not a url", admin: {} });
    expect(await run(malformed.opts)).toBe(2);
  });
});

describe("account-plan script entry", () => {
  const script = fileURLToPath(new URL("../../scripts/account-plan.mjs", import.meta.url));
  const dummyKey = "sb_secret_dummy_not_a_real_key";

  function spawn(argv: string[], supabaseUrl: string) {
    return spawnSync(process.execPath, [script, ...argv], {
      env: {
        PATH: process.env.PATH ?? "",
        SUPABASE_URL: supabaseUrl,
        SUPABASE_KEY: "dummy",
        SUPABASE_SECRET_KEY: dummyKey,
      },
      encoding: "utf8",
    });
  }

  it("a malformed SUPABASE_URL exits 2 with the hint and no stack trace, and never prints the key; a refused argument list exits 2 with the usage", () => {
    const result = spawn(["someone@example.com", "show"], "not a url");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("SUPABASE_URL is not a valid URL");
    expect(result.stderr).not.toMatch(/\bat .*\(|node:internal|Error:/);
    expect(result.stdout + result.stderr).not.toContain(dummyKey);

    // The parseArgs refusals, through the entry point: an unknown action, --create with free, --generate alone.
    for (const argv of [
      ["someone@example.com", "premium"],
      ["someone@example.com", "free", "--create"],
      ["someone@example.com", "full", "--generate"],
    ]) {
      const refused = spawn(argv, url);
      expect(refused.status, argv.join(" ")).toBe(2);
      expect(refused.stderr, argv.join(" ")).toContain("usage:");
      expect(refused.stdout + refused.stderr).not.toContain(dummyKey);
    }
  });
});
