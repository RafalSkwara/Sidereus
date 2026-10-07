import { describe, expect, it } from "vitest";
import { geolocationAlreadyGranted, locateDevice } from "./locate";

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

describe("geolocationAlreadyGranted", () => {
  /** A fake Permissions API whose query answers with `answer` and records the names asked about. */
  function fakePermissions(answer: () => Promise<{ state: PermissionState }>) {
    const names: string[] = [];
    const permissions = {
      query(descriptor: PermissionDescriptor) {
        names.push(descriptor.name);
        return answer() as Promise<PermissionStatus>;
      },
    };
    return { permissions, names };
  }

  it("is true only when geolocation is granted", async () => {
    const fake = fakePermissions(() => Promise.resolve({ state: "granted" }));
    await expect(geolocationAlreadyGranted(fake.permissions)).resolves.toBe(true);
    expect(fake.names).toEqual(["geolocation"]);
  });

  it.each(["prompt", "denied"] as const)("is false when the state is %s", async (state) => {
    const fake = fakePermissions(() => Promise.resolve({ state }));
    await expect(geolocationAlreadyGranted(fake.permissions)).resolves.toBe(false);
  });

  it("is false without a Permissions API", async () => {
    await expect(geolocationAlreadyGranted(undefined)).resolves.toBe(false);
  });

  it("is false when the query throws synchronously", async () => {
    const fake = fakePermissions(() => {
      throw new TypeError("unsupported");
    });
    await expect(geolocationAlreadyGranted(fake.permissions)).resolves.toBe(false);
  });

  it("is false when the query rejects", async () => {
    const fake = fakePermissions(() => Promise.reject(new TypeError("unsupported")));
    await expect(geolocationAlreadyGranted(fake.permissions)).resolves.toBe(false);
  });
});
