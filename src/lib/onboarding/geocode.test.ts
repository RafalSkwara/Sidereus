import { describe, expect, it } from "vitest";
import { fakeFetch, jsonResponse } from "@/lib/forecast/test-helpers";
import { GEOCODING_FAILED, GEOCODING_TIMEOUT_MS, searchPlaces } from "./geocode";

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
  it("requests up to five English results for the trimmed query, with a timeout", async () => {
    const fake = fakeFetch(() => jsonResponse({ results: [MADRID] }));
    await searchPlaces("  Madrid ", fake.fetchFn);
    expect(fake.calls).toHaveLength(1);
    const { url, init } = fake.calls[0];
    expect(url.origin + url.pathname).toBe("https://geocoding-api.open-meteo.com/v1/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      name: "Madrid",
      count: "5",
      language: "en",
      format: "json",
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(GEOCODING_TIMEOUT_MS).toBe(3000);
  });

  it.each(["", " ", "M", "  M  "])("returns [] without fetching for the short query %j", async (query) => {
    const fake = fakeFetch(() => jsonResponse({ results: [MADRID] }));
    await expect(searchPlaces(query, fake.fetchFn)).resolves.toEqual([]);
    expect(fake.calls).toHaveLength(0);
  });

  it("maps results into labels and rounded coordinates", async () => {
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
    await expect(searchPlaces("Ma", fake.fetchFn)).resolves.toEqual([
      { id: 3117735, label: "Madrid, Madrid, Spain", latitudeDeg: 40.42, longitudeDeg: -3.7 },
      { id: 1, label: "Sydney, New South Wales, Australia", latitudeDeg: -33.87, longitudeDeg: 151.21 },
      { id: 2, label: "Null Island", latitudeDeg: 0, longitudeDeg: 0 },
    ]);
  });

  it("returns [] when the response has no results key", async () => {
    const fake = fakeFetch(() => jsonResponse({ generationtime_ms: 0.3 }));
    await expect(searchPlaces("Xyzzy", fake.fetchFn)).resolves.toEqual([]);
  });

  it("throws the fixed message on a non-2xx status", async () => {
    const fake = fakeFetch(() => jsonResponse({ error: true, reason: "Parameter name Madrid is invalid" }, 400));
    await expect(searchPlaces("Madrid", fake.fetchFn)).rejects.toThrow(new Error(GEOCODING_FAILED));
  });

  it("throws the fixed message when fetch rejects or times out", async () => {
    const network = fakeFetch(() => Promise.reject(new TypeError("fetch failed for name=Madrid")));
    await expect(searchPlaces("Madrid", network.fetchFn)).rejects.toThrow(new Error(GEOCODING_FAILED));
    const timeout = fakeFetch(() => Promise.reject(new DOMException("timed out", "TimeoutError")));
    await expect(searchPlaces("Madrid", timeout.fetchFn)).rejects.toThrow(new Error(GEOCODING_FAILED));
  });

  it("throws the fixed message when the caller aborts", async () => {
    const controller = new AbortController();
    const fake = fakeFetch(() => Promise.reject(new DOMException("aborted", "AbortError")));
    controller.abort();
    await expect(searchPlaces("Madrid", fake.fetchFn, controller.signal)).rejects.toThrow(new Error(GEOCODING_FAILED));
    expect(fake.calls[0].init?.signal?.aborted).toBe(true);
  });

  it("throws the fixed message on a body that is not JSON", async () => {
    const fake = fakeFetch(() => new Response("<html>busy</html>", { status: 200 }));
    await expect(searchPlaces("Madrid", fake.fetchFn)).rejects.toThrow(new Error(GEOCODING_FAILED));
  });

  it.each([
    ["results is not an array", { results: "Madrid" }],
    ["a result without coordinates", { results: [{ id: 1, name: "Madrid" }] }],
    ["a latitude out of range", { results: [{ ...MADRID, latitude: 140.4 }] }],
    ["a non-object body", ["Madrid"]],
  ])("throws the fixed message on a schema mismatch: %s", async (_label, body) => {
    const fake = fakeFetch(() => jsonResponse(body));
    await expect(searchPlaces("Madrid", fake.fetchFn)).rejects.toThrow(new Error(GEOCODING_FAILED));
  });

  it("never puts the query or URL into its error", async () => {
    const fake = fakeFetch(() => jsonResponse({}, 500));
    const error = await searchPlaces("Secret Village", fake.fetchFn).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(GEOCODING_FAILED);
    expect((error as Error).message).not.toMatch(/Secret|open-meteo/);
    expect((error as Error).cause).toBeUndefined();
  });
});
