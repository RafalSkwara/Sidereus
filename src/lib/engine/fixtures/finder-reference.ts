/**
 * TEST-ONLY. Classic published star hops for the finder chart's reference test (`finder.test.ts`, finder-chart D-11,
 * roadmap OQ1: calibration without an observer).
 *
 * Each entry is a hop an observing guide publishes, on a fixed instant at 52° N (the `WARSAW` fixture site) with the
 * target well up (above 55°, so the chart is facing, not overhead). The test asserts that the engine's chosen starting
 * star is one of the entry's route stars, that the path reaches the target and that every step is at most 5.6°. It
 * never asserts the engine's own sequence: the sources differ from one another on the exact hop (M31's two routes
 * below), and the engine minimises the number of steps, so it may skip a star the guide names.
 *
 * Each `bortle` is a representative class of one starting-limit band (3 = limit 4.5, 5 = limit 3.5, 8 = limit 2.5),
 * picked once from the starts the engine computes for the three bands (scratch run, finder-chart Phase 2): the band
 * whose limit admits a published start star and makes it the nearest qualifying star, lowest band first. The reason is
 * in `bandReason`. A reference that no band reconciles would go to `KNOWN_DIVERGENCES` with its computed route and
 * never be forced; none needed to. A reference failing is an engine finding, never a fixture edit.
 *
 * Sources were read through WebFetch/WebSearch summaries on 2026-10-13, the same way as `beginner-reference.ts`.
 */

/** A star as HYG designates it: a Bayer letter (HYG's three-letter abbreviation) or a Flamsteed number, in a constellation. */
export interface RouteStar {
  label: string;
  bayer?: string;
  flamsteed?: number;
  con: string;
}

export interface FinderReferenceHop {
  /** Catalogue id of the target (`M31`). */
  id: string;
  /** The fixed instant, UTC. */
  time: string;
  /** Representative Bortle class of the band the hop is checked at: 3, 5 or 8. */
  bortle: 3 | 5 | 8;
  /** Why this band: which published start star its limit admits, and why it is then the nearest qualifying one. */
  bandReason: string;
  /** The stars the guide names as the way: start and hop stars. The engine's start must be one of them. */
  routeStars: readonly RouteStar[];
  source: { title: string; url: string; quote: string };
}

export const FINDER_REFERENCE_SOURCES = {
  WIKI_M13: "https://en.wikipedia.org/wiki/Messier_13",
  WIKI_M57: "https://en.wikipedia.org/wiki/Ring_Nebula",
  WIKI_M81: "https://en.wikipedia.org/wiki/Messier_81",
  WIKI_M82: "https://en.wikipedia.org/wiki/Messier_82",
  WIKI_M27: "https://en.wikipedia.org/wiki/Dumbbell_Nebula",
  EARTHSKY_MIRACH: "https://earthsky.org/brightest-stars/mirach-guide-star-to-three-galaxies",
  ASTRONOMY_M92: "https://www.astronomy.com/observing/the-sky-today-monday-june-9-2025/",
} as const;

const MIRACH: RouteStar = { label: "Mirach (β And)", bayer: "Bet", con: "And" };
const MU_AND: RouteStar = { label: "μ And", bayer: "Mu", con: "And" };
const NU_AND: RouteStar = { label: "ν And", bayer: "Nu", con: "And" };
const ETA_HER: RouteStar = { label: "η Her", bayer: "Eta", con: "Her" };
const ZETA_HER: RouteStar = { label: "ζ Her", bayer: "Zet", con: "Her" };
const PI_HER: RouteStar = { label: "π Her", bayer: "Pi", con: "Her" };
const BETA_LYR: RouteStar = { label: "β Lyr", bayer: "Bet", con: "Lyr" };
const GAMMA_LYR: RouteStar = { label: "γ Lyr", bayer: "Gam", con: "Lyr" };
const DUBHE: RouteStar = { label: "Dubhe (α UMa)", bayer: "Alp", con: "UMa" };
const UMA_24: RouteStar = { label: "24 UMa", flamsteed: 24, con: "UMa" };
const GAMMA_SGE: RouteStar = { label: "γ Sge", bayer: "Gam", con: "Sge" };

