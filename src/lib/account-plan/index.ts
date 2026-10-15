import type { MessageKey } from "@/i18n";
import { ACCOUNT_PLAN_NEEDS_FULL, NOT_CONFIGURED } from "@/lib/api-errors";
import { logFailure } from "@/lib/observability/log-failure";
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

/**
 * What a request's plan read found: the plan, or `"unknown"` when the read itself failed. Access treats `"unknown"` as
 * free (fail closed); only the offline copies' metadata tells the two apart (`accountPlanForCopy`), so a failed read
 * never clears the stored charts (finder-chart review F11).
 */
export type PlanRead = AccountPlan | "unknown";

/** What the request's one plan read found and when it was read (the server's clock; see `readPlan`). */
export interface PlanReading {
  plan: PlanRead;
  at: Date;
}

/** One read per request, keyed by the request's locals; the promise is stored so concurrent callers share it. */
const plans = new WeakMap<App.Locals, Promise<PlanReading>>();

async function readPlan(locals: App.Locals): Promise<PlanReading> {
  const { supabase, user } = locals;
  if (!supabase || !user) {
    return { plan: "free", at: new Date() };
  }
  const startedAt = new Date();
  const result = await accountPlanStore.read(supabase, user.id);
  if ("error" in result) {
    // The store reports a fixed code or the error's name, never the database's text. Without this line the failure is
    // invisible: access fails closed and the page shows the free state.
    // The helper keeps the code only when it has a database code's shape.
    logFailure("account.plan", { code: result.code });
    return { plan: "unknown", at: new Date() };
  }
  const plan = planFrom(result.plan);
  // The stamp errs toward refusing a stored chart (finder-chart review F1): a full read counts from before its query,
  // so it is never later than the state it saw; any other read counts from after it, never earlier.
  return { plan, at: plan === "full" ? startedAt : new Date() };
}

function readOnce(locals: App.Locals): Promise<PlanReading> {
  let plan = plans.get(locals);
  if (!plan) {
    plan = readPlan(locals);
    plans.set(locals, plan);
  }
  return plan;
}

/**
 * The caller's plan. Queries at most once per request and only when asked (never from the middleware); with no
 * database or no user it answers `"free"` without a query, and so does a failed read (fail closed).
 */
export async function getAccountPlan(locals: App.Locals): Promise<AccountPlan> {
  return (await readOnce(locals)).plan === "full" ? "full" : "free";
}

/**
 * The plan as the offline copies record it (`data-plan`) and the time it was read (`data-plan-at`): the same memoised
 * read as `getAccountPlan` (one query per request), but a failed read is `"unknown"` instead of `"free"`, because the
 * worker drops stored charts only for an explicit `"free"`. The time is when the plan was read, not when the page was
 * rendered, so a chart built after a demotion from a plan read before it still carries the earlier time (review F1).
 * Never use it for access: `requireFullPlan` decides that.
 */
export function accountPlanForCopy(locals: App.Locals): Promise<PlanReading> {
  return readOnce(locals);
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
