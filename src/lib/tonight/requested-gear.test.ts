import type { AstroCookies } from "astro";
import { describe, expect, it, vi } from "vitest";
import { requestedGear } from "./requested-gear";

const SITE = "11111111-1111-4111-8111-111111111111";

function cookies() {
  const set = vi.fn();
  return { jar: { get: () => undefined, set } as unknown as AstroCookies, set };
}

describe("requestedGear", () => {
  it("reads but never remembers the site of a next-night request", () => {
    // Control: the same request for tonight does remember the site, so "not called" below is not vacuous.
    const tonight = cookies();
    requestedGear(new URL(`https://x.test/tonight?site=${SITE}`), tonight.jar);
    expect(tonight.set).toHaveBeenCalledOnce();

    const { jar, set } = cookies();
    expect(requestedGear(new URL(`https://x.test/tonight?site=${SITE}&night=next`), jar).siteId).toBe(SITE);
    expect(set).not.toHaveBeenCalled();
  });
});
