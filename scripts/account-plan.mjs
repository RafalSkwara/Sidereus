// Operator command for account plans (roadmap F-01, PRD FR-045): creates a full account or moves an account between plans.
//
//   npm run account:plan -- <email> full|free|show [--create] [--dry-run] [--generate] [--hosted]
//
//   full | free   set the plan (a demote keeps the row with plan = 'free'); the same plan again prints `no change`
//   show          print the current plan
//   --create      with `full`: make the account first (confirmed, password from a hidden prompt, asked twice, 12+ chars);
//                 if the account already exists it only prints `account exists` and carries on, so a re-run finishes a create
//   --generate    with --create: use a random 20-character password and print it once instead of prompting
//   --dry-run     print the intended change and write nothing
//   --hosted      required when SUPABASE_URL is not 127.0.0.1 / localhost
//
// Exit codes: 0 done or no change, 1 unknown email (without --create) or a failed admin call, 2 bad usage, missing env
// or a non-local URL without --hosted.
//
// Key rule: the secret key bypasses RLS, so it exists only in the operator's shell for the one command:
//   SUPABASE_URL=<api url> SUPABASE_SECRET_KEY=<secret key> npm run account:plan -- ...
// The script reads nothing else: no `.env` (it points at the hosted project) and no `.dev.vars`. The agent never holds
// the hosted key. It prints the target host before any write and never prints the key or a typed password.

import { randomInt } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ACTIONS = ["full", "free", "show"];
const FLAGS = { "--create": "create", "--dry-run": "dryRun", "--generate": "generate", "--hosted": "hosted" };
const LOCAL_HOSTS = ["127.0.0.1", "localhost"];
const MIN_PASSWORD_LENGTH = 12;
const GENERATED_PASSWORD_LENGTH = 20;
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const LIST_PAGE_SIZE = 1000;

/**
 * @typedef {"full" | "free" | "show"} Action
 * @typedef {{ ok: true, email: string, action: Action, create: boolean, dryRun: boolean, generate: boolean, hosted: boolean }} ParsedArgs
 * @typedef {{ ok: false, error: string }} ArgsError
 */

/**
 * Pure argument parsing (argv without `node` and the script path). The email is lower-cased, as Supabase stores it.
 * @param {string[]} argv
 * @returns {ParsedArgs | ArgsError}
 */
export function parseArgs(argv) {
  const flags = { create: false, dryRun: false, generate: false, hosted: false };
  /** @type {string[]} */
  const positional = [];
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const name = FLAGS[/** @type {keyof typeof FLAGS} */ (arg)];
      if (!name) return { ok: false, error: `unknown flag ${arg}` };
      flags[name] = true;
    } else {
      positional.push(arg);
    }
  }
  const [email, action, ...extra] = positional;
  if (!email || !action) return { ok: false, error: "expected <email> and an action (full, free or show)" };
  if (extra.length > 0) return { ok: false, error: `unexpected argument ${extra[0]}` };
  if (!email.includes("@")) return { ok: false, error: `${email} is not an email address` };
  if (!ACTIONS.includes(action)) return { ok: false, error: `unknown action ${action} (expected full, free or show)` };
  if (flags.create && action !== "full") return { ok: false, error: "--create only works with the full action" };
  if (flags.generate && !flags.create) return { ok: false, error: "--generate only works with --create" };
  return { ok: true, email: email.trim().toLowerCase(), action: /** @type {Action} */ (action), ...flags };
}

/**
 * @typedef {object} RunOptions
 * @property {import("@supabase/supabase-js").SupabaseClient} admin Client built with the secret key (injected so tests need no env).
 * @property {string} url The API URL the client talks to; only its host is printed, and a non-local one needs `hosted`.
 * @property {string} email
 * @property {Action} action
 * @property {boolean} [create]
 * @property {boolean} [dryRun]
 * @property {boolean} [generate]
 * @property {boolean} [hosted]
 * @property {() => Promise<string>} readPassword Asks for the new account's password (hidden, confirmed); never called with `generate`.
 * @property {(line: string) => void} out Every line of output; never receives the key or a typed password.
 */

/** @param {number} length */
function randomPassword(length) {
  return Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join("");
}

/**
 * The account with this email (case-insensitive), paging through the admin user list.
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} email
 */
