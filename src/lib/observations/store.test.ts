import { describe, expect, it } from "vitest";
import { tonightDateForSite } from "@/lib/tonight/tonight-date";
import { latestNightBound } from "./store";

// The store's only pure rule; everything that talks to Supabase is covered by tests/db/observations.test.ts.

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
