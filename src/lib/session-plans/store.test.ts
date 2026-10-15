import { describe, expect, it } from "vitest";
import { StoreFault } from "@/lib/observability/fault";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import { sessionPlanStore } from "./store";

// What talks to Supabase is covered by tests/db/session-plans.test.ts; here a fake client answers with an error that
// echoes submitted values, and the store must keep only a code and a status.

const SITE = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const NIGHT = "2026-10-10";

const failing = (code: string, status?: number) => fakeClient({ error: leakyPostgrestError(code, status) });

const WRITES: [string, (client: ReturnType<typeof fakeClient>) => ReturnType<typeof sessionPlanStore.save>][] = [
  ["save", (c) => sessionPlanStore.save(c, SITE, NIGHT, ["M31", "M42"])],
  ["reset", (c) => sessionPlanStore.reset(c, SITE, NIGHT)],
];

describe("a failed write carries a sanitized fault", () => {
  it.each(WRITES)("%s: a server fault keeps only its code and status next to the fixed key", async (_name, run) => {
    const result = await run(failing("XX000", 503));
    expect(result).toEqual({
      ok: false,
      message: "errors.save.sessionPlan",
      fault: { kind: "server", code: "XX000", status: 503 },
    });
    expect(JSON.stringify(result)).not.toMatch(LEAK);
  });

  it.each(WRITES)("%s: an RLS refusal (a plan on another user's site) is `refused`", async (_name, run) => {
    expect(await run(failing("42501"))).toEqual({
      ok: false,
      message: "errors.save.sessionPlan",
      fault: { kind: "refused", code: "42501" },
    });
  });

  it.each(WRITES)("%s: a user-input failure has no fault", async (_name, run) => {
    for (const code of ["22P02", "23514"]) {
      const result = await run(failing(code));
      expect(result, code).toEqual({ ok: false, message: "errors.save.sessionPlan" });
    }
  });

  it.each(WRITES)("%s: returns ok when the request succeeds", async (_name, run) => {
    expect(await run(fakeClient({}))).toEqual({ ok: true });
  });
});

describe("get", () => {
  it("throws its key with a StoreFault cause, never the database error", async () => {
    const failure = leakyPostgrestError("XX000", 503);
    const thrown = (await sessionPlanStore
      .get(fakeClient({ error: failure }), SITE, NIGHT)
      .catch((error: unknown) => error)) as Error;
    expect(thrown.message).toBe("errors.load.sessionPlan");
    expect(thrown.cause).toBeInstanceOf(StoreFault);
    expect(thrown.cause).not.toBe(failure);
    expect(thrown.cause).toMatchObject({ code: "XX000", status: 503 });
    expect(Object.keys(thrown.cause as object).sort()).toEqual(["code", "name", "status"]);
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
