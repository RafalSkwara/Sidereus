import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { ACCOUNT_PLAN_NEEDS_FULL, NOT_CONFIGURED } from "@/lib/api-errors";
import type { TypedSupabaseClient } from "@/lib/supabase";

import { accountPlanForCopy, getAccountPlan, requireFullPlan } from "./index";

/**
 * "Anything unknown is free" (roadmap F-01): the reader and the guard fail closed. Only the store is replaced (as
 * `tonight/load.test.ts` does); the query itself is covered by `tests/db/account-plans.test.ts`.
 */

const mocks = vi.hoisted(() => ({
  read: vi.fn<
    (client: unknown, userId: string) => Promise<{ plan: unknown } | { error: true; code?: string; name?: string }>
  >(),
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

describe("accountPlanForCopy", () => {
  /** The plan alone, for the cases that are not about the time. */
  async function planOf(request: App.Locals) {
    return (await accountPlanForCopy(request)).plan;
  }

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

  describe("what the failed read's line holds (review F5)", () => {
    it("files each shaped value under its own key, never under another, and never passes message text, an email or an Error", async () => {
      const cases: { name: string; read: { error: true; code?: string; name?: string }; fields: object }[] = [
        { name: "a short class name", read: { error: true, name: "TypeError" }, fields: { name: "TypeError" } },
        {
          // An identifier may be 32 characters; a code only 12.
          name: "a long class name",
          read: { error: true, name: "AuthRetryableFetchError" },
          fields: { name: "AuthRetryableFetchError" },
        },
        {
          name: "a database code beside the name",
          read: { error: true, code: "PGRST301", name: "PostgrestError" },
          fields: { name: "PostgrestError", code: "PGRST301" },
        },
        { name: "neither", read: { error: true }, fields: {} },
        {
          // A store that misbehaved and put a message and an email where only shaped values belong.
          name: "a store that put a message and an email in the fields",
          read: {
            error: true,
            code: "a@example.test",
            name: "permission denied for a@example.test",
            message: "permission denied for a@example.test",
          } as { error: true; code: string; name: string },
          fields: {},
        },
      ];
      // Non-vacuity: every shape of the failed read is tried.
      expect(cases).toHaveLength(5);
      for (const { name, read, fields } of cases) {
        logged.mockClear();
        mocks.read.mockResolvedValue(read);
        expect(await planOf(locals()), name).toBe("unknown");
        expect(logged, name).toHaveBeenCalledOnce();
        const args = logged.mock.calls[0];
        expect(args, name).toEqual(["sidereus: account.plan failed", { step: "account.plan", ...fields }]);
        expect(
          args.some((arg) => arg instanceof Error),
          name,
        ).toBe(false);
        expect(JSON.stringify(args), name).not.toMatch(/example\.test|permission denied|read failed/);
      }
    });
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
