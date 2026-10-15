import { describe, expect, it } from "vitest";
import { StoreFault } from "@/lib/observability/fault";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import { skyCheckStore } from "./store";

// What talks to Supabase is covered by tests/db; here a fake client answers with an error that echoes submitted
// values, and the store must keep only a code and a status.

const ID = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const NOW = new Date("2026-10-10T22:00:00Z");
const RECORD = {
  siteId: ID,
  night: "2026-10-10",
  headline: "go" as const,
  darkStart: new Date("2026-10-10T18:20:00Z"),
};

const failing = (code: string, status?: number) => fakeClient({ error: leakyPostgrestError(code, status) });

const WRITES: [string, (client: ReturnType<typeof fakeClient>) => ReturnType<typeof skyCheckStore.record>][] = [
  ["record", (c) => skyCheckStore.record(c, RECORD)],
  ["answer", (c) => skyCheckStore.answer(c, ID, "clear", NOW)],
  ["skip", (c) => skyCheckStore.skip(c, ID, NOW)],
];

describe("a failed write carries a sanitized fault", () => {
  it.each(WRITES)("%s: a server fault keeps only its code and status next to the fixed key", async (_name, run) => {
    const result = await run(failing("XX000", 503));
    expect(result).toEqual({
      ok: false,
      message: "errors.save.skyCheck",
      fault: { kind: "server", code: "XX000", status: 503 },
    });
    expect(JSON.stringify(result)).not.toMatch(LEAK);
  });

  it.each(WRITES)("%s: an RLS refusal is `refused`, a session fault is `session`", async (_name, run) => {
    expect(await run(failing("42501"))).toEqual({
      ok: false,
      message: "errors.save.skyCheck",
      fault: { kind: "refused", code: "42501" },
    });
    expect(await run(failing("PGRST301", 401))).toEqual({
      ok: false,
      message: "errors.save.skyCheck",
      fault: { kind: "session", code: "PGRST301", status: 401 },
    });
  });

  it.each(WRITES)("%s: a user-input failure has no fault", async (_name, run) => {
    for (const code of ["22P02", "23514"]) {
      const result = await run(failing(code));
      expect(result.ok, code).toBe(false);
      expect(result, code).not.toHaveProperty("fault");
    }
  });

  it.each(WRITES.slice(1))(
    "%s: a malformed id is not found, and a zero-row update is `no-rows`",
    async (_name, run) => {
      expect(await run(failing("22P02"))).toEqual({ ok: false, message: "errors.notFound.skyCheck" });
      expect(await run(fakeClient({ data: [] }))).toEqual({
        ok: false,
        message: "errors.notFound.skyCheck",
        fault: { kind: "no-rows" },
      });
      expect(await run(fakeClient({ data: [{ id: ID }] }))).toEqual({ ok: true });
    },
  );
});

describe("a failed read throws its key with a sanitized cause", () => {
  const READS: [string, (client: ReturnType<typeof fakeClient>) => Promise<unknown>][] = [
    ["openRecent", (c) => skyCheckStore.openRecent(c, { sinceNight: "2026-10-08" })],
    ["list", (c) => skyCheckStore.list(c, { page: 1, now: NOW })],
    ["tally", (c) => skyCheckStore.tally(c)],
  ];

  it.each(READS)("%s: the cause is a StoreFault holding only the code and status", async (_name, run) => {
    const thrown = (await run(failing("XX000", 503)).catch((error: unknown) => error)) as Error;
    expect(thrown.message).toBe("errors.load.skyChecks");
    expect(thrown.cause).toBeInstanceOf(StoreFault);
    expect(thrown.cause).toMatchObject({ code: "XX000", status: 503 });
    expect(Object.keys(thrown.cause as object).sort()).toEqual(["code", "name", "status"]);
    expect(JSON.stringify(thrown.cause)).not.toMatch(LEAK);
    expect((thrown.cause as Error).message).not.toMatch(LEAK);
  });
});
