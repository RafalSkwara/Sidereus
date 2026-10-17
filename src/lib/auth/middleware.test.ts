import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureConsole, type ConsoleCapture } from "@/lib/test-support/route-context";
import { EMAIL, LEAK } from "@/lib/test-support/supabase-fake";

/**
 * `onRequest` (error-visibility, Phase 5) after `sessionUser` moved out of it: a thin wrapper that resolves the user,
 * redirects a gated path without one exactly as before and passes everything else on. The virtual modules are the
 * Phase 1 seams; the Supabase client is a stub whose `getClaims` the test chooses, so no network is involved.
 */

vi.mock("astro:middleware", async () => (await import("@/lib/test-support/virtual-modules")).astroMiddleware());
vi.mock("astro:env/server", async () =>
  (await import("@/lib/test-support/virtual-modules")).astroEnvServer({
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_KEY: "sb_publishable_test",
  }),
);

const mocks = vi.hoisted(() => ({ getClaims: vi.fn<() => Promise<unknown>>() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: mocks.getClaims } }),
  parseCookieHeader: () => [],
}));

const SUB = "11111111-1111-4111-8111-111111111111";

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
  mocks.getClaims.mockReset();
});
afterEach(() => {
  logs.restore();
});

/** Runs the real middleware over a fake context and reports what it did. */
async function run(path: string, method = "GET") {
  const { onRequest } = await import("@/middleware");
  const url = new URL(`http://localhost${path}`);
  const locals: Record<string, unknown> = {};
  const next = vi.fn(() => Promise.resolve(new Response("page", { headers: { "content-type": "text/html" } })));
  const context = {
    request: new Request(url, { method }),
    url,
    locals,
    cookies: { get: () => undefined, set: () => undefined },
    redirect: (location: string) => new Response(null, { status: 302, headers: { Location: location } }),
  };
  const response = await (onRequest as unknown as (c: unknown, n: () => Promise<Response>) => Promise<Response>)(
    context,
    next,
  );
  return { response, next, locals };
}

const withUser = () => mocks.getClaims.mockResolvedValue({ data: { claims: { sub: SUB, email: EMAIL } }, error: null });

describe("onRequest", () => {
  it("redirects a gated page without a user to sign-in, continuing to the page afterwards", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    const { response, next, locals } = await run("/tonight/targets?site=s1");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/auth/signin?next=%2Ftonight%2Ftargets%3Fsite%3Ds1");
    expect(locals.user).toBeNull();
    expect(next).not.toHaveBeenCalled();
    expect(logs.everything()).toBe("[]");
  });

  it("sends a gated API POST without a user to plain sign-in", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    const { response } = await run("/api/log", "POST");
    expect(response.headers.get("Location")).toBe("/auth/signin");
  });

  it("still redirects when Auth is down (a 503), and now leaves one auth.claims line without the email", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: new AuthRetryableFetchError(`down for ${EMAIL}`, 503) });
    const { response, locals } = await run("/tonight");
    expect(response.headers.get("Location")).toBe("/auth/signin?next=%2Ftonight");
    expect(locals.user).toBeNull();
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: auth.claims failed", {
      step: "auth.claims",
      name: "AuthRetryableFetchError",
      status: 503,
    });
    expect(logs.everything()).not.toMatch(LEAK);
  });

  it("redirects a stale refresh token the same way and logs nothing", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: new AuthApiError("m", 400, "refresh_token_not_found") });
    const { response } = await run("/tonight");
    expect(response.status).toBe(302);
    expect(logs.everything()).toBe("[]");
  });

  it("passes a gated page on for a signed-in user and puts the user on locals", async () => {
    withUser();
    const { response, next, locals } = await run("/tonight");
    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
    expect(locals.user).toEqual({ id: SUB, email: EMAIL });
    expect(response.headers.get("Vary")).toBe("Cookie, Accept-Language");
  });

  it("passes an ungated page on without a user, whatever Auth says, and still logs a real failure", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: new AuthRetryableFetchError("down", 503) });
    const { response, next } = await run("/");
    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledTimes(1);
  });
});
