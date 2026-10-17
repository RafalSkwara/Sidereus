# Stellarium reference fixtures

Hand-read values from Stellarium that the engine tests assert against, within the candidate
tolerance in `src/lib/engine/parameters.ts` (1° of altitude, 5 minutes of time, 0.02 of
illuminated fraction). One JSON file per (site, night) under `stellarium/`. Only the `sun` sections are asserted
(`sun.test.ts`); the Moon and object positions are checked against Skyfield (`skyfield/`), so the Moon and objects
capture protocols were retired with the test-suite diet. A section whose `status` is `pending` registers a todo,
never a silent pass; flip it to `captured` once its values are filled in.

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

## Finish

1. Fill `source.version` (Help → About), `source.capturedBy` (initials are fine) and
   `source.capturedAt` (`YYYY-MM-DD`).
2. Run `npm test`. A sun assertion turns from _todo_ into a real check. A deviation beyond the
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

| File                                       | Generator                       | Site                                  | Night                              | What                                                                                                                                |
| ------------------------------------------ | ------------------------------- | ------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `skyfield/planets-warsaw-2026-10-10.json`  | `scripts/planet-reference.py`   | Warsaw centre, 52.23 N 21.01 E, 110 m | 2026-10-10                         | Each planet's apparent alt/az and apparent diameter, hourly (new moon).                                                             |
| `skyfield/moon-warsaw-2026-10-24.json`     | `scripts/moon-reference.py`     | Warsaw centre, 52.23 N 21.01 E, 110 m | 2026-10-24                         | The Moon's apparent alt/az, illuminated fraction and elongation, hourly.                                                            |
| `skyfield/pairings-warsaw-2026-10-13.json` | `scripts/events-reference.py`   | Warsaw centre, 52.23 N 21.01 E, 110 m | 2026-10-13 + 29                    | Each pair's minimum separation per night, at any moment and while visible (30 nights).                                              |
| `skyfield/pairings-sydney-2026-12-12.json` | `scripts/events-reference.py`   | Sydney centre, 33.87 S 151.21 E, 20 m | 2026-12-12 + 29                    | The same for a southern site (30 nights).                                                                                           |
| `skyfield/deep-sky-warsaw-2026.json`       | `scripts/deep-sky-reference.py` | Warsaw centre, 52.23 N 21.01 E, 110 m | 2026-04-15, 2026-07-15, 2026-10-15 | Each night's dark window (Sun below -15°) and every catalogue object's window at or above 15° inside it, with its highest altitude. |

### Planets

`skyfield/planets-warsaw-2026-10-10.json` is generated, not hand-read. It holds each planet's apparent
(refracted) altitude and azimuth and its apparent equatorial diameter for the Warsaw reference point
(52.23 N 21.01 E, 110 m) at every whole hour inside the civil window (sun below −6°) of the night
2026-10-10, computed with Skyfield and the JPL DE421 ephemeris. It is an independent cross-check of
`planets.ts`, which uses astronomy-engine. `provenance` records the Skyfield version, the ephemeris,
the refraction settings (10 °C, 1010 mbar) and the generation date.

