import type { EyepieceRecord, SiteRecord, TelescopeRecord } from "@/lib/gear/store";

/**
 * Shared Tonight test fixtures: Warsaw, a 150/750 reflector, two Plössls and an early-evening instant. Test-only;
 * nothing in the app imports this file.
 */

export const WARSAW: SiteRecord = {
  id: "site-1",
  name: "Home",
  latitudeDeg: 52.23,
  longitudeDeg: 21.01,
  bortle: 6,
  minAltitudeDeg: 15,
  timeZone: "Europe/Warsaw",
  timeZoneSource: "auto",
  createdAt: "2026-09-01T00:00:00Z",
};

export const TELESCOPE: TelescopeRecord = {
  id: "scope-1",
  name: "Skywatcher 150P",
  apertureMm: 150,
  focalLengthMm: 750,
  createdAt: "2026-09-01T00:00:00Z",
};

export const EYEPIECES: EyepieceRecord[] = [
  { id: "ep-1", name: "25 mm Plössl", focalLengthMm: 25, afovDeg: 52, createdAt: "2026-09-01T00:00:00Z" },
  { id: "ep-2", name: "10 mm Plössl", focalLengthMm: 10, afovDeg: 52, createdAt: "2026-09-01T00:01:00Z" },
];

/**
 * Early evening in Warsaw on 2026-10-10 (20:00 CEST), already inside night 1's dark window at Bortle 6 (from about
 * 17:25 UTC).
 */
export const NOW = new Date("2026-10-10T18:00:00Z");
