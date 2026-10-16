import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import {
  captureConsole,
  locationOf,
  NOT_A_FORM,
  routeContext,
  type ConsoleCapture,
} from "@/lib/test-support/route-context";
import { POST } from "@/pages/api/gear/sites/[id]";

/**
 * `POST /api/gear/sites/[id]`, the family of the gear save routes (error-visibility, Phase 4): a failed write goes
 * through `saveFailureKey`, a form that cannot be read redirects with the shape key, and no value (the coordinates,
 * the email in the name) reaches a log line or a URL.
 */

const ID = "3f2b8c1e-5a4d-4e6f-8a7b-9c0d1e2f3a4b";
// The user's own values, the same ones the leaky database error echoes back.
const FORM = {
  name: "Home ada.lovelace@example.test",
  latitudeDeg: "52.2297",
  longitudeDeg: "21.0122",
  bortle: "5",
  minAltitudeDeg: "20",
  timeZoneMode: "auto",
};

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
});
afterEach(() => {
  logs.restore();
});

async function post(options: { form?: Record<string, string>; error?: unknown; data?: unknown; notForm?: boolean }) {
  const supabase = fakeClient({ data: options.data ?? [{ id: ID }], error: options.error });
  const context = routeContext({
    ...(options.notForm ? { body: NOT_A_FORM } : { form: options.form ?? FORM }),
    params: { id: ID },
    supabase,
  });
  const location = locationOf(await POST(context));
  return location;
}

describe("POST /api/gear/sites/[id]", () => {
  it("redirects a server fault with the neutral key and logs one error line with the code", async () => {
    const location = await post({ error: leakyPostgrestError("08006") });
    expect(location.pathname).toBe(`/gear/sites/${ID}`);
    expect(location.searchParams.get("error")).toBe("errors.serverFault");
    expect(logs.errors).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledWith("sidereus: save.gear failed", { step: "save.gear", code: "08006" });
    expect(logs.warns).not.toHaveBeenCalled();
  });

  it("redirects an RLS refusal (42501) with the entity key and logs one notice", async () => {
    const location = await post({ error: leakyPostgrestError("42501") });
    expect(location.searchParams.get("error")).toBe("errors.save.site");
    expect(logs.warns).toHaveBeenCalledTimes(1);
    expect(logs.warns).toHaveBeenCalledWith("sidereus: save.gear noted", { step: "save.gear", code: "42501" });
    expect(logs.errors).not.toHaveBeenCalled();
  });

  it("redirects a zero-row update (a stale id) with the not-found key and logs one notice", async () => {
    const location = await post({ data: [] });
    expect(location.searchParams.get("error")).toBe("errors.notFound.site");
    expect(logs.warns).toHaveBeenCalledWith("sidereus: save.gear noted", { step: "save.gear" });
    expect(logs.errors).not.toHaveBeenCalled();
  });

  it("redirects an input failure from the database (a check violation) with its key and logs nothing", async () => {
    const location = await post({ error: leakyPostgrestError("23514") });
    expect(location.searchParams.get("error")).toBe("errors.outOfRange");
    expect(logs.everything()).toBe("[]");
  });

  it("redirects a validation failure as before and logs nothing", async () => {
    const location = await post({ form: { ...FORM, latitudeDeg: "952.2297" } });
    expect(location.searchParams.get("error")).toBe("errors.site.latitudeRange");
    expect(logs.everything()).toBe("[]");
  });

  it("redirects a saved site as before and logs nothing", async () => {
    const location = await post({});
    expect(location.pathname + location.search).toBe("/gear?saved=site");
    expect(logs.everything()).toBe("[]");
  });

  it("redirects a body that is not a form with the shape key and logs request.form instead of throwing", async () => {
    const location = await post({ notForm: true });
    expect(location.pathname).toBe(`/gear/sites/${ID}`);
    expect(location.searchParams.get("error")).toBe("errors.checkFields");
    expect(logs.errors).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledWith("sidereus: request.form failed", {
      step: "request.form",
      name: "TypeError",
    });
  });

  it("never lets the submitted or echoed values reach a log line or the redirect", async () => {
    for (const error of [leakyPostgrestError("08006"), leakyPostgrestError("42501"), new Error(LEAK.source)]) {
      const location = await post({ error });
      expect(location.href).not.toMatch(LEAK);
      expect(logs.everything()).not.toMatch(LEAK);
    }
  });
});
