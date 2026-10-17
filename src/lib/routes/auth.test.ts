import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureConsole,
  locationOf,
  NOT_A_FORM,
  routeContext,
  type ConsoleCapture,
} from "@/lib/test-support/route-context";
import { COORDS, EMAIL, LEAK } from "@/lib/test-support/supabase-fake";
import { POST as signin } from "@/pages/api/auth/signin";
import { POST as signout } from "@/pages/api/auth/signout";
import { POST as signup } from "@/pages/api/auth/signup";

/**
 * The auth routes (error-visibility, Phase 5): every Auth failure that is not the user's mistake leaves one
 * `auth.signin` / `auth.signup` / `auth.signout` line with the error's name, status and auth-js `code` (a code from the
 * library's own `ErrorCode` list, `isLoggableCode`; an unknown one is dropped), and the redirect key is
 * the one it has always been. The email sits in the form and in every error's message, and reaches neither a line
 * nor a redirect.
 */

/** What the stub Auth client answers; `createClient` hands it to the route. */
const mocks = vi.hoisted((): { client: unknown } => ({ client: null }));
vi.mock("@/lib/supabase", () => ({ createClient: () => mocks.client }));

const FORM = { email: EMAIL, password: "correct horse battery staple" };

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
});
afterEach(() => {
  logs.restore();
  mocks.client = null;
});

/** An Auth client whose three calls answer as the test says. */
function auth(answers: { signIn?: unknown; signUp?: unknown; signOut?: unknown }) {
  mocks.client = {
    auth: {
      signInWithPassword: () => Promise.resolve(answers.signIn),
      signUp: () => Promise.resolve(answers.signUp),
      signOut: () => Promise.resolve(answers.signOut),
    },
  };
}

/** An error whose message holds the email and coordinates, as a provider's text may. */
const leaky = (message = `bad request for ${EMAIL} near ${COORDS}`) => message;

describe("POST /api/auth/signin", () => {
  async function post(error: unknown, form: Record<string, string> = FORM) {
    auth({ signIn: { data: { user: null, session: null }, error } });
    return locationOf(await signin(routeContext({ form })));
  }

  it("logs a 500 once and redirects with the generic key", async () => {
    const location = await post(new AuthRetryableFetchError(leaky(), 500));
    expect(location.searchParams.get("error")).toBe("errors.auth.generic");
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: auth.signin failed", {
      step: "auth.signin",
      name: "AuthRetryableFetchError",
      status: 500,
    });
  });

  it("logs nothing for a wrong password and keeps its key", async () => {
    const location = await post(new AuthApiError(leaky(), 400, "invalid_credentials"));
    expect(location.searchParams.get("error")).toBe("errors.auth.invalidCredentials");
    expect(logs.everything()).toBe("[]");
  });

  it("redirects a body that is not a form with the shape key and logs a request.form notice instead of throwing", async () => {
    auth({});
    const location = locationOf(await signin(routeContext({ body: NOT_A_FORM })));
    expect(location.pathname).toBe("/auth/signin");
    expect(location.searchParams.get("error")).toBe("errors.checkFields");
    expect(logs.warns).toHaveBeenCalledExactlyOnceWith("sidereus: request.form noted", {
      step: "request.form",
      name: "TypeError",
    });
    expect(logs.errors).not.toHaveBeenCalled();
  });

  it("never lets the email, the password or the coordinates reach a log argument or the redirect", async () => {
    for (const error of [
      new AuthApiError(leaky(), 429, "over_request_rate_limit"),
      new AuthRetryableFetchError(leaky(), 503),
      new AuthApiError(leaky(), 400, "invalid_credentials"),
    ]) {
      expect((await post(error)).href).not.toMatch(LEAK);
    }
    expect(logs.everything()).not.toMatch(LEAK);
    expect(logs.everything()).not.toContain("correct horse");
  });
});

describe("POST /api/auth/signup", () => {
  async function post(result: { data?: unknown; error?: unknown }) {
    auth({ signUp: { data: { user: null, session: null }, error: null, ...result } });
    return locationOf(await signup(routeContext({ form: FORM })));
  }

  it("never lets the email or the coordinates reach a log argument or the redirect", async () => {
    const location = await post({ error: new AuthApiError(leaky(), 500, "unexpected_failure") });
    expect(location.href).not.toMatch(LEAK);
    expect(logs.everything()).not.toMatch(LEAK);
  });
});

describe("POST /api/auth/signout", () => {
  async function post(error: unknown) {
    auth({ signOut: { error } });
    return locationOf(await signout(routeContext()));
  }

  it("reads the result: an Auth outage leaves one auth.signout line and still goes home", async () => {
    const location = await post(new AuthRetryableFetchError(leaky(), 503));
    expect(location.pathname).toBe("/");
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: auth.signout failed", {
      step: "auth.signout",
      name: "AuthRetryableFetchError",
      status: 503,
    });
    expect(logs.everything()).not.toMatch(LEAK);
  });
});
