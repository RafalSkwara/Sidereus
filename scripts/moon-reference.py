"""Independent Moon reference for the engine tests (M-2 S-02).

Computes the Moon's topocentric apparent (refracted) altitude/azimuth, its illuminated fraction and the
geocentric Sun-Moon ecliptic-longitude difference (elongation, 0 new, 180 full) with Skyfield and the JPL
DE421 ephemeris, for the Warsaw public reference point at every whole UTC hour inside the civil window
(sun below -6 degrees) of the observing night 2026-10-24 (waxing gibbous toward the 2026-10-26 full moon).
The engine uses astronomy-engine, so this is a cross-check that does not share its library.

Never install Skyfield in the repo. Run it from a throwaway virtualenv:

    python3 -m venv /tmp/skyfield-venv
    /tmp/skyfield-venv/bin/pip install skyfield
    /tmp/skyfield-venv/bin/python scripts/moon-reference.py /path/to/de421.bsp \
        src/lib/engine/fixtures/skyfield/moon-warsaw-2026-10-24.json

de421.bsp is downloaded once from https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de421.bsp.
"""

import datetime as dt
import json
import sys
from zoneinfo import ZoneInfo

import skyfield
from skyfield import almanac
from skyfield.api import load, load_file, wgs84

# The same site as scripts/planet-reference.py.
SITE = {
    "name": "Warsaw centre",
    "latitudeDeg": 52.23,
    "longitudeDeg": 21.01,
    "elevationM": 110,
    "timeZone": "Europe/Warsaw",
}
NIGHT = "2026-10-24"

# Standard atmosphere for the refraction model, the same as scripts/planet-reference.py.
TEMPERATURE_C = 10.0
PRESSURE_MBAR = 1010.0


def main(ephemeris_path: str, output_path: str) -> None:
    ts = load.timescale()
    eph = load_file(ephemeris_path)
    earth, moon = eph["earth"], eph["moon"]
    zone = ZoneInfo(SITE["timeZone"])
    topos = wgs84.latlon(SITE["latitudeDeg"], SITE["longitudeDeg"], elevation_m=SITE["elevationM"])
    observer = earth + topos

    # The observing night runs from local noon to local noon (25 hours here: DST ends on 2026-10-25).
    evening = dt.date.fromisoformat(NIGHT)
    start = dt.datetime.combine(evening, dt.time(12), zone)
    end = dt.datetime.combine(evening + dt.timedelta(days=1), dt.time(12), zone)
    t0, t1 = ts.from_datetime(start), ts.from_datetime(end)

    # Civil window: the sun below -6 degrees (Skyfield's twilight levels: 0 night ... 3 civil, 4 day).
    times, levels = almanac.find_discrete(t0, t1, almanac.dark_twilight_day(eph, topos))
    dusk = next(t for t, level in zip(times, levels) if level == 2)
    dawn = next(t for t, level in zip(times, levels) if level == 3 and t.tt > dusk.tt)

    first_hour = dusk.utc_datetime().replace(minute=0, second=0, microsecond=0) + dt.timedelta(hours=1)
    instants = []
    at = first_hour
    while at <= dawn.utc_datetime():
        instants.append(at)
        at += dt.timedelta(hours=1)

    samples = []
    for instant in instants:
        t = ts.from_datetime(instant)
        alt, az, _ = observer.at(t).observe(moon).apparent().altaz(
            temperature_C=TEMPERATURE_C, pressure_mbar=PRESSURE_MBAR
        )
        # Geocentric, as astronomy-engine's Illumination and MoonPhase are.
        fraction = almanac.fraction_illuminated(eph, "moon", t)
        elongation = almanac.moon_phase(eph, t).degrees % 360
        samples.append(
            {
                "time": instant.astimezone(zone).isoformat(timespec="seconds"),
                "altitudeDeg": round(alt.degrees, 4),
                "azimuthDeg": round(az.degrees, 4),
                "illuminatedFraction": round(float(fraction), 5),
                "elongationDeg": round(float(elongation), 4),
            }
        )

    document = {
        "provenance": {
            "tool": "Skyfield",
            "version": skyfield.__version__,
            "ephemeris": "JPL DE421 (de421.bsp)",
            "refraction": f"Skyfield altaz, {TEMPERATURE_C:g} C, {PRESSURE_MBAR:g} mbar",
            "illumination": "almanac.fraction_illuminated(eph, 'moon', t), geocentric",
            "elongation": "almanac.moon_phase(eph, t): geocentric apparent Moon minus Sun ecliptic longitude of date",
            "script": "scripts/moon-reference.py",
            "generatedAt": dt.date.today().isoformat(),
            "civilWindow": {
                "start": dusk.utc_datetime().astimezone(zone).isoformat(timespec="seconds"),
                "end": dawn.utc_datetime().astimezone(zone).isoformat(timespec="seconds"),
            },
        },
        "site": SITE,
        "night": NIGHT,
        "samples": samples,
    }
    with open(output_path, "w", encoding="utf-8") as out:
        json.dump(document, out, indent=2)
        out.write("\n")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: moon-reference.py <de421.bsp> <output.json>")
    main(sys.argv[1], sys.argv[2])
