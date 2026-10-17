import { describe, expect, it } from "vitest";
import { StoreFault } from "@/lib/observability/fault";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import { sessionPlanStore } from "./store";

// What talks to Supabase is covered by tests/db/session-plans.test.ts; here a fake client answers with an error that
// echoes submitted values, and the store must keep only a code.

const SITE = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const NIGHT = "2026-10-10";

const failing = (code: string) => fakeClient({ error: leakyPostgrestError(code) });

const WRITES: [string, (client: ReturnType<typeof fakeClient>) => ReturnType<typeof sessionPlanStore.save>][] = [
  ["save", (c) => sessionPlanStore.save(c, SITE, NIGHT, ["M31", "M42"])],
  ["reset", (c) => sessionPlanStore.reset(c, SITE, NIGHT)],
];

describe("a failed write carries a sanitized fault", () => {
  it("keeps only its code for a server fault, is `refused` for RLS, has no fault for user input, and is ok on success, in save and reset", async () => {
    expect(WRITES).toHaveLength(2);
    for (const [name, run] of WRITES) {
      const server = await run(failing("XX000"));
      expect(server, `${name}: server fault`).toEqual({
        ok: false,
        message: "errors.save.sessionPlan",
        fault: { kind: "server", code: "XX000" },
      });
      expect(JSON.stringify(server), `${name}: server fault`).not.toMatch(LEAK);
      // A plan on another user's site.
      expect(await run(failing("42501")), `${name}: RLS`).toEqual({
        ok: false,
        message: "errors.save.sessionPlan",
        fault: { kind: "refused", code: "42501" },
      });
      for (const code of ["22P02", "23514"]) {
        expect(await run(failing(code)), `${name}: ${code}`).toEqual({ ok: false, message: "errors.save.sessionPlan" });
      }
      expect(await run(fakeClient({})), `${name}: success`).toEqual({ ok: true });
    }
  });
});

describe("get", () => {
  it("throws its key with a StoreFault cause, never the database error", async () => {
    const failure = leakyPostgrestError("XX000");
    const thrown = (await sessionPlanStore
      .get(fakeClient({ error: failure }), SITE, NIGHT)
      .catch((error: unknown) => error)) as Error;
    expect(thrown.message).toBe("errors.load.sessionPlan");
    expect(thrown.cause).toBeInstanceOf(StoreFault);
    expect(thrown.cause).not.toBe(failure);
    expect(thrown.cause).toMatchObject({ code: "XX000" });
    expect(Object.keys(thrown.cause as object).sort()).toEqual(["code", "name"]);
    expect(JSON.stringify(thrown.cause)).not.toMatch(LEAK);
    expect((thrown.cause as Error).message).not.toMatch(LEAK);
  });

  it("reads the saved list, or null when none was saved", async () => {
    expect(await sessionPlanStore.get(fakeClient({ data: { targets: ["M31", "jupiter"] } }), SITE, NIGHT)).toEqual([
      "M31",
      "jupiter",
    ]);
    expect(await sessionPlanStore.get(fakeClient({ data: null }), SITE, NIGHT)).toBeNull();
  });
});
