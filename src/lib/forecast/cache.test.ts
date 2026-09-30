import { describe, expect, it } from "vitest";

import { withReadTimeout, type ForecastCache } from "./cache";
import { memoryCache } from "./test-helpers";

describe("withReadTimeout", () => {
  it("gives up on a read that outlives the timeout", async () => {
    const hanging: ForecastCache = {
      get: () =>
        new Promise(() => {
          // never settles
        }),
      put: () => Promise.resolve(),
    };
    await expect(withReadTimeout(hanging, 20).get("k")).rejects.toThrow();
  });

  it("leaves writes untouched", async () => {
    const inner = memoryCache();
    await withReadTimeout(inner, 20).put("k", "v", { expirationTtl: 60 });
    expect(inner.puts).toEqual([{ key: "k", value: "v", expirationTtl: 60 }]);
  });
});
