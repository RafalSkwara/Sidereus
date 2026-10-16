import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  captureConsole,
  locationOf,
  NOT_A_FORM,
  routeContext,
  type ConsoleCapture,
} from "@/lib/test-support/route-context";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import { POST } from "@/pages/api/onboarding";

/**
 * `POST /api/onboarding` (error-visibility, Phase 4): the first-run save goes through `saveFailureKey` as
 * `save.onboarding`. The form holds the user's coordinates and a gear name with an email, which the database error
 * echoes back, and none of them may reach a line or the redirect.
 */

const FORM = {
  latitudeDeg: "52.2297",
  longitudeDeg: "21.0122",
  bortle: "5",
  telescopeName: "Scope of ada.lovelace@example.test",
  apertureMm: "130",
  focalLengthMm: "650",
  eyepieces: "[]",
};

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
});
afterEach(() => {
  logs.restore();
});

async function post(options: { form?: Record<string, string>; error?: unknown; notForm?: boolean }) {
  const context = routeContext({
    ...(options.notForm ? { body: NOT_A_FORM } : { form: options.form ?? FORM }),
    supabase: fakeClient({ error: options.error }),
  });
  return locationOf(await POST(context));
}

describe("POST /api/onboarding", () => {
  it("redirects a server fault to the setup with the neutral key and logs one error line with the code", async () => {
    const location = await post({ error: leakyPostgrestError("57014", 504) });
    expect(location.pathname).toBe("/onboarding");
    expect(location.searchParams.get("error")).toBe("errors.serverFault");
    expect(logs.errors).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledWith("sidereus: save.onboarding failed", {
      step: "save.onboarding",
      code: "57014",
      status: 504,
    });
    expect(logs.warns).not.toHaveBeenCalled();
  });

  it("redirects an RLS refusal (42501) with the entity key and logs one notice", async () => {
    const location = await post({ error: leakyPostgrestError("42501") });
    expect(location.searchParams.get("error")).toBe("errors.save.setup");
    expect(logs.warns).toHaveBeenCalledTimes(1);
    expect(logs.warns).toHaveBeenCalledWith("sidereus: save.onboarding noted", {
      step: "save.onboarding",
      code: "42501",
    });
    expect(logs.errors).not.toHaveBeenCalled();
  });

  it("redirects a check violation with the out-of-range key and logs nothing (the user's input)", async () => {
    const location = await post({ error: leakyPostgrestError("23514") });
    expect(location.searchParams.get("error")).toBe("errors.outOfRange");
    expect(logs.everything()).toBe("[]");
  });

  it("sends a user who already has gear to Tonight as if the save had just worked, with no line", async () => {
    const location = await post({ error: { ...leakyPostgrestError("P0001"), message: "already_onboarded" } });
    expect(location.pathname).toBe("/tonight");
    expect(logs.everything()).toBe("[]");
  });

  it("redirects a validation failure as before and logs nothing", async () => {
    const location = await post({ form: { ...FORM, latitudeDeg: "952.2297" } });
    expect(location.searchParams.get("error")).toBe("errors.site.latitudeRange");
    expect(logs.everything()).toBe("[]");
  });

  it("opens Tonight after a saved setup and logs nothing", async () => {
    const location = await post({});
    expect(location.pathname).toBe("/tonight");
    expect(logs.everything()).toBe("[]");
  });

  it("redirects a body that is not a form with the shape key and logs request.form instead of throwing", async () => {
    const location = await post({ notForm: true });
    expect(location.pathname).toBe("/onboarding");
    expect(location.searchParams.get("error")).toBe("errors.checkFields");
    expect(logs.errors).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledWith("sidereus: request.form failed", {
      step: "request.form",
      name: "TypeError",
    });
  });

  it("never lets the submitted or echoed values reach a log line or the redirect", async () => {
    for (const code of ["08006", "42501", "23514"]) {
      const location = await post({ error: leakyPostgrestError(code) });
      expect(location.href).not.toMatch(LEAK);
    }
    expect(logs.everything()).not.toMatch(LEAK);
  });
});
