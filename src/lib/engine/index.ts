/**
 * Sky engine barrel: the one import path for slices that consume the engine.
 * Everything here is pure; see the purity guard in `purity.test.ts`.
 */

export type * from "./types";
export * from "./parameters";
export { observingNight, observingNightDateFor } from "./night";
export { darkWindow, sunAltitudeDeg, sunEvents } from "./sun";
export { moonSeparationDeg, moonState, moonTrack } from "./moon";
export type { MoonState } from "./moon";
export { bestWindow, objectPosition, objectTrack, objectTracks } from "./objects";
export type { BestWindow } from "./objects";
export { SCORE_COMPONENTS, scoreObject } from "./score";
export type { ObjectScore, ScoreComponent, ScoreComponents, ScoreInput, ScoredObject } from "./score";
export { eyepieceOptics, pairEyepieces } from "./eyepieces";
export type {
  EyepieceOptics,
  EyepieceOpticsInput,
  EyepiecePair,
  NoEyepieceFits,
  TelescopeOpticsInput,
} from "./eyepieces";
export { rankObjects, reasonComponents } from "./ranking";
export type { RankInput, RankTelescope, RankableObject, RankedEntry, Ranking, ReasonComponents } from "./ranking";
export { verdict } from "./verdict";
export { darkWindowReturn, nextNightNotNoGo } from "./outlook";
export type { NextNight, NextNightInput } from "./outlook";
