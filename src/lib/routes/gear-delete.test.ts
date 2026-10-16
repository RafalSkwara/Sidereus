import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { captureConsole, locationOf, routeContext, type ConsoleCapture } from "@/lib/test-support/route-context";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import { POST } from "@/pages/api/gear/telescopes/[id]/delete";

/**
 * `POST /api/gear/telescopes/[id]/delete`, the delete routes (error-visibility, Phase 4): they share the neutral
 * `errors.serverFault` with the saves, since its copy says "nothing was changed".
 */

const ID = "3f2b8c1e-5a4d-4e6f-8a7b-9c0d1e2f3a4b";

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
});
afterEach(() => {
  logs.restore();
});

async function post(result: { data?: unknown; error?: unknown }) {
  const context = routeContext({ params: { id: ID }, supabase: fakeClient(result) });
  return locationOf(await POST(context));
}

describe("POST /api/gear/telescopes/[id]/delete", () => {
  it("redirects a server fault to the hub with the neutral key and logs one error line", async () => {
    const location = await post({ error: leakyPostgrestError("57014", 500) });
    expect(location.pathname).toBe("/gear");
    expect(location.searchParams.get("error")).toBe("errors.serverFault");
    expect(logs.errors).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledWith("sidereus: save.gear failed", {
      step: "save.gear",
      code: "57014",
      status: 500,
    });
    expect(logs.warns).not.toHaveBeenCalled();
    expect(logs.everything()).not.toMatch(LEAK);
  });

  it("redirects an RLS refusal (42501) with the delete key and logs one notice", async () => {
    const location = await post({ error: leakyPostgrestError("42501") });
    expect(location.searchParams.get("error")).toBe("errors.delete.telescope");
    expect(logs.warns).toHaveBeenCalledTimes(1);
    expect(logs.warns).toHaveBeenCalledWith("sidereus: save.gear noted", { step: "save.gear", code: "42501" });
    expect(logs.errors).not.toHaveBeenCalled();
  });

  it("redirects a malformed or foreign id (22P02, and zero rows) with the not-found key", async () => {
    const malformed = await post({ error: leakyPostgrestError("22P02") });
    expect(malformed.searchParams.get("error")).toBe("errors.notFound.telescope");
    // A malformed uuid is the user's input: no line. A well-formed id that matches no row is counted as a notice.
    expect(logs.everything()).toBe("[]");
    const missing = await post({ data: [] });
    expect(missing.searchParams.get("error")).toBe("errors.notFound.telescope");
    expect(logs.warns).toHaveBeenCalledTimes(1);
    expect(logs.warns).toHaveBeenCalledWith("sidereus: save.gear noted", { step: "save.gear" });
    expect(logs.errors).not.toHaveBeenCalled();
  });

  it("redirects a deleted telescope as before and logs nothing", async () => {
    const location = await post({ data: [{ id: ID }] });
    expect(location.pathname + location.search).toBe("/gear?deleted=telescope");
    expect(logs.everything()).toBe("[]");
  });
});
