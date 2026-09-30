import type { APIRoute } from "astro";
import { NOT_CONFIGURED } from "@/lib/api-errors";
import type { MessageKey } from "@/i18n";
import { LOG_LIST, logNotice } from "@/lib/observations/redirect";
import { observationStore } from "@/lib/observations/store";

/*
 * Deletes one log entry (roadmap S-07, FR-017). The ranking reads the log on every load, so the object's
 * penalty and "seen" tag go with it. RLS makes another user's entry indistinguishable from a missing one; both
 * come back as the store's fixed "not found" key on the log. Nothing is logged.
 */
export const POST: APIRoute = async (context) => {
  const fail = (message: MessageKey) => context.redirect(`${LOG_LIST}?error=${encodeURIComponent(message)}`);

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const result = await observationStore.remove(supabase, context.params.id ?? "");
  if (!result.ok) {
    return fail(result.message);
  }
  return context.redirect(logNotice("deleted", result.target));
};
