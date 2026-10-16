import type { APIRoute } from "astro";
import { AUTH_NOT_CONFIGURED, CHECK_FIELDS, authErrorKey, logAuthFailure, readForm } from "@/lib/api-errors";
import { createClient } from "@/lib/supabase";

/*
 * `?error=` carries a message key only: Supabase's error text is mapped by its code, never forwarded. A failure that is
 * not the user's mistake (a network fault, a 5xx, a rate limit, a confirmation-email fault) also leaves an
 * `auth.signup` line with the error's name and status, never the email; a body that is not a form redirects with the
 * shape key and logs `request.form`.
 */
export const POST: APIRoute = async (context) => {
  const form = await readForm(context.request);
  if (form === null) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(CHECK_FIELDS)}`);
  }
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(AUTH_NOT_CONFIGURED)}`);
  }
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    logAuthFailure("auth.signup", error);
    return context.redirect(`/auth/signup?error=${encodeURIComponent(authErrorKey(error))}`);
  }

  // With email confirmation off, sign-up already starts a session: go straight into the first-run setup.
  return context.redirect(data.session ? "/onboarding" : "/auth/confirm-email");
};
