import { spawn } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Proof of the Claude Code agent hooks in .claude/hooks (test rollout Phase 5, testing-quality-gates-wiring; rules in
 * the 10x-configure-hook skill, Step 7). Each case pipes a hook payload into the real script inside a throwaway git
 * repository whose `node_modules/.bin/eslint` and `vitest` are stubs: they log their calls and fail on a `BROKEN`
 * marker in a source file, so a case asserts the exit code and the channel (stderr reaches the agent on exit 2, a
 * `systemMessage` on stdout reaches the user) without running the real tools.
 *
 * The stubs are written once and symlinked into each repository: macOS scans every newly written executable on its
 * first run (~0.5 s), which per case made this file the slowest in the suite. The environment is rebuilt per case:
 * its own TMPDIR (the scripts keep per-agent state there), an NVM_DIR without nvm, no CLAUDE_PROJECT_DIR or GIT_*
 * variables, and a fixed git identity (CI runners have none).
 */

const REPO_ROOT = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
const HOOKS_DIR = join(REPO_ROOT, ".claude", "hooks");
const SCRIPTS = ["lib.sh", "turn-start.sh", "register-checkout.sh", "end-of-turn.sh"];
const BASH = "/bin/bash";
const SANDBOX = realpathSync(mkdtempSync(join(tmpdir(), "agent-hooks-")));
const STUBS = join(SANDBOX, "stubs");

const GIT_ENV = {
  GIT_AUTHOR_NAME: "agent-hooks test",
  GIT_AUTHOR_EMAIL: "agent-hooks@example.invalid",
  GIT_COMMITTER_NAME: "agent-hooks test",
  GIT_COMMITTER_EMAIL: "agent-hooks@example.invalid",
};

// Lint stub: options come before `--`, files after it (a file named like an option stays a file). Requires both
// `--no-warn-ignored` and `--`, and fails on a BROKEN marker in any file it is given.
const ESLINT_STUB = `#!/bin/sh
echo "eslint $*" >> "$STUB_LOG"
case " $* " in *" --no-warn-ignored "*) ;; *) echo "stub eslint: --no-warn-ignored missing"; exit 3 ;; esac
while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do shift; done
[ "$1" = "--" ] || { echo "stub eslint: no -- before the paths"; exit 3; }
shift
status=0
for f in "$@"; do
  if grep -q BROKEN -- "$f" 2>/dev/null; then echo "$f: BROKEN marker"; status=1; fi
done
exit $status
`;

// Test stub: fails when any file under src carries the BROKEN marker.
const VITEST_STUB = `#!/bin/sh
echo "vitest $*" >> "$STUB_LOG"
if grep -rl BROKEN src 2>/dev/null; then echo "stub vitest: a test fails"; exit 1; fi
exit 0
`;

mkdirSync(STUBS);
for (const [name, body] of [
  ["eslint", ESLINT_STUB],
  ["vitest", VITEST_STUB],
] as const) {
  writeFileSync(join(STUBS, name), body);
  chmodSync(join(STUBS, name), 0o755);
}

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

/** The test process's environment without anything that would point the scripts or git at another checkout. */
function cleanEnv(): Env {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key !== "CLAUDE_PROJECT_DIR" && !key.startsWith("GIT_")),
  );
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

/** Git in a sandbox, independent of the developer's global signing and hook settings; a failure fails the case. */
async function git(cwd: string, ...args: string[]): Promise<void> {
  const result = await run("git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], {
    cwd,
    env: { ...cleanEnv(), ...GIT_ENV },
  });
  expect(result, `git ${args.join(" ")}`).toMatchObject({ code: 0 });
}

/** The stubbed eslint and vitest, and generated types, in a checkout (a fresh worktree has neither). */
function installTools(checkout: string): void {
  mkdirSync(join(checkout, "node_modules", ".bin"), { recursive: true });
  mkdirSync(join(checkout, ".astro"), { recursive: true });
  for (const name of ["eslint", "vitest"]) symlinkSync(join(STUBS, name), join(checkout, "node_modules", ".bin", name));
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

const prompt = (box: Sandbox, extra: Record<string, unknown> = {}) => ({
  hook_event_name: "UserPromptSubmit",
  session_id: "s1",
  cwd: box.repo,
  prompt: "go",
  ...extra,
});

const edit = (filePath: string, extra: Record<string, unknown> = {}) => ({
  hook_event_name: "PostToolUse",
  session_id: "s1",
  tool_name: "Edit",
  tool_input: { file_path: filePath },
  ...extra,
});

/** A subagent's events: SubagentStart, its edits and SubagentStop carry its `agent_id` and the parent's session. */
const subagent = (id: string) => ({ agent_id: id, agent_type: "general-purpose" });

async function worktree(box: Sandbox, name: string): Promise<string> {
  const path = join(box.repo, "..", name);
  await git(box.repo, "worktree", "add", "-q", path);
  installTools(path);
  return realpathSync(path);
}

const calls = (box: Sandbox) => readFileSync(box.log, "utf8").trim();

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true });
});

