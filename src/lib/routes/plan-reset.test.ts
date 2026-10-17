import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tonightDateForSite } from "@/lib/tonight/tonight-date";
import {
  captureConsole,
  locationOf,
  routeContext,
  SITE_ROW,
  type ConsoleCapture,
} from "@/lib/test-support/route-context";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import { POST } from "@/pages/api/tonight/plan/reset";

/**
 * `POST /api/tonight/plan/reset` (error-visibility, Phase 4): the session plan's reset goes through `saveFailureKey` as
 * `save.plan-reset`, and the catch around the route's own reads takes the same step, classified by the cause's code (a server fault
 * is the neutral key and an error line, a refusal or session fault a notice with the store's key). A full-plan account is read through the same fake client.
 */

const TONIGHT = tonightDateForSite(
  { latitudeDeg: SITE_ROW.latitude_deg, longitudeDeg: SITE_ROW.longitude_deg, timeZone: SITE_ROW.time_zone, bortle: 5 },
  new Date(),
);
const FORM = { site: SITE_ROW.id, night: TONIGHT };

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
});
afterEach(() => {
  logs.restore();
});

/** A full-plan user with one site and no saved list; `siteError` fails the read, `writeError` the delete. */
async function post(options: { form?: Record<string, string>; siteError?: unknown; writeError?: unknown }) {
  const supabase = fakeClient((table, calls) => {
    if (table === "account_plans") {
      return { data: { plan: "full" } };
    }
    if (table === "sites") {
      return { data: SITE_ROW, error: options.siteError };
    }
    return calls.includes("delete") ? { error: options.writeError } : { data: null };
  });
  const context = routeContext({
    form: options.form ?? FORM,
    supabase,
  });
  return locationOf(await POST(context));
}

describe("POST /api/tonight/plan/reset", () => {
  it("redirects a server fault with the neutral key and logs one error line with the code", async () => {
    const location = await post({ writeError: leakyPostgrestError("08006") });
    expect(location.pathname).toBe("/tonight/plan");
    expect(location.searchParams.get("site")).toBe(SITE_ROW.id);
    expect(location.searchParams.get("error")).toBe("errors.serverFault");
    expect(logs.errors).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledWith("sidereus: save.plan-reset failed", {
      step: "save.plan-reset",
      code: "08006",
    });
    expect(logs.warns).not.toHaveBeenCalled();
  });

  it("never lets the echoed values reach a log line or the redirect", async () => {
    for (const options of [
      { writeError: leakyPostgrestError("08006") },
      { writeError: leakyPostgrestError("42501") },
      { siteError: leakyPostgrestError("08006") },
      { siteError: new Error(LEAK.source) },
    ]) {
      const location = await post(options);
      expect(location.href).not.toMatch(LEAK);
    }
    expect(logs.everything()).not.toMatch(LEAK);
  });
});
