import type { APIRoute } from "astro";
import { CHECK_FIELDS, NOT_CONFIGURED, issueKey, readForm } from "@/lib/api-errors";
import type { MessageKey } from "@/i18n";
import { LOG_PENALTY_MIN_RATING } from "@/lib/engine";
import { reachedBySave } from "@/lib/observations/celebrate";
import { milestoneStore } from "@/lib/observations/milestone-store";
import { editRedirect, logNotice, withMilestones } from "@/lib/observations/redirect";
import { observationUpdateSchema } from "@/lib/observations/schemas";
import { observationStore } from "@/lib/observations/store";
import { saveFailureKey } from "@/lib/observability/save-failure";
import { isKnownTarget } from "@/lib/targets/labels";

/*
 * Saves an edited log entry (roadmap S-07, FR-017) and returns to the log, which confirms it. A failure goes
 * back to the entry's page with a fixed message key only (`editRedirect`), so no typed value reaches the URL.
 * Every edit goes through `reachedBySave`: one rated `LOG_PENALTY_MIN_RATING` or above counts (it stores what it
 * reached and carries the newly stored milestones to the log as `milestone=<key>` params, fixed keys only), a lower
 * one stores what the log had reached before it can be lost and never celebrates. A failed write goes through
 * `saveFailureKey` (`save.log`): a server fault logs one line with only its code and status and redirects with
 * `errors.serverFault`; a body that is not a form redirects with `errors.checkFields` and logs `request.form`.
 * `reachedBySave` traces a failed milestone step under its own `milestones.*-edit` word, which never fails the save;
 * no value is ever logged.
 */
export const POST: APIRoute = async (context) => {
  const id = context.params.id ?? "";
  const fail = (message: MessageKey) => context.redirect(editRedirect(id, message));

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const form = await readForm(context.request);
  if (!form) {
    return fail(CHECK_FIELDS);
  }
  const parsed = observationUpdateSchema.safeParse(Object.fromEntries(form));
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
    route: "edit",
    write: () => observationStore.update(supabase, id, parsed.data, new Date()),
  });
  if (!result.ok) {
    return fail(saveFailureKey("save.log", result));
  }
  return context.redirect(withMilestones(logNotice("updated", parsed.data.target), celebrate));
};
