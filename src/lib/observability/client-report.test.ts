import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CLIENT_STEPS } from "@/lib/observability/client/steps";
import { captureConsole, type ConsoleCapture } from "@/lib/test-support/route-context";

import { logClientReport } from "./client-report";

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
});
afterEach(() => {
  logs.restore();
});

describe("logClientReport", () => {
  it("writes one fixed warn line per client step, `sidereus: client.<step> noted`, and never an error line", () => {
    expect(CLIENT_STEPS.length).toBeGreaterThan(0);
    for (const step of CLIENT_STEPS) {
      logs.warns.mockClear();
      logClientReport({ step });
      expect(logs.warns, step).toHaveBeenCalledExactlyOnceWith(`sidereus: client.${step} noted`, {
        step: `client.${step}`,
      });
    }
    expect(logs.errors).not.toHaveBeenCalled();
  });

  it("carries the name when the report has one and no name field when it has none", () => {
    logClientReport({ step: "sw.index", name: "QuotaExceededError" });
    logClientReport({ step: "sw.index" });
    expect(logs.warns.mock.calls).toEqual([
      ["sidereus: client.sw.index noted", { step: "client.sw.index", name: "QuotaExceededError" }],
      ["sidereus: client.sw.index noted", { step: "client.sw.index" }],
    ]);
  });
});
