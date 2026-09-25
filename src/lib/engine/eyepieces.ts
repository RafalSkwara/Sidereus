import { EXIT_PUPIL_CEILING_MM, EXIT_PUPIL_FLOOR_MM, FOV_FIT_FRACTION } from "./parameters";

/**
 * Eyepiece optics and the finding/detail pairing (FR-014) over the user's own kit. Pure. Inputs are
 * structural, so the gear store's `TelescopeRecord` and `EyepieceRecord` are assignable to them and
 * the engine never imports the gear layer.
 */

export interface TelescopeOpticsInput {
  apertureMm: number;
  focalLengthMm: number;
}

export interface EyepieceOpticsInput {
  focalLengthMm: number;
  /** Apparent field of view, degrees. */
  afovDeg: number;
}

export interface EyepieceOptics {
  magnification: number;
  exitPupilMm: number;
  /** True field of view, degrees. */
  trueFovDeg: number;
}

/** The finding (widest field) and detail (most magnification) eyepieces for one object. */
export interface EyepiecePair<E extends EyepieceOpticsInput = EyepieceOpticsInput> {
  kind: "pair";
  finding: E;
  detail: E;
}

/**
 * No eyepiece in the kit fits the object. Not a pairing: `widest` is carried only so the UI can
 * advise sweeping across the object with the widest-field eyepiece.
 */
export interface NoEyepieceFits<E extends EyepieceOpticsInput = EyepieceOpticsInput> {
  kind: "none-fit";
  widest: E;
}

export function eyepieceOptics(telescope: TelescopeOpticsInput, eyepiece: EyepieceOpticsInput): EyepieceOptics {
  const magnification = telescope.focalLengthMm / eyepiece.focalLengthMm;
  return {
    magnification,
    exitPupilMm: telescope.apertureMm / magnification,
    trueFovDeg: eyepiece.afovDeg / magnification,
  };
}

interface Candidate<E> {
  eyepiece: E;
  optics: EyepieceOptics;
}

/** The candidate with the largest `key`; the earliest one in input order wins a tie. */
function maxBy<E>(candidates: readonly Candidate<E>[], key: (c: Candidate<E>) => number): Candidate<E> | null {
  let best: Candidate<E> | null = null;
  for (const c of candidates) {
    if (best === null || key(c) > key(best)) {
      best = c;
    }
  }
  return best;
}

const trueField = <E>(c: Candidate<E>): number => c.optics.trueFovDeg;

/**
 * Pairs a finding and a detail eyepiece for an object of the given major axis (arcminutes; `null`
 * means unknown size, which fits every eyepiece). An eyepiece is eligible only when the object fits
 * within `FOV_FIT_FRACTION` of its true field, so no eyepiece is ever recommended for an object that
 * does not fit it.
 *
 * - finding: the eligible eyepiece with the widest true field whose exit pupil is within the ceiling,
 *   else the eligible eyepiece with the widest true field;
 * - detail: the eligible eyepiece with the highest magnification whose exit pupil is at least the
 *   floor, else the finding eyepiece.
 *
 * Returns `null` for an empty kit and `none-fit` when no eyepiece is eligible. Ties go to the earlier
 * eyepiece in `eyepieces` (callers pass `created_at` order).
 */
export function pairEyepieces<E extends EyepieceOpticsInput>(
  telescope: TelescopeOpticsInput,
  eyepieces: readonly E[],
  majorAxisArcmin: number | null,
): EyepiecePair<E> | NoEyepieceFits<E> | null {
  if (eyepieces.length === 0) {
    return null;
  }
  const candidates = eyepieces.map((eyepiece) => ({ eyepiece, optics: eyepieceOptics(telescope, eyepiece) }));
  const eligible = candidates.filter(
    (c) => majorAxisArcmin === null || majorAxisArcmin / 60 <= FOV_FIT_FRACTION * c.optics.trueFovDeg,
  );
  const widestEligible = maxBy(eligible, trueField);
  if (widestEligible === null) {
    const widest = maxBy(candidates, trueField);
    if (widest === null) {
      throw new Error("pairEyepieces: unreachable, the kit is not empty");
    }
    return { kind: "none-fit", widest: widest.eyepiece };
  }
  const finding =
    maxBy(
      eligible.filter((c) => c.optics.exitPupilMm <= EXIT_PUPIL_CEILING_MM),
      trueField,
    ) ?? widestEligible;
  const detail =
    maxBy(
      eligible.filter((c) => c.optics.exitPupilMm >= EXIT_PUPIL_FLOOR_MM),
      (c) => c.optics.magnification,
    ) ?? finding;
  return { kind: "pair", finding: finding.eyepiece, detail: detail.eyepiece };
}
