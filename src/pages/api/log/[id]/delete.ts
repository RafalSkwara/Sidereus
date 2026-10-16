import type { APIRoute } from "astro";
import { NOT_CONFIGURED } from "@/lib/api-errors";
import type { MessageKey } from "@/i18n";
import { reachedBySave } from "@/lib/observations/celebrate";
import { milestoneStore } from "@/lib/observations/milestone-store";
import { LOG_LIST, logNotice } from "@/lib/observations/redirect";
import { observationStore } from "@/lib/observations/store";
import { saveFailureKey } from "@/lib/observability/save-failure";

/*
 * Deletes one log entry (roadmap S-07, FR-017). The ranking reads the log on every load, so the object's
 * penalty and "seen" tag go with it. RLS makes another user's entry indistinguishable from a missing one; both
 * come back as the store's fixed "not found" key on the log. A delete can reach nothing, but it can take away the
 * only entry that showed a milestone, so `reachedBySave` (`counts: false`) stores what the log had reached before
 * the entry goes; it never celebrates, and the redirect carries no milestone. A failed delete goes through
 * `saveFailureKey` (`save.log`): a server fault logs one line with only its code and status and redirects with
 * `errors.serverFault`. `reachedBySave` traces a failed milestone step under its own `milestones.*-delete` word,
 * which never fails the delete; no value is ever logged.
 */
export const POST: APIRoute = async (context) => {
  const fail = (message: MessageKey) => context.redirect(`${LOG_LIST}?error=${encodeURIComponent(message)}`);

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const id = context.params.id ?? "";
  const { result } = await reachedBySave({
    read: () => observationStore.listSeenEntries(supabase),
    record: (states) => milestoneStore.record(supabase, states),
    counts: false,
    route: "delete",
    write: () => observationStore.remove(supabase, id),
  });
  if (!result.ok) {
    return fail(saveFailureKey("save.log", result));
  }
  return context.redirect(logNotice("deleted", result.target));
};
