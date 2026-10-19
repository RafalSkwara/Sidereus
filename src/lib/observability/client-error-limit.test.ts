import { describe, expect, it } from "vitest";

import { createMemoryLimiter } from "./client-error-limit";

/** The in-memory bucket is the limiter of Vitest and of a deploy that lost the binding: it must really refuse. */
describe("createMemoryLimiter", () => {
  it("lets `limit` calls through, refuses the next, and serves again as the period refills it", async () => {
    let clock = 0;
    const limiter = createMemoryLimiter({ limit: 3, periodSeconds: 60, now: () => clock });
    const key = { key: "client-error" };
    const results: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      results.push((await limiter.limit(key)).success);
    }
    expect(results).toEqual([true, true, true, false, false]);

    clock += 20_000; // one token back (3 per 60 s)
    expect((await limiter.limit(key)).success).toBe(true);
    expect((await limiter.limit(key)).success).toBe(false);

    clock += 600_000; // long idle: full again, never more than `limit`
    const after: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      after.push((await limiter.limit(key)).success);
    }
    expect(after).toEqual([true, true, true, false]);
  });
});
