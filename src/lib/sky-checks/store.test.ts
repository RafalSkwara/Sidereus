import { describe, expect, it } from "vitest";
import { StoreFault } from "@/lib/observability/fault";
import { fakeClient, gatewayError, leakyPostgrestError, LEAK, transportError } from "@/lib/test-support/supabase-fake";
import { skyCheckStore } from "./store";

// What talks to Supabase is covered by tests/db; here a fake client answers with an error that echoes submitted
// values, and the store must keep only a code.

const ID = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const NOW = new Date("2026-10-10T22:00:00Z");
const RECORD = {
  siteId: ID,
  night: "2026-10-10",
  headline: "go" as const,
  darkStart: new Date("2026-10-10T18:20:00Z"),
};

const failing = (code: string) => fakeClient({ error: leakyPostgrestError(code) });

const WRITES: [string, (client: ReturnType<typeof fakeClient>) => ReturnType<typeof skyCheckStore.record>][] = [
  ["record", (c) => skyCheckStore.record(c, RECORD)],
  ["answer", (c) => skyCheckStore.answer(c, ID, "clear", NOW)],
  ["skip", (c) => skyCheckStore.skip(c, ID, NOW)],
];

describe("a failed write carries a sanitized fault", () => {
  it("keeps only its code for a server fault, is `refused` or `session` by code, and has no fault for user input, in answer and skip", async () => {
    expect(WRITES).toHaveLength(3);
    for (const [name, run] of WRITES) {
      const server = await run(failing("XX000"));
      expect(server, `${name}: server fault`).toEqual({
        ok: false,
        message: "errors.save.skyCheck",
        fault: { kind: "server", code: "XX000" },
      });
      expect(JSON.stringify(server), `${name}: server fault`).not.toMatch(LEAK);
      expect(await run(failing("42501")), `${name}: RLS`).toEqual({
        ok: false,
        message: "errors.save.skyCheck",
        fault: { kind: "refused", code: "42501" },
      });
      expect(await run(failing("PGRST301")), `${name}: session`).toEqual({
        ok: false,
        message: "errors.save.skyCheck",
        fault: { kind: "session", code: "PGRST301" },
      });
      if (name === "record") {
        // `record`'s arguments are built by the server, so a class 22 or 23 result is our bug and keeps its fault (below).
        continue;
      }
      for (const code of ["22P02", "23514"]) {
        const result = await run(failing(code));
        expect(result.ok, `${name}: ${code}`).toBe(false);
        // A malformed id is its own not-found key (below); either way no fault is carried.
        expect(result, `${name}: ${code}`).not.toHaveProperty("fault");
      }
    }
  });

  it("keeps a fault for every failed record: a class 22 or 23 code and a request without a PostgREST code included", async () => {
    for (const code of ["22P02", "23514"]) {
      const result = await skyCheckStore.record(failing(code), RECORD);
      expect(result, code).toEqual({ ok: false, message: "errors.save.skyCheck", fault: { kind: "server", code } });
      expect(JSON.stringify(result), code).not.toMatch(LEAK);
    }
    const transport = await skyCheckStore.record(fakeClient({ error: transportError(), status: 0 }), RECORD);
    expect(transport).toEqual({
      ok: false,
      message: "errors.save.skyCheck",
      fault: { kind: "server", code: "request" },
    });
    const gateway = await skyCheckStore.record(fakeClient({ error: gatewayError(), status: 502 }), RECORD);
    expect(gateway).toEqual({
      ok: false,
      message: "errors.save.skyCheck",
      fault: { kind: "server", code: "http", status: 502 },
    });
    expect(JSON.stringify([transport, gateway])).not.toMatch(LEAK);
    expect(await skyCheckStore.record(fakeClient({}), RECORD)).toEqual({ ok: true });
  });

  it("answers a malformed id as not found, a zero-row update as `no-rows`, and a changed row as ok, in answer and skip", async () => {
    const updates = WRITES.slice(1);
    expect(updates.map(([name]) => name)).toEqual(["answer", "skip"]);
    for (const [name, run] of updates) {
      expect(await run(failing("22P02")), `${name}: malformed id`).toEqual({
        ok: false,
        message: "errors.notFound.skyCheck",
      });
      expect(await run(fakeClient({ data: [] })), `${name}: zero rows`).toEqual({
        ok: false,
        message: "errors.notFound.skyCheck",
        fault: { kind: "no-rows" },
      });
      expect(await run(fakeClient({ data: [{ id: ID }] })), `${name}: changed a row`).toEqual({ ok: true });
    }
  });
});

describe("a failed read throws its key with a sanitized cause", () => {
  const READS: [string, (client: ReturnType<typeof fakeClient>) => Promise<unknown>][] = [
    ["openRecent", (c) => skyCheckStore.openRecent(c, { sinceNight: "2026-10-08" })],
    ["list", (c) => skyCheckStore.list(c, { page: 1, now: NOW })],
    ["tally", (c) => skyCheckStore.tally(c)],
  ];

  it("holds only the code in a StoreFault cause, in every read", async () => {
    expect(READS).toHaveLength(3);
    for (const [name, run] of READS) {
      const thrown = (await run(failing("XX000")).catch((error: unknown) => error)) as Error;
      expect(thrown.message, name).toBe("errors.load.skyChecks");
      expect(thrown.cause, name).toBeInstanceOf(StoreFault);
      expect(thrown.cause, name).toMatchObject({ code: "XX000" });
      expect(Object.keys(thrown.cause as object).sort(), name).toEqual(["code", "name"]);
      expect(JSON.stringify(thrown.cause), name).not.toMatch(LEAK);
      expect((thrown.cause as Error).message, name).not.toMatch(LEAK);
    }
  });
});
