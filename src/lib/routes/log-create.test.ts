import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { captureConsole, locationOf, routeContext, type ConsoleCapture } from "@/lib/test-support/route-context";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import { POST } from "@/pages/api/log/index";

/**
 * `POST /api/log` (error-visibility, Phase 4): the log entry's save goes through `saveFailureKey` as `save.log`, a
 * milestone step that fails inside the same save names the route that ran it, and no value reaches a line or a URL.
 */

const SITE = "3f2b8c1e-5a4d-4e6f-8a7b-9c0d1e2f3a4b";
const TELESCOPE = "7a1c9d2e-6b5f-4d3a-9e8c-0b1a2d3c4e5f";
const FORM = { target: "M31", night: "2026-01-10", rating: "2", siteId: SITE, telescopeId: TELESCOPE, from: "log" };

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
});
afterEach(() => {
  logs.restore();
});

/** Every database request answers with `error`: the entry's own gear lookup is the first to fail. */
async function post(options: { form?: Record<string, string>; error?: unknown; notForm?: boolean }) {
  const context = routeContext({
    form: options.form ?? FORM,
    supabase: fakeClient({ error: options.error }),
  });
  return locationOf(await POST(context));
}

describe("POST /api/log", () => {
  it("redirects a server fault to the form with the neutral key and logs one error line with the code", async () => {
    const location = await post({ error: leakyPostgrestError("08006") });
    expect(location.pathname).toBe("/log/new");
    expect(location.searchParams.get("error")).toBe("errors.serverFault");
    // The prefill the form keeps is filtered ids and keys, as before.
    expect(location.searchParams.get("object")).toBe("M31");
    expect(logs.errors).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledWith("sidereus: save.log failed", { step: "save.log", code: "08006" });
    expect(logs.warns).not.toHaveBeenCalled();
  });

  it("names the create route in a milestone step that fails beside the failed save, with the cause's code", async () => {
    // Rated 3 or above, so the save reads the log before and the milestone trace has something to say.
    await post({ form: { ...FORM, rating: "4" }, error: leakyPostgrestError("08006") });
    expect(logs.errors.mock.calls).toEqual([
      [
        "sidereus: milestones.read-create failed",
        { step: "milestones.read-create", name: "StoreFault", code: "08006" },
      ],
      ["sidereus: save.log failed", { step: "save.log", code: "08006" }],
    ]);
  });

  it("never lets the echoed values reach a log line or the redirect", async () => {
    for (const code of ["08006", "42501"]) {
      const location = await post({ form: { ...FORM, rating: "4" }, error: leakyPostgrestError(code) });
      expect(location.href).not.toMatch(LEAK);
    }
    expect(logs.everything()).not.toMatch(LEAK);
  });
});
