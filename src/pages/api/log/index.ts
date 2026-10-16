import type { APIRoute } from "astro";
import { CHECK_FIELDS, NOT_CONFIGURED, issueKey, readForm } from "@/lib/api-errors";
import type { MessageKey } from "@/i18n";
import { LOG_PENALTY_MIN_RATING } from "@/lib/engine";
import { reachedBySave } from "@/lib/observations/celebrate";
import { milestoneStore } from "@/lib/observations/milestone-store";
import { formRedirect, noticeRedirect, tonightReturnPath, withMilestones } from "@/lib/observations/redirect";
import { observationInputSchema, returnTargetSchema } from "@/lib/observations/schemas";
import { observationStore } from "@/lib/observations/store";
import { saveFailureKey } from "@/lib/observability/save-failure";
import { isKnownTarget } from "@/lib/targets/labels";

/*
 * Saves one observation log entry (roadmap S-06) and returns to the Tonight page that linked to the form (`from`
 * names a focused page, tonight-dashboard; missing or unknown → Tonight), which confirms it; a manual entry from
 * the log (`from=log`, S-07) returns to the log instead. Every
 * `?error=` value is a fixed message key, and the prefill carried back is filtered by `formRedirect`,
 * so no typed value (and never a coordinate) reaches the URL. A create rated `LOG_PENALTY_MIN_RATING` or above
 * stores the milestones it reached (`reachedBySave`) and carries the newly stored ones to the returning page as
 * `milestone=<key>` params (fixed keys, never a value); a lower rating can neither reach nor lose one and does no
 * milestone work at all. A failed write goes through `saveFailureKey` (`save.log`): a server fault logs one line with
 * only its code and status and redirects with `errors.serverFault`; a body that is not a form redirects with
 * `errors.checkFields` and logs `request.form`. `reachedBySave` traces a failed milestone step under its own
 * `milestones.*-create` word, which never fails the save; no value is ever logged.
 */
export const POST: APIRoute = async (context) => {
  const form = await readForm(context.request);
  // An unreadable body has no values to carry back to the form: the redirect holds the shape key only.
  const raw = form ? Object.fromEntries(form) : {};
  const fail = (message: MessageKey) => context.redirect(formRedirect(raw, message));
  if (!form) {
    return fail(CHECK_FIELDS);
  }

  const supabase = context.locals.supabase;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }

  const parsed = observationInputSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(issueKey(parsed.error));
  }
  // The schema checks the key's shape; a well-formed key the catalogue lacks ("NGC1") is as invalid as a typo.
  if (!isKnownTarget(parsed.data.target)) {
    return fail("errors.observation.objectInvalid");
  }

  const write = () => observationStore.create(supabase, parsed.data, new Date());
  // The create short-circuit: a rating below the bar skips the milestone reads and the record entirely.
  const { result, celebrate } =
    parsed.data.rating >= LOG_PENALTY_MIN_RATING
      ? await reachedBySave({
          read: () => observationStore.listSeenEntries(supabase),
          record: (states) => milestoneStore.record(supabase, states),
          counts: true,
          route: "create",
          write,
        })
      : { result: await write(), celebrate: [] };
  if (!result.ok) {
    return fail(saveFailureKey("save.log", result));
  }
  const from = returnTargetSchema.safeParse(raw.from).data;
  const manual = from === "log";
  const { target } = parsed.data;
  return context.redirect(
    withMilestones(
      manual
        ? noticeRedirect("saved", target)
        : `${tonightReturnPath(from)}?${new URLSearchParams({ logged: target }).toString()}`,
      celebrate,
    ),
  );
};
