/**
 * Sky engine barrel: the one import path for slices that consume the engine.
 * Everything here is pure; see the purity guard in `purity.test.ts`.
 */

export type * from "./types";
export * from "./parameters";
export { observingNight, observingNightDateFor } from "./night";
export { darkWindow, sunAltitudeDeg, sunEvents, tonightDateFor } from "./sun";
export { moonElongationDeg, moonFreeMinutes, moonPhaseBand, moonSeparationDeg, moonState, moonTrack } from "./moon";
export type { MoonState } from "./moon";
export { isBrightMoon, moonPlacementOf, moonTarget } from "./moon-target";
export type { MoonFacts, MoonPlacement, MoonTargetEntry, MoonTargetInput } from "./moon-target";
export { bestWindow, objectPosition, objectTrack, objectTracks } from "./objects";
export type { BestWindow } from "./objects";
export { SCORE_COMPONENTS, scoreObject } from "./score";
export type { ObjectScore, ScoreComponent, ScoreComponents, ScoreInput, ScoredObject } from "./score";
export { eyepieceOptics, pairEyepieces, planetEyepiece, wholeDiscEyepiece } from "./eyepieces";
export type {
  EyepieceOptics,
  EyepieceOpticsInput,
  EyepiecePair,
  NoEyepieceFits,
  TelescopeOpticsInput,
  WholeDiscEyepiece,
} from "./eyepieces";
export { rankObjects, reasonComponents } from "./ranking";
export type { RankInput, RankTelescope, RankableObject, RankedEntry, Ranking, ReasonComponents } from "./ranking";
export { PLANET_KEYS, planetFacts, planetTracks } from "./planets";
export type { PlanetFacts, PlanetKey } from "./planets";
export { rankPlanets } from "./planet-ranking";
export type { PlanetEntry, PlanetPlacement, PlanetRankInput, PlanetScore, PlanetTiming } from "./planet-ranking";
export { seenSummaries } from "./log";
export type { LogEntry, SeenSummary } from "./log";
export { clearIntervals, cloudOutlook, verdict } from "./verdict";
export type { CloudOutlook } from "./verdict";
export { darkWindowReturn, nextNightInOutlook, nextNightNotNoGo, sevenNightOutlook } from "./outlook";
export type { NextNight, NextNightInput, OutlookNight } from "./outlook";
