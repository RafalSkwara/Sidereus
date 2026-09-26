import type { APIRoute } from "astro";
import { NOT_CONFIGURED } from "@/lib/api-errors";
import type { MessageKey } from "@/i18n";
import { siteStore } from "@/lib/gear/store";

/*
 * Deletes one site. RLS makes another user's site indistinguishable from a missing one, so both
 * come back as the store's fixed "not found" key. Failures land on the hub, which shows the
 * `?error=` banner. Nothing is logged.
 */
export const POST: APIRoute = async (context) => {
  const fail = (message: MessageKey) => context.redirect(`/gear?error=${encodeURIComponent(message)}`);

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const result = await siteStore.remove(supabase, context.params.id ?? "");
  if (!result.ok) {
    return fail(result.message);
  }
  return context.redirect("/gear");
};
