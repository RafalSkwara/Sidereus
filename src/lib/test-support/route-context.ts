import type { APIRoute } from "astro";
import { vi, type MockInstance } from "vitest";
import type { TypedSupabaseClient } from "@/lib/supabase";

/**
 * Seams for the API route tests under `src/lib/routes` (error-visibility, Phase 4): a fake Astro `context` around a
 * real `Request`, so a route's own `request.formData()` runs, and a spy on both log levels that tells a test what a
 * request wrote to the console. A `*.test.ts` under `src/pages` would be built as an endpoint, which is why route
 * tests live elsewhere and import the route from `@/pages/api/...`.
 */

type RouteContext = Parameters<APIRoute>[0];

export interface RouteContextOptions {
  /** The posted form: a field with several values (`targets`) is an array. Ignored when `body` is set. */
  form?: Record<string, string | string[]>;
  /** A raw body with its content type, for the request a browser would never send from a form. */
  body?: { content: string; type: string };
  params?: Record<string, string>;
  supabase?: TypedSupabaseClient | null;
  user?: { id: string } | null;
}

/** A context with the `request`, `url`, `params`, `redirect` and the `locals` the routes read; every other field is absent. */
export function routeContext(options: RouteContextOptions = {}): RouteContext {
  const { form = {}, body, params = {}, supabase = null, user = { id: "user-1" } } = options;
  const request = body
    ? new Request("http://localhost/api/test", {
        method: "POST",
        body: body.content,
        headers: { "content-type": body.type },
      })
    : new Request("http://localhost/api/test", { method: "POST", body: formBody(form) });
  return {
    request,
    url: new URL(request.url),
    params,
    locals: { supabase, user, locale: "en", theme: "dark", skyMode: "default" },
    redirect: (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
  } as unknown as RouteContext;
}

function formBody(form: Record<string, string | string[]>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [name, value] of Object.entries(form)) {
    for (const each of Array.isArray(value) ? value : [value]) {
      body.append(name, each);
    }
  }
  return body;
}

/** A body that is not a form: `request.formData()` rejects on it, as it does on any non-form content type. */
export const NOT_A_FORM = { content: "{}", type: "application/json" };

/** Where the route sent the browser. */
export function locationOf(response: Response): URL {
  const location = response.headers.get("Location");
  if (location === null) {
    throw new Error("the route did not redirect");
  }
  return new URL(location, "http://localhost");
}

/** What a request wrote to the console, by level. */
export interface ConsoleCapture {
  errors: MockInstance<typeof console.error>;
  warns: MockInstance<typeof console.warn>;
  /** Every argument of every call at both levels, serialised: what a canary must never appear in. */
  everything: () => string;
  restore: () => void;
}

export function captureConsole(): ConsoleCapture {
  const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const warns = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  return {
    errors,
    warns,
    everything: () => JSON.stringify([...errors.mock.calls, ...warns.mock.calls]),
    restore: () => {
      errors.mockRestore();
      warns.mockRestore();
    },
  };
}

/** A stored site row as PostgREST returns it (the coordinates are the canary's, so a leak of the row shows). */
export const SITE_ROW = {
  id: "3f2b8c1e-5a4d-4e6f-8a7b-9c0d1e2f3a4b",
  name: "Back garden",
  latitude_deg: 52.2297,
  longitude_deg: 21.0122,
  bortle: 5,
  min_altitude_deg: 20,
  time_zone: "Europe/Warsaw",
  time_zone_source: "auto",
  created_at: "2026-09-01T10:00:00Z",
};