async function findUser(admin, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: LIST_PAGE_SIZE });
    if (error) throw new Error(`could not list users: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < LIST_PAGE_SIZE) return null;
  }
}

/**
 * Runs one command and returns its exit code.
 * @param {RunOptions} options
 * @returns {Promise<0 | 1 | 2>}
 */
export async function run(options) {
  const {
    admin,
    email,
    action,
    create = false,
    dryRun = false,
    generate = false,
    hosted = false,
    readPassword,
    out,
  } = options;

  let host;
  try {
    const parsedUrl = new URL(options.url);
    host = parsedUrl.host;
    if (!hosted && !LOCAL_HOSTS.includes(parsedUrl.hostname)) {
      out(`refusing to touch ${host}: it is not local. Pass --hosted if this is the project you mean.`);
      return 2;
    }
  } catch {
    out("SUPABASE_URL is not a valid URL.");
    return 2;
  }
  out(`target: ${host}${dryRun ? " (dry run, nothing is written)" : ""}`);

  try {
    let user = await findUser(admin, email);
    if (!user) {
      if (!create) {
        out(`no account for ${email} on ${host}. Use --create with full to make one.`);
        return 1;
      }
      if (dryRun) {
        out(`${email} on ${host}: would create the account and set it to full`);
        return 0;
      }
      const password = generate ? randomPassword(GENERATED_PASSWORD_LENGTH) : await readPassword();
      if (password.length < MIN_PASSWORD_LENGTH) {
        out(`the password must be at least ${MIN_PASSWORD_LENGTH} characters; nothing was created.`);
        return 2;
      }
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error) throw new Error(`could not create the account: ${created.error.message}`);
      user = created.data.user;
      out(`created ${email} (${user.id}) on ${host}`);
      if (generate) out(`generated password (shown once): ${password}`);
    } else if (create) {
      out(`account exists: ${email} (${user.id}); continuing as a plain full`);
    }

    const read = await admin.from("account_plans").select("plan").eq("user_id", user.id);
    if (read.error) throw new Error(`could not read the plan: ${read.error.message}`);
    const current = read.data[0]?.plan === "full" ? "full" : "free";
    const who = `${email} (${user.id}) on ${host}`;

    if (action === "show") {
      out(`${who}: ${current}`);
      return 0;
    }
    if (current === action) {
      out(`${who}: ${current}, no change`);
      return 0;
    }
    if (dryRun) {
      out(`${who}: would change ${current} → ${action}`);
      return 0;
    }
    const write = await admin
      .from("account_plans")
      .upsert({ user_id: user.id, plan: action, updated_at: new Date().toISOString() });
    if (write.error) {
      throw new Error(`could not set the plan: ${write.error.message}. Re-run the same command to finish.`);
    }
    out(`${who}: ${current} → ${action}`);
    return 0;
  } catch (error) {
    out(`failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

/**
 * Reads one line from the terminal without echoing it.
 * @param {string} label
 * @returns {Promise<string>}
 */
function promptHidden(label) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error("no terminal to ask for a password; run it in a terminal or pass --generate"));
      return;
    }
    stdout.write(label);
    let typed = "";
    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
    };
    /** @param {string} chunk */
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n" || char === "\u0004") {
          finish();
          resolve(typed);
          return;
        }
        if (char === "\u0003") {
          finish();
          reject(new Error("cancelled"));
          return;
        }
        typed = char === "\u007f" ? typed.slice(0, -1) : typed + char;
      }
    };
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function readPasswordTwice() {
  const first = await promptHidden("New account password (hidden, 12+ characters): ");
  const second = await promptHidden("Repeat the password: ");
  if (first !== second) throw new Error("the two passwords do not match");
  return first;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(
      `${args.error}\nusage: npm run account:plan -- <email> full|free|show [--create] [--dry-run] [--generate] [--hosted]`,
    );
    return 2;
  }
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    console.error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY must be set in this shell (no .env fallback). Locally: take API_URL and SECRET_KEY\n" +
        "from `npx supabase status -o env`. For the hosted project the owner exports them for this one command only.",
    );
    return 2;
  }
  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { ok: _ok, ...rest } = args;
  return run({ ...rest, admin, url, readPassword: readPasswordTwice, out: (line) => console.log(line) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
