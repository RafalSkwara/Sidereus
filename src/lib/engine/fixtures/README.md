# Stellarium reference fixtures

Hand-read values from Stellarium that the engine tests assert against, within the candidate
tolerance in `src/lib/engine/parameters.ts` (1° of altitude, 5 minutes of time, 0.02 of
illuminated fraction). One JSON file per (site, night) under `stellarium/`. A fixture section whose
`status` is `pending` shows up in `npm test` as a **todo**, never as a silent pass; flip it to
`captured` once its values are filled in.

## Fixtures

| File                     | Site                                  | Night      | Why                                                                                   |
| ------------------------ | ------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `warsaw-2026-10-10.json` | Warsaw centre, 52.23 N 21.01 E, 110 m | 2026-10-10 | Ordinary autumn night at the PRD's 52° N. New moon: `moon` section is not applicable. |
| `warsaw-2026-10-24.json` | Warsaw centre, 52.23 N 21.01 E, 110 m | 2026-10-24 | Spans the 2026-10-25 DST change (25-hour night). Waxing gibbous moon, up all night.   |
| `tromso-2026-06-21.json` | Tromsø, 69.65 N 18.96 E, 10 m         | 2026-06-21 | Midnight sun: no sunset, no sunrise, no dark window at any threshold (FR-023 case).   |

The coordinates are public reference points, not anyone's home.

## How values are written

- Times: ISO 8601 with the numeric UTC offset, to the minute, seconds `00`, e.g.
  `2026-10-10T17:52:00+02:00`. Warsaw is `+02:00` up to 2026-10-25 02:59 and `+01:00` from
  2026-10-25 02:00 (the repeated hour); Tromsø in June is `+02:00`. Never write a bare local time.
- Angles: decimal degrees. Stellarium shows `-18°00'12"`; write `-18.0` (minutes ÷ 60, seconds ÷ 3600).
- Illumination: Stellarium shows `Illuminated: 67.3%`; write `0.673`.
- A value that does not occur (no sunset under the midnight sun) stays `null`.

## Stellarium setup (once per fixture)

1. **Location** — press `F6`. In the bottom half of the window, type the fixture's latitude,
   longitude and altitude exactly as in the JSON `site` block (e.g. `52.23` N, `21.01` E, `110 m`),
   type the fixture's name in the _Name/City_ field, and tick **Use custom time zone** (or open the
   _Time zone_ combo) and pick the fixture's `site.timeZone` (`Europe/Warsaw` / `Europe/Oslo`).
   Do **not** pick a city preset. Click _Add to list_ if you want to reuse it.
2. **Info panel** — press `F2` → _Information_ tab. Make sure these are ticked: **Azimuth/Altitude**,
   **Rise, transit and set** (some versions label it _RTS_), **Illumination** (for the Moon) and
   **Local time**. Choose _Decimal degrees_ if offered; otherwise convert as above.
3. **Atmosphere on** — press `A` until the sky has an atmosphere. Stellarium then shows _apparent_
   altitudes (with refraction), which is what the fixtures record.
4. **Date and time** — press `F5`. The dialog shows the local date and time in the zone from step 1;
   click a field and type. Speed keys: `L` faster, `J` slower, `K` normal speed, `7` stop, `8` now.
   Precise stepping: `Alt+-`/`Alt+=` move by one sidereal day; for minutes use the arrow keys on the
   minute field in the `F5` dialog.

## Reading the sun (`sun` section)

1. Select the Sun: press `F3`, type `Sun`, `Enter`. The info panel (top-left) now shows the Sun's
   lines, including **Rise / Transit / Set** for the current local date and **Az./Alt.**
2. **Sunset**: set the date (`F5`) to the fixture's evening date, any afternoon time. Read the _Set_
   value from the info panel → `sunset`. **Sunrise**: set the date to the _next_ morning and read
   _Rise_ → `sunrise`. (These come from the info panel; the _RTS_ tab in the Astronomical Calculations
   window `F10` does the same but only after you select an object, set the _from/to_ dates and press
   _Calculate_.)
3. **Dark start** (`darkStart.time`): set the time to about 90 minutes after sunset. Watch the
   Sun's **Alt.** value in the info panel while stepping the minute field forward until it reads
   `-18°00'` (±30″ is fine). Write that minute. If you overshoot, step back.
