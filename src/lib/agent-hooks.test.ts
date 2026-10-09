import { spawn } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Proof of the Claude Code agent hooks in .claude/hooks (test rollout Phase 5, testing-quality-gates-wiring; rules in
 * the 10x-configure-hook skill, Step 7). Each case pipes a hook payload into the real script inside a throwaway git
 * repository whose `node_modules/.bin/eslint` and `vitest` are stubs: they log their calls and fail on a `BROKEN`
 * marker in a source file, so a case asserts the exit code and the channel (stderr reaches the agent on exit 2, a
 * `systemMessage` on stdout reaches the user) without running the real tools.
 *
 * The environment is rebuilt per case: its own TMPDIR (the scripts keep per-session state there), an NVM_DIR without
 * nvm, no CLAUDE_PROJECT_DIR or GIT_* variables, and a fixed git identity (CI runners have none).
 */

const REPO_ROOT = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
const HOOKS_DIR = join(REPO_ROOT, ".claude", "hooks");
const SCRIPTS = ["lib.sh", "turn-start.sh", "register-checkout.sh", "end-of-turn.sh"];
const BASH = "/bin/bash";
const SANDBOX = realpathSync(mkdtempSync(join(tmpdir(), "agent-hooks-")));

const GIT_ENV = {
  GIT_AUTHOR_NAME: "agent-hooks test",
  GIT_AUTHOR_EMAIL: "agent-hooks@example.invalid",
  GIT_COMMITTER_NAME: "agent-hooks test",
  GIT_COMMITTER_EMAIL: "agent-hooks@example.invalid",
};

// Lint stub: requires --no-warn-ignored, fails on a BROKEN marker in any file it is given.
const ESLINT_STUB = `#!/bin/sh
echo "eslint $*" >> "$STUB_LOG"
case " $* " in *" --no-warn-ignored "*) ;; *) echo "stub eslint: --no-warn-ignored missing"; exit 3 ;; esac
status=0
for f in "$@"; do
  case "$f" in --*|0) continue ;; esac
  if grep -q BROKEN "$f" 2>/dev/null; then echo "$f: BROKEN marker"; status=1; fi
done
exit $status
`;

// Test stub: fails when any file under src carries the BROKEN marker.
const VITEST_STUB = `#!/bin/sh
echo "vitest $*" >> "$STUB_LOG"
if grep -rl BROKEN src 2>/dev/null; then echo "stub vitest: a test fails"; exit 1; fi
exit 0
`;

/** A child's environment. Not NodeJS.ProcessEnv: worker-configuration.d.ts makes the Worker's bindings required there. */
type Env = Record<string, string | undefined>;

interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

interface Sandbox {
  repo: string;
  tmp: string;
  log: string;
  env: Env;
}

let counter = 0;

function git(cwd: string, ...args: string[]): Promise<Run> {
  return run("git", args, { cwd, env: { ...cleanEnv(), ...GIT_ENV } });
}

/** The test process's environment without anything that would point the scripts or git at another checkout. */
function cleanEnv(): Env {
  const dropped = new Set(["CLAUDE_PROJECT_DIR", "GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE"]);
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !dropped.has(key)));
}

function run(command: string, args: string[], options: { cwd: string; env: Env; input?: string }): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env as NodeJS.ProcessEnv });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(options.input ?? "");
  });
}

/** Stubbed eslint and vitest, and generated types, in a checkout (a fresh worktree has neither). */
function installTools(checkout: string): void {
  mkdirSync(join(checkout, "node_modules", ".bin"), { recursive: true });
  mkdirSync(join(checkout, ".astro"), { recursive: true });
  for (const [name, body] of [
    ["eslint", ESLINT_STUB],
    ["vitest", VITEST_STUB],
  ] as const) {
    writeFileSync(join(checkout, "node_modules", ".bin", name), body);
    chmodSync(join(checkout, "node_modules", ".bin", name), 0o755);
  }
}

