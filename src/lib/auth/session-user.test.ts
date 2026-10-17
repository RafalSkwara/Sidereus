import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  AuthApiError,
  AuthInvalidJwtError,
  AuthRefreshDiscardedError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthUnknownError,
} from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { captureConsole, type ConsoleCapture } from "@/lib/test-support/route-context";
import { COORDS, EMAIL, LEAK } from "@/lib/test-support/supabase-fake";

import { ROUTINE_ERROR_CODES, ROUTINE_ERROR_NAMES, isRoutineSessionError, sessionUser } from "./session-user";

/**
 * `sessionUser` (error-visibility, Phase 5): the middleware's session read, pure over the client. A stale or changed
 * cookie is routine and silent; an Auth outage (network, timeout, 5xx) and anything unknown is a failure that leaves
 * an `auth.claims` line, while the user stays signed out either way. The error classes are the installed
 * `@supabase/auth-js`'s own, so the pinned lists below are checked against the library, not against memory.
 */

const CLAIMS = { sub: "11111111-1111-4111-8111-111111111111", email: EMAIL };

type GetClaims = () => Promise<unknown>;

/** A client whose `getClaims` does what the test says; the cast is the stub's only seam. */
function clientWith(getClaims: GetClaims): Parameters<typeof sessionUser>[0] {
  return { auth: { getClaims } } as unknown as Parameters<typeof sessionUser>[0];
}

/** `getClaims` returning `{ data: null, error }`, which is how auth-js reports every auth failure. */
function failing(error: unknown) {
  return clientWith(() => Promise.resolve({ data: null, error }));
}

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
});
afterEach(() => {
  logs.restore();
});

describe("the pinned lists, checked against the installed @supabase/auth-js", () => {
  const require = createRequire(import.meta.url);

  it("names exactly what the library's error classes are called, lists only codes it declares, and knows how it words its routine errors", () => {
    expect(new AuthSessionMissingError().name).toBe("AuthSessionMissingError");
    expect(new AuthInvalidJwtError("x").name).toBe("AuthInvalidJwtError");
    expect(new AuthRefreshDiscardedError().name).toBe("AuthRefreshDiscardedError");
    expect(new AuthRetryableFetchError("x", 503).name).toBe("AuthRetryableFetchError");
    expect([...ROUTINE_ERROR_NAMES].sort()).toEqual([
      "AuthInvalidJwtError",
      "AuthRefreshDiscardedError",
      "AuthSessionMissingError",
    ]);

    // The ErrorCode union in error-codes.d.ts.
    const declared = readFileSync(
      require.resolve("@supabase/auth-js/package.json").replace("package.json", "dist/main/lib/error-codes.d.ts"),
      "utf8",
    );
    for (const code of ROUTINE_ERROR_CODES) {
      expect(declared, code).toContain(`'${code}'`);
    }
    expect([...ROUTINE_ERROR_CODES].sort()).toEqual([
      "bad_jwt",
      "refresh_token_already_used",
      "refresh_token_not_found",
      "session_expired",
      "session_not_found",
      "validation_failed",
    ]);

    // A missing session and an invalid JWT are routine by NAME, and neither carries one of the listed codes, so a
    // name check alone is not enough for a server-sent code and a code check alone is not enough for these two.
    expect(new AuthSessionMissingError().code).toBeUndefined();
    expect(new AuthInvalidJwtError("x").code).toBe("invalid_jwt");
    expect(new AuthRetryableFetchError("x", 0).status).toBe(0);
    // A concurrent sign-out or sign-in raced the refresh: auth-js itself treats it as a no-op, with a 409 and no code.
    expect(new AuthRefreshDiscardedError().code).toBeUndefined();
    expect(new AuthRefreshDiscardedError().status).toBe(409);
  });
});

