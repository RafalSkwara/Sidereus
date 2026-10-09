import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCOUNT_PLAN_NEEDS_FULL, NOT_CONFIGURED } from "@/lib/api-errors";
import type { TypedSupabaseClient } from "@/lib/supabase";

import { getAccountPlan, planFrom, requireFullPlan } from "./index";

/**
 * "Anything unknown is free" (roadmap F-01): the reader and the guard fail closed. Only the store is replaced (as
 * `tonight/load.test.ts` does); the query itself is covered by `tests/db/account-plans.test.ts`.
 */

const mocks = vi.hoisted(() => ({
  read: vi.fn<(client: unknown, userId: string) => Promise<{ plan: unknown } | { error: true }>>(),
}));

vi.mock("./store", () => ({ accountPlanStore: { read: mocks.read } }));

/** Never called: the store is stubbed, so any non-null client will do. */
const SUPABASE = {} as TypedSupabaseClient;
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "a@example.test" };

/** A fresh object per case, because the memo is keyed by the locals object itself. */
function locals(overrides: Partial<Pick<App.Locals, "user" | "supabase">> = {}): App.Locals {
  return { user: USER, supabase: SUPABASE, ...overrides } as App.Locals;
}

beforeEach(() => {
  mocks.read.mockReset();
});

describe("planFrom", () => {
  it("is full only for exactly the string full", () => {
    expect(planFrom("full")).toBe("full");
    for (const raw of ["free", null, undefined, "FULL", {}]) {
      expect(planFrom(raw)).toBe("free");
    }
  });
});

describe("getAccountPlan", () => {
  it("reads as free without a query when there is no database or no user", async () => {
    expect(await getAccountPlan(locals({ supabase: null }))).toBe("free");
    expect(await getAccountPlan(locals({ user: null }))).toBe("free");
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("queries once per request however often it is asked", async () => {
    mocks.read.mockResolvedValue({ plan: "full" });
    const request = locals();
    expect(await getAccountPlan(request)).toBe("full");
    expect(await getAccountPlan(request)).toBe("full");
    expect(mocks.read).toHaveBeenCalledOnce();
    expect(mocks.read).toHaveBeenCalledWith(SUPABASE, USER.id);
  });

  it("reads as free when the query fails or the stored value is unknown", async () => {
    mocks.read.mockResolvedValueOnce({ error: true });
    expect(await getAccountPlan(locals())).toBe("free");
    mocks.read.mockResolvedValueOnce({ plan: "platinum" });
    expect(await getAccountPlan(locals())).toBe("free");
  });
});

describe("requireFullPlan", () => {
  it("lets a full account through", async () => {
    mocks.read.mockResolvedValue({ plan: "full" });
    expect(await requireFullPlan(locals())).toEqual({ ok: true });
  });

  it("refuses with the fixed key that names why", async () => {
    mocks.read.mockResolvedValue({ plan: "free" });
    expect(await requireFullPlan(locals())).toEqual({
      ok: false,
      reason: "needs-full",
      errorKey: ACCOUNT_PLAN_NEEDS_FULL,
    });
    expect(ACCOUNT_PLAN_NEEDS_FULL).toBe("errors.accountPlan.needsFull");

    expect(await requireFullPlan(locals({ user: null }))).toEqual({
      ok: false,
      reason: "signed-out",
      errorKey: ACCOUNT_PLAN_NEEDS_FULL,
    });
    expect(await requireFullPlan(locals({ supabase: null }))).toEqual({
      ok: false,
      reason: "not-configured",
      errorKey: NOT_CONFIGURED,
    });
  });
});
