import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  AuthApiError,
  AuthInvalidJwtError,
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

  it("names exactly what the library's error classes are called", () => {
    expect(new AuthSessionMissingError().name).toBe("AuthSessionMissingError");
    expect(new AuthInvalidJwtError("x").name).toBe("AuthInvalidJwtError");
    expect(new AuthRetryableFetchError("x", 503).name).toBe("AuthRetryableFetchError");
    expect([...ROUTINE_ERROR_NAMES].sort()).toEqual(["AuthInvalidJwtError", "AuthSessionMissingError"]);
  });

  it("lists only codes the library declares (the ErrorCode union in error-codes.d.ts)", () => {
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
  });

  it("knows how the library words its own routine errors: a missing session has no code, an invalid JWT's is invalid_jwt", () => {
    // Both are routine by NAME; neither carries one of the listed codes, so a name check alone is not enough for a
    // server-sent code and a code check alone is not enough for these two.
    expect(new AuthSessionMissingError().code).toBeUndefined();
    expect(new AuthInvalidJwtError("x").code).toBe("invalid_jwt");
    expect(new AuthRetryableFetchError("x", 0).status).toBe(0);
  });
});

describe("sessionUser", () => {
  it("returns the user from the verified claims and logs nothing", async () => {
    const user = await sessionUser(clientWith(() => Promise.resolve({ data: { claims: CLAIMS }, error: null })));
    expect(user).toEqual({ id: CLAIMS.sub, email: EMAIL });
    expect(logs.everything()).toBe("[]");
  });

  it("gives a null email when the claims have none", async () => {
    const user = await sessionUser(
      clientWith(() => Promise.resolve({ data: { claims: { sub: CLAIMS.sub } }, error: null })),
    );
    expect(user).toEqual({ id: CLAIMS.sub, email: null });
  });

  it("reads a missing session ({ data: null, error: null }) as signed out and logs nothing", async () => {
    expect(await sessionUser(clientWith(() => Promise.resolve({ data: null, error: null })))).toBeNull();
    expect(logs.everything()).toBe("[]");
  });

  describe("a routine error (a stale or changed cookie) is signed out and silent", () => {
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
    ];

    it.each(routine)("%s", async (_label, error) => {
      expect(await sessionUser(failing(error))).toBeNull();
      expect(logs.everything()).toBe("[]");
      expect(isRoutineSessionError(error)).toBe(true);
    });
  });

  describe("a failure is signed out and leaves one auth.claims line with only its name and status", () => {
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
        { name: "AuthApiError", status: 505 },
      ],
      [
        "a rate limit (AuthApiError 429)",
        new AuthApiError("m", 429, "over_request_rate_limit"),
        { name: "AuthApiError", status: 429 },
      ],
      [
        "an unknown error class (unknown is not benign)",
        new AuthUnknownError("m", new Error("x")),
        { name: "AuthUnknownError" },
      ],
      [
        "an unknown code on a 4xx",
        new AuthApiError("m", 400, "flow_state_not_found"),
        { name: "AuthApiError", status: 400 },
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
        { name: "AuthApiError", status: 503 },
      ],
    ];

    it.each(failures)("%s", async (_label, error, fields) => {
      expect(await sessionUser(failing(error))).toBeNull();
      expect(isRoutineSessionError(error)).toBe(false);
      expect(logs.errors).toHaveBeenCalledTimes(1);
      expect(logs.errors).toHaveBeenCalledWith("sidereus: auth.claims failed", { step: "auth.claims", ...fields });
      expect(logs.warns).not.toHaveBeenCalled();
    });

    it("reads a value that is not an Error (a string, an empty object) as a failure with only the step", async () => {
      expect(await sessionUser(failing("boom"))).toBeNull();
      expect(await sessionUser(failing({}))).toBeNull();
      expect(logs.errors).toHaveBeenCalledTimes(2);
      expect(logs.errors).toHaveBeenNthCalledWith(1, "sidereus: auth.claims failed", { step: "auth.claims" });
    });
  });

  describe("a thrown error (non-auth: auth-js rethrows those) is signed out and logs the same step once", () => {
    it("logs the thrown error's name", async () => {
      const user = await sessionUser(clientWith(() => Promise.reject(new TypeError("crypto.subtle is gone"))));
      expect(user).toBeNull();
      expect(logs.errors).toHaveBeenCalledTimes(1);
      expect(logs.errors).toHaveBeenCalledWith("sidereus: auth.claims failed", {
        step: "auth.claims",
        name: "TypeError",
      });
    });

    it("also survives a getClaims that throws synchronously", async () => {
      const user = await sessionUser(
        clientWith(() => {
          throw new RangeError("x");
        }),
      );
      expect(user).toBeNull();
      expect(logs.errors).toHaveBeenCalledWith("sidereus: auth.claims failed", {
        step: "auth.claims",
        name: "RangeError",
      });
    });
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
});
