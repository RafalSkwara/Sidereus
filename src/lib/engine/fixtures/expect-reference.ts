import type { ExpectationKey } from "../expectation";

/**
 * TEST-ONLY. Published small-telescope descriptions for the "what to expect" rule's reference test
 * (`expectation.test.ts`, what-to-expect D-6, roadmap Open Roadmap Question 1: calibration without an observer).
 *
 * Each entry fixes one object at one setting (the telescope's aperture, the site's Bortle class) and the phrase key
 * that at least two published sources support for what an observer sees there. The settings are 150 mm (a 6-inch)
 * under Bortle 4 unless the entry says otherwise. `showcase` entries are the objects a beginner is pointed at;
 * `hard` entries are the cases the plan review found the first-drafted rule gets wrong (faint globulars at large
 * apertures, large low-surface-brightness planetaries, a bright nebula under a city sky, a huge faint nebula, a
 * small galaxy near the limit, a large galaxy under a city sky).
 *
 * How it was built, in this order: (1) the sources for every entry were read and each `expected` key was decided
 * from what they describe at that aperture and sky, before the rule's output was looked at; (2) the starting rule
 * was compared with them; (3) each mismatch was either fixed with one of the rule changes the plan permits
 * (D-2 a-e, each with its own `EXPECT_*` parameter in `parameters.ts`, each justified by an entry here) or listed in
 * `KNOWN_DIVERGENCES` with the key the rule computes and why; (4) the rule's invariants were re-run.
 *
 * Never edit an `expected` to make a test pass: a failing reference is an engine finding. The one exception to
 * "decided before looking": NGC 7662's catalogue size (0.28 arcminute) was seen when its entry was written, and
 * the sources are split on it (see its note).
 *
 * Sources were read on 2026-10-14 through WebFetch/WebSearch summaries, the same way as `finder-reference.ts`.
 * Pages that refused the fetch (HTTP 403: Sky & Telescope, Stargazers Lounge) are cited from the WebSearch summary
 * alone, and the entry says so. Requests carried no personal data.
 */

export interface ExpectSource {
  title: string;
  publisher: string;
  url: string;
  /** The day the page was read. */
  accessed: string;
}

export interface ExpectReference {
  /** Catalogue id of the object (`M13`). */
  id: string;
  apertureMm: number;
  bortle: number;
  kind: "showcase" | "hard";
  /** The key at least two sources support at this setting. */
  expected: ExpectationKey;
  sources: readonly ExpectSource[];
  /** What the sources say, and how it maps to the key. */
  note: string;
}

export interface ExpectDivergence extends ExpectReference {
  /** The key the rule computes today. */
  computed: ExpectationKey;
  /** Why the rule is not changed to agree: which permitted change does not reach it, or the sources disagree. */
  reason: string;
}

const ACCESSED = "2026-10-14";

function source(title: string, publisher: string, url: string): ExpectSource {
  return { title, publisher, url, accessed: ACCESSED };
}

