import type { APIRoute } from "astro";
import { AUTH_NOT_CONFIGURED, CHECK_FIELDS, authErrorKey, logAuthFailure, readForm } from "@/lib/api-errors";
import { safeNextPath, withNext } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase";

/*
 * `?error=` carries a message key only: Supabase's error text is mapped by its code, never forwarded. A failure that is
 * not the user's mistake (a network fault, a 5xx, a confirmation-email fault) also leaves an `auth.signup` line with
 * the error's name and status, never the email, and a rate limit a warn-level notice; a body that is not a form
 * redirects with the shape key and leaves a `request.form` notice (the route is public, so a scanner's body is not an
 * Issue). A safe `next` (the page the visitor asked for before sign-up, read through `safeNextPath`) rides on every
 * redirect, after the first-run setup: `/onboarding?next=…` carries it to its end.
 */
export const POST: APIRoute = async (context) => {
  const form = await readForm(context.request, { publicRoute: true });
  const next = safeNextPath(form?.get("next"));

  const backToSignUp = (errorKey: string) => {
    const params = new URLSearchParams({ error: errorKey });
    if (next) params.set("next", next);
    return context.redirect(`/auth/signup?${params.toString()}`);
  };

  if (form === null) {
    return backToSignUp(CHECK_FIELDS);
  }
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return backToSignUp(AUTH_NOT_CONFIGURED);
  }
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    logAuthFailure("auth.signup", error);
    return backToSignUp(authErrorKey(error));
  }

  // With email confirmation off, sign-up already starts a session: go straight into the first-run setup.
  return context.redirect(withNext(data.session ? "/onboarding" : "/auth/confirm-email", next));
};
