import { getAccountPlan } from "@/lib/account-plan";
import { sessionPlanStore } from "@/lib/session-plans/store";
import type { PlanEditsReader } from "@/lib/tonight/load";

/**
 * The hook a Tonight island passes to `loadTonightFor` as `readPlanEdits` (adjustable-session-plan). It checks the plan
 * itself, before any query: only a confirmed full plan (`getAccountPlan`, which fails closed, and is the request's one
 * memoised read, so it overlaps the Tonight load) reads `session_plans`; a free, signed-out or unreadable-plan request
 * gets `null` with no query at all, so an island URL replayed without a session never touches the table. A failed read
 * throws the store's fixed key, which `loadTonight` turns into `planEditsError`. Server-only.
 */
export function readPlanEditsFor(locals: App.Locals): PlanEditsReader {
  return async (siteId, nightDate) => {
    const { supabase } = locals;
    if (!supabase || !locals.user || (await getAccountPlan(locals)) !== "full") {
      return null;
    }
    return sessionPlanStore.get(supabase, siteId, nightDate);
  };
}
