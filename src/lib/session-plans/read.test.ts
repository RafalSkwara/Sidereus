import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TypedSupabaseClient } from "@/lib/supabase";

import { readPlanEditsFor } from "./read";

/**
 * The reader's gate (adjustable-session-plan, "gate before read"): `session_plans` is queried only for a confirmed
 * full plan; the `account_plans` read and the store are replaced, the memoised plan read is the real one.
 */

const mocks = vi.hoisted(() => ({
  planRead: vi.fn<(client: unknown, userId: string) => Promise<{ plan: unknown } | { error: true; code: string }>>(),
  get: vi.fn<(client: unknown, siteId: string, night: string) => Promise<string[] | null>>(),
}));

vi.mock("@/lib/account-plan/store", () => ({ accountPlanStore: { read: mocks.planRead } }));
vi.mock("@/lib/session-plans/store", () => ({ sessionPlanStore: { get: mocks.get } }));

const SUPABASE = {} as TypedSupabaseClient;
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "a@example.test" };
const SITE = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

/** A fresh locals per case: the plan read is memoised by the locals object. */
function locals(overrides: Partial<Pick<App.Locals, "user" | "supabase">> = {}): App.Locals {
  return { user: USER, supabase: SUPABASE, locale: "en", ...overrides } as App.Locals;
}

const logged = vi.spyOn(console, "error");

beforeEach(() => {
  mocks.planRead.mockReset();
  mocks.get.mockReset();
  logged.mockReset();
  logged.mockImplementation(() => undefined);
  mocks.planRead.mockResolvedValue({ plan: "full" });
  mocks.get.mockResolvedValue(["M31", "jupiter"]);
});

describe("readPlanEditsFor", () => {
  it("reads the saved list for a confirmed full plan", async () => {
    expect(await readPlanEditsFor(locals())(SITE, "2026-10-14")).toEqual(["M31", "jupiter"]);
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(SUPABASE, SITE, "2026-10-14");
  });

  it("passes on a missing list as null", async () => {
    mocks.get.mockResolvedValue(null);
    expect(await readPlanEditsFor(locals())(SITE, "2026-10-14")).toBeNull();
  });

  it.each([
    ["a free account", { plan: "free" }],
    ["an odd stored value", { plan: "pro" }],
    ["a failed plan read", { error: true as const, code: "PGRST000" }],
  ])("returns null without a query for %s", async (_name, read) => {
    mocks.planRead.mockResolvedValue(read);
    expect(await readPlanEditsFor(locals())(SITE, "2026-10-14")).toBeNull();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("returns null without reading the plan or the table when signed out or unconfigured", async () => {
    expect(await readPlanEditsFor(locals({ user: null }))(SITE, "2026-10-14")).toBeNull();
    expect(await readPlanEditsFor(locals({ supabase: null }))(SITE, "2026-10-14")).toBeNull();
    expect(mocks.planRead).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("lets a failed read of the list throw, for `loadTonight` to turn into planEditsError", async () => {
    mocks.get.mockRejectedValue(new Error("errors.load.sessionPlan"));
    await expect(readPlanEditsFor(locals())(SITE, "2026-10-14")).rejects.toThrow("errors.load.sessionPlan");
  });
});
