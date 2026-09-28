import type { APIRoute } from "astro";
import { AUTH_NOT_CONFIGURED, authErrorKey } from "@/lib/api-errors";
import { safeNextPath } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase";

/* `?error=` carries a message key only: Supabase's error text is mapped by its code, never forwarded. */
export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;
  // The page the user asked for before being sent to sign-in (S-09); only a safe same-origin path counts.
  const next = safeNextPath(form.get("next"));

  const backToSignIn = (errorKey: string) => {
    const params = new URLSearchParams({ error: errorKey });
    if (next) params.set("next", next);
    return context.redirect(`/auth/signin?${params.toString()}`);
  };

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return backToSignIn(AUTH_NOT_CONFIGURED);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return backToSignIn(authErrorKey(error));
  }

  // A returning user continues to the page they asked for, else lands on the product (S-03).
  return context.redirect(next ?? "/tonight");
};
