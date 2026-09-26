import type { APIRoute } from "astro";
import { AUTH_NOT_CONFIGURED, authErrorKey } from "@/lib/api-errors";
import { createClient } from "@/lib/supabase";

/* `?error=` carries a message key only: Supabase's error text is mapped by its code, never forwarded. */
export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(AUTH_NOT_CONFIGURED)}`);
  }
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return context.redirect(`/auth/signup?error=${encodeURIComponent(authErrorKey(error))}`);
  }

  // With email confirmation off, sign-up already starts a session: go straight into the first-run setup.
  return context.redirect(data.session ? "/onboarding" : "/auth/confirm-email");
};
