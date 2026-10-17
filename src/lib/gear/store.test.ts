import { describe, expect, it } from "vitest";
import { StoreFault } from "@/lib/observability/fault";
import { fakeClient, leakyPostgrestError, LEAK } from "@/lib/test-support/supabase-fake";
import type { EyepieceInput, SiteInput, TelescopeInput } from "./schemas";
import { eyepieceStore, siteStore, telescopeStore, type WriteResult } from "./store";

// What talks to Supabase is covered by tests/db; here a fake client answers with an error that echoes the submitted
// coordinates and an email, as a failing insert's message does, and the store must keep only a code.

const SITE: SiteInput = {
  name: "Back garden",
  latitudeDeg: 52.2297,
  longitudeDeg: 21.0122,
  bortle: 6,
  minAltitudeDeg: 20,
  timeZoneMode: "auto",
};
const TELESCOPE: TelescopeInput = { name: "Dobsonian", apertureMm: 150, focalLengthMm: 750 };
const EYEPIECE: EyepieceInput = { name: "25 mm", focalLengthMm: 25, afovDeg: 50, afovPreset: "plossl" };
const ID = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

const failing = (code: string) => fakeClient({ error: leakyPostgrestError(code) });
const emptyRows = fakeClient({ data: [] });

/** Each entity's writes through the same fake, with the key a plain server fault keeps. */
const WRITES: [string, (client: ReturnType<typeof fakeClient>) => Promise<WriteResult>, string][] = [
  ["site create", (c) => siteStore.create(c, SITE), "errors.save.site"],
  ["site update", (c) => siteStore.update(c, ID, SITE), "errors.save.site"],
  ["site remove", (c) => siteStore.remove(c, ID), "errors.delete.site"],
  ["telescope create", (c) => telescopeStore.create(c, TELESCOPE), "errors.save.telescope"],
  ["telescope update", (c) => telescopeStore.update(c, ID, TELESCOPE), "errors.save.telescope"],
  ["telescope remove", (c) => telescopeStore.remove(c, ID), "errors.delete.telescope"],
  ["eyepiece create", (c) => eyepieceStore.create(c, EYEPIECE), "errors.save.eyepiece"],
  ["eyepiece update", (c) => eyepieceStore.update(c, ID, EYEPIECE), "errors.save.eyepiece"],
  ["eyepiece remove", (c) => eyepieceStore.remove(c, ID), "errors.delete.eyepiece"],
];

describe("a failed write carries a sanitized fault", () => {
  it.each(WRITES)("%s: a server fault keeps only its code next to the fixed key", async (_name, run, key) => {
    const result = await run(failing("XX000"));
    expect(result).toEqual({ ok: false, message: key, fault: { kind: "server", code: "XX000" } });
    expect(JSON.stringify(result)).not.toMatch(LEAK);
  });

  it.each(WRITES)("%s: an RLS refusal (42501) is `refused`, with the same key", async (_name, run, key) => {
    expect(await run(failing("42501"))).toEqual({ ok: false, message: key, fault: { kind: "refused", code: "42501" } });
  });

  it.each(WRITES)("%s: an error without a code (a network failure) is a server fault", async (_name, run, key) => {
    expect(await run(fakeClient({ error: { message: `fetch failed for ${LEAK.source}` } }))).toEqual({
      ok: false,
      message: key,
      fault: { kind: "server" },
    });
  });

  it.each(WRITES)("%s: a user-input failure has no fault", async (_name, run) => {
    for (const code of ["22P02", "23514", "23505"]) {
      const result = await run(failing(code));
      expect(result.ok, code).toBe(false);
      expect(result, code).not.toHaveProperty("fault");
    }
  });

  it("keeps the entity's own key for a malformed id and an out-of-range value", async () => {
    expect(await siteStore.update(failing("22P02"), "not-a-uuid", SITE)).toEqual({
      ok: false,
      message: "errors.notFound.site",
    });
    expect(await telescopeStore.create(failing("23514"), TELESCOPE)).toEqual({
      ok: false,
      message: "errors.outOfRange",
    });
  });

  it.each(WRITES.filter(([name]) => !name.endsWith("create")))(
    "%s: a zero-row result is `no-rows`, under the entity's not-found key",
    async (name, run) => {
      const entity = name.split(" ")[0];
      expect(await run(emptyRows)).toEqual({
        ok: false,
        message: `errors.notFound.${entity}`,
        fault: { kind: "no-rows" },
      });
    },
  );

  it("returns ok for a write that changed a row", async () => {
    expect(await siteStore.update(fakeClient({ data: [{ id: ID }] }), ID, SITE)).toEqual({ ok: true });
    expect(await siteStore.create(fakeClient({}), SITE)).toEqual({ ok: true });
  });

  it("carries a fault, not a dropped error, when the site's time zone cannot be resolved", async () => {
    const outOfRange: SiteInput = { ...SITE, latitudeDeg: 999, longitudeDeg: 999 };
    for (const result of [
      await siteStore.create(fakeClient({}), outOfRange),
      await siteStore.update(fakeClient({ data: [{ id: ID }] }), ID, outOfRange),
    ]) {
      expect(result).toEqual({ ok: false, message: "errors.save.site", fault: { kind: "server" } });
      expect(JSON.stringify(result)).not.toMatch(/999/);
    }
  });
});

describe("a failed read throws its key with a sanitized cause", () => {
  const READS: [string, (client: ReturnType<typeof fakeClient>) => Promise<unknown>, string][] = [
    ["site list", (c) => siteStore.list(c), "errors.load.sites"],
    ["site get", (c) => siteStore.get(c, ID), "errors.load.sites"],
    ["telescope list", (c) => telescopeStore.list(c), "errors.load.telescopes"],
    ["telescope get", (c) => telescopeStore.get(c, ID), "errors.load.telescopes"],
    ["eyepiece list", (c) => eyepieceStore.list(c), "errors.load.eyepieces"],
    ["eyepiece get", (c) => eyepieceStore.get(c, ID), "errors.load.eyepieces"],
  ];

  it.each(READS)("%s: the cause is a StoreFault holding only the code", async (_name, run, key) => {
    const thrown: unknown = await run(failing("XX000")).catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(Error);
    const error = thrown as Error;
    expect(error.message).toBe(key);
    expect(error.cause).toBeInstanceOf(StoreFault);
    const cause = error.cause as StoreFault;
    expect(cause.code).toBe("XX000");
    expect(Object.keys(cause).sort()).toEqual(["code", "name"]);
    expect(JSON.stringify(cause)).not.toMatch(LEAK);
    expect(cause.message).not.toMatch(LEAK);
    expect(String(cause.stack)).not.toMatch(LEAK);
  });

  it.each(READS)("%s: an error without a code still leaves a cause without a message", async (_name, run) => {
    const thrown = (await run(fakeClient({ error: { message: LEAK.source } })).catch(
      (error: unknown) => error,
    )) as Error;
    expect(thrown.cause).toBeInstanceOf(StoreFault);
    expect((thrown.cause as StoreFault).code).toBeUndefined();
    expect((thrown.cause as StoreFault).message).not.toMatch(LEAK);
  });

  it("still reads a malformed id as not found, not as a failure", async () => {
    expect(await siteStore.get(failing("22P02"), "not-a-uuid")).toBeNull();
    expect(await telescopeStore.get(failing("22P02"), "not-a-uuid")).toBeNull();
    expect(await eyepieceStore.get(failing("22P02"), "not-a-uuid")).toBeNull();
  });
});