/** A git repo with the hooks committed, stubbed tools, a clean `src/a.ts` and a README. */
async function sandbox(withHooks = true): Promise<Sandbox> {
  counter += 1;
  const base = join(SANDBOX, `case-${String(counter)}`);
  const repo = join(base, "repo");
  const tmp = join(base, "tmp");
  const nvm = join(base, "no-nvm");
  for (const dir of [repo, tmp, nvm, join(repo, "src")]) mkdirSync(dir, { recursive: true });
  installTools(repo);
  if (withHooks) {
    mkdirSync(join(repo, ".claude", "hooks"), { recursive: true });
    for (const script of SCRIPTS) copyFileSync(join(HOOKS_DIR, script), join(repo, ".claude", "hooks", script));
    copyFileSync(join(REPO_ROOT, ".claude", "settings.json"), join(repo, ".claude", "settings.json"));
  }
  writeFileSync(join(repo, ".gitignore"), "node_modules/\n.astro/\n");
  writeFileSync(join(repo, "src", "a.ts"), "export const a = 1;\n");
  writeFileSync(join(repo, "README.md"), "# sandbox\n");
  await git(repo, "init", "-q");
  await git(repo, "add", "-A");
  await git(repo, "commit", "-q", "-m", "init");
  const log = join(base, "stub.log");
  writeFileSync(log, "");
  const env: Env = { ...cleanEnv(), ...GIT_ENV, TMPDIR: tmp, NVM_DIR: nvm, STUB_LOG: log };
  return { repo, tmp, log, env };
}

function hook(box: Sandbox, script: string, payload: unknown, cwd = box.repo, env = box.env): Promise<Run> {
  const input = typeof payload === "string" ? payload : JSON.stringify(payload);
  return run(BASH, [join(box.repo, ".claude", "hooks", script)], { cwd, env, input });
}

const stop = (box: Sandbox, extra: Record<string, unknown> = {}) => ({
  hook_event_name: "Stop",
  session_id: "s1",
  cwd: box.repo,
  stop_hook_active: false,
  ...extra,
});

const calls = (box: Sandbox) => readFileSync(box.log, "utf8").trim();

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true });
});

describe("end-of-turn.sh", () => {
  it("1. sends the agent back when a changed file is broken, naming it on stderr", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "export const a = 1; // BROKEN\n");
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("src/a.ts");
    expect(result.stderr).toContain("Fix these before you finish");
  });

  it("2. lets a clean change finish with nothing on stderr", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "export const a = 2;\n");
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(calls(box)).toContain("vitest run");
  });

  it("3. runs nothing for a documentation-only change", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "README.md"), "# sandbox, edited\n");
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result.code).toBe(0);
    expect(calls(box)).toBe("");
  });

  it("4. runs nothing when the checkout has no changes", async () => {
    const box = await sandbox();
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(calls(box)).toBe("");
  });

  it("5. treats an empty or unparseable payload as the process cwd", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "// BROKEN\n");
    expect((await hook(box, "end-of-turn.sh", "{}")).code).toBe(2);
    expect((await hook(box, "end-of-turn.sh", "not json")).code).toBe(2);
  });

  it("6. lets the retry pass finish, and tells the user the turn ended red", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "// BROKEN\n");
    const result = await hook(box, "end-of-turn.sh", stop(box, { stop_hook_active: true }));
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    const message = JSON.parse(result.stdout) as { systemMessage: string };
    expect(message.systemMessage).toContain(box.repo);
  });

  it("7. catches a file written without any per-edit hook (a shell rewrite)", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "b.ts"), "// BROKEN, written by a shell command\n");
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("src/b.ts");
  });

  it("8. resolves checkouts from the payload and the registry, never from CLAUDE_PROJECT_DIR", async () => {
    const box = await sandbox();
    const other = await sandbox();
    writeFileSync(join(other.repo, "src", "a.ts"), "// BROKEN\n");
    // CLAUDE_PROJECT_DIR names a broken checkout; the session's checkout is clean.
    const pinned = await hook(box, "end-of-turn.sh", stop(box), box.repo, {
      ...box.env,
      CLAUDE_PROJECT_DIR: other.repo,
    });
    expect(pinned.code).toBe(0);

    // A sibling worktree edited this turn is swept through the registry.
    const worktree = join(box.repo, "..", "wt");
    await git(box.repo, "worktree", "add", "-q", worktree);
    installTools(worktree);
    writeFileSync(join(worktree, "src", "a.ts"), "// BROKEN in the worktree\n");
    const edit = { session_id: "s8", cwd: box.repo, tool_name: "Edit", tool_input: { file_path: "src/a.ts" } };
    // A relative path resolves against the payload cwd: here the worktree.
    expect((await hook(box, "register-checkout.sh", { ...edit, cwd: worktree })).code).toBe(0);
    const registry = readFileSync(join(box.tmp, "claude-hooks", "s8.roots"), "utf8");
    expect(registry.trim()).toBe(realpathSync(worktree));
    const swept = await hook(box, "end-of-turn.sh", stop(box, { session_id: "s8" }));
    expect(swept.code).toBe(2);
    expect(swept.stderr).toContain(realpathSync(worktree));
    expect(swept.stderr).not.toContain("npm ci");

    // A registered repository without these hooks is skipped.
    const foreign = await sandbox(false);
    writeFileSync(join(foreign.repo, "src", "a.ts"), "// BROKEN, not ours\n");
    const registered = { ...edit, session_id: "s8b", tool_input: { file_path: join(foreign.repo, "src", "a.ts") } };
    expect((await hook(box, "register-checkout.sh", registered)).code).toBe(0);
    expect((await hook(box, "end-of-turn.sh", stop(box, { session_id: "s8b" }))).code).toBe(0);
  });

  it("9. fails visibly when a tool is missing, never passing silently", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "export const a = 3;\n");
    rmSync(join(box.repo, "node_modules", ".bin", "eslint"));
    const noLinter = await hook(box, "end-of-turn.sh", stop(box));
    expect(noLinter.code).toBe(2);
    expect(noLinter.stderr).toContain("npm ci");

    const noJq = await hook(box, "end-of-turn.sh", stop(box), box.repo, { ...box.env, PATH: "" });
    expect(noJq.code).toBe(2);
    expect(noJq.stderr).toContain("jq");
  });

  it("10. passes --no-warn-ignored, so an eslint-ignored generated file does not fail the run", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "database.types.ts"), "export type Generated = 1;\n");
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result.code).toBe(0);
    expect(calls(box)).toMatch(/eslint --max-warnings 0 --no-warn-ignored .*src\/database\.types\.ts/);
  });

  it("11. skips work in progress from before the turn, and sweeps it once the turn changes something", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "// BROKEN, left from an earlier turn\n");
    const prompt = { hook_event_name: "UserPromptSubmit", session_id: "s11", cwd: box.repo, prompt: "hi" };
    expect((await hook(box, "turn-start.sh", prompt)).code).toBe(0);
    const unchanged = await hook(box, "end-of-turn.sh", stop(box, { session_id: "s11" }));
    expect(unchanged.code).toBe(0);
    expect(calls(box)).toBe("");

    writeFileSync(join(box.repo, "src", "c.ts"), "export const c = 1;\n");
    expect((await hook(box, "end-of-turn.sh", stop(box, { session_id: "s11" }))).code).toBe(2);
  });

  it("12. treats a SubagentStop payload like Stop", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "// BROKEN by a subagent\n");
    const payload = stop(box, { hook_event_name: "SubagentStop", agent_id: "def456", agent_type: "general-purpose" });
    expect((await hook(box, "end-of-turn.sh", payload)).code).toBe(2);
  });

  it("15. does not see a checkout when the session cwd is not one and nothing was registered (documented limit)", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "// BROKEN through a shell command\n");
    const outside = join(box.tmp, "projects");
    mkdirSync(outside);
    expect((await hook(box, "end-of-turn.sh", stop(box, { cwd: outside }), outside)).code).toBe(0);
  });
});

