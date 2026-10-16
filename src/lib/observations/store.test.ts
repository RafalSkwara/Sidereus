import { describe, expect, it } from "vitest";
import { StoreFault } from "@/lib/observability/fault";
import type { TypedSupabaseClient } from "@/lib/supabase";
import { fakeClient, leakyPostgrestError, LEAK, type FakeResult } from "@/lib/test-support/supabase-fake";
import { tonightDateForSite } from "@/lib/tonight/tonight-date";
import type { ObservationInput, ObservationUpdateInput } from "./schemas";
import { latestNightBound, observationStore, SEEN_PAGE_SIZE } from "./store";

// The pure rules; what talks to Supabase is covered by tests/db/observations.test.ts. The one exception is the
// paged seen read, whose loop is checked here against a fake client (a lower `max_rows` cannot be set locally).

const WARSAW = { latitudeDeg: 52.23, longitudeDeg: 21.01, timeZone: "Europe/Warsaw", bortle: 6 };
const HONOLULU = { latitudeDeg: 21.31, longitudeDeg: -157.86, timeZone: "Pacific/Honolulu", bortle: 6 };

describe("latestNightBound", () => {
  it("is the latest night Tonight shows across the user's sites", () => {
    // 09:00 in Warsaw on 27 September: Warsaw's Tonight already shows the 27th, Honolulu (21:00 on the 26th) the 26th.
    const now = new Date("2026-09-27T07:00:00Z");
    expect(tonightDateForSite(WARSAW, now)).toBe("2026-09-27");
    expect(tonightDateForSite(HONOLULU, now)).toBe("2026-09-26");
    expect(latestNightBound([HONOLULU, WARSAW], now)).toBe("2026-09-27");
    expect(latestNightBound([HONOLULU], now)).toBe("2026-09-26");
  });

  it("falls back to the date at UTC+14 when the user has no site left", () => {
    // 10:30 UTC on 26 September is already 00:30 on the 27th at UTC+14.
    expect(latestNightBound([], new Date("2026-09-26T10:30:00Z"))).toBe("2026-09-27");
    expect(latestNightBound([], new Date("2026-09-26T09:30:00Z"))).toBe("2026-09-26");
  });
});

describe("listSeenEntries", () => {
  interface Request {
    select: unknown[];
    range: [number, number];
  }

  /** A fake client over `rows`: every response holds at most `maxRows` rows, like PostgREST's `max_rows`. */
  function fakeClient(rows: { target: string; night: string; rating: number }[], maxRows: number) {
    const requests: Request[] = [];
    const client = {
      from: () => {
        const request: Request = { select: [], range: [0, 0] };
        const query = {
          select: (...args: unknown[]) => {
            request.select = args;
            return query;
          },
          gte: () => query,
          order: () => query,
          range: (from: number, to: number) => {
            request.range = [from, to];
            requests.push(request);
            const data = rows.slice(from, Math.min(to + 1, from + maxRows));
            return Promise.resolve({ data, error: null, count: from === 0 ? rows.length : null });
          },
        };
        return query;
      },
    };
    return { client: client as unknown as TypedSupabaseClient, requests };
  }

  const rowsOf = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ target: `M${i + 1}`, night: "2026-10-01", rating: 4 }));

  it("reads a normal log (under one page) in exactly one request, asking for the exact total", async () => {
    const rows = rowsOf(120);
    const { client, requests } = fakeClient(rows, SEEN_PAGE_SIZE);
    expect(await observationStore.listSeenEntries(client)).toEqual(rows);
    expect(requests).toHaveLength(1);
    expect(requests[0].select).toEqual(["target, night, rating", { count: "exact" }]);
    expect(requests[0].range).toEqual([0, SEEN_PAGE_SIZE - 1]);
  });

  it("skips no row when the host returns fewer rows than a page (a lower max_rows)", async () => {
    const rows = rowsOf(1250);
    const { client, requests } = fakeClient(rows, 500);
    const entries = await observationStore.listSeenEntries(client);
    expect(entries).toEqual(rows);
    // Each request starts where the rows received end, never at a fixed page edge.
    expect(requests.map((request) => request.range[0])).toEqual([0, 500, 1000]);
    // The total is asked for once, on the first request.
    expect(requests.map((request) => request.select[1])).toEqual([{ count: "exact" }, undefined, undefined]);
  });

  it("stops on an empty page when the total is not given", async () => {
    const rows = rowsOf(30);
    // A response with no count at all: only an empty page can end the read.
    const noCount = {
      from: () => {
        const query = {
          select: () => query,
          gte: () => query,
          order: () => query,
          range: (from: number) =>
            Promise.resolve({ data: rows.slice(from, from + 25), error: null, count: null as number | null }),
        };
        return query;
      },
    } as unknown as TypedSupabaseClient;
    expect(await observationStore.listSeenEntries(noCount)).toEqual(rows);
  });

  it("throws a keyed error whose cause is a sanitized fault, never the database error", async () => {
    const failure = leakyPostgrestError("XX000");
    const failing = {
      from: () => {
        const query = {
          select: () => query,
          gte: () => query,
          order: () => query,
          range: () => Promise.resolve({ data: null, error: failure, count: null }),
        };
        return query;
      },
    } as unknown as TypedSupabaseClient;
    const thrown = await observationStore.listSeenEntries(failing).catch((error: unknown) => error);
    expect(thrown).toMatchObject({ message: "errors.load.observations" });
    const cause = (thrown as Error).cause;
    expect(cause).toBeInstanceOf(StoreFault);
    expect(cause).not.toBe(failure);
    expect(cause).toMatchObject({ code: "XX000" });
    expect(JSON.stringify(cause)).not.toMatch(LEAK);
  });
});

