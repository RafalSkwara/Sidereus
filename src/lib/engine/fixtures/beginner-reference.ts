/**
 * TEST-ONLY. The published beginner reference for the calibration oracle
 * (`src/lib/engine/calibration.test.ts`, Risk #4 of `context/foundation/test-plan.md`).
 *
 * Counting rule, fixed before any comparison with the engine's rankings: an object counts for a night
 * when at least 2 of the sources below name it as a beginner target for that season. The lists were read
 * from the pages through WebFetch summaries on 2026-10-08 by a worker that never saw the engine's output.
 * Never edit a list to make a ranking pass: a change needs a dated note in `fixtures/README.md` with the
 * new sources. Ids use the catalogue form (`M31`, `NGC869`, `NGC7000`).
 */

export interface BeginnerSource {
  title: string;
  publisher: string;
  /** One page, or several when the source is a multi-part article. */
  urls: readonly [string, ...string[]];
  /** The day the page was read. */
  accessed: string;
}

export const BEGINNER_SOURCES = {
  AW: {
    title: "See winter's best Messier objects",
    publisher: "Astronomy.com",
    urls: ["https://www.astronomy.com/observing/see-winters-best-messier-objects/"],
    accessed: "2026-10-08",
  },
  AS: {
    title: "Observe spring's best Messier objects",
    publisher: "Astronomy.com",
    urls: ["https://www.astronomy.com/observing/observe-springs-best-messier-objects/"],
    accessed: "2026-10-08",
  },
  ASU: {
    title: "Run a mini Messier marathon this summer",
    publisher: "Astronomy.com",
    urls: ["https://astronomy.com/observing/run-a-mini-messier-marathon-this-summer"],
    accessed: "2026-10-08",
  },
  AF: {
    title: "See fall's best Messier objects",
    publisher: "Astronomy.com",
    urls: ["https://www.astronomy.com/observing/see-falls-best-messier-objects/"],
    accessed: "2026-10-08",
  },
  TS: {
    title: "Beginner Deep Sky Objects by Season",
    publisher: "Telescope School",
    urls: ["https://telescopeschool.com/beginner-deep-sky-objects-by-season-your-guide-to-easy-stargazing-targets/"],
    accessed: "2026-10-08",
  },
  LNS: {
    title: "Deep Space Objects for Beginners, parts 1 and 2",
    publisher: "Love the Night Sky",
    urls: [
      "https://lovethenightsky.com/best-deep-space-objects-pt-1/",
      "https://lovethenightsky.com/best-deep-space-objects-pt-2/",
    ],
    accessed: "2026-10-08",
  },
  TA: {
    title: "Best Messier Objects for Beginners",
    publisher: "Telescope Advisor",
    urls: ["https://www.telescopeadvisor.com/best-messier-objects-for-beginners/"],
    accessed: "2026-10-08",
  },
  SZ: {
    title: "Best beginners objects",
    publisher: "Starizona",
    urls: ["https://starizona.com/blogs/tutorials/best-beginners-objects"],
    accessed: "2026-10-08",
  },
  TW: {
    title: "Top deep-sky objects for beginners",
    publisher: "Telescopic Watch",
    urls: ["https://telescopicwatch.com/top-deep-sky-objects-for-beginners/"],
    accessed: "2026-10-08",
  },
} as const satisfies Record<string, BeginnerSource>;

export type SourceKey = keyof typeof BEGINNER_SOURCES;

export interface BeginnerReferenceEntry {
  id: string;
  /** The sources that name the object for that season (at least 2). */
  sources: readonly SourceKey[];
}

export type ReferenceNight = "2026-01-15" | "2026-04-15" | "2026-07-15" | "2026-10-15";

