import { describe, expect, it } from "vitest";
import { ownerFingerprint } from "./owner";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

describe("ownerFingerprint", () => {
  it("is 64 hex characters, the same for the same user and different for another", async () => {
    const a = await ownerFingerprint(USER_A);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await ownerFingerprint(USER_A)).toBe(a);
    expect(await ownerFingerprint(USER_B)).not.toBe(a);
  });

  it("does not contain the user id", async () => {
    const a = await ownerFingerprint(USER_A);
    expect(a).not.toContain(USER_A.replaceAll("-", ""));
    expect(a).not.toContain("11111111");
  });
});
