// The named moments an e2e test can pin the browser and the server to (test-suite-diet Phase 6). One module, read by
// `helpers.ts` (the clock fixture, `pinContext`) and by `forecast-fixture.mjs` (so the fixture's hours surround every
// scenario), so the two can never disagree. Plain `.mjs` with no dependencies: the fixture runs under bare `node`.
//
// The e2e site is Madrid (40.42 N, 3.70 W, Europe/Madrid). Every instant is inside the data the engine and the
// sky-event catalogue cover (2026-2027); `src/lib/e2e-clock-guard.test.ts` asserts the range and that the engine's own
// reading agrees with each label (the Sun, the Moon, the dark window), so a retuned rule shows up there.

/** The named instants (UTC). Madrid is on CEST (UTC+2) until 2026-10-25 03:00, then CET (UTC+1). */
export const SCENARIOS = {
  // 21:30 local, 17 October: deep in the dark window, a waxing Moon and Saturn up, tonight's plan editable.
  evening: "2026-10-17T19:30:00Z",
  // 01:30 local on the 18th: the night in progress (still the night of the 17th), the Sun far below the horizon.
  deepNight: "2026-10-17T23:30:00Z",
  // 08:15 local on the 18th (civil dawn 08:01, sunrise 08:29): where "tonight" rolls to the evening ahead and a saved
  // plan is `held`. The window #198 broke on.
  civilDawn: "2026-10-18T06:15:00Z",
  // 14:00 local on the 17th: the Sun high, the night not begun.
  daytime: "2026-10-17T12:00:00Z",
  // 21:30 local, 26 October (CET): a full Moon, so the ranking sets washed-out galaxies apart.
  fullMoonEvening: "2026-10-26T20:30:00Z",
  // 23:00 local on 21 June at a 52 N site: no astronomical darkness, where the ranking can be empty.
  noDarkness: "2026-06-21T21:00:00Z",
};

/** The scenario every test starts on unless it pins another (`E2E_CLOCK` overrides this default for a whole run). */
export const DEFAULT_SCENARIO = "evening";

const HOUR_MS = 3_600_000;
/** What the forecast fixture serves around every scenario: Open-Meteo's `past_days=1` plus `forecast_days=8`, with margin. */
export const FIXTURE_HOURS_BEFORE = 48;
export const FIXTURE_HOURS_AFTER = 216;

/** Unix seconds of every hour in the union of the windows around every scenario and around `nowMs` (sorted, unique). */
export function fixtureHours(nowMs = Date.now()) {
  const centres = [...Object.values(SCENARIOS).map((iso) => Date.parse(iso)), nowMs];
  const hours = new Set();
  for (const centre of centres) {
    const hour = Math.floor(centre / HOUR_MS) * HOUR_MS;
    for (let t = hour - FIXTURE_HOURS_BEFORE * HOUR_MS; t <= hour + FIXTURE_HOURS_AFTER * HOUR_MS; t += HOUR_MS) {
      hours.add(t / 1000);
    }
  }
  return [...hours].sort((a, b) => a - b);
}
