/**
 * Sky engine barrel: the one import path for slices that consume the engine.
 * Everything here is pure; see the purity guard in `purity.test.ts`.
 */

export type * from "./types";
export * from "./parameters";
export { addDays, observingNight, observingNightDateFor } from "./night";
export { darkWindow, sunAltitudeDeg, sunEvents, tonightDateFor } from "./sun";
export {
  moonElongationDeg,
  moonFreeMinutes,
  moonPhaseBand,
  moonSeparationDeg,
  moonSeparationsDeg,
  moonState,
  moonTrack,
} from "./moon";
export { moonDiscState, moonDiscStates } from "./moon-disc";
export type { MoonDiscState } from "@/lib/moon-disc/state";
export { effectiveSurfaceBrightness, moonBrighteningMag, magToNL, nlToMag, skyBrightnessNL } from "./moonlight";
export type { SkyBrightness, SkyBrightnessInput } from "./moonlight";
export { contrastBand } from "./contrast";
export type { ContrastBand } from "./contrast";
export { EXPECTATION_KEYS, expectationFor } from "./expectation";
export type { ExpectationKey, ExpectationObject } from "./expectation";
export type { MoonState } from "./moon";
export { moonPlacementOf, moonTarget } from "./moon-target";
export type { MoonFacts, MoonPlacement, MoonTargetEntry, MoonTargetInput } from "./moon-target";
export { bestWindow, objectPosition, objectTrack, objectTracks, refinedWindow } from "./objects";
export type { BestWindow, RefinedWindow } from "./objects";
export { SCORE_COMPONENTS, scoreObject } from "./score";
export type { ObjectScore, ScoreComponent, ScoreComponents, ScoreInput, ScoredObject } from "./score";
export { eyepieceOptics, findingEyepiece, pairEyepieces, planetEyepiece, wholeDiscEyepiece } from "./eyepieces";
export type {
  EyepieceOptics,
  EyepieceOpticsInput,
  FindingEyepiece,
  EyepiecePair,
  NoEyepieceFits,
  TelescopeOpticsInput,
  WholeDiscEyepiece,
} from "./eyepieces";
export { rankObjects, reasonComponents } from "./ranking";
export type {
  RankInput,
  RankTelescope,
  RankableObject,
  RankedEntry,
  Ranking,
  ReachableEntry,
  ReasonComponents,
  WashedOutEntry,
} from "./ranking";
export { PLANET_KEYS, isIceGiant, planetFacts, planetJ2000Vector, planetTracks } from "./planets";
export { finderChart, projectGnomonic } from "./finder";
export type {
  FinderChartData,
  FinderChartInput,
  FinderHop,
  FinderKind,
  FinderPanel,
  FinderStart,
  FinderStarInput,
  FinderTarget,
  PanelCircle,
  PanelPoint,
  PanelZenithEdge,
  PanelStar,
  UnitVector,
} from "./finder";
export { skyFrames } from "./sky-frames";
export type { SkyFrame } from "./sky-frames";
export type { PlanetFacts, PlanetKey } from "./planets";
export { rankPlanets } from "./planet-ranking";
export type { PlanetEntry, PlanetPlacement, PlanetRankInput, PlanetScore, PlanetTiming } from "./planet-ranking";
export { seenSummaries } from "./log";
export type { LogEntry, SeenSummary } from "./log";
export { clearIntervals, cloudOutlook, verdict } from "./verdict";
export type { CloudOutlook } from "./verdict";
export { darkWindowReturn, nextNightInOutlook, nextNightNotNoGo, sevenNightOutlook } from "./outlook";
export type { NextNight, NextNightInput, OutlookNight } from "./outlook";
export { isNotableEvent, skyEvents, visibleAt } from "./events";
export type {
  ElongationBody,
  ElongationEvent,
  EventVisibility,
  LunarEclipseEvent,
  MeteorShowerEvent,
  NotVisibleReason,
  OppositionBody,
  OppositionEvent,
  PairingBody,
  PairingEvent,
  SkyEvent,
  SkyEventKind,
  SolarEclipseEvent,
} from "./events";
