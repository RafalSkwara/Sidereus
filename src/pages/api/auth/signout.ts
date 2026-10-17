import type { APIRoute } from "astro";
import { logAuthFailure } from "@/lib/api-errors";
import { createClient } from "@/lib/supabase";

/*
 * Signs out and goes home whatever happens. The `signOut()` result is read, though: an Auth outage means the session was
 * never revoked on the server while the user believes they are signed out, so a failure leaves an `auth.signout` line
 * (name and status only). A session that was already stale is routine and silent.
 */
export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      logAuthFailure("auth.signout", error);
    }
  }
  return context.redirect("/");
};