describe("end-of-turn.sh", () => {
  it("sends the agent back when a changed file is broken, naming it on stderr", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "export const a = 1; // BROKEN\n");
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("src/a.ts");
    expect(result.stderr).toContain("Fix these before you finish");
  });

  it("lets a clean change finish with nothing on stderr", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "export const a = 2;\n");
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(calls(box)).toContain("vitest run");
  });

  it("runs nothing for a documentation-only change, even where the tools are not installed", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "README.md"), "# sandbox, edited\n");
    rmSync(join(box.repo, "node_modules"), { recursive: true });
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(calls(box)).toBe("");
  });

  it("runs nothing when the checkout has no changes", async () => {
    const box = await sandbox();
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result).toMatchObject({ code: 0, stderr: "" });
    expect(calls(box)).toBe("");
  });

  it("treats an empty or unparseable payload as the process cwd", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "// BROKEN\n");
    expect((await hook(box, "end-of-turn.sh", "{}")).code).toBe(2);
    expect((await hook(box, "end-of-turn.sh", "not json")).code).toBe(2);
  });

  it("lets the retry pass finish, and tells the user the turn ended red", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "// BROKEN\n");
    const result = await hook(box, "end-of-turn.sh", stop(box, { stop_hook_active: true }));
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    const message = JSON.parse(result.stdout) as { systemMessage: string };
    expect(message.systemMessage).toContain(box.repo);
  });

  it("catches a file written without any per-edit hook (a shell rewrite)", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "b.ts"), "// BROKEN, written by a shell command\n");
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("src/b.ts");
  });

  it("resolves checkouts from the payload and the registry, never from CLAUDE_PROJECT_DIR", async () => {
    const box = await sandbox();
    const other = await sandbox();
    writeFileSync(join(other.repo, "src", "a.ts"), "// BROKEN\n");
    // CLAUDE_PROJECT_DIR names a broken checkout; the session's checkout is clean.
    const pinned = await hook(box, "end-of-turn.sh", stop(box), box.repo, {
      ...box.env,
      CLAUDE_PROJECT_DIR: other.repo,
    });
    expect(pinned.code).toBe(0);

    // A sibling worktree edited this turn is swept through the registry; a relative path resolves against the cwd.
    const wt = await worktree(box, "wt");
    writeFileSync(join(wt, "src", "a.ts"), "// BROKEN in the worktree\n");
    expect((await hook(box, "register-checkout.sh", edit("src/a.ts", { cwd: wt }))).code).toBe(0);
    expect(readFileSync(join(box.tmp, "claude-hooks", "s1.main.roots"), "utf8").trim()).toBe(wt);
    const swept = await hook(box, "end-of-turn.sh", stop(box));
    expect(swept.code).toBe(2);
    expect(swept.stderr).toContain(wt);
    expect(swept.stderr).not.toContain("npm ci");

    // A registered repository without these hooks is skipped.
    const foreign = await sandbox(false);
    writeFileSync(join(foreign.repo, "src", "a.ts"), "// BROKEN, not ours\n");
    const session = { session_id: "s2", cwd: box.repo };
    expect((await hook(box, "register-checkout.sh", edit(join(foreign.repo, "src", "a.ts"), session))).code).toBe(0);
    expect((await hook(box, "end-of-turn.sh", stop(box, session))).code).toBe(0);
  });

  it("fails visibly when a tool is missing, naming it, never passing silently", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "export const a = 3;\n");
    rmSync(join(box.repo, "node_modules", ".bin", "eslint"));
    const noLinter = await hook(box, "end-of-turn.sh", stop(box));
    expect(noLinter.code).toBe(2);
    expect(noLinter.stderr).toContain("not installed: eslint");
    expect(noLinter.stderr).toContain("npm ci");

    const noJq = await hook(box, "end-of-turn.sh", stop(box), box.repo, { ...box.env, PATH: "" });
    expect(noJq.code).toBe(2);
    expect(noJq.stderr).toContain("jq");
  });

  it("passes --no-warn-ignored, so an eslint-ignored generated file does not fail the run", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "database.types.ts"), "export type Generated = 1;\n");
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result.code).toBe(0);
    expect(calls(box)).toMatch(/eslint --max-warnings 0 --no-warn-ignored -- .*src\/database\.types\.ts/);
  });

  it("keeps a changed file named like an option a file (`--` before the paths)", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "-c.ts"), "// BROKEN\n");
    const result = await hook(box, "end-of-turn.sh", stop(box));
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("-c.ts: BROKEN marker");
  });

  it("treats a SubagentStop payload like Stop", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "// BROKEN by a subagent\n");
    const payload = stop(box, { hook_event_name: "SubagentStop", ...subagent("def456") });
    expect((await hook(box, "end-of-turn.sh", payload)).code).toBe(2);
  });

  it("does not see a checkout when the session cwd is not one and nothing was registered (documented limit)", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "// BROKEN through a shell command\n");
    const outside = join(box.tmp, "projects");
    mkdirSync(outside);
    expect((await hook(box, "end-of-turn.sh", stop(box, { cwd: outside }), outside)).code).toBe(0);
  });
});