export const FINDER_REFERENCE: readonly FinderReferenceHop[] = [
  {
    id: "M31",
    time: "2026-10-15T19:30:00Z",
    bortle: 5,
    bandReason:
      "Limit 3.5 admits Mirach (2.1) and excludes ν And (4.5) and μ And (3.9), so Mirach, the published start, is the nearest qualifying star. At limit 4.5 the engine starts from ν And, 1.3° from M31, which is also a route star.",
    routeStars: [MIRACH, MU_AND, NU_AND],
    source: {
      title: "Mirach: a guide star to three galaxies (EarthSky)",
      url: FINDER_REFERENCE_SOURCES.EARTHSKY_MIRACH,
      quote:
        "Draw an imaginary line from Mirach through Mu, going twice the Mirach/Mu distance; Nu Andromedae, with Mu, forms the end of a line leading from Mirach toward the galaxy. Other guides name Mu and Nu as the two fainter stars to pass; the sources differ on the exact spacing.",
    },
  },
  {
    id: "M13",
    time: "2026-05-15T22:00:00Z",
    bortle: 3,
    bandReason:
      "Limit 4.5 admits η Her (3.5), 2.5° from M13, the nearest qualifying star; no brighter star is nearer. The route stars are the Keystone's two western stars, so any start in the pair is the published one.",
    routeStars: [ETA_HER, ZETA_HER],
    source: {
      title: "Messier 13 (Wikipedia)",
      url: FINDER_REFERENCE_SOURCES.WIKI_M13,
      quote: "M13 can be seen in this asterism 2/3 of the way north (by west) from Zeta to Eta Herculis.",
    },
  },
  {
    id: "M57",
    time: "2026-08-15T19:00:00Z",
    bortle: 3,
    bandReason:
      "Limit 4.5 admits β Lyr (Sheliak, 3.5), 0.8° from M57, the nearest qualifying star; the published route is the β-γ Lyrae line, so the start is a route star.",
    routeStars: [BETA_LYR, GAMMA_LYR],
    source: {
      title: "Ring Nebula (Wikipedia)",
      url: FINDER_REFERENCE_SOURCES.WIKI_M57,
      quote: "The nebula lies about 40% of the distance from Beta (β) to Gamma (γ) Lyrae.",
    },
  },
  {
    id: "M81",
    time: "2026-03-15T19:00:00Z",
    bortle: 5,
    bandReason:
      "Limit 3.5 excludes 24 UMa (4.5), the nearest star of the Dubhe route, so Dubhe, the published start, is the nearest qualifying star at 10.1° (the source says about 10°). At limit 4.5 the engine starts from 24 UMa, 2° from M81, which is a route star too.",
    routeStars: [DUBHE, UMA_24],
    source: {
      title: "Messier 81 (Wikipedia)",
      url: FINDER_REFERENCE_SOURCES.WIKI_M81,
      quote: "The galaxy is to be found approximately 10° northwest of Alpha Ursae Majoris (Dubhe).",
    },
  },
  {
    id: "M82",
    time: "2026-03-15T19:00:00Z",
    bortle: 5,
    bandReason:
      "Same band and start as M81, for the same reason: M82 lies about 3/4° from M81, so the Dubhe route is the same hop (Bode, quoted by the M82 page). No source gives M82's route from Dubhe in its own words.",
    routeStars: [DUBHE, UMA_24],
    source: {
      title: "Messier 82 (Wikipedia), with Messier 81 (Wikipedia)",
      url: FINDER_REFERENCE_SOURCES.WIKI_M82,
      quote:
        "Bode noted M81 and M82 as about 3/4 degree away from the other; M81 is approximately 10° northwest of Dubhe.",
    },
  },
  {
    id: "M27",
    time: "2026-09-01T19:30:00Z",
    bortle: 3,
    bandReason: "Limit 4.5 admits γ Sge (3.5), 3.2° from M27, the nearest qualifying star; it is the published start.",
    routeStars: [GAMMA_SGE],
    source: {
      title: "Dumbbell Nebula (Wikipedia)",
      url: FINDER_REFERENCE_SOURCES.WIKI_M27,
      quote: "Located in the sky a few degrees north of γ Sagittae, near the star 14 Vulpeculae.",
    },
  },
  {
    id: "M92",
    time: "2026-05-15T22:00:00Z",
    bortle: 5,
    bandReason:
      "Limit 3.5 excludes ι Her (3.8), 4.9° from M92 and not on the π/η route, so π Her (3.2), the published start, is the nearest qualifying star at 6.3° (the source says about 6°). At limit 4.5 the engine starts from ι Her, which is no route star, so that band does not reconcile; at 2.5 it starts from Eltanin.",
    routeStars: [PI_HER, ETA_HER],
    source: {
      title: "The Sky Today: Hercules' other globular (Astronomy.com)",
      url: FINDER_REFERENCE_SOURCES.ASTRONOMY_M92,
      quote:
        "M92 is about 6.3° north of magnitude 3.2 π Herculis; it forms a triangle with the Keystone's two northernmost stars, η and π Herculis.",
    },
  },
];

/**
 * References no starting-limit band reconciles, each with the route the engine computes at its nearest band. Never
 * forced into agreement.
 */
export const KNOWN_DIVERGENCES: readonly { id: string; reason: string; computed: string }[] = [];
