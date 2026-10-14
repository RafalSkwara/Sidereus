"""Independent close-pairing reference for the engine tests (M-3 S-07, sky-events Phase 2).

For two public reference sites and one fixed 30-night window each, records, for every pair of the Moon and
the five naked-eye planets (the Moon with each planet, and the ten planet pairs: 15 in all) and for every
observing night (local noon to local noon), two topocentric minima found on a one-minute grid with Skyfield
and the JPL DE421 ephemeris:

- the geometric minimum separation of the night, whatever the sky is doing, with its time and the two
  bodies' refracted altitudes (first and second of the pair) and the Sun's geometric altitude at that time;
- the visible minimum, the smallest separation among the minutes when both bodies are at least 10 degrees
  up (refracted) and the Sun is at or below -6 degrees (geometric), with its time and the lower body's
  altitude, or null when no minute of the night qualifies.

The engine uses astronomy-engine, so this cross-checks `src/lib/engine/pairings.ts` with a library that
shares none of its code. Separations are angles between the apparent topocentric directions of two bodies
(`observer.at(t).observe(body).apparent()`), so they are free of any frame choice.

Never install Skyfield in the repo. Run it from a throwaway virtualenv:

    python3 -m venv /tmp/skyfield-venv
    /tmp/skyfield-venv/bin/pip install skyfield
    /tmp/skyfield-venv/bin/python scripts/events-reference.py /path/to/de421.bsp \
        src/lib/engine/fixtures/skyfield

de421.bsp is downloaded once from https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de421.bsp. The output
directory receives pairings-warsaw-2026-10-13.json and pairings-sydney-2026-12-12.json. The script is run
by hand when a fixture is generated; it is not part of CI.
"""

import datetime as dt
import itertools
import json
import os
import sys
from zoneinfo import ZoneInfo

import numpy as np
import skyfield
from skyfield.api import load, load_file, wgs84
from skyfield.functions import angle_between

# Standard atmosphere for the refraction model, the same as scripts/planet-reference.py.
TEMPERATURE_C = 10.0
PRESSURE_MBAR = 1010.0

# The engine's visibility rule (src/lib/engine/parameters.ts): EVENT_MIN_ALTITUDE_DEG and
# EVENT_SUN_MAX_ALTITUDE_DEG. Written out here on purpose: the oracle must not read the code under test.
MIN_ALTITUDE_DEG = 10.0
SUN_MAX_ALTITUDE_DEG = -6.0

NIGHTS = 30

# DE421 has the centres of the Moon, Mercury, Venus and Mars; for Jupiter and Saturn it has only the
# system barycentres, which sit within a few hundred km of the planet's centre (far below the tolerance).
BODIES = [
    ("moon", "moon"),
    ("mercury", "mercury"),
    ("venus", "venus"),
    ("mars", "mars"),
    ("jupiter", "jupiter barycenter"),
    ("saturn", "saturn barycenter"),
]

# Chosen with the engine so that each window holds close pairings (a visible Moon-planet and planet-planet
# approach in Warsaw's, two Moon approaches and a daytime one in Sydney's), and so that Warsaw's window
# spans the 2026-10-25 clock change (a 25-hour night). Fixed dates only.
FIXTURES = [
    (
        "pairings-warsaw-2026-10-13.json",
        {
            "name": "Warsaw centre",
            "latitudeDeg": 52.23,
            "longitudeDeg": 21.01,
            "elevationM": 110,
            "timeZone": "Europe/Warsaw",
        },
        "2026-10-13",
    ),
    (
        "pairings-sydney-2026-12-12.json",
        {
            "name": "Sydney centre",
            "latitudeDeg": -33.87,
            "longitudeDeg": 151.21,
            "elevationM": 20,
            "timeZone": "Australia/Sydney",
        },
        "2026-12-12",
    ),
]


def iso_utc(jd_array, index, ts) -> str:
    """The minute-grid instant as an ISO 8601 UTC string with seconds 00."""
    stamp = ts.tt_jd(jd_array[index]).utc_datetime().replace(second=0, microsecond=0)
    return stamp.isoformat(timespec="seconds").replace("+00:00", "Z")


