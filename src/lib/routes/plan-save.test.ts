import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { tonightDateForSite } from "@/lib/tonight/tonight-date";
import {
  captureConsole,
  locationOf,
  NOT_A_FORM,
  routeContext,
  SITE_ROW,
  type ConsoleCapture,
} from "@/lib/test-support/route-context";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import { POST } from "@/pages/api/tonight/plan";

/**
 * `POST /api/tonight/plan` (error-visibility, Phase 4): the session plan's save goes through `saveFailureKey` as
 * `save.plan`, and the catch around the route's own reads logs the step with the cause's name and code instead of
 * only mapping it to a key. A full-plan account is read through the same fake client.
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

/** A full-plan user with one site and no saved list; `siteError` fails the read, `writeError` the upsert. */
async function post(options: {
  form?: Record<string, string>;
  siteError?: unknown;
  writeError?: unknown;
  notForm?: boolean;
}) {
  const supabase = fakeClient((table, calls) => {
    if (table === "account_plans") {
      return { data: { plan: "full" } };
    }
    if (table === "sites") {
      return { data: SITE_ROW, error: options.siteError };
    }
    return calls.includes("upsert") ? { error: options.writeError } : { data: null };
  });
  const context = routeContext({
    ...(options.notForm ? { body: NOT_A_FORM } : { form: options.form ?? FORM }),
    supabase,
  });
  return locationOf(await POST(context));
}

describe("POST /api/tonight/plan", () => {
  it("redirects a server fault with the neutral key and logs one error line with the code", async () => {
    const location = await post({ writeError: leakyPostgrestError("08006") });
    expect(location.pathname).toBe("/tonight/plan");
    expect(location.searchParams.get("site")).toBe(SITE_ROW.id);
    expect(location.searchParams.get("error")).toBe("errors.serverFault");
    expect(logs.errors).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledWith("sidereus: save.plan failed", { step: "save.plan", code: "08006" });
    expect(logs.warns).not.toHaveBeenCalled();
  });

  it("redirects an RLS refusal (42501, a site that is not the user's) with the entity key and logs one notice", async () => {
    const location = await post({ writeError: leakyPostgrestError("42501") });
    expect(location.searchParams.get("error")).toBe("errors.save.sessionPlan");
    expect(logs.warns).toHaveBeenCalledTimes(1);
    expect(logs.warns).toHaveBeenCalledWith("sidereus: save.plan noted", { step: "save.plan", code: "42501" });
    expect(logs.errors).not.toHaveBeenCalled();
  });

  it("logs a failed read of the route's own checks with the step, the cause's name and code, and keeps the key", async () => {
    const location = await post({ siteError: leakyPostgrestError("08006") });
    expect(location.searchParams.get("error")).toBe("errors.load.sites");
    expect(logs.errors).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledWith("sidereus: save.plan failed", {
      step: "save.plan",
      name: "StoreFault",
      code: "08006",
    });
  });

  it("redirects a validation failure as before and logs nothing", async () => {
    const location = await post({ form: { site: SITE_ROW.id, night: "not-a-date" } });
    expect(location.searchParams.get("error")).toBe("errors.save.sessionPlan");
    expect(logs.everything()).toBe("[]");
  });

  it("redirects a night that is over as before and logs nothing", async () => {
    const location = await post({ form: { site: SITE_ROW.id, night: "2020-01-01" } });
    expect(location.searchParams.get("error")).toBe("errors.sessionPlan.nightOver");
    expect(logs.everything()).toBe("[]");
  });

  it("redirects a saved plan as before and logs nothing", async () => {
    const location = await post({});
    expect(location.pathname + location.search).toBe(`/tonight/plan?site=${SITE_ROW.id}&saved=plan`);
    expect(logs.everything()).toBe("[]");
  });

  it("redirects a body that is not a form with the shape key and logs request.form instead of throwing", async () => {
    const location = await post({ notForm: true });
    expect(location.pathname).toBe("/tonight/plan");
    expect(location.searchParams.get("site")).toBeNull();
    expect(location.searchParams.get("error")).toBe("errors.checkFields");
    expect(logs.errors).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledWith("sidereus: request.form failed", {
      step: "request.form",
      name: "TypeError",
    });
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
