import type { APIRoute } from "astro";
import type { MessageKey } from "@/i18n";
import { requireFullPlan } from "@/lib/account-plan";
import { CHECK_FIELDS, issueKey, NOT_CONFIGURED, readForm } from "@/lib/api-errors";
import { siteStore } from "@/lib/gear/store";
import { logFailure } from "@/lib/observability/log-failure";
import { saveFailureKey } from "@/lib/observability/save-failure";
import { keysWithoutWindow, newKeys, thrownKey } from "@/lib/session-plans/checks";
import { planErrorRedirect, planSavedRedirect, PLAN_SAVED } from "@/lib/session-plans/redirect";
import { savePlanSchema } from "@/lib/session-plans/schemas";
import { sessionPlanStore } from "@/lib/session-plans/store";
import { isKnownTarget } from "@/lib/targets/labels";
import { tonightDateForSite } from "@/lib/tonight/tonight-date";

/*
 * Saves the edited Session plan for tonight (M-3 S-08, adjustable-session-plan): the whole ordered list of target keys
 * for one site and night. The first full-plan POST route, so every refusal comes before any read or write and in this
 * order: no database, the plan (`requireFullPlan`), the form's shape, the catalogue, the user's own site, tonight's
 * date (the night in the form must be the site's current one), then the window of every key the list adds (a key
 * already on the stored list passes unchecked, F4), and only then the write. Every refusal redirects back to
 * `/tonight/plan` with a fixed `?error=<message key>`; the site's id is put into the URL only when it is shaped like
 * one. Nothing else from the form (keys, night, coordinates) reaches a URL or a log. A failed write goes through
 * `saveFailureKey` (`save.plan`): a server fault logs one line with only its code and status and redirects with
 * `errors.serverFault`. A failed read of the route's own checks logs `save.plan` with the cause's name and code and
 * keeps its key; a body that is not a form redirects with `errors.checkFields` and logs `request.form`.
 */
export const POST: APIRoute = async (context) => {
  const form = await readForm(context.request);
  // The raw site goes into a redirect only through `isGearId` (see `redirect.ts`).
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

  const parsed = savePlanSchema.safeParse({ site, night: form.get("night"), targets: form.getAll("targets") });
  if (!parsed.success) {
    return fail(issueKey(parsed.error));
  }
  // The schema checks the keys' shape; a well-formed key the catalogue lacks ("NGC1") is as invalid as a typo.
  if (!parsed.data.targets.every(isKnownTarget)) {
    return fail("errors.save.sessionPlan");
  }

  const { site: siteId, night, targets } = parsed.data;
  try {
    const own = await siteStore.get(supabase, siteId);
    if (own === null) {
      return fail("errors.notFound.site");
    }
    if (night !== tonightDateForSite(own, new Date())) {
      return fail("errors.sessionPlan.nightOver");
    }
    const stored = await sessionPlanStore.get(supabase, siteId, night);
    if (keysWithoutWindow(own, night, newKeys(stored, targets)).length > 0) {
      return fail("errors.sessionPlan.notVisible");
    }
  } catch (error) {
    // A failed read: traced with the step, the cause's name and code, and answered with the store's fixed key (its
    // database error stays inside the store).
    logFailure("save.plan", error);
    return fail(thrownKey(error, "errors.save.sessionPlan"));
  }

  const result = await sessionPlanStore.save(supabase, siteId, night, targets);
  if (!result.ok) {
    return fail(saveFailureKey("save.plan", result));
  }
  return context.redirect(planSavedRedirect(siteId, PLAN_SAVED));
};