const SRC = {
  STARLUST_M13: source("M13 Globular Cluster", "Starlust", "https://starlust.org/m13-globular-cluster/"),
  ASTRONOMY_BIG_BOY: source(
    "Glenn Chaple's observing basics: Bust out the big boy",
    "Astronomy magazine",
    "https://www.astronomy.com/observing/glenn-chaples-observing-basics-bust-out-the-big-boy/",
  ),
  TELESCOPE_ADVISOR_LIGHT_POLLUTION: source(
    "Can a Telescope Overcome Light Pollution?",
    "Telescope Advisor",
    "https://www.telescopeadvisor.com/does-light-pollution-ruin-telescope-viewing/",
  ),
  SKYHOUND_M3: source("M3", "Skyhound", "https://observing.skyhound.com/archives/may/M__3.html"),
  TELESCOPE_ADVISOR_M3: source(
    "How to See Globular Cluster M3 Through a Telescope: Complete Observing Guide",
    "Telescope Advisor",
    "https://www.telescopeadvisor.com/m3-globular-cluster-telescope-guide/",
  ),
  ASTRONOMY_RING: source(
    "Michael's Miscellany: Observe the Ring Nebula",
    "Astronomy magazine",
    "https://www.astronomy.com/observing/michaels-miscellany-observe-the-ring-nebula/",
  ),
  SKYHOUND_M57: source("The Ring Nebula (M57)", "Skyhound", "https://observing.skyhound.com/archives/jul/M_57.html"),
  ASTRONOMY_NOW_M27: source(
    "Observe the dramatic Dumbbell Nebula",
    "Astronomy Now",
    "https://astronomynow.com/2022/07/25/observe-the-dramatic-dumbbell-nebula/",
  ),
  ASTRONOMY_DUMBBELL: source(
    "Glenn Chaple's observing basics: A dumbell for you",
    "Astronomy magazine",
    "https://astronomy.com/observing/glenn-chaples-observing-basics-a-dumbell-for-you",
  ),
  SKYHOUND_SNOWBALL: source(
    "Observing at Skyhound: The Blue Snowball (NGC 7662)",
    "Skyhound",
    "https://observing.skyhound.com/archives/oct/NGC_7662.html",
  ),
  ASTRONOMY_SNOWBALL: source(
    "Michael's Miscellany: Observe the Blue Snowball",
    "Astronomy magazine",
    "https://www.astronomy.com/observing/michaels-miscellany-observe-the-blue-snowball/",
  ),
  ASTROPIX_SNOWBALL: source(
    "NGC 7662 (Astronomer's Guide to Deep Sky Objects)",
    "astropix.com",
    "https://astropix.com/books/AGDS/1_FALL/NGC7662.HTM",
  ),
  STARLUST_ANDROMEDA: source("Galaxies in Andromeda", "Starlust", "https://starlust.org/galaxies-in-andromeda"),
  ASTRONOMY_ANDROMEDA: source(
    "Michael's Miscellany: Observe the Andromeda Galaxy",
    "Astronomy magazine",
    "https://www.astronomy.com/observing/michaels-miscellany-observe-the-andromeda-galaxy/",
  ),
  ASTRONOMY_NOW_M33: source(
    "Observe majestic Messier 33: A Local Group heavyweight",
    "Astronomy Now",
    "https://astronomynow.com/2022/10/12/observe-majestic-messier-33-a-local-group-heavyweight/",
  ),
  SKY_TELESCOPE_BORTLE: source(
    "The Bortle Dark-Sky Scale",
    "Sky & Telescope",
    "https://skyandtelescope.org/astronomy-resources/the-bortle-dark-sky-scale/",
  ),
  SKYHOUND_M51: source("The Whirlpool (M51)", "Skyhound", "https://observing.skyhound.com/archives/may/M_51.html"),
  ASTRONOMY_WHIRLPOOL: source(
    "The Sky Today on Sunday, June 15: View the Whirlpool and its companion",
    "Astronomy magazine",
    "https://www.astronomy.com/observing/the-sky-today-sunday-june-15-2025/",
  ),
  TELESCOPE_ADVISOR_M81: source(
    "How to See Bode's Galaxy (M81) and the Cigar Galaxy (M82) Through a Telescope",
    "Telescope Advisor",
    "https://www.telescopeadvisor.com/bodes-galaxy-m81-m82-telescope-guide/",
  ),
  MESSIER_OBJECTS_M81: source(
    "Messier 81: Bode's Galaxy",
    "Messier Objects",
    "https://www.messier-objects.com/messier-81/",
  ),
  ASTRONOMY_M101: source(
    "101 Must-See Cosmic Objects: M101",
    "Astronomy magazine",
    "https://www.astronomy.com/observing/101-must-see-cosmic-objects-m101/",
  ),
  DEEP_SKY_CORNER_M101: source(
    "Pinwheel Galaxy (Messier 101)",
    "Deep Sky Corner",
    "https://www.deepskycorner.ch/obj/m101.en.php",
  ),
  BINOSKY_M42: source(
    "M42 in BinoSky",
    "BinoSky (Benjamin Crowell)",
    "https://www.lightandmatter.com/binosky/m42.html",
  ),
  STARGAZERS_LOUNGE_M42: source(
    "M42 - The Orion Nebula - through my ST80",
    "Stargazers Lounge",
    "https://stargazerslounge.com/blogs/entry/1026-m42-the-orion-nebula-through-my-st80/",
  ),
  TELESCOPE_ADVISOR_PLEIADES: source(
    "Pleiades Star Cluster (M45) in 2026: How to Find and Observe",
    "Telescope Advisor",
    "https://www.telescopeadvisor.com/pleiades-star-cluster/",
  ),
  COSMOS_SAFARI_M45: source(
    "How to Find M45 The Pleiades Open Cluster in your Telescope or Binoculars",
    "Cosmos Safari",
    "https://www.cosmossafari.com/post/how-to-find-m45-the-pleiades-open-cluster-in-your-telescope-or-binoculars",
  ),
  SKYHOUND_M11: source(
    "The Wild Duck Cluster -- M11",
    "Skyhound",
    "https://observing.skyhound.com/archives/jul/M_11.html",
  ),
  ASTRONOMY_WILD_DUCK: source(
    "Michael's Miscellany: Observe the Wild Duck Cluster",
    "Astronomy magazine",
    "https://www.astronomy.com/?p=165920",
  ),
  MESSIER_OBJECTS_M56: source("Messier 56", "Messier Objects", "https://messier-objects.com/messier-56"),
  WIKIPEDIA_M56: source("Messier 56", "Wikipedia", "https://en.wikipedia.org/wiki/Messier_56"),
  SKY_TELESCOPE_M56: source(
    "The Overlooked Masterpiece of M56",
    "Sky & Telescope",
    "https://skyandtelescope.org/stargazing-and-observing/night-at-the-celestial-museum/",
  ),
  SKYHOUND_HELIX: source(
    "Observing at Skyhound: The Helix Nebula",
    "Skyhound",
    "https://observing.skyhound.com/archives/sep/NGC_7293.html",
  ),
  ASTRONOMY_HELIX: source(
    "Michael's Miscellany: Observe the Helix Nebula",
    "Astronomy magazine",
    "https://www.astronomy.com/observing/michaels-miscellany-observe-the-helix-nebula",
  ),
  STARLUST_OWL: source("Owl Nebula", "Starlust", "https://starlust.org/owl-nebula"),
  SKYHOUND_OWL: source("The Owl (M97)", "Skyhound", "https://observing.skyhound.com/archives/apr/M_97.html"),
  CRAYFORD_C20: source(
    "Caldwell 20, C20, The North America Nebula",
    "Crayford Manor House Astronomical Society",
    "https://crayfordmanorastro.com/2018/08/19/caldwell-20-c20-ngc7000/",
  ),
  WIKIPEDIA_NGC7000: source("North America Nebula", "Wikipedia", "https://en.wikipedia.org/wiki/North_America_Nebula"),
  SKY_TELESCOPE_NGC7000: source(
    "Sky & Telescope, September 2022 (observing column)",
    "Sky & Telescope",
    "https://nxtbook.com/nxtbooks/aas/st_202209/index.php?startid=58",
  ),
  FREE_STAR_CHARTS_NGC4889: source(
    "NGC 4889 - Elliptical Galaxy",
    "freestarcharts.com",
    "https://freestarcharts.com/ngc-4889",
  ),
  SKY_TELESCOPE_NGC4889: source(
    "Sky and Telescope, May 2018 (Coma Cluster observing column)",
    "Sky & Telescope",
    "https://www.nxtbook.com/nxtbooks/aas/st_201805/index.php?startid=58",
  ),
  DEEP_SKY_WATCH_COMA: source(
    "Coma Cluster of Galaxies (Abell 1656)",
    "Deep Sky Watch (Michael Vlasov)",
    "http://www.deepskywatch.com/Astrosketches/coma-cluster-sketch.html",
  ),
} as const;

