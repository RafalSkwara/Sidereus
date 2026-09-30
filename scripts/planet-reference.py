"""Independent planet reference for the engine tests (M-2 S-01).

Computes each planet's apparent (refracted) altitude/azimuth and apparent equatorial diameter with
Skyfield and the JPL DE421 ephemeris, for the Warsaw public reference point at every whole UTC hour
inside the civil window (sun below -6 degrees) of the observing night 2026-10-10. The engine uses
astronomy-engine, so this is a cross-check that does not share its library.

Never install Skyfield in the repo. Run it from a throwaway virtualenv:

    python3 -m venv /tmp/skyfield-venv
    /tmp/skyfield-venv/bin/pip install skyfield
    /tmp/skyfield-venv/bin/python scripts/planet-reference.py /path/to/de421.bsp \
        src/lib/engine/fixtures/skyfield/planets-warsaw-2026-10-10.json

de421.bsp is downloaded once from https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de421.bsp.
"""

import datetime as dt
import json
import math
import sys
from zoneinfo import ZoneInfo

import skyfield
from skyfield import almanac
from skyfield.api import load, load_file, wgs84

SITE = {
    "name": "Warsaw centre",
    "latitudeDeg": 52.23,
    "longitudeDeg": 21.01,
    "elevationM": 110,
    "timeZone": "Europe/Warsaw",
}
NIGHT = "2026-10-10"

# Standard atmosphere for the refraction model, close to astronomy-engine's "normal" refraction.
TEMPERATURE_C = 10.0
PRESSURE_MBAR = 1010.0

# Equatorial radii, km: the same values as src/lib/engine/planets.ts. DE421 has the centres of Mercury,
# Venus and Mars; for the giants it has only system barycentres, which sit within a few hundred km of
# the centre (far below the tolerance).
PLANETS = [
    ("mercury", "mercury", 2440.53),
    ("venus", "venus", 6051.8),
    ("mars", "mars", 3396.19),
    ("jupiter", "jupiter barycenter", 71492.0),
    ("saturn", "saturn barycenter", 60268.0),
    ("uranus", "uranus barycenter", 25559.0),
    ("neptune", "neptune barycenter", 24764.0),
]

ARCSEC_PER_RADIAN = 180 / math.pi * 3600


def main(ephemeris_path: str, output_path: str) -> None:
    ts = load.timescale()
    eph = load_file(ephemeris_path)
    earth = eph["earth"]
    zone = ZoneInfo(SITE["timeZone"])
    topos = wgs84.latlon(SITE["latitudeDeg"], SITE["longitudeDeg"], elevation_m=SITE["elevationM"])
    observer = earth + topos

    # The observing night runs from local noon to local noon.
    evening = dt.date.fromisoformat(NIGHT)
    start = dt.datetime.combine(evening, dt.time(12), zone)
    end = start + dt.timedelta(days=1)
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
        for key, name, radius_km in PLANETS:
            body = eph[name]
            alt, az, _ = observer.at(t).observe(body).apparent().altaz(
                temperature_C=TEMPERATURE_C, pressure_mbar=PRESSURE_MBAR
            )
            geo_km = earth.at(t).observe(body).distance().km
            diameter = 2 * math.atan(radius_km / geo_km) * ARCSEC_PER_RADIAN
            samples.append(
                {
                    "time": instant.astimezone(zone).isoformat(timespec="seconds"),
                    "planet": key,
                    "altitudeDeg": round(alt.degrees, 4),
                    "azimuthDeg": round(az.degrees, 4),
                    "apparentDiameterArcsec": round(diameter, 3),
                }
            )

    document = {
        "provenance": {
            "tool": "Skyfield",
            "version": skyfield.__version__,
            "ephemeris": "JPL DE421 (de421.bsp)",
            "refraction": f"Skyfield altaz, {TEMPERATURE_C:g} C, {PRESSURE_MBAR:g} mbar",
            "diameter": "2 atan(equatorial radius / geocentric light-time distance)",
            "script": "scripts/planet-reference.py",
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
        sys.exit("usage: planet-reference.py <de421.bsp> <output.json>")
    main(sys.argv[1], sys.argv[2])
