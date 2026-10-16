"""Independent deep-sky window reference for the engine tests (M-4 S-05, evening-showpieces Phase 1).

For one public reference site (Warsaw centre, 52.23 N 21.01 E, 110 m) and three fixed observing nights
(2026-04-15, 2026-07-15, 2026-10-15; local noon to local noon), records:

- the night's dark window: the interval in which the Sun's geometric altitude (no refraction, the twilight
  convention of the PRD) is below -15 degrees, which is Bortle 5's threshold (`darknessThresholdDegForBortle`
  in src/lib/engine/parameters.ts, written out here on purpose: the oracle must not read the code under test).
  The engine's `darkWindow` (src/lib/engine/sun.ts) is the same definition: astronomy-engine's apparent Sun
  with no refraction, crossings found to 1 s. The edges here are interpolated from a one-minute grid;
- for every object of the catalogue (the 110 Messier and 61 Caldwell objects of messier.json and
  caldwell.json, 171 in all, with their J2000 RA and Dec as Skyfield `Star` positions, never typed by hand),
  its best window inside the dark window: the longest contiguous run of one-minute samples at a refracted
  altitude of at least 15 degrees (the site's default minimum altitude), its first and last instants
  interpolated linearly across the minute where the altitude crosses 15 degrees (a run that touches the
  dark window's edge keeps that edge: the dark window is the clip), and the run's maximum altitude with its
  time (the grid maximum, refined by a parabola through its neighbours). An object that never reaches 15
  degrees in the dark window has null edges and the dark window's maximum.

The engine uses astronomy-engine, so this cross-checks the window edges of src/lib/engine/objects.ts and
score.ts with a library that shares none of its code. Atmosphere for the refraction model: 10 C, 1010 mbar,
the same as scripts/planet-reference.py. Skyfield's `Star` takes the catalogue coordinates as ICRS with no
proper motion, which differs from the J2000 frame by about 20 mas: far below the tolerance.

Never install Skyfield in the repo. Run it from a throwaway virtualenv:

    python3 -m venv /tmp/skyfield-venv
    /tmp/skyfield-venv/bin/pip install skyfield
    /tmp/skyfield-venv/bin/python -I scripts/deep-sky-reference.py /path/to/de421.bsp \
        src/lib/catalogue src/lib/engine/fixtures/skyfield

de421.bsp is downloaded once from https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de421.bsp. The catalogue
directory is read-only here (messier.json and caldwell.json); the output directory receives
deep-sky-warsaw-2026.json. The script is run by hand when the fixture is generated; it is not part of CI.
"""

import datetime as dt
import json
import os
import sys
from zoneinfo import ZoneInfo

import numpy as np
import skyfield
from skyfield.api import Star, load, load_file, wgs84

OUTPUT_FILENAME = "deep-sky-warsaw-2026.json"

SITE = {
    "name": "Warsaw centre",
    "latitudeDeg": 52.23,
    "longitudeDeg": 21.01,
    "elevationM": 110,
    "timeZone": "Europe/Warsaw",
}
NIGHTS = ["2026-04-15", "2026-07-15", "2026-10-15"]

# Standard atmosphere for the refraction model, the same as scripts/planet-reference.py.
TEMPERATURE_C = 10.0
PRESSURE_MBAR = 1010.0

# The engine's rules for the calibration nights (Bortle 5, the site's default minimum altitude), written out
# here on purpose: the oracle must not read the code under test.
MIN_ALTITUDE_DEG = 15.0
DARK_SUN_MAX_ALTITUDE_DEG = -15.0

GRID_SECONDS = 60


def iso_utc(tt_jd: float, ts) -> str:
    """The instant as an ISO 8601 UTC string, to the nearest second."""
    stamp = ts.tt_jd(tt_jd).utc_datetime()
    stamp = (stamp + dt.timedelta(milliseconds=500)).replace(microsecond=0)
    return stamp.isoformat(timespec="seconds").replace("+00:00", "Z")


def crossing(jd_a: float, alt_a: float, jd_b: float, alt_b: float, level: float) -> float:
    """The instant between two grid samples where the altitude crosses `level` (linear, one minute apart)."""
    return jd_a + (jd_b - jd_a) * (level - alt_a) / (alt_b - alt_a)


def dark_window(ts, eph, observer, night_start, night_end):
    """The interval with the Sun's geometric altitude below the threshold, as (start_tt, end_tt)."""
    minutes = int(round((night_end - night_start).total_seconds() / 60))
    jd = ts.from_datetime(night_start).tt + np.arange(minutes + 1) / 1440.0
    alt, _, _ = observer.at(ts.tt_jd(jd)).observe(eph["sun"]).apparent().altaz()
    sun = alt.degrees
    below = sun < DARK_SUN_MAX_ALTITUDE_DEG
    if not below.any() or below[0] or below[-1]:
        raise SystemExit("the reference needs nights with a dusk and a dawn crossing of the threshold")
    first = int(np.argmax(below))
    last = len(below) - 1 - int(np.argmax(below[::-1]))
    start = crossing(jd[first - 1], sun[first - 1], jd[first], sun[first], DARK_SUN_MAX_ALTITUDE_DEG)
    end = crossing(jd[last], sun[last], jd[last + 1], sun[last + 1], DARK_SUN_MAX_ALTITUDE_DEG)
    return float(start), float(end)


