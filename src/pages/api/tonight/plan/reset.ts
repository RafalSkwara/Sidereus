import type { APIRoute } from "astro";
import type { MessageKey } from "@/i18n";
import { requireFullPlan } from "@/lib/account-plan";
import { CHECK_FIELDS, issueKey, NOT_CONFIGURED, readForm } from "@/lib/api-errors";
import { siteStore } from "@/lib/gear/store";
import { logFailure } from "@/lib/observability/log-failure";
import { saveFailureKey } from "@/lib/observability/save-failure";
import { thrownKey } from "@/lib/session-plans/checks";
import { planErrorRedirect, planSavedRedirect, PLAN_RESET } from "@/lib/session-plans/redirect";
import { resetPlanSchema } from "@/lib/session-plans/schemas";
import { sessionPlanStore } from "@/lib/session-plans/store";
import { tonightDateForSite } from "@/lib/tonight/tonight-date";

/*
 * Resets the Session plan for tonight (M-3 S-08, adjustable-session-plan): deletes the saved list for one site and
 * night, so the suggested plan shows again. The same guards as `POST /api/tonight/plan`, in the same order (database,
 * plan, shape, the user's own site, tonight's date), minus the target keys and their windows: a full-plan route
 * refuses before any read or write, and only fixed keys and the site's id reach the URL. A failed delete goes through
 * `saveFailureKey` (`save.plan-reset`): a server fault logs one line with only its code and status and redirects with
 * `errors.serverFault`. A failed read of the route's own checks logs `save.plan-reset` with the cause's name and code
 * and keeps its key; a body that is not a form redirects with `errors.checkFields` and logs `request.form`. Nothing
 * submitted is ever logged.
 */
export const POST: APIRoute = async (context) => {
  const form = await readForm(context.request);
  const site = form?.get("site");
  const fail = (key: MessageKey) => context.redirect(planErrorRedirect(site, key));
  if (!form) {
    return fail(CHECK_FIELDS);
  }

  const { supabase } = context.locals;
  if (!supabase) {
    return fail(NOT_CONFIGURED);
  }
  const guard = await requireFullPlan(context.locals);
  if (!guard.ok) {
    return fail(guard.errorKey);
  }

  const parsed = resetPlanSchema.safeParse({ site, night: form.get("night") });
  if (!parsed.success) {
    return fail(issueKey(parsed.error));
  }

  const { site: siteId, night } = parsed.data;
  try {
    const own = await siteStore.get(supabase, siteId);
    if (own === null) {
      return fail("errors.notFound.site");
    }
    if (night !== tonightDateForSite(own, new Date())) {
      return fail("errors.sessionPlan.nightOver");
    }
  } catch (error) {
    logFailure("save.plan-reset", error);
    return fail(thrownKey(error, "errors.save.sessionPlan"));
  }

  const result = await sessionPlanStore.reset(supabase, siteId, night);
  if (!result.ok) {
    return fail(saveFailureKey("save.plan-reset", result));
  }
  return context.redirect(planSavedRedirect(siteId, PLAN_RESET));
};
