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
    return context.redirect(`/auth/signin?error=${encodeURIComponent(AUTH_NOT_CONFIGURED)}`);
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(authErrorKey(error))}`);
  }

  // A returning user lands on the product (S-03); continuing to the originally requested page is S-09.
  return context.redirect("/tonight");
};
