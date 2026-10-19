import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { CLIENT_ERROR_PATH } from "@/lib/observability/client/steps";

/**
 * The worker's reporter (error-visibility Phase 8): `reportAnd` turns a swallowed `.catch(() => fallback)` into one
 * that leaves a trace and returns the same fallback. The risk these tests protect is the worker's behaviour: a report
 * must never change what a site returns, never throw into the worker and never flood the endpoint. The payload rules
 * and the caps themselves belong to the reporter core's tests; here they are checked through the worker's own wiring.
 * The module's reporter is its own state (the cap is per wake-up), so each case loads a fresh copy.
 */

function storageError(): Error {
  return Object.assign(new Error("quota"), { name: "QuotaExceededError" });
}

let fetchStub: Mock<(url: string, init: RequestInit) => Promise<Response>>;

beforeEach(() => {
  vi.resetModules();
  fetchStub = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  );
  vi.stubGlobal("fetch", fetchStub);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** The reporter's `send` is fire-and-forget: let its microtasks settle before reading what was sent. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function bodies(): unknown[] {
  return fetchStub.mock.calls.map(([, init]): unknown => JSON.parse(init.body as string));
}

describe("the worker's reporter", () => {
  it("posts a step and a name to the endpoint as a keepalive JSON request", async () => {
    const { report } = await import("./report");
    report("sw.island-commit", storageError());
    await settle();
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0];
    expect(url).toBe(CLIENT_ERROR_PATH);
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
    });
    expect(bodies()).toEqual([{ step: "sw.island-commit", name: "QuotaExceededError" }]);
  });

  it("reportAnd reports its step once and returns the fallback it was given, unchanged", async () => {
    const { reportAnd } = await import("./report");
    const handlers = [reportAnd("sw.index", undefined), reportAnd("sw.index", null), reportAnd("sw.sweep", 0)];
    expect(handlers.map((handle) => handle(storageError()))).toEqual([undefined, null, 0]);
    await settle();
    // The same step and name twice is one report; the other step is another.
    expect(bodies()).toEqual([
      { step: "sw.index", name: "QuotaExceededError" },
      { step: "sw.sweep", name: "QuotaExceededError" },
    ]);
  });

  it("drops a routine network fault at a network step but still returns the fallback; a storage fault there is reported", async () => {
    const { reportAnd } = await import("./report");
    expect(reportAnd("sw.navigation", "fallback")(new TypeError("Failed to fetch"))).toBe("fallback");
    expect(reportAnd("sw.next-night", "fallback")(new DOMException("slow", "TimeoutError"))).toBe("fallback");
    await settle();
    expect(fetchStub).not.toHaveBeenCalled();

    expect(reportAnd("sw.store-page", "fallback")(storageError())).toBe("fallback");
    await settle();
    expect(bodies()).toEqual([{ step: "sw.store-page", name: "QuotaExceededError" }]);
  });

  it("reports a TypeError at a store step: only the network steps treat it as routine", async () => {
    const { report } = await import("./report");
    report("sw.island-commit", new TypeError("bad Response"));
    await settle();
    expect(bodies()).toEqual([{ step: "sw.island-commit", name: "TypeError" }]);
  });

  it("changes no outcome when the send throws or rejects", async () => {
    const { reportAnd } = await import("./report");
    fetchStub.mockImplementationOnce(() => {
      throw new Error("no network");
    });
    expect(reportAnd("sw.index", "kept")(storageError())).toBe("kept");
    fetchStub.mockImplementationOnce(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(reportAnd("sw.sweep", "kept")(storageError())).toBe("kept");
    await settle();
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it("sends at most 10 reports per wake-up", async () => {
    const { report } = await import("./report");
    const steps = ["sw.index", "sw.precache", "sw.shell", "sw.offline-page", "sw.next-night", "sw.store-page"] as const;
    // 6 steps x 2 names = 12 distinct reports; the dedupe lets each through once, the cap stops the last two.
    for (const step of steps) {
      report(step, storageError());
      report(step, new RangeError("x"));
    }
    await settle();
    expect(fetchStub).toHaveBeenCalledTimes(10);
  });

  it("sends nothing while the device is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { report } = await import("./report");
    report("sw.index", storageError());
    await settle();
    expect(fetchStub).not.toHaveBeenCalled();
  });
});