// The writes and reads that go through the store's other paths. A fake answers per table: the gear lookups the
// entry needs, then the observations request under test.

const SITE_ROW = {
  id: "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
  name: "Back garden",
  latitude_deg: 52.2297,
  longitude_deg: 21.0122,
  bortle: 6,
  min_altitude_deg: 20,
  time_zone: "Europe/Warsaw",
  time_zone_source: "auto",
  created_at: "2026-10-01T00:00:00Z",
};
const TELESCOPE_ROW = {
  id: "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  name: "Dobsonian",
  aperture_mm: 150,
  focal_length_mm: 750,
  created_at: "2026-10-01T00:00:00Z",
};
const OBSERVATION_ID = "5b4c3d2e-1f0a-4b9c-8d7e-6f5a4b3c2d1e";
const NOW = new Date("2026-10-10T20:00:00Z");

const EXISTING_ROW = {
  id: OBSERVATION_ID,
  target: "M31",
  night: "2026-10-09",
  rating: 4,
  site_id: SITE_ROW.id,
  telescope_id: TELESCOPE_ROW.id,
  site_name: "Back garden",
  telescope_name: "Dobsonian",
  created_at: "2026-10-09T20:00:00Z",
};

const CREATE: ObservationInput = {
  target: "M31",
  night: "2026-10-09",
  rating: 4,
  siteId: SITE_ROW.id,
  telescopeId: TELESCOPE_ROW.id,
};
const UPDATE: ObservationUpdateInput = { ...CREATE };

/** A client whose gear lookups succeed and whose `observations` table answers `observations`. */
function withGear(observations: FakeResult) {
  return fakeClient((table) => {
    if (table === "sites") return { data: SITE_ROW };
    if (table === "telescopes") return { data: TELESCOPE_ROW };
    return observations;
  });
}