describe("turn-start.sh", () => {
  it("13. prints nothing (its stdout would join the prompt) and always exits 0", async () => {
    const box = await sandbox();
    const outside = join(box.tmp, "projects");
    mkdirSync(outside);
    const payloads = [
      "{}",
      "not json",
      { session_id: "s13", cwd: outside, prompt: "hi" },
      { session_id: "s13", cwd: box.repo, prompt: "hi" },
    ];
    for (const payload of payloads) {
      const result = await hook(box, "turn-start.sh", payload);
      expect(result, JSON.stringify(payload)).toMatchObject({ code: 0, stdout: "", stderr: "" });
    }
  });
});

describe("hook scripts and registration", () => {
  it("14. every script parses (bash -n)", async () => {
    for (const script of SCRIPTS) {
      const result = await run(BASH, ["-n", join(HOOKS_DIR, script)], { cwd: REPO_ROOT, env: cleanEnv() });
      expect(result, script).toMatchObject({ code: 0, stderr: "" });
    }
  });

  it("every command in .claude/settings.json reaches its script from a worktree, whatever CLAUDE_PROJECT_DIR says", async () => {
    const box = await sandbox();
    const worktree = join(box.repo, "..", "wt-settings");
    await git(box.repo, "worktree", "add", "-q", worktree);
    const settings = JSON.parse(readFileSync(join(REPO_ROOT, ".claude", "settings.json"), "utf8")) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    const commands = Object.values(settings.hooks).flatMap((groups) =>
      groups.flatMap((group) => group.hooks.map((entry) => entry.command)),
    );
    expect(commands.length).toBeGreaterThanOrEqual(4);
    for (const command of commands) {
      const env = { ...box.env, CLAUDE_PROJECT_DIR: join(box.tmp, "does-not-exist") };
      const result = await run("/bin/sh", ["-c", command], { cwd: worktree, env, input: "{}" });
      expect(result, command).toMatchObject({ code: 0, stderr: "" });
    }
  });
});