describe("turn fingerprint", () => {
  it("skips work in progress from before the turn, and sweeps it once the turn changes something", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "a.ts"), "// BROKEN, left from an earlier turn\n");
    expect((await hook(box, "turn-start.sh", prompt(box))).code).toBe(0);
    expect((await hook(box, "end-of-turn.sh", stop(box))).code).toBe(0);
    expect(calls(box)).toBe("");

    writeFileSync(join(box.repo, "src", "c.ts"), "export const c = 1;\n");
    expect((await hook(box, "end-of-turn.sh", stop(box))).code).toBe(2);
  });

  it("notices an edit to a tracked file", async () => {
    const box = await sandbox();
    expect((await hook(box, "turn-start.sh", prompt(box))).code).toBe(0);
    writeFileSync(join(box.repo, "src", "a.ts"), "// BROKEN, tracked file edited this turn\n");
    expect((await hook(box, "end-of-turn.sh", stop(box))).code).toBe(2);
  });

  it("notices a new content in an untracked file that existed at turn start", async () => {
    const box = await sandbox();
    writeFileSync(join(box.repo, "src", "draft.ts"), "export const draft = 1;\n");
    expect((await hook(box, "turn-start.sh", prompt(box))).code).toBe(0);
    writeFileSync(join(box.repo, "src", "draft.ts"), "// BROKEN, untracked file edited this turn\n");
    expect((await hook(box, "end-of-turn.sh", stop(box))).code).toBe(2);
  });

  it("notices an untracked file whose path is longer than 255 bytes", async () => {
    const box = await sandbox();
    const long = join(box.repo, "src", "d".repeat(100), "e".repeat(100), `${"f".repeat(60)}.ts`);
    mkdirSync(dirname(long), { recursive: true });
    writeFileSync(long, "export const long = 1;\n");
    expect((await hook(box, "turn-start.sh", prompt(box))).code).toBe(0);
    writeFileSync(long, "// BROKEN behind a long path\n");
    expect((await hook(box, "end-of-turn.sh", stop(box))).code).toBe(2);
  });

  it("does not follow an untracked symlink (a link to /dev/zero would never end)", async () => {
    const box = await sandbox();
    symlinkSync("/dev/zero", join(box.repo, "src", "zero"));
    expect(await hook(box, "turn-start.sh", prompt(box))).toMatchObject({ code: 0, stdout: "", stderr: "" });
    expect((await hook(box, "end-of-turn.sh", stop(box))).code).toBe(0);
  }, 15_000);
});