export const EXPECT_REFERENCES: readonly ExpectReference[] = [
  {
    id: "M13",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "globularResolved",
    sources: [SRC.STARLUST_M13, SRC.ASTRONOMY_BIG_BOY, SRC.TELESCOPE_ADVISOR_LIGHT_POLLUTION],
    note: "Starlust: a 4.5-inch starts to show stars at the edge as individual points and with a 6-inch their images are strong and steady, while resolving the bright core is nearly impossible. Astronomy: a 3-4 inch might resolve the outer parts, and a 6-inch is the least to appreciate it. Telescope Advisor: compact enough to punch through moderate light pollution.",
  },
  {
    id: "M3",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "globularResolved",
    sources: [SRC.SKYHOUND_M3, SRC.TELESCOPE_ADVISOR_M3],
    note: "Skyhound: a 6-inch will reveal many hundreds of individual stars. Telescope Advisor: a 150 mm at 100-150x resolves hundreds of stars across the face, almost to the centre, around a bright compressed core.",
  },
  {
    id: "M57",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "planetaryDisc",
    sources: [SRC.ASTRONOMY_RING, SRC.SKYHOUND_M57],
    note: "Skyhound: a 6-inch will reveal the famous smoke ring structure. Astronomy: at 100x or more the outer part looks thicker than the centre, which makes the ring.",
  },
  {
    id: "M27",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "planetaryDisc",
    sources: [SRC.ASTRONOMY_NOW_M27, SRC.ASTRONOMY_DUMBBELL],
    note: "Astronomy Now: the lobes become apparent in a 150 mm and many rate it one of the easiest planetaries. Astronomy: the brightest and easiest of all planetary nebulae, a rectangle with rounded edges in small telescopes. The nearest of the three planetary phrases is the disc, although the Dumbbell is not small (8 arcminutes): a Phase 2 wording note.",
  },
  {
    id: "NGC7662",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "planetaryStarLike",
    sources: [SRC.ASTROPIX_SNOWBALL, SRC.SKYHOUND_SNOWBALL, SRC.ASTRONOMY_SNOWBALL],
    note: "Sources split: astropix says it appears star-like at low magnification with a blue-green colour (32 x 28 arcseconds); Skyhound's 6-inch sketch at 50x says 'note how small it is' and calls it non-stellar even at low power; Astronomy: a small, evenly lit disc in an 8-inch. Taken as a tiny object that is star-like at low power and a small disc at high power, which is what the star-like phrase says.",
  },
  {
    id: "M31",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "galaxyBright",
    sources: [SRC.STARLUST_ANDROMEDA, SRC.ASTRONOMY_ANDROMEDA, SRC.TELESCOPE_ADVISOR_LIGHT_POLLUTION],
    note: "Starlust: an elongated patch that brightens gradually to a nearly star-like nucleus, seen with a wide-field eyepiece. Astronomy: low power shows the nucleus and dust lanes. Telescope Advisor: bright galaxies like M31 are only detectable-but-faint from Bortle 5-6, so Bortle 4 is where it is easy.",
  },
  {
    id: "M33",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "galaxySmudge",
    sources: [SRC.ASTRONOMY_NOW_M33, SRC.SKY_TELESCOPE_BORTLE],
    note: "Astronomy Now: with a dark-adapted eye a 100-150 mm shows it S-shaped on a transparent moonless night away from light pollution. Sky & Telescope's Bortle scale (WebSearch summary only; the page refused the fetch): under a class 4 sky it is a difficult averted-vision object, and detectable only above 50 degrees.",
  },
  {
    id: "M33",
    apertureMm: 150,
    bortle: 7,
    kind: "showcase",
    expected: "galaxyLimit",
    sources: [SRC.ASTRONOMY_NOW_M33, SRC.SKY_TELESCOPE_BORTLE],
    note: "Astronomy Now: under an urban or even a suburban sky it lacks contrast and melts into the sky background (low surface brightness). Sky & Telescope (WebSearch summary only): a dark-adapted observer needs class 4 or better to spot it by eye, and it is a difficult averted-vision object even at class 4.",
  },
  {
    id: "M51",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "galaxySmudge",
    sources: [SRC.SKYHOUND_M51, SRC.ASTRONOMY_WHIRLPOOL],
    note: "Skyhound: in 6-inch or smaller scopes a large, round, hazy spot with a large, slightly brighter centre and a smaller hazy spot (NGC 5195) nearly touching it; the arms need more than 8 inches. Astronomy: any small scope shows a circular glow that brightens toward the centre. Permitted change D-2 (d) (`EXPECT_BRIGHT_GALAXY_MARGIN_MAG`) is justified by this entry together with M81.",
  },
  {
    id: "M81",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "galaxyBright",
    sources: [SRC.TELESCOPE_ADVISOR_M81, SRC.MESSIER_OBJECTS_M81],
    note: "Telescope Advisor: a 150 mm at 60-80x shows a large bright oval with a sharply defined core. Messier Objects: 6-inch telescopes reveal the bright core surrounded by a faint halo.",
  },
  {
    id: "M101",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "galaxySmudge",
    sources: [SRC.ASTRONOMY_M101, SRC.DEEP_SKY_CORNER_M101],
    note: "Astronomy: the core is relatively easy in small scopes but the galaxy has a low surface brightness and the arms need dark, transparent skies. Deep Sky Corner: the brighter core can already be seen in small instruments; the fine arms need extremely good conditions and larger scopes.",
  },
  {
    id: "M101",
    apertureMm: 150,
    bortle: 7,
    kind: "showcase",
    expected: "galaxyLimit",
    sources: [SRC.ASTRONOMY_M101, SRC.TELESCOPE_ADVISOR_LIGHT_POLLUTION],
    note: "Telescope Advisor: faint galaxies such as M101 and M51 need Bortle 4 or better, and even the bright galaxies M31 and M81 are 'very difficult' at Bortle 7-8. Astronomy: it should be easy in small instruments, 'however, that is not the case' (low surface brightness; light pollution is a major problem).",
  },
  {
    id: "M42",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "clusterNebulaBright",
    sources: [SRC.BINOSKY_M42, SRC.STARGAZERS_LOUNGE_M42, SRC.TELESCOPE_ADVISOR_LIGHT_POLLUTION],
    note: "BinoSky: a nebulosity about 15 arcminutes across around the middle star even under urban skies. Stargazers Lounge (WebSearch summary only): an 80 mm refractor under streetlights shows three stars at the centre and the nebula's classic bird shape. Telescope Advisor: stunning through a telescope even from city centres.",
  },
  {
    id: "M45",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "openClusterWide",
    sources: [SRC.TELESCOPE_ADVISOR_PLEIADES, SRC.COSMOS_SAFARI_M45],
    note: "Telescope Advisor: wider than many people expect; start around 20-40x so the cluster fits the field. Cosmos Safari: significantly bigger than the field of view of a long-focal-length telescope; short focal lengths work best.",
  },
  {
    id: "M11",
    apertureMm: 150,
    bortle: 4,
    kind: "showcase",
    expected: "openClusterCompact",
    sources: [SRC.SKYHOUND_M11, SRC.ASTRONOMY_WILD_DUCK],
    note: "Skyhound: many stars brighter than 11th magnitude make a terrific view in even a 6-inch; the first stars to resolve form a triangle. Astronomy: the core, which resembles a poor globular cluster, is tightly packed.",
  },
  {
    id: "M42",
    apertureMm: 150,
    bortle: 7,
    kind: "hard",
    expected: "clusterNebulaBright",
    sources: [SRC.BINOSKY_M42, SRC.STARGAZERS_LOUNGE_M42, SRC.TELESCOPE_ADVISOR_LIGHT_POLLUTION],
    note: "The starting rule gave 'clusterNebulaFaint' here (contrast deficit 1.8). Telescope Advisor: visible to the naked eye and stunning through a telescope even from city centres; BinoSky: seen from an urban sky. Fixed by permitted change D-2 (c), scoped to the cluster-with-nebula type (`EXPECT_BRIGHT_NEBULA_MAX_VMAG`), which only M42 passes.",
  },
  {
    id: "M56",
    apertureMm: 200,
    bortle: 4,
    kind: "hard",
    expected: "globularGrainy",
    sources: [SRC.MESSIER_OBJECTS_M56, SRC.WIKIPEDIA_M56, SRC.SKY_TELESCOPE_M56],
    note: "The starting rule gave 'globularGlow' at any aperture. Messier Objects: 4-inch telescopes show a round ball of light and it takes 8 inches or more to resolve it into stars. Wikipedia: it can be resolved with an aperture of 8 inches or larger. Sky & Telescope (WebSearch summary only): an 8-inch at 90x reveals hints of individual stars, and 120x is dim and mushy. At the threshold that is a grainy view, not a resolved one. Fixed by permitted change D-2 (a) (`EXPECT_RESOLVE_MARGIN_MAG`, `EXPECT_GRAINY_MARGIN_MAG`).",
  },
  {
    id: "NGC7293",
    apertureMm: 150,
    bortle: 4,
    kind: "hard",
    expected: "planetaryFaint",
    sources: [SRC.SKYHOUND_HELIX, SRC.ASTRONOMY_HELIX],
    note: "The starting rule gave 'planetaryDisc'. Skyhound: its low surface brightness makes it difficult unless you know what you are looking for; use the lowest power and a field of at least half a degree. Astronomy: its surface brightness is disappointingly low and it spans 25 arcminutes. Fixed by permitted change D-2 (b) (`EXPECT_LARGE_PLANETARY_ARCMIN`, `EXPECT_LARGE_PLANETARY_DISC_BELOW`). The 'faint' phrase says 'moderate power': the Helix wants the lowest (a Phase 2 wording note).",
  },
  {
    id: "M97",
    apertureMm: 150,
    bortle: 4,
    kind: "hard",
    expected: "planetaryFaint",
    sources: [SRC.STARLUST_OWL, SRC.SKYHOUND_OWL],
    note: "The starting rule gave 'planetaryDisc'. Starlust: indistinct even in 6-inch telescopes because of its low surface brightness; the eyes need 8 inches and moderately high power. Skyhound: in small telescopes (under 8 inches) a round hazy patch. Fixed by permitted change D-2 (b).",
  },
  {
    id: "M33",
    apertureMm: 150,
    bortle: 9,
    kind: "hard",
    expected: "galaxyLimit",
    sources: [SRC.ASTRONOMY_NOW_M33, SRC.SKY_TELESCOPE_BORTLE],
    note: "Pins the `limit` band for a ranked object whose deficit is above the washed-out threshold (3.5 mag). Astronomy Now: under an urban sky it melts into the background. Sky & Telescope (WebSearch summary only): class 4 or better is needed by eye, and it is difficult even there.",
  },
];