4. **Dark end** (`darkEnd.time`): same, before sunrise, stepping until the altitude climbs back
   through `-18°00'`.
5. **Midnight sun / no darkness** (Tromsø in June): the info panel shows no set/rise, or the Sun's
   altitude never goes below `-18°`. Leave the four times `null`, keep `expectNoDarkness: true`.
6. Set `sun.status` to `captured`.

## Reading the Moon (`moon` section)

Skip fixtures whose `moon.status` is `not-applicable`.

1. Select the Moon (`F3`, `Moon`). For each sample row: set the time (`F5`), then copy **Az.** and
   **Alt.** from the info panel and the **Illuminated** percentage as a 0–1 fraction. Write the
   `time` you set, ISO with offset.
2. Warsaw 2026-10-24 needs at least two instants inside the dark window (e.g. 22:00 and 02:30 local);
   Tromsø needs one (its Moon may be below the horizon; a negative altitude is a valid sample).
3. Set `moon.status` to `captured`.

## Reading objects (`objects` section)

1. For each placeholder row, select the object (`F3`, e.g. `M31`), set the time, and copy **Az.** and
   **Alt.**. Prefer instants where the object is above 20°. In October at Warsaw, M31, M13, M42 and
   M45 are convenient; in June at Tromsø M13, M57 and M81. You may change the `id`s to whatever is up,
   as long as every row is fully filled in and there are at least three per Warsaw night.
2. Set `objects.status` to `captured`.

## Finish

1. Fill `source.version` (Help → About), `source.capturedBy` (initials are fine) and
   `source.capturedAt` (`YYYY-MM-DD`).
2. Run `npm test`. The fixture assertions turn from _todo_ into real checks. A deviation beyond the
   tolerance is a real finding (engine bug, protocol slip, or a tolerance that needs revisiting via
   PRD Open Question 9), not something to paper over.

## Section status values

- `pending` — placeholders; tests register a todo.
- `captured` — real values; tests assert them.
- `not-applicable` — the section does not apply to this fixture (a `reason` is recorded); tests skip it.

## USNO references (`usno.ts`)

`USNO_CIVIL_DAWN` holds civil dawn (sun at −6°) and sunrise for the five edge nights of the night-boundary
tests, read from the U.S. Naval Observatory API: an oracle independent of the engine. Each entry is an engine
`Site` (`elevationM: 0`, USNO's sea-level basis), the observing night's evening date and the two times as ISO
UTC strings. Values are rounded to the minute, so compare with ±2 min (engine ends) or use ±5 min either side
(rollover instants). To re-check or add one:

```
https://aa.usno.navy.mil/api/rstt/oneday?date=<YYYY-MM-DD>&coords=<lat>,<lon>&tz=0
```

`tz=0` returns UTC times for the UTC day `date`, so use the morning after the night's evening date (the UTC day
before it far east of UTC); read `Begin civil twilight` and `Sunrise`. Update `USNO_CHECKED` in `usno.ts`.

## Runner zones (`runner-zones.ts`)

Test machinery shared by the engine, Tonight and log night-boundary tests, not a fixture: `RUNNER_ZONES`, and
`useRunnerZone(zone)` to switch `process.env.TZ` for a `describe` and restore it afterwards. See the file's doc
comment for the rules (engine calls inside `it`, assert the switch first).

## Skyfield references (`skyfield/`)

| File                                      | Generator                     | Site                                  | Night      | What                                                                     |
| ----------------------------------------- | ----------------------------- | ------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| `skyfield/planets-warsaw-2026-10-10.json` | `scripts/planet-reference.py` | Warsaw centre, 52.23 N 21.01 E, 110 m | 2026-10-10 | Each planet's apparent alt/az and apparent diameter, hourly (new moon).  |
| `skyfield/moon-warsaw-2026-10-24.json`    | `scripts/moon-reference.py`   | Warsaw centre, 52.23 N 21.01 E, 110 m | 2026-10-24 | The Moon's apparent alt/az, illuminated fraction and elongation, hourly. |

### Planets

