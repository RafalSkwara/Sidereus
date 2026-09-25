import type { APIRoute } from "astro";
import { telescopeStore } from "@/lib/gear/store";

const NOT_CONFIGURED = "The database is not configured.";

/*
 * Deletes one telescope. RLS makes another user's telescope indistinguishable from a missing one, so both
 * come back as the store's fixed "not found" message. Failures land on the hub, which shows the
 * `?error=` banner. Nothing is logged.
 */
export const POST: APIRoute = async (context) => {
  const fail = (message: string) => context.redirect(`/gear?error=${encodeURIComponent(message)}`);

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const result = await telescopeStore.remove(supabase, context.params.id ?? "");
  if (!result.ok) {
    return fail(result.message);
  }
  return context.redirect("/gear");
};
