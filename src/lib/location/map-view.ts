import { roundCoordinate } from "@/lib/gear/coordinates";

/**
 * The decisions behind "Pick from map" (S-09) that need no browser: where the map starts, and how a
 * point on the map becomes a pick. The map itself (Leaflet) lives only in `map-panel.tsx`.
 *
 * Privacy (PRD NFR): a pick is rounded with `roundCoordinate` here, before it reaches the host form, so
 * the exact tapped point never reaches component state. This module never logs.
 *
 * Island-safe: imports only `@/lib/gear/coordinates`.
 */

export interface MapPoint {
  latitudeDeg: number;
  longitudeDeg: number;
}

export interface MapView extends MapPoint {
  zoom: number;
  /** Whether the starting point is a real location that gets the pin, rather than the neutral view. */
  pinned: boolean;
}

/** The view when there is nothing to start from: Europe, zoomed out. */
export const NEUTRAL_VIEW = { latitudeDeg: 50, longitudeDeg: 15, zoom: 4 } as const;

/** The zoom for a known point (the host's coordinates or the device), close enough to see towns. */
export const POINT_ZOOM = 11;

/** How long the map waits for an already granted device position before staying on the neutral view. */
export const DEVICE_RECENTRE_TIMEOUT_MS = 3000;

/**
 * The host form's coordinate strings as a point rounded to about 1 km (as a save would store it), or `null` unless
 * both are non-empty, finite numbers in range (latitude ±90, longitude ±180).
 */
export function parseCurrent(latitude: string, longitude: string): MapPoint | null {
  if (latitude.trim() === "" || longitude.trim() === "") return null;
  const latitudeDeg = Number(latitude);
  const longitudeDeg = Number(longitude);
  if (!Number.isFinite(latitudeDeg) || !Number.isFinite(longitudeDeg)) return null;
  if (Math.abs(latitudeDeg) > 90 || Math.abs(longitudeDeg) > 180) return null;
  return { latitudeDeg: roundCoordinate(latitudeDeg), longitudeDeg: roundCoordinate(longitudeDeg) };
}

/** Where the map opens: the host's current point with the pin, else the neutral view without one. */
export function initialMapView(current: MapPoint | null | undefined): MapView {
  if (current) return { ...current, zoom: POINT_ZOOM, pinned: true };
  return { ...NEUTRAL_VIEW, pinned: false };
}

/**
 * A point on the map as a pick: longitude wrapped into [−180, 180) (the map repeats the world sideways),
 * latitude clamped to [−90, 90], both rounded to about 1 km.
 */
export function pickFromMap(latitudeDeg: number, longitudeDeg: number): MapPoint {
  const wrapped = ((((longitudeDeg + 180) % 360) + 360) % 360) - 180;
  const clamped = Math.min(90, Math.max(-90, latitudeDeg));
  // Rounding can turn a wrapped 179.996 into 180, which is still a valid stored longitude (±180).
  return { latitudeDeg: roundCoordinate(clamped), longitudeDeg: roundCoordinate(wrapped) };
}
