import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_SECONDS, withSessionMaxAge } from "./session-cookie";

describe("withSessionMaxAge", () => {
  it("gives a set auth cookie 30 days, whatever lifetime the library chose, and leaves other options alone", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(withSessionMaxAge<{ maxAge?: number }>({}).maxAge).toBe(SESSION_MAX_AGE_SECONDS);
    const options = { path: "/", sameSite: "lax" as const, httpOnly: false, secure: true, maxAge: 34560000 };
    expect(withSessionMaxAge(options)).toEqual({ ...options, maxAge: SESSION_MAX_AGE_SECONDS });
  });

  it("keeps a removal a removal", () => {
    expect(withSessionMaxAge({ maxAge: 0 }).maxAge).toBe(0);
  });
});
