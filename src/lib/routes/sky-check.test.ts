import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { captureConsole, locationOf, routeContext, type ConsoleCapture } from "@/lib/test-support/route-context";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import { POST } from "@/pages/api/log/sky/[id]";

/**
 * `POST /api/log/sky/[id]` (error-visibility, Phase 4): the sky check's answer and skip go through
 * `saveFailureKey` as `save.sky-check`, back to the page they were asked on.
 */

const ID = "3f2b8c1e-5a4d-4e6f-8a7b-9c0d1e2f3a4b";

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
});
afterEach(() => {
  logs.restore();
});

async function post(options: { form?: Record<string, string>; data?: unknown; error?: unknown; notForm?: boolean }) {
  const context = routeContext({
    form: options.form ?? { action: "clear", from: "tonight" },
    params: { id: ID },
    supabase: fakeClient({ data: options.data, error: options.error }),
  });
  return locationOf(await POST(context));
}

describe("POST /api/log/sky/[id]", () => {
  it("returns a server fault to the asking page with the neutral key and one error line", async () => {
    const location = await post({ error: leakyPostgrestError("08006") });
    expect(location.pathname).toBe("/tonight");
    expect(location.searchParams.get("error")).toBe("errors.serverFault");
    expect(logs.errors).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledWith("sidereus: save.sky-check failed", {
      step: "save.sky-check",
      code: "08006",
    });
    expect(logs.warns).not.toHaveBeenCalled();
    expect(logs.everything()).not.toMatch(LEAK);
  });

  it("answers an RLS refusal (42501) and a night with no row with the entity key and one notice each", async () => {
    const refused = await post({ error: leakyPostgrestError("42501") });
    expect(refused.searchParams.get("error")).toBe("errors.save.skyCheck");
    expect(logs.warns).toHaveBeenLastCalledWith("sidereus: save.sky-check noted", {
      step: "save.sky-check",
      code: "42501",
    });
    const missing = await post({ data: [] });
    expect(missing.searchParams.get("error")).toBe("errors.notFound.skyCheck");
    expect(logs.warns).toHaveBeenLastCalledWith("sidereus: save.sky-check noted", { step: "save.sky-check" });
    expect(logs.warns).toHaveBeenCalledTimes(2);
    expect(logs.errors).not.toHaveBeenCalled();
  });
});
