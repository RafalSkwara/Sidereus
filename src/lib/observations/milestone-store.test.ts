import { describe, expect, it } from "vitest";
import { StoreFault } from "@/lib/observability/fault";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import { milestoneStore } from "./milestone-store";

// What talks to Supabase is covered by tests/db/milestones.test.ts; here a fake client answers with an error that
// echoes the submitted coordinates and an email, as a failing request's message does, and a failed read or record
// must throw its fixed key with a cause that keeps only the code (error-visibility, impl review F2).

const failing = (code: string) => fakeClient({ error: leakyPostgrestError(code) });

const CALLS: [string, (client: ReturnType<typeof fakeClient>) => Promise<unknown>][] = [
  ["listReached", (c) => milestoneStore.listReached(c)],
  ["record", (c) => milestoneStore.record(c, [{ key: "first-moon", reachedNight: "2026-10-15" }])],
];

describe("milestoneStore: a failed request throws its key with a sanitized cause", () => {
  it("holds only the code in a StoreFault cause, with or without a code, in listReached and record", async () => {
    expect(CALLS).toHaveLength(2);
    for (const [name, run] of CALLS) {
      const thrown: unknown = await run(failing("XX000")).catch((error: unknown) => error);
      expect(thrown, name).toBeInstanceOf(Error);
      const error = thrown as Error;
      expect(error.message, name).toBe("errors.load.observations");
      expect(error.cause, name).toBeInstanceOf(StoreFault);
      const cause = error.cause as StoreFault;
      expect(cause.code, name).toBe("XX000");
      expect(Object.keys(cause).sort(), name).toEqual(["code", "name"]);
      expect(JSON.stringify(cause), name).not.toMatch(LEAK);
      expect(cause.message, name).not.toMatch(LEAK);
      expect(String(cause.stack), name).not.toMatch(LEAK);

      const codeless = (await run(fakeClient({ error: { message: LEAK.source, details: LEAK.source } })).catch(
        (caught: unknown) => caught,
      )) as Error;
      expect(codeless.cause, `${name}: codeless`).toBeInstanceOf(StoreFault);
      expect((codeless.cause as StoreFault).code, `${name}: codeless`).toBeUndefined();
      expect(JSON.stringify(codeless.cause), `${name}: codeless`).not.toMatch(LEAK);
      expect((codeless.cause as StoreFault).message, `${name}: codeless`).not.toMatch(LEAK);
    }
  });
});

describe("milestoneStore: the happy paths", () => {
  it("listReached keeps only the keys of the fixed set, and record makes no request for an empty input and returns the keys it inserted", async () => {
    const reached = await milestoneStore.listReached(
      fakeClient({
        data: [
          { key: "first-moon", reached_night: "2026-10-15" },
          { key: "from-a-newer-app", reached_night: "2026-10-16" },
        ],
      }),
    );
    expect([...reached]).toEqual([["first-moon", "2026-10-15"]]);

    expect(await milestoneStore.record(failing("XX000"), [])).toEqual([]);
    const inserted = await milestoneStore.record(
      fakeClient({ data: [{ key: "first-moon" }, { key: "from-a-newer-app" }] }),
      [{ key: "first-moon", reachedNight: "2026-10-15" }],
    );
    expect(inserted).toEqual(["first-moon"]);
  });
});
