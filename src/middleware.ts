import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
import { LOCALE_COOKIE, THEME_COOKIE, resolveLocale, resolveTheme } from "@/lib/preferences";

const PROTECTED_ROUTES = ["/dashboard", "/gear", "/api/gear", "/tonight", "/onboarding", "/api/onboarding"];

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

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  const response = await next();
  // HTML depends on the theme/language cookies and Accept-Language: no cache may share it across visitors.
  if (response.headers.get("content-type")?.includes("text/html")) {
    response.headers.append("Vary", "Cookie, Accept-Language");
  }
  return response;
});
