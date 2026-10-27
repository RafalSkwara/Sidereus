import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CLIENT_ERROR_PATH } from "@/lib/observability/client/steps";
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

const mocks = vi.hoisted(() => {
  const getClaims = vi.fn<() => Promise<unknown>>();
  return { getClaims, createServerClient: vi.fn(() => ({ auth: { getClaims } })) };
});
vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
  parseCookieHeader: () => [],
}));

const SUB = "11111111-1111-4111-8111-111111111111";

let logs: ConsoleCapture;
beforeEach(() => {
  logs = captureConsole();
  mocks.getClaims.mockReset();
  mocks.createServerClient.mockClear();
});
afterEach(() => {
  logs.restore();
});

/** Runs the real middleware over a fake context and reports what it did. */
async function run(
  path: string,
  method = "GET",
  respond: () => Promise<Response> = () =>
    Promise.resolve(new Response("page", { headers: { "content-type": "text/html" } })),
) {
  const { onRequest } = await import("@/middleware");
  const url = new URL(`http://localhost${path}`);
  const locals: Record<string, unknown> = {};
  const next = vi.fn(respond);
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

    // A gated API POST has no page to come back to: plain sign-in.
    const post = await run("/api/log", "POST");
    expect(post.response.headers.get("Location")).toBe("/auth/signin");
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

  it("passes a gated page on for a signed-in user, and an ungated page on without one, whatever Auth says, still logging a real failure", async () => {
    withUser();
    const signedIn = await run("/tonight");
    expect(signedIn.response.status).toBe(200);
    expect(signedIn.next).toHaveBeenCalledTimes(1);
    expect(signedIn.locals.user).toEqual({ id: SUB, email: EMAIL });
    expect(signedIn.response.headers.get("Vary")).toBe("Cookie, Accept-Language");
    expect(logs.everything()).toBe("[]");

    mocks.getClaims.mockResolvedValue({ data: null, error: new AuthRetryableFetchError("down", 503) });
    const { response, next } = await run("/");
    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
    expect(logs.errors).toHaveBeenCalledTimes(1);
  });
});

describe("onRequest for the client-error endpoint", () => {
  it("passes the path on at once, any method, with no Supabase client, no session read and no locals, while another path still resolves the user", async () => {
    withUser();
    // The route also answers under a trailing slash (`trailingSlash` is `ignore`), so that spelling skips the session too.
    for (const [path, method] of [
      [CLIENT_ERROR_PATH, "POST"],
      [CLIENT_ERROR_PATH, "GET"],
      [`${CLIENT_ERROR_PATH}/`, "POST"],
      [`${CLIENT_ERROR_PATH}//`, "POST"],
    ]) {
      const { response, next, locals } = await run(path, method);
      expect(response.status, `${method} ${path}`).toBe(200);
      expect(next, `${method} ${path}`).toHaveBeenCalledTimes(1);
      expect(locals, `${method} ${path}`).toEqual({});
    }
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.getClaims).not.toHaveBeenCalled();

    const other = await run("/tonight");
    expect(other.locals.user).toEqual({ id: SUB, email: EMAIL });
    expect(mocks.createServerClient).toHaveBeenCalledTimes(1);
    expect(mocks.getClaims).toHaveBeenCalledTimes(1);
  });
});

describe("onRequest as the error boundary", () => {
  it("logs one request.stream line when an HTML body fails mid-stream, keeps the Vary header and the status, and the body still fails for the client", async () => {
    withUser();
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new RangeError("render failed"));
      },
    });
    const { response } = await run("/tonight", "GET", () =>
      Promise.resolve(new Response(body, { status: 200, headers: { "content-type": "text/html" } })),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Vary")).toBe("Cookie, Accept-Language");
    expect(logs.errors).not.toHaveBeenCalled();
    await expect(response.text()).rejects.toThrow("render failed");
    expect(logs.errors).toHaveBeenCalledExactlyOnceWith("sidereus: request.stream failed", {
      step: "request.stream",
      name: "RangeError",
    });
  });
});