`skyfield/planets-warsaw-2026-10-10.json` is generated, not hand-read. It holds each planet's apparent
(refracted) altitude and azimuth and its apparent equatorial diameter for the Warsaw reference point
(52.23 N 21.01 E, 110 m) at every whole hour inside the civil window (sun below −6°) of the night
2026-10-10, computed with Skyfield and the JPL DE421 ephemeris. It is an independent cross-check of
`planets.ts`, which uses astronomy-engine. `provenance` records the Skyfield version, the ephemeris,
the refraction settings (10 °C, 1010 mbar) and the generation date.

`planets.test.ts` asserts every sample above 5° within 0.05° in altitude and azimuth (refraction
models differ near the horizon, so lower samples are not compared). That is far tighter than
`ALTITUDE_TOLERANCE_DEG` (1°, sized for hand-read Stellarium values): the libraries agree to ~0.005°,
and a 1° tolerance could not tell a refracted position from an unrefracted one. Every diameter is checked within 1″, or 2% where that is tighter.

To regenerate, never install Skyfield in the repo; use a throwaway virtualenv and a local copy of
`de421.bsp` (https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de421.bsp):

```bash
python3 -m venv /tmp/skyfield-venv
/tmp/skyfield-venv/bin/pip install skyfield
/tmp/skyfield-venv/bin/python scripts/planet-reference.py /path/to/de421.bsp \
  src/lib/engine/fixtures/skyfield/planets-warsaw-2026-10-10.json
```

The planet radii in the script must match `planets.ts`. Review the diff before committing.

### Moon

`skyfield/moon-warsaw-2026-10-24.json` is generated the same way by `scripts/moon-reference.py`. It holds the
Moon's topocentric apparent (refracted) altitude and azimuth (the same site and atmosphere as the planet
reference), its geocentric illuminated fraction (`almanac.fraction_illuminated`) and the geocentric Sun–Moon
ecliptic-longitude difference (`almanac.moon_phase`, 0 new, 180 full) at every whole hour inside the civil
window of the night 2026-10-24, a waxing gibbous Moon two nights before full, across the DST change.
It cross-checks `moonState` and `moonElongationDeg` in `moon.ts`.

`moon.test.ts` asserts every sample above 5° within 0.2° in altitude and azimuth, and every sample's
illuminated fraction within 0.005 (half a percentage point) and elongation within 0.3°. These are the plan's
tolerances; the two libraries agreed to about 0.003° in position, 0.00003 in illumination and 0.004° in
elongation when the fixture was generated (2026-10-01), so a failure is a real regression, not noise.

```bash
/tmp/skyfield-venv/bin/python scripts/moon-reference.py /path/to/de421.bsp \
  src/lib/engine/fixtures/skyfield/moon-warsaw-2026-10-24.json
```

## Generated cases (`generated.ts`, `independent-altitude.ts`)

Test machinery for the property suites (Risk #3 and #4 of `context/foundation/test-plan.md`), not fixtures. Both
modules are test-only, like everything here: the purity guard and the runner-zone guard skip this directory, and
production code must never import them.

- `generated.ts`: `seeded(seed)` (mulberry32), `GENERATED_SITES` (16 public reference points from the equator to
  78° N and 64.8° S, with fixed IANA zones, the far-east ones included) and `generateCase(random)` (a site, a day of
  2026, Bortle 1-9, minimum altitude 0-60, a 50-400 mm telescope at f/3-f/16 and a 0-3 eyepiece kit). The suite
  builds its case array at module scope from the seed alone and runs every engine call inside `it` or
  `beforeAll`; failure messages carry the case index and inputs so a case replays from the seed. The seed in
  `src/lib/engine/visibility-invariants.test.ts` is `20261008`.
- `independent-altitude.ts`: `deepSkyAltitudeDeg`, `bodyAltitudeDeg` and `sunAltitudeGeometricDeg` recompute a
  position from astronomy-engine by a road the engine does not take, for any `Observer` (elevation 0 for Tonight,
  which drops the site's elevation). `DARK_THRESHOLD_BY_BORTLE` and `PLANET_WINDOW_THRESHOLD_DEG` are the PRD's own
  table (-18 / -15 / -12 and -6), written out on purpose. Compare with `ALTITUDE_TOLERANCE_DEG` (0.05°).

Neither module may use engine output (tracks, `bestWindow`, `moonState`, `parameters.ts` thresholds): an oracle built
from the code under test moves with it. Keep them free of imports other than `astronomy-engine` and engine types.