describe("sessionUser", () => {
  it("reads the verified claims as the user, and a missing session or a routine error (a stale or changed cookie) as signed out and silent", async () => {
    expect(await sessionUser(clientWith(() => Promise.resolve({ data: { claims: CLAIMS }, error: null })))).toEqual({
      id: CLAIMS.sub,
      email: EMAIL,
    });
    expect(
      await sessionUser(clientWith(() => Promise.resolve({ data: { claims: { sub: CLAIMS.sub } }, error: null }))),
    ).toEqual({ id: CLAIMS.sub, email: null });
    expect(await sessionUser(clientWith(() => Promise.resolve({ data: null, error: null })))).toBeNull();
    expect(logs.everything()).toBe("[]");

    const routine: [string, unknown][] = [
      ["a stale refresh token (refresh_token_not_found)", new AuthApiError("m", 400, "refresh_token_not_found")],
      ["a reused refresh token (refresh_token_already_used)", new AuthApiError("m", 400, "refresh_token_already_used")],
      ["an expired session (session_expired)", new AuthApiError("m", 400, "session_expired")],
      ["a session that no longer exists (session_not_found)", new AuthApiError("m", 403, "session_not_found")],
      ["a bad JWT (bad_jwt)", new AuthApiError("m", 403, "bad_jwt")],
      [
        "a malformed refresh token in a tampered cookie (validation_failed)",
        new AuthApiError("m", 400, "validation_failed"),
      ],
      ["a missing session error", new AuthSessionMissingError()],
      ["an invalid JWT (a bad signature or structure)", new AuthInvalidJwtError("Invalid JWT signature")],
      [
        "a refresh discarded because the session changed mid-flight (AuthRefreshDiscardedError, status 409)",
        new AuthRefreshDiscardedError(),
      ],
    ];
    expect(routine).toHaveLength(9);
    for (const [label, error] of routine) {
      expect(await sessionUser(failing(error)), label).toBeNull();
      expect(logs.everything(), label).toBe("[]");
      expect(isRoutineSessionError(error), label).toBe(true);
    }
  });

  it("reads a failure as signed out and leaves one auth.claims line with only its name, status and auth-js code", async () => {
    const failures: [string, unknown, Record<string, unknown>][] = [
      [
        "a transient fetch failure with a 5xx status (AuthRetryableFetchError 503)",
        new AuthRetryableFetchError("Service unavailable", 503),
        { name: "AuthRetryableFetchError", status: 503 },
      ],
      [
        "a network failure or the client's 5 s timeout (AuthRetryableFetchError, status 0, which is no HTTP status)",
        new AuthRetryableFetchError("fetch failed", 0),
        { name: "AuthRetryableFetchError" },
      ],
      [
        "a 5xx the library does not call retryable (AuthApiError 505)",
        new AuthApiError("m", 505, "unexpected_failure"),
        { name: "AuthApiError", status: 505, code: "unexpected_failure" },
      ],
      [
        "a rate limit (AuthApiError 429)",
        new AuthApiError("m", 429, "over_request_rate_limit"),
        { name: "AuthApiError", status: 429, code: "over_request_rate_limit" },
      ],
      [
        "an unknown error class (unknown is not benign)",
        new AuthUnknownError("m", new Error("x")),
        { name: "AuthUnknownError" },
      ],
      [
        "an unknown code on a 4xx",
        new AuthApiError("m", 400, "flow_state_not_found"),
        { name: "AuthApiError", status: 400, code: "flow_state_not_found" },
      ],
      [
        "a timeout error (TimeoutError)",
        Object.assign(new Error("timed out"), { name: "TimeoutError" }),
        { name: "TimeoutError" },
      ],
      [
        "an aborted call (AbortError)",
        Object.assign(new Error("aborted"), { name: "AbortError" }),
        { name: "AbortError" },
      ],
      [
        "a routine code on a 5xx status",
        new AuthApiError("m", 503, "session_expired"),
        { name: "AuthApiError", status: 503, code: "session_expired" },
      ],
      // A value that is not an Error (a string, an empty object) is a failure with only the step.
      ["a string", "boom", {}],
      ["an empty object", {}, {}],
    ];
    expect(failures).toHaveLength(11);
    for (const [label, error, fields] of failures) {
      logs.errors.mockClear();
      expect(await sessionUser(failing(error)), label).toBeNull();
      expect(isRoutineSessionError(error), label).toBe(false);
      expect(logs.errors, label).toHaveBeenCalledTimes(1);
      expect(logs.errors, label).toHaveBeenCalledWith("sidereus: auth.claims failed", {
        step: "auth.claims",
        ...fields,
      });
      expect(logs.warns, label).not.toHaveBeenCalled();
    }
  });

  it("never lets an email or coordinates placed in an error's message, cause or details reach a log argument", async () => {
    const leak = `${EMAIL} at ${COORDS}`;
    const cases: Error[] = [
      new AuthRetryableFetchError(leak, 503),
      new AuthApiError(leak, 500, "unexpected_failure"),
      new AuthUnknownError(leak, new Error(leak)),
      Object.assign(new Error(leak, { cause: new Error(leak) }), { details: leak, hint: leak }),
    ];
    for (const error of cases) {
      await sessionUser(failing(error));
      await sessionUser(clientWith(() => Promise.reject(error)));
    }
    expect(logs.errors).toHaveBeenCalledTimes(cases.length * 2);
    expect(logs.everything()).not.toMatch(LEAK);
  });

  it("is signed out and logs the thrown error's name once, whether getClaims rejects or throws synchronously (auth-js rethrows non-auth errors)", async () => {
    expect(await sessionUser(clientWith(() => Promise.reject(new TypeError("crypto.subtle is gone"))))).toBeNull();
    expect(logs.errors).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledWith("sidereus: auth.claims failed", {
      step: "auth.claims",
      name: "TypeError",
    });

    const user = await sessionUser(
      clientWith(() => {
        throw new RangeError("x");
      }),
    );
    expect(user).toBeNull();
    expect(logs.errors).toHaveBeenCalledTimes(2);
    expect(logs.errors).toHaveBeenLastCalledWith("sidereus: auth.claims failed", {
      step: "auth.claims",
      name: "RangeError",
    });
  });
});
