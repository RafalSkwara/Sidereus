import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { ACCOUNT_PLAN_NEEDS_FULL, NOT_CONFIGURED } from "@/lib/api-errors";
import type { TypedSupabaseClient } from "@/lib/supabase";

import { accountPlanForCopy, getAccountPlan, planFrom, requireFullPlan } from "./index";

/**
 * "Anything unknown is free" (roadmap F-01): the reader and the guard fail closed. Only the store is replaced (as
 * `tonight/load.test.ts` does); the query itself is covered by `tests/db/account-plans.test.ts`.
 */

const mocks = vi.hoisted(() => ({
  read: vi.fn<(client: unknown, userId: string) => Promise<{ plan: unknown } | { error: true; code: string }>>(),
}));

vi.mock("./store", () => ({ accountPlanStore: { read: mocks.read } }));

/** Never called: the store is stubbed, so any non-null client will do. */
const SUPABASE = {} as TypedSupabaseClient;
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "a@example.test" };

/** A fresh object per case, because the memo is keyed by the locals object itself. */
function locals(overrides: Partial<Pick<App.Locals, "user" | "supabase">> = {}): App.Locals {
  return { user: USER, supabase: SUPABASE, ...overrides } as App.Locals;
}

/** The failed read's one log line, kept off the test output and asserted through this spy. */
let logged: MockInstance<(...data: unknown[]) => void>;

beforeEach(() => {
  mocks.read.mockReset();
  logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
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
    mocks.read.mockResolvedValueOnce({ error: true, code: "42501" });
    expect(await getAccountPlan(locals())).toBe("free");
    mocks.read.mockResolvedValueOnce({ plan: "platinum" });
    expect(await getAccountPlan(locals())).toBe("free");
  });
});

describe("accountPlanForCopy", () => {
  /** The plan alone, for the cases that are not about the time. */
  async function planOf(request: App.Locals) {
    return (await accountPlanForCopy(request)).plan;
  }

  it("is the plan the read found", async () => {
    mocks.read.mockResolvedValueOnce({ plan: "full" });
    expect(await planOf(locals())).toBe("full");
    mocks.read.mockResolvedValueOnce({ plan: "free" });
    expect(await planOf(locals())).toBe("free");
    mocks.read.mockResolvedValueOnce({ plan: undefined });
    expect(await planOf(locals())).toBe("free");
    mocks.read.mockResolvedValueOnce({ plan: "platinum" });
    expect(await planOf(locals())).toBe("free");
    expect(logged).not.toHaveBeenCalled();
  });

  it("is free without a query when there is no database or no user", async () => {
    expect(await planOf(locals({ supabase: null }))).toBe("free");
    expect(await planOf(locals({ user: null }))).toBe("free");
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("shares the one read with getAccountPlan, in either order", async () => {
    mocks.read.mockResolvedValue({ plan: "full" });
    const first = locals();
    const [, reading] = await Promise.all([getAccountPlan(first), accountPlanForCopy(first), getAccountPlan(first)]);
    expect(reading.plan).toBe("full");
    const second = locals();
    await accountPlanForCopy(second);
    await getAccountPlan(second);
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });

  it("is unknown when the read fails, logs a fixed line and the code once, and leaves access closed (reviews F11, F4)", async () => {
    mocks.read.mockResolvedValue({ error: true, code: "42501" });
    const request = locals();
    expect(await planOf(request)).toBe("unknown");
    expect(await getAccountPlan(request)).toBe("free");
    expect(await requireFullPlan(request)).toEqual({
      ok: false,
      reason: "needs-full",
      errorKey: ACCOUNT_PLAN_NEEDS_FULL,
    });
    expect(mocks.read).toHaveBeenCalledOnce();
    expect(logged).toHaveBeenCalledOnce();
    expect(logged).toHaveBeenCalledWith("sidereus: account.plan failed", { step: "account.plan", code: "42501" });
  });

  it("logs a failed read once however it is asked first", async () => {
    mocks.read.mockResolvedValue({ error: true, code: "TypeError" });
    const request = locals();
    expect(await requireFullPlan(request)).toMatchObject({ ok: false, reason: "needs-full" });
    expect(await planOf(request)).toBe("unknown");
    expect(logged).toHaveBeenCalledOnce();
  });

  describe("the time the plan was read (review F1)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-13T12:00:00.000Z"));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("is stamped by the read, not by the later asking, and shared like the plan", async () => {
      mocks.read.mockResolvedValue({ plan: "full" });
      const request = locals();
      const first = await accountPlanForCopy(request);
      vi.setSystemTime(new Date("2026-10-13T12:00:09.000Z"));
      const second = await accountPlanForCopy(request);
      expect(second).toBe(first);
      expect(first.at.toISOString()).toBe("2026-10-13T12:00:00.000Z");
    });

    it("counts a full read from before its query and any other read from after it, so a slow read errs toward refusing", async () => {
      const slow = (plan: unknown) => () => {
        vi.setSystemTime(new Date("2026-10-13T12:00:02.000Z"));
        return Promise.resolve({ plan });
      };
      mocks.read.mockImplementationOnce(slow("full"));
      expect((await accountPlanForCopy(locals())).at.toISOString()).toBe("2026-10-13T12:00:00.000Z");
      vi.setSystemTime(new Date("2026-10-13T12:00:00.000Z"));
      mocks.read.mockImplementationOnce(slow("free"));
      expect((await accountPlanForCopy(locals())).at.toISOString()).toBe("2026-10-13T12:00:02.000Z");
      vi.setSystemTime(new Date("2026-10-13T12:00:00.000Z"));
      mocks.read.mockImplementationOnce(() => {
        vi.setSystemTime(new Date("2026-10-13T12:00:02.000Z"));
        return Promise.resolve({ error: true as const, code: "57014" });
      });
      expect((await accountPlanForCopy(locals())).at.toISOString()).toBe("2026-10-13T12:00:02.000Z");
    });
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