def object_window(ts, observer, star, start_tt, end_tt):
    """The longest at-or-above-minimum run in [start, end] on a one-minute grid, with its true edges and peak."""
    step = GRID_SECONDS / 86400.0
    count = int(np.floor((end_tt - start_tt) / step + 1e-9))
    jd = start_tt + np.arange(count + 1) * step
    if jd[-1] < end_tt - 1e-9:
        jd = np.append(jd, end_tt)
    alt, _, _ = observer.at(ts.tt_jd(jd)).observe(star).apparent().altaz(
        temperature_C=TEMPERATURE_C, pressure_mbar=PRESSURE_MBAR
    )
    deg = alt.degrees
    above = deg >= MIN_ALTITUDE_DEG

    # Contiguous runs of samples at or above the minimum, as (first index, last index).
    runs = []
    run_start = None
    for i, flag in enumerate(above):
        if flag and run_start is None:
            run_start = i
        elif not flag and run_start is not None:
            runs.append((run_start, i - 1))
            run_start = None
    if run_start is not None:
        runs.append((run_start, len(above) - 1))

    if not runs:
        lo, hi = 0, len(deg) - 1
        window = None
    else:
        # The longest run in time; the earlier one on a tie.
        lo, hi = max(runs, key=lambda r: (jd[r[1]] - jd[r[0]], -r[0]))
        edge_start = (
            jd[lo] if lo == 0 else crossing(jd[lo - 1], deg[lo - 1], jd[lo], deg[lo], MIN_ALTITUDE_DEG)
        )
        edge_end = (
            jd[hi]
            if hi == len(deg) - 1
            else crossing(jd[hi], deg[hi], jd[hi + 1], deg[hi + 1], MIN_ALTITUDE_DEG)
        )
        window = (float(edge_start), float(edge_end))

    peak = lo + int(np.argmax(deg[lo : hi + 1]))
    peak_deg = float(deg[peak])
    peak_tt = float(jd[peak])
    if 0 < peak < len(deg) - 1:
        # Parabola through the three samples around the grid maximum (a one-minute step: the vertex stays
        # within a minute of the sample). Skipped at the clip edges, where the maximum is the edge itself.
        a, b, c = deg[peak - 1], deg[peak], deg[peak + 1]
        curvature = a - 2 * b + c
        if curvature < 0 and lo < peak < hi:
            offset = 0.5 * (a - c) / curvature
            if abs(offset) <= 1:
                peak_deg = float(b - 0.25 * (a - c) * offset)
                peak_tt = float(jd[peak] + offset * step)
    return window, peak_deg, peak_tt


def build(ephemeris_path: str, catalogue_dir: str) -> dict:
    ts = load.timescale()
    eph = load_file(ephemeris_path)
    zone = ZoneInfo(SITE["timeZone"])
    topos = wgs84.latlon(SITE["latitudeDeg"], SITE["longitudeDeg"], elevation_m=SITE["elevationM"])
    observer = eph["earth"] + topos

    objects = []
    for filename in ("messier.json", "caldwell.json"):
        with open(os.path.join(catalogue_dir, filename), encoding="utf-8") as source:
            objects.extend(json.load(source))
    stars = [(o["id"], Star(ra_hours=o["raHours"], dec_degrees=o["decDeg"])) for o in objects]

    nights = {}
    for date in NIGHTS:
        evening = dt.date.fromisoformat(date)
        start = dt.datetime.combine(evening, dt.time(12), zone)
        end = dt.datetime.combine(evening + dt.timedelta(days=1), dt.time(12), zone)
        dark_start, dark_end = dark_window(ts, eph, observer, start, end)
        entries = {}
        for object_id, star in stars:
            window, peak_deg, peak_tt = object_window(ts, observer, star, dark_start, dark_end)
            entries[object_id] = {
                "windowStart": None if window is None else iso_utc(window[0], ts),
                "windowEnd": None if window is None else iso_utc(window[1], ts),
                "maxAltitudeDeg": round(peak_deg, 3),
                "maxTime": iso_utc(peak_tt, ts),
            }
        nights[date] = {
            "dark": {"start": iso_utc(dark_start, ts), "end": iso_utc(dark_end, ts)},
            "objects": entries,
        }

    return {
        "provenance": {
            "tool": "Skyfield",
            "version": skyfield.__version__,
            "ephemeris": "JPL DE421 (de421.bsp)",
            "objects": f"{len(stars)} objects of messier.json and caldwell.json: J2000 RA and Dec as Skyfield Star, no proper motion",
            "refraction": f"Skyfield altaz, {TEMPERATURE_C:g} C, {PRESSURE_MBAR:g} mbar; the Sun's altitude is geometric",
            "minAltitudeDeg": MIN_ALTITUDE_DEG,
            "darkSunMaxAltitudeDeg": DARK_SUN_MAX_ALTITUDE_DEG,
            "grid": "one minute inside the dark window; edges interpolated linearly across the crossing minute",
            "window": "the longest run at or above minAltitudeDeg inside the dark window; null edges when there is none; maxAltitudeDeg and maxTime are the run's (the dark window's when there is no run)",
            "script": "scripts/deep-sky-reference.py",
            "generatedAt": dt.date.today().isoformat(),
        },
        "site": SITE,
        "nights": nights,
    }


def main(ephemeris_path: str, catalogue_dir: str, output_dir: str) -> None:
    document = build(ephemeris_path, catalogue_dir)
    with open(os.path.join(output_dir, OUTPUT_FILENAME), "w", encoding="utf-8") as out:
        json.dump(document, out, indent=2)
        out.write("\n")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit("usage: deep-sky-reference.py <de421.bsp> <catalogue directory> <output directory>")
    main(sys.argv[1], sys.argv[2], sys.argv[3])
