import { describe, expect, it } from "vitest";

import { withTimeout } from "./fetch-timeout";

/** A fetch that never answers on its own and rejects with the signal's reason once aborted. */
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(init.signal?.reason as Error);
    });
  });

describe("withTimeout", () => {
  it("aborts a request that outlives the timeout", async () => {
    await expect(withTimeout(hangingFetch, 20)("https://example.test/")).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("passes a fast response through", async () => {
    const fast: typeof fetch = () => Promise.resolve(new Response("ok"));
    const response = await withTimeout(fast, 1000)("https://example.test/");
    expect(await response.text()).toBe("ok");
  });

  it("still honours an abort from the caller", async () => {
    const controller = new AbortController();
    const pending = withTimeout(hangingFetch, 10_000)("https://example.test/", { signal: controller.signal });
    controller.abort(new Error("caller gave up"));
    await expect(pending).rejects.toThrow("caller gave up");
  });
});