describe("a failed write carries a sanitized fault", () => {
  it("create: a server fault keeps only its code next to the fixed key", async () => {
    const result = await observationStore.create(withGear({ error: leakyPostgrestError("XX000") }), CREATE, NOW);
    expect(result).toEqual({
      ok: false,
      message: "errors.save.observation",
      fault: { kind: "server", code: "XX000" },
    });
    expect(JSON.stringify(result)).not.toMatch(LEAK);
  });

  it("create: an RLS refusal is `refused`, and a user-input failure has no fault", async () => {
    expect(await observationStore.create(withGear({ error: leakyPostgrestError("42501") }), CREATE, NOW)).toEqual({
      ok: false,
      message: "errors.save.observation",
      fault: { kind: "refused", code: "42501" },
    });
    for (const code of ["22P02", "23514", "23503"]) {
      const result = await observationStore.create(withGear({ error: leakyPostgrestError(code) }), CREATE, NOW);
      expect(result, code).toEqual({ ok: false, message: "errors.save.observation" });
    }
  });

  it("create: a failed gear lookup keeps the lookup's code instead of dropping the error", async () => {
    const lookupFails = fakeClient((table) =>
      table === "sites" ? { error: leakyPostgrestError("42501") } : { data: TELESCOPE_ROW },
    );
    const result = await observationStore.create(lookupFails, CREATE, NOW);
    expect(result).toEqual({
      ok: false,
      message: "errors.save.observation",
      fault: { kind: "refused", code: "42501" },
    });
    expect(JSON.stringify(result)).not.toMatch(LEAK);

    const unreachable = fakeClient((table) =>
      table === "sites" ? { error: { message: `fetch failed ${LEAK.source}` } } : { data: TELESCOPE_ROW },
    );
    expect(await observationStore.create(unreachable, CREATE, NOW)).toEqual({
      ok: false,
      message: "errors.save.observation",
      fault: { kind: "server" },
    });
  });

  it("update: a server fault keeps its code, a refusal is `refused`, a zero-row update is `no-rows`", async () => {
    const updateAnswers = (answer: FakeResult) =>
      fakeClient((table, calls) => {
        if (table === "sites") return { data: SITE_ROW };
        if (table === "telescopes") return { data: TELESCOPE_ROW };
        // The entry is read first (`get`), then written (`update`): only the write gets the answer under test.
        return calls.includes("update") ? answer : { data: EXISTING_ROW };
      });

    const server = await observationStore.update(
      updateAnswers({ error: leakyPostgrestError("XX000") }),
      OBSERVATION_ID,
      UPDATE,
      NOW,
    );
    expect(server).toEqual({
      ok: false,
      message: "errors.save.observation",
      fault: { kind: "server", code: "XX000" },
    });
    expect(JSON.stringify(server)).not.toMatch(LEAK);

    expect(
      await observationStore.update(
        updateAnswers({ error: leakyPostgrestError("42501") }),
        OBSERVATION_ID,
        UPDATE,
        NOW,
      ),
    ).toEqual({ ok: false, message: "errors.save.observation", fault: { kind: "refused", code: "42501" } });
    expect(await observationStore.update(updateAnswers({ data: [] }), OBSERVATION_ID, UPDATE, NOW)).toEqual({
      ok: false,
      message: "errors.notFound.observation",
      fault: { kind: "no-rows" },
    });
    expect(
      await observationStore.update(
        updateAnswers({ error: leakyPostgrestError("23514") }),
        OBSERVATION_ID,
        UPDATE,
        NOW,
      ),
    ).toEqual({ ok: false, message: "errors.save.observation" });
    expect(
      await observationStore.update(updateAnswers({ data: [{ id: OBSERVATION_ID }] }), OBSERVATION_ID, UPDATE, NOW),
    ).toEqual({ ok: true });
  });

  it("update: a failed lookup of the entry or of the user's sites keeps its code", async () => {
    const getFails = fakeClient((table) =>
      table === "observations" ? { error: leakyPostgrestError("PGRST301") } : { data: SITE_ROW },
    );
    expect(await observationStore.update(getFails, OBSERVATION_ID, UPDATE, NOW)).toEqual({
      ok: false,
      message: "errors.save.observation",
      fault: { kind: "session", code: "PGRST301" },
    });

    // No chosen site: the night bound reads every site of the user, and that read fails.
    const sitesFail = fakeClient((table) => {
      if (table === "sites") return { error: leakyPostgrestError("XX000") };
      return {
        data: {
          id: OBSERVATION_ID,
          target: "M31",
          night: "2026-10-09",
          rating: 4,
          site_id: null,
          telescope_id: null,
          site_name: "Gone",
          telescope_name: "Gone",
          created_at: "2026-10-09T20:00:00Z",
        },
      };
    });
    const result = await observationStore.update(
      sitesFail,
      OBSERVATION_ID,
      { ...UPDATE, siteId: null, telescopeId: null },
      NOW,
    );
    expect(result).toEqual({
      ok: false,
      message: "errors.save.observation",
      fault: { kind: "server", code: "XX000" },
    });
  });

  it("remove: a server fault keeps its code, a malformed id has none, and a zero-row delete is `no-rows`", async () => {
    expect(await observationStore.remove(fakeClient({ error: leakyPostgrestError("XX000") }), OBSERVATION_ID)).toEqual({
      ok: false,
      message: "errors.delete.observation",
      fault: { kind: "server", code: "XX000" },
    });
    expect(await observationStore.remove(fakeClient({ error: leakyPostgrestError("22P02") }), "nope")).toEqual({
      ok: false,
      message: "errors.notFound.observation",
    });
    expect(await observationStore.remove(fakeClient({ error: leakyPostgrestError("42501") }), OBSERVATION_ID)).toEqual({
      ok: false,
      message: "errors.delete.observation",
      fault: { kind: "refused", code: "42501" },
    });
    expect(await observationStore.remove(fakeClient({ data: [] }), OBSERVATION_ID)).toEqual({
      ok: false,
      message: "errors.notFound.observation",
      fault: { kind: "no-rows" },
    });
  });
});

describe("a failed read throws its key with a sanitized cause", () => {
  it.each([
    ["list", (c: TypedSupabaseClient) => observationStore.list(c, { page: 1 })],
    ["get", (c: TypedSupabaseClient) => observationStore.get(c, OBSERVATION_ID)],
  ])("%s: the cause is a StoreFault holding only the code", async (_name, run) => {
    const thrown = (await run(fakeClient({ error: leakyPostgrestError("XX000") })).catch(
      (error: unknown) => error,
    )) as Error;
    expect(thrown.message).toBe("errors.load.observations");
    expect(thrown.cause).toBeInstanceOf(StoreFault);
    expect(thrown.cause).toMatchObject({ code: "XX000" });
    expect(Object.keys(thrown.cause as object).sort()).toEqual(["code", "name"]);
    expect(JSON.stringify(thrown.cause)).not.toMatch(LEAK);
    expect((thrown.cause as Error).message).not.toMatch(LEAK);
  });
});
