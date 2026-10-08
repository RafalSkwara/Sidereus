import { describe, expect, it } from "vitest";

import { RUNNER_ZONES, expectRunnerZoneActive, useRunnerZone } from "@/lib/engine/fixtures/runner-zones";
import { USNO_CIVIL_DAWN } from "@/lib/engine/fixtures/usno";
import type { Site } from "@/lib/engine";
import type { SiteRecord } from "@/lib/gear/store";
import { tonightDateForSite } from "@/lib/tonight/tonight-date";

import { logFormNights } from "./log-night";

// Expected nights are hand literals; the relation in (b) is the one place a helper's output is compared.
// Calls run inside `it`, after the runner zone is switched.

const MINUTE_MS = 60_000;

function siteRecord(site: Site, name: string): SiteRecord {
  return {
    id: `site-${name}`,
    name,
    latitudeDeg: site.latitudeDeg,
    longitudeDeg: site.longitudeDeg,
    bortle: 5,
    minAltitudeDeg: 15,
    timeZone: site.timeZone,
    timeZoneSource: "auto",
    createdAt: "2026-09-01T00:00:00Z",
  };
}

const WARSAW_ENTRY = USNO_CIVIL_DAWN[0]; // Warsaw 24/25 Oct 2026
const LOS_ANGELES_ENTRY = USNO_CIVIL_DAWN[2]; // Los Angeles 31 Oct / 1 Nov 2026
const WARSAW = siteRecord(WARSAW_ENTRY.site, "Warsaw");
const LOS_ANGELES = siteRecord(LOS_ANGELES_ENTRY.site, "Los Angeles");

// The wall-clock trap instants of the engine suite, by site zone (local wall time in the comments).
const TRAPS: Record<string, string[]> = {
  "America/Los_Angeles": [
    "2026-11-01T07:30:00Z", // 00:30 PDT on 1 Nov
    "2026-11-01T08:30:00Z", // 01:30 PDT, first pass
    "2026-11-01T09:30:00Z", // 01:30 PST, second pass
    "2026-11-01T19:59:00Z", // 11:59 PST on 1 Nov, after dawn
    "2026-10-31T18:59:00Z", // 11:59 PDT on 31 Oct
    "2026-10-25T06:00:00Z", // 23:00 PDT on 24 Oct, UTC date already 25
  ],
  "Pacific/Kiritimati": [
    "2026-10-24T18:00:00Z", // 08:00 on 25 Oct, UTC date still 24
  ],
  "Europe/Warsaw": [
    "2026-03-29T01:30:00Z", // 03:30 CEST, just after the skipped hour
    "2026-10-25T00:30:00Z", // 02:30 CEST, first pass
    "2026-10-25T01:30:00Z", // 02:30 CET, second pass
    "2026-10-25T10:59:00Z", // 11:59 CET on 25 Oct
  ],
};

describe.each(RUNNER_ZONES)("the log form's nights (runner zone %s)", (runnerZone) => {
  useRunnerZone(runnerZone);

  it("runs in the runner zone it claims", () => {
    expectRunnerZoneActive(runnerZone);
  });

  describe("(a) default night vs the latest night, Warsaw 24/25 Oct", () => {
    it.each([
      {
        name: "civil dawn - 5 min (04:39Z, 05:39 CET)",
        at: "2026-10-25T04:39:00Z",
        night: "2026-10-24",
        max: "2026-10-24",
      },
      {
        name: "civil dawn + 5 min (04:49Z, 05:49 CET)",
        at: "2026-10-25T04:49:00Z",
        night: "2026-10-24",
        max: "2026-10-25",
      },
      {
        name: "10:59Z (11:59 CET, a minute before noon)",
        at: "2026-10-25T10:59:00Z",
        night: "2026-10-24",
        max: "2026-10-25",
      },
      { name: "11:00Z (12:00 CET, noon)", at: "2026-10-25T11:00:00Z", night: "2026-10-25", max: "2026-10-25" },
    ])("$name: default $night, latest $max", ({ at, night, max }) => {
      expect(logFormNights([WARSAW], WARSAW, new Date(at))).toEqual({ night, maxNight: max });
    });
  });

  describe("(b) the default night is never ahead of the server's bound", () => {
    it.each(USNO_CIVIL_DAWN)("$label", (entry) => {
      const record = siteRecord(entry.site, entry.label);
      const dawn = new Date(entry.civilDawn).getTime();
      const instants = [
        new Date(dawn - 5 * MINUTE_MS),
        new Date(dawn + 5 * MINUTE_MS),
        ...(TRAPS[entry.site.timeZone] ?? []).map((at) => new Date(at)),
      ];
      for (const now of instants) {
        const { night } = logFormNights([record], record, now);
        expect(night <= tonightDateForSite(record, now), `${now.toISOString()}: default ${night}`).toBe(true);
      }
    });
  });

  describe("(c) two sites", () => {
    it("a site's default follows its own zone while the latest night follows the furthest ahead", () => {
      // 05:00Z: after Warsaw's civil dawn (05:44 CET), at 06:00 CET, 22:00 PDT on 24 Oct in Los Angeles.
      const now = new Date("2026-10-25T05:00:00Z");
      expect(logFormNights([WARSAW, LOS_ANGELES], LOS_ANGELES, now)).toEqual({
        night: "2026-10-24",
        maxNight: "2026-10-25",
      });
    });

    it("is empty without sites", () => {
      expect(logFormNights([], undefined, new Date("2026-10-25T05:00:00Z"))).toEqual({ night: "", maxNight: "" });
    });
  });
});
