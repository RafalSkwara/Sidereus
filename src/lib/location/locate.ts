import { roundCoordinate } from "@/lib/gear/coordinates";

/**
 * The device position for the shared location picker, asked for only when the user clicks
 * "Use my location". The geolocation API is passed in so tests need no browser.
 *
 * Privacy (PRD NFR): the position is rounded with `roundCoordinate` before it leaves this module, so
 * the raw position never reaches component state. This module never logs.
 *
 * Island-safe: imports only `@/lib/gear/coordinates`.
 */

/** Why no position came back: the user (or the browser) refused, or anything else went wrong. */
export type LocateFailure = "denied" | "unavailable";

export interface DevicePosition {
  latitudeDeg: number;
  longitudeDeg: number;
}

const POSITION_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 };

/**
 * Asks `geolocation` for the current position, rounded to about 1 km. Rejects with an `Error` whose
 * message is a `LocateFailure`: "denied" for a refused permission, "unavailable" for any other error
 * or when there is no geolocation API at all (no request is made then).
 */
export function locateDevice(geolocation: Geolocation | undefined): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(new Error("unavailable" satisfies LocateFailure));
      return;
    }
    geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitudeDeg: roundCoordinate(position.coords.latitude),
          longitudeDeg: roundCoordinate(position.coords.longitude),
        });
      },
      (error) => {
        const failure: LocateFailure = error.code === error.PERMISSION_DENIED ? "denied" : "unavailable";
        reject(new Error(failure));
      },
      POSITION_OPTIONS,
    );
  });
}

/**
 * Whether geolocation is already granted, found without ever showing a prompt: "Pick from map" recentres
 * on the device only for a user who allowed it before. `false` when there is no Permissions API, or the
 * query throws or rejects. Never touches `navigator.geolocation`.
 */
export async function geolocationAlreadyGranted(permissions?: Pick<Permissions, "query">): Promise<boolean> {
  if (!permissions) return false;
  try {
    const status = await permissions.query({ name: "geolocation" });
    return status.state === "granted";
  } catch {
    // An unsupported or failing query only means no recentre; nothing is hidden, the map stays usable.
    return false;
  }
}