export const BEGINNER_REFERENCE: Readonly<Record<ReferenceNight, readonly BeginnerReferenceEntry[]>> = {
  "2026-01-15": [
    { id: "M42", sources: ["TA", "TS", "LNS", "SZ", "TW", "AS"] },
    { id: "M45", sources: ["TA", "TS", "LNS", "SZ", "TW"] },
    { id: "M35", sources: ["TA", "TS", "SZ", "AS"] },
    { id: "NGC869", sources: ["TS", "TW", "LNS", "SZ"] },
    { id: "M31", sources: ["TA", "TW"] },
    { id: "M36", sources: ["SZ", "AS"] },
    { id: "M37", sources: ["SZ", "AS"] },
    { id: "M41", sources: ["SZ", "AS"] },
  ],
  "2026-04-15": [
    { id: "M44", sources: ["TA", "TW", "TS", "SZ", "AS"] },
    { id: "M51", sources: ["TA", "TS", "LNS", "AS"] },
    { id: "M81", sources: ["TW", "TS", "AS"] },
    { id: "M82", sources: ["TW", "TS", "AS"] },
    { id: "M3", sources: ["SZ", "TW", "AS"] },
    { id: "M65", sources: ["TS", "LNS", "AW"] },
    { id: "M66", sources: ["TS", "LNS", "AW"] },
    { id: "M13", sources: ["TS", "AS"] },
    { id: "M104", sources: ["TS", "AS"] },
    { id: "M97", sources: ["TS", "AS"] },
    { id: "M67", sources: ["TS", "AS"] },
    { id: "M96", sources: ["LNS", "AW"] },
    { id: "M105", sources: ["LNS", "AW"] },
    { id: "M87", sources: ["TS", "AW"] },
    { id: "M84", sources: ["TS", "AW"] },
    { id: "M86", sources: ["TS", "AW"] },
    { id: "M49", sources: ["TS", "AW"] },
    { id: "M35", sources: ["TA", "AS"] },
    // 2026-10-09 spot-check: TA gives M42 "Nov–Mar", so TA no longer counts for April (README).
    { id: "M42", sources: ["TW", "AS"] },
    { id: "M45", sources: ["TA", "TW"] },
  ],
  "2026-07-15": [
    { id: "M8", sources: ["TA", "TW", "SZ", "TS", "ASU", "LNS"] },
    { id: "M27", sources: ["TA", "TW", "TS", "ASU", "LNS"] },
    { id: "M57", sources: ["TA", "TW", "SZ", "ASU", "LNS"] },
    { id: "M13", sources: ["TA", "TW", "SZ", "ASU"] },
    { id: "M11", sources: ["SZ", "TW", "ASU"] },
    { id: "M17", sources: ["SZ", "ASU", "TW", "LNS"] },
    { id: "M20", sources: ["LNS", "ASU", "TW"] },
    { id: "M16", sources: ["TS", "ASU"] },
    { id: "M7", sources: ["SZ", "ASU"] },
    { id: "M6", sources: ["SZ", "ASU"] },
    { id: "M22", sources: ["ASU", "TW"] },
    { id: "M4", sources: ["LNS", "TW"] },
    { id: "NGC7000", sources: ["TS", "LNS"] },
    { id: "M2", sources: ["SZ", "ASU"] },
    { id: "M15", sources: ["SZ", "ASU"] },
    { id: "M21", sources: ["LNS", "AF"] },
    { id: "M24", sources: ["ASU", "AF"] },
    { id: "M29", sources: ["ASU", "AF"] },
    { id: "M39", sources: ["ASU", "AF"] },
    { id: "M73", sources: ["ASU", "AF"] },
  ],
  "2026-10-15": [
    { id: "M31", sources: ["TA", "TW", "TS", "LNS", "SZ", "AF"] },
    { id: "NGC869", sources: ["TS", "TW", "SZ", "LNS"] },
    { id: "M45", sources: ["TA", "TW", "AF"] },
    { id: "M32", sources: ["TS", "AF"] },
    { id: "M13", sources: ["TA", "TW", "TS"] },
    { id: "M57", sources: ["TA", "TW"] },
    { id: "M27", sources: ["TA", "TW"] },
    { id: "M15", sources: ["SZ", "ASU"] },
    { id: "M2", sources: ["SZ", "ASU"] },
    { id: "M29", sources: ["AF", "ASU"] },
    { id: "M39", sources: ["AF", "ASU"] },
    { id: "M73", sources: ["AF", "ASU"] },
    { id: "M72", sources: ["AF", "ASU"] },
    { id: "M24", sources: ["AF", "ASU"] },
    { id: "M18", sources: ["AF", "ASU"] },
    { id: "M28", sources: ["AF", "ASU"] },
    { id: "M69", sources: ["AF", "ASU"] },
    { id: "M14", sources: ["AF", "ASU"] },
    { id: "M21", sources: ["AF", "LNS"] },
  ],
};

/** The 20 Messier objects of source AF ("See fall's best Messier objects"), in the article's catalogue form. */
export const AF_FALL_LIST: readonly string[] = [
  "M14",
  "M21",
  "M24",
  "M18",
  "M28",
  "M69",
  "M29",
  "M72",
  "M73",
  "M39",
  "M52",
  "M31",
  "M32",
  "M103",
  "M33",
  "M74",
  "M76",
  "M34",
  "M77",
  "M45",
];
