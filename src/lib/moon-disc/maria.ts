/**
 * The lunar maria the Moon disc draws (moonlight-and-the-verdict): data, not tunables.
 *
 * Centres and diameters are the IAU Gazetteer of Planetary Nomenclature values as listed on Wikipedia ("List of maria
 * on the Moon", retrieved 2026-10-02). Selenographic latitude is north positive and longitude IAU east positive (the
 * Mare Crisium side). The angular radius of a round mare is its diameter over two, divided by the Moon's mean radius
 * (1737.4 km), in degrees of arc on the lunar sphere.
 *
 * Two maria do not fit a round cap and are approximated: Mare Frigoris, a long east-west band, is an ellipse 1596 km
 * long (26.3° half-length) and about 250 km wide; Oceanus Procellarum, 2568 km across and irregular, is three caps
 * placed along its north-south extent around the IAU centre (18.4° N, 57.4° W).
 */

/** One mare outline: an ellipse on the lunar sphere, with its semi-axes along the local east and north directions. */
export interface MareShape {
  name: string;
  latDeg: number;
  lonDeg: number;
  /** Angular semi-axis towards selenographic east, degrees of arc. */
  eastRadiusDeg: number;
  /** Angular semi-axis towards selenographic north, degrees of arc. */
  northRadiusDeg: number;
}

const MOON_RADIUS_KM = 1737.4;

/** The angular radius, degrees of arc, of a round mare `diameterKm` across. */
function capRadiusDeg(diameterKm: number): number {
  return ((diameterKm / 2 / MOON_RADIUS_KM) * 180) / Math.PI;
}

/** A round mare from its IAU centre and diameter. */
function cap(name: string, latDeg: number, lonDeg: number, diameterKm: number): MareShape {
  const radiusDeg = capRadiusDeg(diameterKm);
  return { name, latDeg, lonDeg, eastRadiusDeg: radiusDeg, northRadiusDeg: radiusDeg };
}

export const MARIA: readonly MareShape[] = [
  cap("Mare Imbrium", 32.8, -15.6, 1146),
  cap("Mare Serenitatis", 28.0, 17.5, 674),
  cap("Mare Tranquillitatis", 8.5, 31.4, 873),
  cap("Mare Crisium", 17.0, 59.1, 556),
  cap("Mare Fecunditatis", -7.8, 51.3, 909),
  cap("Mare Nectaris", -15.2, 35.5, 333),
  cap("Mare Nubium", -21.3, -16.6, 715),
  cap("Mare Humorum", -24.4, -38.6, 389),
  cap("Mare Cognitum", -10.0, -23.1, 376),
  cap("Mare Insularum", 7.5, -30.9, 513),
  cap("Mare Vaporum", 13.3, 3.6, 245),
  {
    name: "Mare Frigoris",
    latDeg: 56.0,
    lonDeg: 1.4,
    eastRadiusDeg: capRadiusDeg(1596),
    northRadiusDeg: capRadiusDeg(250),
  },
  cap("Oceanus Procellarum (north)", 38.0, -54.0, 700),
  cap("Oceanus Procellarum (centre)", 18.4, -57.4, 750),
  cap("Oceanus Procellarum (south)", 0.0, -48.0, 600),
];
