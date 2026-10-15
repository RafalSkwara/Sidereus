import type { MessageKey } from "@/i18n";
import { isGearId } from "@/lib/tonight/gear-choice";

/**
 * Where the Session plan's routes send the browser (adjustable-session-plan): back to `/tonight/plan`, with a fixed
 * `?error=<message key>` or `?saved=plan|plan-reset`. Only fixed keys and the site's id reach the URL, and the id only
 * when it is shaped like a uuid (`isGearId`), because the raw form value is the one thing a visitor controls: never a
 * target key, a night, a coordinate or any other submitted value.
 */

/** The Session plan page. */
export const PLAN_PAGE = "/tonight/plan";

/** The fixed values of `?saved=`: a saved list and a reset one. Both are in `TOAST_PARAMS` (`saved`). */
export const PLAN_SAVED = "plan";
export const PLAN_RESET = "plan-reset";
export type PlanSaved = typeof PLAN_SAVED | typeof PLAN_RESET;

/** The page's query, `site=` first and only for an id that passes `isGearId`, then the given fixed params. */
function planQuery(site: unknown, params: Record<string, string>): string {
  const query = new URLSearchParams();
  if (isGearId(site)) {
    query.set("site", site);
  }
  for (const [name, value] of Object.entries(params)) {
    query.set(name, value);
  }
  return `${PLAN_PAGE}?${query.toString()}`;
}

/** A refusal: the plan page with the fixed message key (and the site, when it is a well-formed id). */
export function planErrorRedirect(site: unknown, error: MessageKey): string {
  return planQuery(site, { error });
}

/** A saved or reset list: the plan page with the toast's fixed value (and the site's id). */
export function planSavedRedirect(site: unknown, saved: PlanSaved): string {
  return planQuery(site, { saved });
}

/** What the plan page shows a toast for: `?saved=` is one of the two fixed values, anything else is no toast. */
export function parsePlanSaved(value: string | null): PlanSaved | null {
  return value === PLAN_SAVED || value === PLAN_RESET ? value : null;
}
