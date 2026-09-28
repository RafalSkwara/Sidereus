import { defineMiddleware } from "astro:middleware";
import { createClient, type SessionUser, type TypedSupabaseClient } from "@/lib/supabase";
import { LOCALE_COOKIE, THEME_COOKIE, resolveLocale, resolveTheme } from "@/lib/preferences";
import { signInUrl } from "@/lib/auth-redirect";
import { isProtectedPath } from "@/lib/protected-routes";

/**
 * Verifies the access token locally (asymmetric signing keys, cached per isolate) instead of asking
 * Supabase Auth on every request; Supabase is only called when the token needs refreshing. Accepted
 * trade-off: a session revoked elsewhere stays valid here until its token expires (at most 1 h).
 * Any failure, a timeout included, counts as signed out.
 */
async function sessionUser(supabase: TypedSupabaseClient): Promise<SessionUser | null> {
  try {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    return claims ? { id: claims.sub, email: claims.email ?? null } : null;
  } catch {
    return null;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Preferences resolve for every request, with or without Supabase, so Layout can theme the first paint.
  context.locals.theme = resolveTheme(context.cookies.get(THEME_COOKIE)?.value);
  context.locals.locale = resolveLocale(
    context.cookies.get(LOCALE_COOKIE)?.value,
    context.request.headers.get("accept-language"),
  );

  const supabase = createClient(context.request.headers, context.cookies);
  // One per-request client: the same instance resolves the user and serves DB queries in pages and routes.
  context.locals.supabase = supabase;

  context.locals.user = supabase ? await sessionUser(supabase) : null;

  if (isProtectedPath(context.url.pathname)) {
    if (!context.locals.user) {
      // A page visit continues there after sign-in; gated API routes are POST targets, so they get plain sign-in.
      const { pathname, search } = context.url;
      const isPageVisit = context.request.method === "GET" && !pathname.startsWith("/api/");
      return context.redirect(signInUrl(isPageVisit ? pathname + search : null));
    }
  }

  const response = await next();
  // HTML depends on the theme/language cookies and Accept-Language: no cache may share it across visitors.
  if (response.headers.get("content-type")?.includes("text/html")) {
    response.headers.append("Vary", "Cookie, Accept-Language");
  }
  return response;
});
