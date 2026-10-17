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
  it.each(CALLS)("%s: the cause is a StoreFault holding only the code", async (_name, run) => {
    const thrown: unknown = await run(failing("XX000")).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toBe("errors.load.observations");
    expect(error.cause).toBeInstanceOf(StoreFault);
    const cause = error.cause as StoreFault;
    expect(cause.code).toBe("XX000");
    expect(Object.keys(cause).sort()).toEqual(["code", "name"]);
    expect(JSON.stringify(cause)).not.toMatch(LEAK);
    expect(cause.message).not.toMatch(LEAK);
    expect(String(cause.stack)).not.toMatch(LEAK);
  });

  it.each(CALLS)("%s: an error without a code still leaves a cause without a message", async (_name, run) => {
    const thrown = (await run(fakeClient({ error: { message: LEAK.source, details: LEAK.source } })).catch(
      (error: unknown) => error,
    )) as Error;
    expect(thrown.cause).toBeInstanceOf(StoreFault);
    expect((thrown.cause as StoreFault).code).toBeUndefined();
    expect(JSON.stringify(thrown.cause)).not.toMatch(LEAK);
    expect((thrown.cause as StoreFault).message).not.toMatch(LEAK);
  });
});

describe("milestoneStore: the happy paths", () => {
  it("listReached keeps only the keys of the fixed set", async () => {
    const reached = await milestoneStore.listReached(
      fakeClient({
        data: [
          { key: "first-moon", reached_night: "2026-10-15" },
          { key: "from-a-newer-app", reached_night: "2026-10-16" },
        ],
      }),
    );
    expect([...reached]).toEqual([["first-moon", "2026-10-15"]]);
  });

  it("record makes no request for an empty input and returns the keys it inserted", async () => {
    expect(await milestoneStore.record(failing("XX000"), [])).toEqual([]);
    const inserted = await milestoneStore.record(
      fakeClient({ data: [{ key: "first-moon" }, { key: "from-a-newer-app" }] }),
      [{ key: "first-moon", reachedNight: "2026-10-15" }],
    );
    expect(inserted).toEqual(["first-moon"]);
  });
});
