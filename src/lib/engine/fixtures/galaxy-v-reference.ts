/**
 * TEST-ONLY. Independently published visual (V) magnitudes of six Messier galaxies, the oracle for
 * `src/lib/catalogue/galaxy-colour.test.ts` (openngc-galaxy-magnitudes, GitHub #178). Not exported from
 * `fixtures/index.ts` and never shipped: no page, island or generator reads it.
 *
 * Each value is a published fact typed by hand with the page it was read from, not a copy of a table. The
 * catalogue's own V for these galaxies is HyperLEDA's `vt`, which OpenNGC ships with an uncertainty of 1 to 1.6 mag;
 * these values come from sources that do not depend on it.
 *
 * Read on 2026-10-19 (see the change's `research.md`, section 4). The requests carried no personal data. A failing
 * entry is a finding about the catalogue, never a value to edit here.
 */

export interface PublishedVSource {
  title: string;
  publisher: string;
  url: string;
  /** The day the page was read. */
  accessed: string;
}

export interface PublishedV {
  /** Catalogue id of the galaxy (`M58`). */
  id: string;
  /** The V magnitude the sources publish. */
  publishedV: number;
  sources: readonly PublishedVSource[];
  /** What is thin about this entry, when something is. */
  note?: string;
}

/**
 * How far the catalogue's V may sit from a published V before the oracle names the galaxy. 0.3 mag is above the
 * largest gap the colour rule is expected to leave (0.17 mag, M88 at 9.43 against 9.6) and below the smallest error the
 * catalogue had before the correction (0.55 mag, M61 at 10.25 against 9.7).
 */
export const PUBLISHED_V_TOLERANCE_MAG = 0.3;

const ACCESSED = "2026-10-19";

function seds(messier: number, title: string): PublishedVSource {
  const padded = String(messier).padStart(3, "0");
  return {
    title,
    publisher: "SEDS",
    url: `https://messier.seds.org/m/m${padded}.html`,
    accessed: ACCESSED,
  };
}

function simbad(ident: string, title: string): PublishedVSource {
  return {
    title,
    publisher: "CDS, Strasbourg",
    url: `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${ident}`,
    accessed: ACCESSED,
  };
}

export const PUBLISHED_V: readonly PublishedV[] = [
  {
    id: "M58",
    publishedV: 9.7,
    sources: [seds(58, "Messier 58"), simbad("M58", "M 58 (SIMBAD, Flux V 9.66)")],
  },
  {
    id: "M61",
    publishedV: 9.7,
    sources: [seds(61, "Messier 61"), simbad("M61", "M 61 (SIMBAD, Flux V 9.65)")],
  },
  {
    id: "M88",
    publishedV: 9.6,
    sources: [seds(88, "Messier 88")],
    note: "One usable source. SIMBAD's V and B pair for M88 comes from a source 3 to 4 mag too faint and was discarded.",
  },
  {
    id: "M91",
    publishedV: 10.2,
    sources: [seds(91, "Messier 91")],
    note: "One usable source. SIMBAD's V and B pair for M91 comes from a source 3 to 4 mag too faint and was discarded.",
  },
  {
    id: "M98",
    publishedV: 10.1,
    sources: [seds(98, "Messier 98"), simbad("M98", "M 98 (SIMBAD, Flux V 10.14)")],
  },
  {
    id: "M106",
    publishedV: 8.4,
    sources: [seds(106, "Messier 106"), simbad("M106", "M 106 (SIMBAD, Flux V 8.41)")],
  },
];