`planet-ranking.test.ts` asserts every sample above 5° within 0.05° in altitude and azimuth (refraction
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

### Pairings

`skyfield/pairings-warsaw-2026-10-13.json` and `skyfield/pairings-sydney-2026-12-12.json` are generated by
`scripts/events-reference.py` (one run writes both). Each holds, for the 15 pairs of the Moon and the five
naked-eye planets and each of 30 observing nights (local noon to local noon), two topocentric minima on a
one-minute grid, computed with Skyfield and DE421:

- `geometric`: the night's smallest separation at any moment, its time (ISO UTC, to the minute), the two
  bodies' refracted altitudes (`firstAltitudeDeg`, `secondAltitudeDeg`) and the Sun's geometric altitude then;
- `visible`: the smallest separation among the minutes when both bodies are at least 10° up and the Sun is at
  or below −6° (the engine's rule, written out in the script on purpose), with its time and the lower body's
  altitude, or `null` when no minute qualifies.

Separations are angles between apparent topocentric directions, so they involve no frame choice. The windows
were chosen with the engine so that each holds close pairings (Warsaw's: Moon-Mars, Moon-Jupiter and
Mars-Jupiter visible, Moon-Venus by day, and the 25-hour night of the 2026-10-25 clock change; Sydney's: two Moon
approaches and a Moon-Mercury one by day). `pairings.test.ts` derives the events the reference implies at the 5°
threshold (a night is close when its geometric minimum is, consecutive close nights are one event, and a visible
night within the threshold makes the event visible) and asserts the engine's events match: the same pairs and
nights, separations within 0.05° and moments within 10 minutes, and the engine's separation at every recorded
moment within 0.05°. The generator is run by hand once and the output committed; it is not part of CI. It
writes prettier-stable JSON (no arrays), so no formatting pass is needed.

```bash
python3 -m venv /tmp/skyfield-venv
/tmp/skyfield-venv/bin/pip install skyfield
/tmp/skyfield-venv/bin/python -I scripts/events-reference.py /path/to/de421.bsp \
  src/lib/engine/fixtures/skyfield
```

Changing a window or a site means changing `FIXTURES` in the script and the file names here; check with the
engine first that the window still holds a visible close pairing, or the tests' "a close pairing in the
window" check fails by design.

### Deep-sky windows

`skyfield/deep-sky-warsaw-2026.json` is generated by `scripts/deep-sky-reference.py` (M-4 S-05, evening-showpieces). For
Warsaw (52.23 N 21.01 E, 110 m) on 2026-04-15, 2026-07-15 and 2026-10-15 it holds, per night, the dark window (the Sun's
geometric altitude below -15°, Bortle 5, the engine's own definition written out in the script) and, for all 171
objects of `messier.json` and `caldwell.json` (J2000 coordinates read from those files), the longest run at or above
15° (refracted, 10 °C, 1010 mbar) inside the dark window: its first and last instants interpolated across the crossing
minute of a one-minute grid, the run's maximum altitude and its time, and null edges when the object never reaches 15°
in the dark. `window-reference.test.ts` compares the engine's windows with it (every edge within
`TIME_TOLERANCE_MINUTES`, the peak within `ALTITUDE_TOLERANCE_DEG`): the grid-edge windows of `bestWindow` miss it by 5
to 10 minutes, the true crossings of `refinedWindow` pass. The same test checks the final top 5 of each night (PRD
criterion 2, ephemeris leg). The file is prettier-stable JSON (no arrays).

```bash
python3 -m venv /tmp/skyfield-venv
/tmp/skyfield-venv/bin/pip install skyfield
/tmp/skyfield-venv/bin/python -I scripts/deep-sky-reference.py /path/to/de421.bsp \
  src/lib/catalogue src/lib/engine/fixtures/skyfield
```

## Generated cases (`generated.ts`, `independent-altitude.ts`)

Test machinery for the property suites (Risk #3 and #4 of `context/foundation/test-plan.md`), not fixtures. Both
modules are test-only, like everything here: the purity guard and the runner-zone guard skip this directory, and
production code must never import them.

- `generated.ts`: `seeded(seed)` (mulberry32), `GENERATED_SITES` (16 public reference points from the equator to
  78° N and 64.8° S, with fixed IANA zones, the far-east ones included) and `generateCase(random)` (a site, a day of
  2026, Bortle 1-9, minimum altitude 0-60, a 50-400 mm telescope at f/3-f/16 and a 0-3 eyepiece kit). The suite
  builds its case array at module scope from the seed alone and runs every engine call inside `it` or
  `beforeAll`; failure messages carry the case index and inputs so a case replays from the seed. The seeds are
  `20261008` (`src/lib/engine/visibility-invariants.test.ts`), `20261009`
  (`src/lib/engine/ranking-invariants.test.ts`) and `20261010` (`src/lib/tonight/visibility-invariants.test.ts`).
  `generated.ts` imports `addDays` and `EYEPIECE_PRESETS`, which only shape the inputs.
- `independent-altitude.ts`: `deepSkyAltitudeDeg` and `bodyAltitudeDeg` recompute a position from astronomy-engine
  by a road the engine does not take; `sunAltitudeGeometricDeg` is a deliberate copy of the engine's geometric sun
  (`sun.ts`: the same astronomy-engine calls, the PRD's twilight convention), not an independent road. All three
  take any `Observer` (elevation 0 for Tonight,
  which drops the site's elevation). `DARK_THRESHOLD_BY_BORTLE` and `PLANET_WINDOW_THRESHOLD_DEG` are the PRD's own
  table (-18 / -15 / -12 and -6), written out on purpose. Compare with `ALTITUDE_TOLERANCE_DEG` (0.05°).

Neither module may use engine output (tracks, `bestWindow`, `moonState`, `parameters.ts` thresholds): an oracle built
from the code under test moves with it. `independent-altitude.ts` keeps its imports to `astronomy-engine` and engine
types; that import rule does not cover `generated.ts`.

## Beginner reference (`beginner-reference.ts`)

The independent judgment behind the calibration oracle (`src/lib/engine/calibration.test.ts`, Risk #4): published
beginner picks for the four calibration nights, so a retune is measured against what observers recommend, not
against the engine's own previous output. Test-only, like everything here.

- `BEGINNER_SOURCES`: the nine pages (key, title, publisher, URL, access date 2026-10-08).
- `BEGINNER_REFERENCE`: per night (2026-01-15, 04-15, 07-15, 10-15) the objects with the source keys that name
  them. **Counting rule, fixed before any comparison with the engine:** an object counts for a night when at least
  2 sources name it as a beginner target for that season. The calibration test requires each night's top 5 to share
  at least 3 objects with the night's list (k = 3, the user's decision of 2026-10-08).
- `AF_FALL_LIST`: the 20 Messier objects of source AF, used by `ranking.test.ts` for the 2026-10-10 top 5 (a set
  check, so a reorder within AF's fall picks passes).
- The lists came from WebFetch summaries of the pages, read on 2026-10-08, not from a hand transcription of each
  article. Spot-check an entry against its page before relying on it.
- **Never edit a list to make a ranking pass.** If a retune moves a night below 3, the ranking is what is under
  review. Changing the reference needs a dated note here naming the new sources (and the day they were read).

Dated notes:

- **2026-10-09, spot-check (plan Progress 3.4).** 3 entries per night were checked against their pages (WebFetch): Jan M42 (TS), M36 (SZ), NGC869 (TW, "h & χ Persei"); Apr M51 (LNS), M65 (AW, TS), M3 (SZ, TW); Jul M8 (ASU), NGC7000 (TS), M4 (LNS, TW); Oct M32 (AF, TS), M15 (SZ, ASU), M73 (AF, ASU). All confirmed. One key corrected toward its source: TA's table gives M42 "Nov–Mar", so TA was removed from April's M42; M42 stays on AS (lists it) and TW ("Late Fall through Early Spring"). M44 checked as a possible January omission: only TS lists it for winter (TW "spring and early summer", TA "Feb–May"), so it rightly stays out.