/**
 * References the rule does not reach, each with the key it computes today and why no permitted change fixes it.
 * Never forced into agreement: they are the owner's to decide (reword, widen the permitted set, or accept).
 */
export const KNOWN_DIVERGENCES: readonly ExpectDivergence[] = [
  {
    id: "NGC7000",
    apertureMm: 150,
    bortle: 4,
    kind: "hard",
    expected: "nebulaFaint",
    sources: [SRC.CRAYFORD_C20, SRC.WIKIPEDIA_NGC7000, SRC.SKY_TELESCOPE_NGC7000],
    note: "Crayford and Wikipedia (one text): its surface brightness is low, and telescopes with a field of about 3 degrees show it only as a foggy patch under sufficiently dark skies. Sky & Telescope (WebSearch summary only): hard to separate from the star cloud around it, more prominent in binoculars than in a telescope. A very faint mist wanting the lowest power: 'nebulaFaint'.",
    computed: "nebulaGlow",
    reason:
      "Permitted change D-2 (e) caps a huge nebula (100 arcminutes or more) at 'nebulaGlow', which moves NGC 7000 from 'nebulaBright'. Reaching 'nebulaFaint' needs the cap to push the band to 'faint', which is a different change from the one the plan permits; the sources also read 'a soft misty glow' ('foggy patch') as a fair description.",
  },
  {
    id: "NGC4889",
    apertureMm: 150,
    bortle: 4,
    kind: "hard",
    expected: "galaxyFaint",
    sources: [SRC.FREE_STAR_CHARTS_NGC4889, SRC.SKY_TELESCOPE_NGC4889, SRC.DEEP_SKY_WATCH_COMA],
    note: "freestarcharts: a 100 mm shows a faint out-of-focus 'star'; it can be glimpsed with a 4-inch refractor. Sky & Telescope (WebSearch summary only): small, faint and round. Deep Sky Watch: easily spotted in a 10-inch, and a larger aperture is wanted for the fainter members of the cluster. A very faint grey smudge wanting averted vision: 'galaxyFaint'.",
    computed: "galaxySmudge",
    reason:
      "Permitted change D-2 (d) stops a galaxy this far from the limit being 'galaxyBright' and it takes 'galaxySmudge'. Taking it to 'galaxyFaint' needs a wider near-limit floor (`EXPECT_NEAR_LIMIT_MAG` 1.0 to about 1.5), which is a retune of a starting value that D-2 does not list among the permitted changes.",
  },
];
