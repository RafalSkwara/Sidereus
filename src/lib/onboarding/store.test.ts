import { describe, expect, it } from "vitest";
import { StoreFault } from "@/lib/observability/fault";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import type { OnboardingInput } from "./schemas";
import { completeOnboarding, hasAnyGear } from "./store";

// What talks to Supabase is covered by tests/db; here a fake client answers with an error that echoes submitted
// values, and the store must keep only a code.

const INPUT: OnboardingInput = {
  site: { latitudeDeg: 52.2297, longitudeDeg: 21.0122, bortle: 6, minAltitudeDeg: 20 },
  telescope: { name: "Dobsonian", apertureMm: 150, focalLengthMm: 750 },
  eyepieces: [{ name: "25 mm", focalLengthMm: 25, afovDeg: 50 }],
} as OnboardingInput;
const OPTIONS = { siteName: "Home" };

const failing = (code: string) => fakeClient({ error: leakyPostgrestError(code) });

describe("completeOnboarding", () => {
  it("returns ok when the function succeeds", async () => {
    expect(await completeOnboarding(fakeClient({}), INPUT, OPTIONS)).toEqual({ ok: true });
  });

  it("a server fault keeps only its code next to the fixed key", async () => {
    const result = await completeOnboarding(failing("XX000"), INPUT, OPTIONS);
    expect(result).toEqual({
      ok: false,
      reason: "failed",
      message: "errors.save.setup",
      fault: { kind: "server", code: "XX000" },
    });
    expect(JSON.stringify(result)).not.toMatch(LEAK);
  });

  it("an RLS refusal is `refused`", async () => {
    expect(await completeOnboarding(failing("42501"), INPUT, OPTIONS)).toEqual({
      ok: false,
      reason: "failed",
      message: "errors.save.setup",
      fault: { kind: "refused", code: "42501" },
    });
  });

  it("an out-of-range value is the user's input: its own key, no fault", async () => {
    const result = await completeOnboarding(failing("23514"), INPUT, OPTIONS);
    expect(result).toEqual({ ok: false, reason: "failed", message: "errors.outOfRange" });
    expect(result).not.toHaveProperty("fault");
  });

  it("an already-onboarded user is its own reason, with no fault", async () => {
    const result = await completeOnboarding(
      fakeClient({ error: { ...leakyPostgrestError("P0001"), message: "already_onboarded" } }),
      INPUT,
      OPTIONS,
    );
    expect(result).toEqual({ ok: false, reason: "alreadyOnboarded" });
  });

  it("an unresolvable time zone returns its key with a fault instead of dropping the error", async () => {
    const outOfRange = { ...INPUT, site: { ...INPUT.site, latitudeDeg: 999, longitudeDeg: 999 } };
    const result = await completeOnboarding(fakeClient({}), outOfRange, OPTIONS);
    expect(result).toEqual({ ok: false, reason: "failed", message: "errors.save.setup", fault: { kind: "server" } });
    expect(JSON.stringify(result)).not.toMatch(/999/);
  });
});

describe("hasAnyGear", () => {
  it("answers from the rows", async () => {
    expect(await hasAnyGear(fakeClient({ data: [{ id: "x" }] }))).toBe(true);
    expect(await hasAnyGear(fakeClient({ data: [] }))).toBe(false);
  });

  it("throws its key with a StoreFault cause holding only the code, from either read", async () => {
    const sitesFail = fakeClient((table) =>
      table === "sites" ? { error: leakyPostgrestError("XX000") } : { data: [] },
    );
    const telescopesFail = fakeClient((table) =>
      table === "telescopes" ? { error: leakyPostgrestError("XX000") } : { data: [] },
    );
    for (const client of [sitesFail, telescopesFail]) {
      const thrown = (await hasAnyGear(client).catch((error: unknown) => error)) as Error;
      expect(thrown.message).toBe("errors.load.setup");
      expect(thrown.cause).toBeInstanceOf(StoreFault);
      expect(thrown.cause).toMatchObject({ code: "XX000" });
      expect(JSON.stringify(thrown.cause)).not.toMatch(LEAK);
      expect((thrown.cause as Error).message).not.toMatch(LEAK);
    }
  });
});
