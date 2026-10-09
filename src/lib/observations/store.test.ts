import { describe, expect, it } from "vitest";
import type { TypedSupabaseClient } from "@/lib/supabase";
import { tonightDateForSite } from "@/lib/tonight/tonight-date";
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

  it("throws a keyed error that keeps the database error as its cause", async () => {
    const failure = { message: "boom", code: "XX000" };
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
    await expect(observationStore.listSeenEntries(failing)).rejects.toMatchObject({
      message: "errors.load.observations",
      cause: failure,
    });
  });
});
