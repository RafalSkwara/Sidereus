import type { APIRoute } from "astro";
import { NOT_CONFIGURED, issueKey } from "@/lib/api-errors";
import type { MessageKey } from "@/i18n";
import { LOG_PENALTY_MIN_RATING } from "@/lib/engine";
import { reachedBySave } from "@/lib/observations/celebrate";
import { milestoneStore } from "@/lib/observations/milestone-store";
import { editRedirect, logNotice, withMilestones } from "@/lib/observations/redirect";
import { observationUpdateSchema } from "@/lib/observations/schemas";
import { observationStore } from "@/lib/observations/store";
import { isKnownTarget } from "@/lib/targets/labels";

/*
 * Saves an edited log entry (roadmap S-07, FR-017) and returns to the log, which confirms it. A failure goes
 * back to the entry's page with a fixed message key only (`editRedirect`), so no typed value reaches the URL.
 * Every edit goes through `reachedBySave`: one rated `LOG_PENALTY_MIN_RATING` or above counts (it stores what it
 * reached and carries the newly stored milestones to the log as `milestone=<key>` params, fixed keys only), a lower
 * one stores what the log had reached before it can be lost and never celebrates. Nothing is logged except
 * `reachedBySave`'s fixed trace of a failed milestone step, which never fails the save.
 */
export const POST: APIRoute = async (context) => {
  const id = context.params.id ?? "";
  const fail = (message: MessageKey) => context.redirect(editRedirect(id, message));

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const parsed = observationUpdateSchema.safeParse(Object.fromEntries(await context.request.formData()));
  if (!parsed.success) {
    return fail(issueKey(parsed.error));
  }
  // The schema checks the key's shape; a well-formed key the catalogue lacks ("NGC1") is as invalid as a typo.
  if (!isKnownTarget(parsed.data.target)) {
    return fail("errors.observation.objectInvalid");
  }

  const { result, celebrate } = await reachedBySave({
    read: () => observationStore.listSeenEntries(supabase),
    record: (states) => milestoneStore.record(supabase, states),
    counts: parsed.data.rating >= LOG_PENALTY_MIN_RATING,
    write: () => observationStore.update(supabase, id, parsed.data, new Date()),
  });
  if (!result.ok) {
    return fail(result.message);
  }
  return context.redirect(withMilestones(logNotice("updated", parsed.data.target), celebrate));
};
