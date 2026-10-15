import { z } from "zod";

import type { ForecastHour, HourlyForecast } from "@/lib/engine";

/**
 * Open-Meteo client: hourly cloud cover and relative humidity for one site, mapped into the
 * engine's `HourlyForecast`. The fetch function is passed in so tests need no network.
 *
 * Privacy (PRD NFR): the coordinates go only into this request's query string. Every failure
 * throws a `ForecastError` with a fixed, value-free message and the step that failed (plus the HTTP
 * status for `http`): no URL, no response text, no cause (the cause of a network failure can quote the
 * URL). This module never logs; the caller reads `name`, `step` and `status` (error-visibility).
 */

export const OPEN_METEO_BASE_URL = "https://api.open-meteo.com";

/** Abort the request (including reading the body) after this long. */
export const FORECAST_TIMEOUT_MS = 3000;

export const FORECAST_REQUEST_FAILED = "The forecast service could not be reached.";
export const FORECAST_RESPONSE_INVALID = "The forecast service returned an unexpected response.";

/** Which step of the fetch failed: the request itself, the HTTP status, the body's JSON, or the body's shape. */
export type ForecastStep = "request" | "http" | "parse" | "schema";

/**
 * A failed forecast fetch. `message` is one of the two fixed texts above, `step` says where it failed and `status`
 * (an integer HTTP status) is set for `http` only. It holds no URL and no cause, so every property is safe to log.
 */
export class ForecastError extends Error {
  readonly step: ForecastStep;
  readonly status?: number;

  constructor(step: ForecastStep, status?: number) {
    super(step === "parse" || step === "schema" ? FORECAST_RESPONSE_INVALID : FORECAST_REQUEST_FAILED);
    this.step = step;
    if (status !== undefined) {
      this.status = status;
    }
  }
}

export interface ForecastCoords {
  latitudeDeg: number;
  longitudeDeg: number;
}

/** A percentage the provider reports; outside 0-100 the response breaks its contract and is invalid. */
const percent = z.number().min(0).max(100).nullable();

const responseSchema = z.object({
  hourly: z
    .object({
      time: z.array(z.number().int()),
      cloud_cover: z.array(percent),
      relative_humidity_2m: z.array(percent),
    })
    .refine(
      (h) => h.cloud_cover.length === h.time.length && h.relative_humidity_2m.length === h.time.length,
      "hourly arrays differ in length",
    ),
});

/**
 * The request URL. `past_days=1` keeps the evening before UTC midnight in the series, and
 * `forecast_days=8` reaches past the morning of the seventh night, so the three verdict nights and
 * the cloud outlook of nights 4-7 are covered by this one request.
 */
export function forecastUrl(site: ForecastCoords, baseUrl: string = OPEN_METEO_BASE_URL): URL {
  const url = new URL("/v1/forecast", baseUrl);
  url.searchParams.set("latitude", String(site.latitudeDeg));
  url.searchParams.set("longitude", String(site.longitudeDeg));
  url.searchParams.set("hourly", "cloud_cover,relative_humidity_2m");
  url.searchParams.set("timezone", "GMT");
  url.searchParams.set("timeformat", "unixtime");
  url.searchParams.set("past_days", "1");
  url.searchParams.set("forecast_days", "8");
  return url;
}

/**
 * Maps an Open-Meteo response body into `HourlyForecast`. Hours where either value is null are
 * left out (the verdict counts them as not clear). Throws a `ForecastError` (step `schema`) on a
 * schema mismatch, including a cloud cover or humidity outside 0-100 (a negative cloud would
 * otherwise read clear).
 */
export function mapForecastResponse(body: unknown): HourlyForecast {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ForecastError("schema");
  }
  const { time, cloud_cover: cloud, relative_humidity_2m: humidity } = parsed.data.hourly;
  const hours: ForecastHour[] = [];
  time.forEach((unixSeconds, i) => {
    const cloudCoverPct = cloud[i];
    const humidityPct = humidity[i];
    if (cloudCoverPct !== null && humidityPct !== null) {
      hours.push({ start: new Date(unixSeconds * 1000), cloudCoverPct, humidityPct });
    }
  });
  return { hours };
}

/** Fetches and maps the forecast. Throws a `ForecastError` on non-2xx, timeout, network, JSON or schema failure. */
export async function fetchForecast(
  fetchFn: typeof fetch,
  site: ForecastCoords,
  baseUrl: string = OPEN_METEO_BASE_URL,
): Promise<HourlyForecast> {
  let response: Response;
  try {
    response = await fetchFn(forecastUrl(site, baseUrl), { signal: AbortSignal.timeout(FORECAST_TIMEOUT_MS) });
  } catch (_error) {
    // No cause on purpose: it can quote the request URL, which carries the coordinates.
    throw new ForecastError("request");
  }
  if (!response.ok) {
    throw new ForecastError("http", response.status);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    // A body that is not JSON is a bad response; anything else (the timeout firing mid-body) is a failed request.
    throw new ForecastError(error instanceof SyntaxError ? "parse" : "request");
  }
  return mapForecastResponse(body);
}
