/**
 * Sky engine barrel: the one import path for slices that consume the engine.
 * Everything here is pure; see the purity guard in `purity.test.ts`.
 */

export type * from "./types";
export * from "./parameters";
export { observingNight } from "./night";
export { darkWindow, sunAltitudeDeg, sunEvents } from "./sun";
export { moonSeparationDeg, moonState, moonTrack } from "./moon";
export type { MoonState } from "./moon";
export { bestWindow, objectPosition, objectTrack, objectTracks } from "./objects";
export type { BestWindow } from "./objects";
