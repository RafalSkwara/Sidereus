/**
 * The gear catalogue's entry shapes (roadmap S-12). Island-safe: types only. The data lives in `telescopes.json` and
 * `eyepieces.json`, entered by hand from manufacturer pages (see `README.md`, `LICENSE-DATA.md`).
 */

export const EYEPIECE_DESIGNS = ["plossl", "kellner", "huygens", "orthoscopic", "other"] as const;

export type EyepieceDesign = (typeof EYEPIECE_DESIGNS)[number];

export interface TelescopeEntry {
  /** Stable kebab slug, e.g. "skywatcher-heritage-130p". */
  id: string;
  brand: string;
  model: string;
  /** What fills the form: the brand, model and numbers only (no descriptive words), at most 60 characters. */
  name: string;
  apertureMm: number;
  /** The effective focal length for catadioptrics. */
  focalLengthMm: number;
  /** Other ways the entry is written (mount variants, a former name). */
  aliases?: string[];
  /** Ids of eyepieces that ship with the telescope. */
  bundledEyepieces?: string[];
  discontinued?: true;
  /** The https page the numbers were read from. */
  source: string;
}

export interface EyepieceEntry {
  /** Stable kebab slug, e.g. "baader-hyperion-zoom-8-24-at-12". */
  id: string;
  brand: string;
  line: string;
  /** What fills the form: the brand, model and numbers only (no descriptive words), at most 60 characters. */
  name: string;
  focalLengthMm: number;
  /** Whole degrees. */
  afovDeg: number;
  design?: EyepieceDesign;
  /** The AFOV is the typical value for the design, or interpolated for a zoom click stop between its endpoints, not a published figure. */
  afovEstimated?: true;
  /** Ships with a telescope (listed in its `bundledEyepieces`); the detail line says so, the name does not. */
  bundled?: true;
  /** Set on the click stops of a zoom: the published range of the whole eyepiece. */
  zoom?: { minMm: number; maxMm: number };
  aliases?: string[];
  discontinued?: true;
  /** The https page the numbers were read from. */
  source: string;
}