def night_minima(ts, eph, observer, topos, night_start, night_end):
    """Both minima of every pair over one observing night, on a one-minute grid."""
    t0 = ts.from_datetime(night_start)
    minutes = int(round((night_end - night_start).total_seconds() / 60))
    jd = t0.tt + np.arange(minutes + 1) / 1440.0
    t = ts.tt_jd(jd)

    positions = {}
    altitudes = {}
    for key, name in BODIES:
        apparent = observer.at(t).observe(eph[name]).apparent()
        positions[key] = apparent.position.au
        alt, _, _ = apparent.altaz(temperature_C=TEMPERATURE_C, pressure_mbar=PRESSURE_MBAR)
        altitudes[key] = alt.degrees
    # The Sun's altitude is geometric (no refraction): the twilight convention of the PRD.
    sun_alt, _, _ = observer.at(t).observe(eph["sun"]).apparent().altaz()
    sun_deg = sun_alt.degrees

    results = {}
    for (first, _), (second, _) in itertools.combinations(BODIES, 2):
        separation = np.degrees(angle_between(positions[first], positions[second]))
        lowest = np.minimum(altitudes[first], altitudes[second])
        geo = int(np.argmin(separation))
        entry = {
            "geometric": {
                "time": iso_utc(jd, geo, ts),
                "separationDeg": round(float(separation[geo]), 4),
                "firstAltitudeDeg": round(float(altitudes[first][geo]), 3),
                "secondAltitudeDeg": round(float(altitudes[second][geo]), 3),
                "sunAltitudeDeg": round(float(sun_deg[geo]), 3),
            },
            "visible": None,
        }
        mask = (lowest >= MIN_ALTITUDE_DEG) & (sun_deg <= SUN_MAX_ALTITUDE_DEG)
        if mask.any():
            masked = np.where(mask, separation, np.inf)
            vis = int(np.argmin(masked))
            entry["visible"] = {
                "time": iso_utc(jd, vis, ts),
                "separationDeg": round(float(separation[vis]), 4),
                "lowerAltitudeDeg": round(float(lowest[vis]), 3),
            }
        results[(first, second)] = entry
    return results


def build(ephemeris_path: str, site: dict, from_night: str) -> dict:
    ts = load.timescale()
    eph = load_file(ephemeris_path)
    zone = ZoneInfo(site["timeZone"])
    topos = wgs84.latlon(site["latitudeDeg"], site["longitudeDeg"], elevation_m=site["elevationM"])
    observer = eph["earth"] + topos

    first_date = dt.date.fromisoformat(from_night)
    per_pair = {pair: [] for pair in itertools.combinations([key for key, _ in BODIES], 2)}
    for n in range(NIGHTS):
        evening = first_date + dt.timedelta(days=n)
        start = dt.datetime.combine(evening, dt.time(12), zone)
        end = dt.datetime.combine(evening + dt.timedelta(days=1), dt.time(12), zone)
        minima = night_minima(ts, eph, observer, topos, start, end)
        for pair, entry in minima.items():
            per_pair[pair].append({"night": evening.isoformat(), **entry})

    return {
        "provenance": {
            "tool": "Skyfield",
            "version": skyfield.__version__,
            "ephemeris": "JPL DE421 (de421.bsp)",
            "separation": "angle between apparent topocentric directions (observer.at(t).observe(body).apparent())",
            "refraction": f"Skyfield altaz, {TEMPERATURE_C:g} C, {PRESSURE_MBAR:g} mbar; the Sun's altitude is geometric",
            "grid": "one minute, local noon to local noon",
            "visibleRule": f"both bodies at least {MIN_ALTITUDE_DEG:g} degrees up, the Sun at or below {SUN_MAX_ALTITUDE_DEG:g} degrees",
            "script": "scripts/events-reference.py",
            "generatedAt": dt.date.today().isoformat(),
        },
        "site": site,
        "fromNight": from_night,
        "nights": NIGHTS,
        "pairs": [{"first": pair[0], "second": pair[1], "nights": nights} for pair, nights in per_pair.items()],
    }


def main(ephemeris_path: str, output_dir: str) -> None:
    for filename, site, from_night in FIXTURES:
        document = build(ephemeris_path, site, from_night)
        with open(os.path.join(output_dir, filename), "w", encoding="utf-8") as out:
            json.dump(document, out, indent=2)
            out.write("\n")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: events-reference.py <de421.bsp> <output directory>")
    main(sys.argv[1], sys.argv[2])
