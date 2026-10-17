import type { APIRoute } from "astro";
import { AUTH_NOT_CONFIGURED, CHECK_FIELDS, authErrorKey, logAuthFailure, readForm } from "@/lib/api-errors";
import { safeNextPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase";

/*
 * `?error=` carries a message key only: Supabase's error text is mapped by its code, never forwarded. A failure that is
 * not the user's mistake (a network fault, a 5xx) also leaves an `auth.signin` line with the error's name and status,
 * never the email, and a rate limit a warn-level notice; a body that is not a form redirects with the shape key and
 * leaves a `request.form` notice (the route is public, so a scanner's body is not an Issue).
 */
export const POST: APIRoute = async (context) => {
  const form = await readForm(context.request, { publicRoute: true });
  // The page the user asked for before being sent to sign-in (S-09); only a safe same-origin path counts.
  const next = safeNextPath(form?.get("next"));

  const backToSignIn = (errorKey: string) => {
    const params = new URLSearchParams({ error: errorKey });
    if (next) params.set("next", next);
    return context.redirect(`/auth/signin?${params.toString()}`);
  };

  if (form === null) {
    return backToSignIn(CHECK_FIELDS);
  }
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return backToSignIn(AUTH_NOT_CONFIGURED);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    logAuthFailure("auth.signin", error);
    return backToSignIn(authErrorKey(error));
  }

  // A returning user continues to the page they asked for, else lands on the product (S-03).
  return context.redirect(next ?? "/tonight");
};