describe("per-agent state", () => {
  it("does not judge a subagent on what the parent left half done", async () => {
    const box = await sandbox();
    expect((await hook(box, "turn-start.sh", prompt(box))).code).toBe(0);
    writeFileSync(join(box.repo, "src", "a.ts"), "// BROKEN, the parent's work in progress\n");
    expect((await hook(box, "register-checkout.sh", edit(join(box.repo, "src", "a.ts")))).code).toBe(0);
    const explorer = subagent("explore1");
    expect(
      (await hook(box, "turn-start.sh", { ...prompt(box), ...explorer, hook_event_name: "SubagentStart" })).code,
    ).toBe(0);
    const subStop = await hook(box, "end-of-turn.sh", stop(box, { hook_event_name: "SubagentStop", ...explorer }));
    expect(subStop.code).toBe(0);
    // The parent still answers for its own edit.
    expect((await hook(box, "end-of-turn.sh", stop(box))).code).toBe(2);
  });

  it("does not block a clean subagent for another subagent's broken worktree, and keeps that one's record", async () => {
    const box = await sandbox();
    const wtA = await worktree(box, "wt-a");
    const a = subagent("agentA");
    const b = subagent("agentB");
    for (const agent of [a, b]) {
      expect(
        (await hook(box, "turn-start.sh", { ...prompt(box), ...agent, hook_event_name: "SubagentStart" })).code,
      ).toBe(0);
    }
    writeFileSync(join(wtA, "src", "a.ts"), "// BROKEN, agent A mid-edit\n");
    expect((await hook(box, "register-checkout.sh", edit(join(wtA, "src", "a.ts"), a))).code).toBe(0);
    writeFileSync(join(box.repo, "src", "b.ts"), "export const b = 1;\n");
    expect((await hook(box, "register-checkout.sh", edit(join(box.repo, "src", "b.ts"), b))).code).toBe(0);

    const stopB = await hook(box, "end-of-turn.sh", stop(box, { hook_event_name: "SubagentStop", ...b }));
    expect(stopB.code).toBe(0);
    // B's green run cleared only B's record: A is still swept for its worktree.
    const stopA = await hook(box, "end-of-turn.sh", stop(box, { hook_event_name: "SubagentStop", ...a }));
    expect(stopA.code).toBe(2);
    expect(stopA.stderr).toContain(wtA);
  });

  it("keeps a running subagent's record when the user sends a new prompt", async () => {
    const box = await sandbox();
    const wtA = await worktree(box, "wt-bg");
    const a = subagent("background1");
    writeFileSync(join(wtA, "src", "a.ts"), "// BROKEN by a background subagent\n");
    expect((await hook(box, "register-checkout.sh", edit(join(wtA, "src", "a.ts"), a))).code).toBe(0);
    expect((await hook(box, "turn-start.sh", prompt(box))).code).toBe(0);
    expect((await hook(box, "end-of-turn.sh", stop(box, { hook_event_name: "SubagentStop", ...a }))).code).toBe(2);
  });
});

describe("turn-start.sh", () => {
  it("prints nothing (its stdout would join the prompt) and always exits 0", async () => {
    const box = await sandbox();
    const outside = join(box.tmp, "projects");
    mkdirSync(outside);
    const payloads = ["{}", "not json", prompt(box, { cwd: outside }), prompt(box)];
    for (const payload of payloads) {
      const result = await hook(box, "turn-start.sh", payload);
      expect(result, JSON.stringify(payload)).toMatchObject({ code: 0, stdout: "", stderr: "" });
    }
  });
});

describe("hook scripts and registration", () => {
  it("every script parses (bash -n)", async () => {
    for (const script of SCRIPTS) {
      const result = await run(BASH, ["-n", join(HOOKS_DIR, script)], { cwd: REPO_ROOT, env: cleanEnv() });
      expect(result, script).toMatchObject({ code: 0, stderr: "" });
    }
  });

  it("every command in .claude/settings.json reaches its script from a worktree, whatever CLAUDE_PROJECT_DIR says", async () => {
    const box = await sandbox();
    const wt = await worktree(box, "wt-settings");
    const settings = JSON.parse(readFileSync(join(REPO_ROOT, ".claude", "settings.json"), "utf8")) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    const commands = Object.values(settings.hooks).flatMap((groups) =>
      groups.flatMap((group) => group.hooks.map((entry) => entry.command)),
    );
    expect(commands.length).toBeGreaterThanOrEqual(5);
    for (const command of commands) {
      const env = { ...box.env, CLAUDE_PROJECT_DIR: join(box.tmp, "does-not-exist") };
      const result = await run("/bin/sh", ["-c", command], { cwd: wt, env, input: "{}" });
      expect(result, command).toMatchObject({ code: 0, stderr: "" });
    }
  });
});
