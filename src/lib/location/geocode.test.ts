import { describe, expect, it } from "vitest";
import { getMessages, translateKey } from "@/i18n";
import { fakeFetch, jsonResponse } from "@/lib/forecast/test-helpers";
import { GEOCODING_FAILED, searchPlaces } from "./geocode";

const MADRID = {
  id: 3117735,
  name: "Madrid",
  latitude: 40.4165,
  longitude: -3.70256,
  elevation: 667,
  feature_code: "PPLC",
  country_code: "ES",
  admin1: "Madrid",
  country: "Spain",
  timezone: "Europe/Madrid",
};

describe("searchPlaces", () => {
  it("maps results into names, labels and rounded coordinates", async () => {
    const fake = fakeFetch(() =>
      jsonResponse({
        results: [
          MADRID,
          {
            id: 1,
            name: "Sydney",
            latitude: -33.86785,
            longitude: 151.20732,
            admin1: "New South Wales",
            country: "Australia",
          },
          { id: 2, name: "Null Island", latitude: -0.004, longitude: 0.001, admin1: "", country: "  " },
        ],
        generationtime_ms: 0.5,
      }),
    );
    await expect(searchPlaces("Ma", "en", fake.fetchFn)).resolves.toEqual([
      { id: 3117735, name: "Madrid", label: "Madrid, Madrid, Spain", latitudeDeg: 40.42, longitudeDeg: -3.7 },
      { id: 1, name: "Sydney", label: "Sydney, New South Wales, Australia", latitudeDeg: -33.87, longitudeDeg: 151.21 },
      { id: 2, name: "Null Island", label: "Null Island", latitudeDeg: 0, longitudeDeg: 0 },
    ]);
  });

  it("never puts the query or URL into its error", async () => {
    const fake = fakeFetch(() => jsonResponse({}, 500));
    const error = await searchPlaces("Secret Village", "en", fake.fetchFn).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(GEOCODING_FAILED);
    expect(translateKey(getMessages("en"), GEOCODING_FAILED, "errors.generic")).toBe(
      "Place search is unavailable right now.",
    );
    expect((error as Error).message).not.toMatch(/Secret|open-meteo/);
    expect((error as Error).cause).toBeUndefined();
  });
});
