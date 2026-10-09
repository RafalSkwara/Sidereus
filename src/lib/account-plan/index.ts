import type { MessageKey } from "@/i18n";
import { ACCOUNT_PLAN_NEEDS_FULL, NOT_CONFIGURED } from "@/lib/api-errors";
import { accountPlanStore } from "./store";

/**
 * The account plan on the server (roadmap F-01, PRD FR-045): the one rule "anything unknown is free", a lazy
 * per-request read and the refusal full-plan routes and pages share. Server-only: islands never import it. Callers
 * never query `account_plans` themselves.
 */

export type AccountPlan = "free" | "full";

/** The stored value as a plan: `"full"` only for exactly `"full"`, so a missing, misspelled or odd value is free. */
export function planFrom(raw: unknown): AccountPlan {
  return raw === "full" ? "full" : "free";
}

/** One read per request, keyed by the request's locals; the promise is stored so concurrent callers share it. */
const plans = new WeakMap<App.Locals, Promise<AccountPlan>>();

async function readPlan(locals: App.Locals): Promise<AccountPlan> {
  const { supabase, user } = locals;
  if (!supabase || !user) {
    return "free";
  }
  const result = await accountPlanStore.read(supabase, user.id);
  return "error" in result ? "free" : planFrom(result.plan);
}

/**
 * The caller's plan. Queries at most once per request and only when asked (never from the middleware); with no
 * database or no user it answers `"free"` without a query, and so does a failed read (fail closed).
 */
export function getAccountPlan(locals: App.Locals): Promise<AccountPlan> {
  let plan = plans.get(locals);
  if (!plan) {
    plan = readPlan(locals);
    plans.set(locals, plan);
  }
  return plan;
}

export type PlanGuard =
  { ok: true } | { ok: false; reason: "signed-out" | "not-configured" | "needs-full"; errorKey: MessageKey };

/**
 * Refuses everything but a full account. `errorKey` is the fixed `?error=` value a route redirects with
 * (`NOT_CONFIGURED` without a database, `ACCOUNT_PLAN_NEEDS_FULL` otherwise); a page renders its own state instead.
 */
export async function requireFullPlan(locals: App.Locals): Promise<PlanGuard> {
  if (!locals.supabase) {
    return { ok: false, reason: "not-configured", errorKey: NOT_CONFIGURED };
  }
  if (!locals.user) {
    return { ok: false, reason: "signed-out", errorKey: ACCOUNT_PLAN_NEEDS_FULL };
  }
  if ((await getAccountPlan(locals)) !== "full") {
    return { ok: false, reason: "needs-full", errorKey: ACCOUNT_PLAN_NEEDS_FULL };
  }
  return { ok: true };
}
