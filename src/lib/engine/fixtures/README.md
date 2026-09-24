# Stellarium reference fixtures

Hand-read values from Stellarium that the engine tests assert against, within the candidate
tolerance in `src/lib/engine/parameters.ts` (1° of altitude, 5 minutes of time, 0.02 of
illuminated fraction). One JSON file per (site, night) under `stellarium/`. A fixture section whose
`status` is `pending` shows up in `npm test` as a **todo**, never as a silent pass; flip it to
`captured` once its values are filled in.

## Fixtures

| File                     | Site                                  | Night      | Why                                                                                    |
| ------------------------ | ------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `warsaw-2026-10-10.json` | Warsaw centre, 52.23 N 21.01 E, 110 m | 2026-10-10 | Ordinary autumn night at the PRD's 52° N. New moon: `moon` section is not applicable.  |
| `warsaw-2026-10-24.json` | Warsaw centre, 52.23 N 21.01 E, 110 m | 2026-10-24 | Spans the 2026-10-25 DST change (25-hour night). Waxing gibbous moon, up all night.     |
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
   type the fixture's name in the *Name/City* field, and tick **Use custom time zone** (or open the
   *Time zone* combo) and pick the fixture's `site.timeZone` (`Europe/Warsaw` / `Europe/Oslo`).
   Do **not** pick a city preset. Click *Add to list* if you want to reuse it.
2. **Info panel** — press `F2` → *Information* tab. Make sure these are ticked: **Azimuth/Altitude**,
   **Rise, transit and set** (some versions label it *RTS*), **Illumination** (for the Moon) and
   **Local time**. Choose *Decimal degrees* if offered; otherwise convert as above.
3. **Atmosphere on** — press `A` until the sky has an atmosphere. Stellarium then shows *apparent*
   altitudes (with refraction), which is what the fixtures record.
4. **Date and time** — press `F5`. The dialog shows the local date and time in the zone from step 1;
   click a field and type. Speed keys: `L` faster, `J` slower, `K` normal speed, `7` stop, `8` now.
   Precise stepping: `Alt+-`/`Alt+=` move by one sidereal day; for minutes use the arrow keys on the
   minute field in the `F5` dialog.

## Reading the sun (`sun` section)

1. Select the Sun: press `F3`, type `Sun`, `Enter`. The info panel (top-left) now shows the Sun's
   lines, including **Rise / Transit / Set** for the current local date and **Az./Alt.**
2. **Sunset**: set the date (`F5`) to the fixture's evening date, any afternoon time. Read the *Set*
   value from the info panel → `sunset`. **Sunrise**: set the date to the *next* morning and read
   *Rise* → `sunrise`. (These come from the info panel; the *RTS* tab in the Astronomical Calculations
   window `F10` does the same but only after you select an object, set the *from/to* dates and press
   *Calculate*.)
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
2. Run `npm test`. The fixture assertions turn from *todo* into real checks. A deviation beyond the
   tolerance is a real finding (engine bug, protocol slip, or a tolerance that needs revisiting via
   PRD Open Question 9), not something to paper over.

## Section status values

- `pending` — placeholders; tests register a todo.
- `captured` — real values; tests assert them.
- `not-applicable` — the section does not apply to this fixture (a `reason` is recorded); tests skip it.
