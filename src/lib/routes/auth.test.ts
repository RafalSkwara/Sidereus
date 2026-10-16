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
 * `auth.signin` / `auth.signup` / `auth.signout` line with the error's name and status, and the redirect key is
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

  it("logs a rate limit once and redirects with the rate-limit key", async () => {
    const location = await post(new AuthApiError(leaky(), 429, "over_request_rate_limit"));
    expect(location.pathname).toBe("/auth/signin");
    expect(location.searchParams.get("error")).toBe("errors.auth.rateLimited");
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: auth.signin failed", {
      step: "auth.signin",
      name: "AuthApiError",
      status: 429,
    });
    expect(logs.warns).not.toHaveBeenCalled();
  });

  it("logs a 500 once and redirects with the generic key", async () => {
    const location = await post(new AuthRetryableFetchError(leaky(), 500));
    expect(location.searchParams.get("error")).toBe("errors.auth.generic");
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: auth.signin failed", {
      step: "auth.signin",
      name: "AuthRetryableFetchError",
      status: 500,
    });
  });

  it("logs a network failure (no code, status 0) once and redirects with the generic key", async () => {
    const location = await post(new AuthRetryableFetchError(leaky("fetch failed"), 0));
    expect(location.searchParams.get("error")).toBe("errors.auth.generic");
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: auth.signin failed", {
      step: "auth.signin",
      name: "AuthRetryableFetchError",
    });
  });

  it("logs nothing for a wrong password and keeps its key", async () => {
    const location = await post(new AuthApiError(leaky(), 400, "invalid_credentials"));
    expect(location.searchParams.get("error")).toBe("errors.auth.invalidCredentials");
    expect(logs.everything()).toBe("[]");
  });

  it("keeps the safe next path on every failure redirect", async () => {
    const location = await post(new AuthApiError(leaky(), 400, "invalid_credentials"), {
      ...FORM,
      next: "/tonight/plan?site=s1",
    });
    expect(location.searchParams.get("next")).toBe("/tonight/plan?site=s1");
  });

  it("continues to the page asked for, or to Tonight, after a successful sign-in, and logs nothing", async () => {
    expect(await post(null, { ...FORM, next: "/log" })).toMatchObject({ pathname: "/log" });
    expect(await post(null)).toMatchObject({ pathname: "/tonight" });
    expect(logs.everything()).toBe("[]");
  });

  it("redirects with the not-configured key and logs nothing when there is no client (createClient logs config.supabase)", async () => {
    mocks.client = null;
    const location = locationOf(await signin(routeContext({ form: FORM })));
    expect(location.searchParams.get("error")).toBe("errors.auth.notConfigured");
    expect(logs.everything()).toBe("[]");
  });

  it("redirects a body that is not a form with the shape key and logs request.form instead of throwing", async () => {
    auth({});
    const location = locationOf(await signin(routeContext({ body: NOT_A_FORM })));
    expect(location.pathname).toBe("/auth/signin");
    expect(location.searchParams.get("error")).toBe("errors.checkFields");
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: request.form failed", {
      step: "request.form",
      name: "TypeError",
    });
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

  it("logs a confirmation-email fault (a 500 unexpected_failure) once and redirects with the generic key", async () => {
    const location = await post({ error: new AuthApiError(leaky(), 500, "unexpected_failure") });
    expect(location.pathname).toBe("/auth/signup");
    expect(location.searchParams.get("error")).toBe("errors.auth.generic");
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: auth.signup failed", {
      step: "auth.signup",
      name: "AuthApiError",
      status: 500,
    });
  });

  it("logs an email rate limit once and keeps its key", async () => {
    const location = await post({ error: new AuthApiError(leaky(), 429, "over_email_send_rate_limit") });
    expect(location.searchParams.get("error")).toBe("errors.auth.emailRateLimited");
    expect(logs.errors).toHaveBeenCalledTimes(1);
  });

  it("logs a network failure once", async () => {
    const location = await post({ error: new AuthRetryableFetchError(leaky("fetch failed"), 0) });
    expect(location.searchParams.get("error")).toBe("errors.auth.generic");
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: auth.signup failed", {
      step: "auth.signup",
      name: "AuthRetryableFetchError",
    });
  });

  it.each([
    ["an address that is already registered", "user_already_exists", "errors.auth.userExists"],
    ["a weak password", "weak_password", "errors.auth.weakPassword"],
    ["a malformed address", "email_address_invalid", "errors.auth.invalidEmail"],
  ])("logs nothing for %s and keeps its key", async (_label, code, key) => {
    const location = await post({ error: new AuthApiError(leaky(), 422, code) });
    expect(location.searchParams.get("error")).toBe(key);
    expect(logs.everything()).toBe("[]");
  });

  it("goes to the first-run setup with a session, or to the confirmation page without one, and logs nothing", async () => {
    expect((await post({ data: { session: {} } })).pathname).toBe("/onboarding");
    expect((await post({ data: { session: null } })).pathname).toBe("/auth/confirm-email");
    expect(logs.everything()).toBe("[]");
  });

  it("redirects a body that is not a form with the shape key and logs request.form", async () => {
    auth({});
    const location = locationOf(await signup(routeContext({ body: NOT_A_FORM })));
    expect(location.pathname).toBe("/auth/signup");
    expect(location.searchParams.get("error")).toBe("errors.checkFields");
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: request.form failed", {
      step: "request.form",
      name: "TypeError",
    });
  });

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

  it("logs nothing for a session that was already stale", async () => {
    expect((await post(new AuthApiError(leaky(), 400, "refresh_token_not_found"))).pathname).toBe("/");
    expect(logs.everything()).toBe("[]");
  });

  it("logs nothing for a clean sign-out", async () => {
    expect((await post(null)).pathname).toBe("/");
    expect(logs.everything()).toBe("[]");
  });

  it("goes home without a call or a line when there is no client", async () => {
    mocks.client = null;
    expect(locationOf(await signout(routeContext())).pathname).toBe("/");
    expect(logs.everything()).toBe("[]");
  });
});
