import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * A catalogue chunk that fails to load (a flaky connection, a deploy that replaced the file) must not be remembered:
 * the loaders memoise their promise, and a memoised rejection would leave every form that mounts afterwards on the same
 * page stuck on "unavailable" until a reload. The forms report the failure (island.import); this holds the recovery.
 */

afterEach(() => {
  vi.doUnmock("./telescopes.json");
  vi.doUnmock("./eyepieces.json");
  vi.resetModules();
});

describe("catalogue loaders", () => {
  it("forget a failed import so a later load succeeds, and share one import once it has", async () => {
    const files = [
      { file: "./telescopes.json", load: "loadTelescopes" },
      { file: "./eyepieces.json", load: "loadEyepieces" },
    ] as const;
    expect(files).toHaveLength(2);
    for (const { file, load } of files) {
      vi.resetModules();
      let failing = true;
      let imports = 0;
      vi.doMock(file, () => {
        imports += 1;
        if (failing) throw new Error("chunk failed");
        return { default: [{ id: "entry" }] };
      });
      const loaders = await import("./load");

      await expect(loaders[load](), `${load}: the first load fails`).rejects.toThrow();
      failing = false;
      const retry = await loaders[load]();
      expect(retry, `${load}: a retry after the failure succeeds`).toEqual([{ id: "entry" }]);
      expect(await loaders[load]()).toBe(retry);
      expect(imports, `${load}: the file is imported again only after the failure`).toBe(2);
    }
  });
});
