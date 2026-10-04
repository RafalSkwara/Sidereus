import { describe, expect, it } from "vitest";
import { locateDevice } from "./locate";

const PERMISSION_DENIED = 1;
const TIMEOUT = 3;

/** A fake geolocation that answers every request with `outcome` and records the calls. */
function fakeGeolocation(outcome: { latitude: number; longitude: number } | { code: number }) {
  const calls: (PositionOptions | undefined)[] = [];
  const geolocation = {
    getCurrentPosition(success: PositionCallback, failure?: PositionErrorCallback | null, options?: PositionOptions) {
      calls.push(options);
      if ("code" in outcome) {
        failure?.({ code: outcome.code, PERMISSION_DENIED, message: "" } as GeolocationPositionError);
      } else {
        success({ coords: outcome } as GeolocationPosition);
      }
    },
  } as Geolocation;
  return { geolocation, calls };
}

describe("locateDevice", () => {
  it("returns the position rounded to 2 decimals, asking for low accuracy", async () => {
    const fake = fakeGeolocation({ latitude: 50.06143, longitude: 19.93658 });
    await expect(locateDevice(fake.geolocation)).resolves.toEqual({ latitudeDeg: 50.06, longitudeDeg: 19.94 });
    expect(fake.calls).toEqual([{ enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }]);
  });

  it("rejects with 'denied' when permission is refused", async () => {
    const fake = fakeGeolocation({ code: PERMISSION_DENIED });
    await expect(locateDevice(fake.geolocation)).rejects.toThrow("denied");
  });

  it("rejects with 'unavailable' on any other error", async () => {
    const fake = fakeGeolocation({ code: TIMEOUT });
    await expect(locateDevice(fake.geolocation)).rejects.toThrow("unavailable");
  });

  it("rejects with 'unavailable' when there is no geolocation API", async () => {
    await expect(locateDevice(undefined)).rejects.toThrow("unavailable");
  });
});
