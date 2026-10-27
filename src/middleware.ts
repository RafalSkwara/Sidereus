import { defineMiddleware } from "astro:middleware";
import { SUPABASE_URL } from "astro:env/server";
import { sessionUser } from "@/lib/auth/session-user";
import { createClient } from "@/lib/supabase";
import {
  LOCALE_COOKIE,
  SKY_MODE_COOKIE,
  THEME_COOKIE,
  resolveLocale,
  resolveSkyMode,
  resolveTheme,
} from "@/lib/preferences";
import { isAuthEntryPath, safeNextPath, signInUrl } from "@/lib/auth-redirect";
import { isProtectedPath } from "@/lib/protected-routes";
import { readTestNow } from "@/lib/clock";
import { isClientErrorPath } from "@/lib/observability/client/steps";
import { logFailure, requestRoute } from "@/lib/observability/log-failure";
import { guardStream } from "@/lib/observability/stream-guard";

// A thin wrapper: the session read and its failure trace are `sessionUser` (src/lib/auth/session-user.ts).
export const onRequest = defineMiddleware(async (context, next) => {
  // The client-error endpoint (error-visibility, Phase 7) is public and reads no session: a beacon from the service
  // worker or a signed-out page must not cost a Supabase Auth call. Any method, so a probing GET costs none either.
  if (isClientErrorPath(context.url.pathname)) {
    return next();
  }

  // Preferences resolve for every request, with or without Supabase, so Layout can theme the first paint.
  context.locals.theme = resolveTheme(context.cookies.get(THEME_COOKIE)?.value);
  context.locals.locale = resolveLocale(
    context.cookies.get(LOCALE_COOKIE)?.value,
    context.request.headers.get("accept-language"),
  );
  // The live sky's mode (ui-sky-modes): read by the dashboard shell (its skeleton) and its server island alike.
  context.locals.skyMode = resolveSkyMode(context.cookies.get(SKY_MODE_COOKIE)?.value);

  // The e2e clock seam (src/lib/clock.ts): the cookie is honoured against a loopback Supabase only.
  const testNow = readTestNow(context.request.headers.get("cookie"), SUPABASE_URL);
  if (testNow) {
    context.locals.testNow = testNow;
  }

  const supabase = createClient(context.request.headers, context.cookies);
  // One per-request client: the same instance resolves the user and serves DB queries in pages and routes.
  context.locals.supabase = supabase;

  context.locals.user = supabase ? await sessionUser(supabase) : null;

  // A signed-in visitor has no use for the sign-in and sign-up pages: continue to `next`, else Tonight. `safeNextPath`
  // refuses `/auth*`, so the target is never an auth page and cannot loop. A stale cookie resolves to no user above.
  if (context.locals.user && context.request.method === "GET" && isAuthEntryPath(context.url.pathname)) {
    return context.redirect(safeNextPath(context.url.searchParams.get("next")) ?? "/tonight");
  }

  if (isProtectedPath(context.url.pathname)) {
    if (!context.locals.user) {
      // A page visit continues there after sign-in; gated API routes are POST targets, so they get plain sign-in.
      const { pathname, search } = context.url;
      const isPageVisit = context.request.method === "GET" && !pathname.startsWith("/api/");
      return context.redirect(signInUrl(isPageVisit ? pathname + search : null));
    }
  }

  // The route template names the page or island that broke on a request-level line, never a pathname or a value.
  const route = requestRoute(context.routePattern, context.params);

  // The boundary for every page and island: a throw from `next()` is logged once and rethrown, as it was before.
  let response: Response;
  try {
    response = await next();
  } catch (error) {
    logFailure("request.uncaught", error, { route });
    throw error;
  }
  // A safety net: production rejects `next()` when a page or an endpoint throws (the catch above), and renders the
  // `/500` page through this middleware again (`renderDefaultError`, #190), so the page itself is skipped here.
  if (response.status >= 500 && context.routePattern !== "/500") {
    logFailure("request.uncaught", undefined, { status: response.status, route });
  }
  // HTML depends on the theme/language cookies and Accept-Language: no cache may share it across visitors.
  if (response.headers.get("content-type")?.includes("text/html")) {
    response.headers.append("Vary", "Cookie, Accept-Language");
    // The body is sent as it renders, so a render error after the 200 is a rejected read: guard it. Astro re-attaches
    // `context.cookies` after the middleware, so building a new Response loses no cookie; no length is ever set.
    if (response.body) {
      return new Response(guardStream(response.body, "request.stream", { route }), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
  }
  return response;
});
