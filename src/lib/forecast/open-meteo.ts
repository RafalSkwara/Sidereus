import { z } from "zod";

import type { ForecastHour, HourlyForecast } from "@/lib/engine";

/**
 * Open-Meteo client: hourly cloud cover and relative humidity for one site, mapped into the
 * engine's `HourlyForecast`. The fetch function is passed in so tests need no network.
 *
 * Privacy (PRD NFR): the coordinates go only into this request's query string. Every failure
 * throws an `Error` with a fixed, value-free message (no URL, no response text, no cause), and
 * this module never logs.
 */

export const OPEN_METEO_BASE_URL = "https://api.open-meteo.com";

/** Abort the request (including reading the body) after this long. */
export const FORECAST_TIMEOUT_MS = 3000;

export const FORECAST_REQUEST_FAILED = "The forecast service could not be reached.";
export const FORECAST_RESPONSE_INVALID = "The forecast service returned an unexpected response.";

export interface ForecastCoords {
  latitudeDeg: number;
  longitudeDeg: number;
}

const responseSchema = z.object({
  hourly: z
    .object({
      time: z.array(z.number().int()),
      cloud_cover: z.array(z.number().nullable()),
      relative_humidity_2m: z.array(z.number().nullable()),
    })
    .refine(
      (h) => h.cloud_cover.length === h.time.length && h.relative_humidity_2m.length === h.time.length,
      "hourly arrays differ in length",
    ),
});

/** The request URL. `past_days=1` keeps the evening before UTC midnight in the series. */
export function forecastUrl(site: ForecastCoords, baseUrl: string = OPEN_METEO_BASE_URL): URL {
  const url = new URL("/v1/forecast", baseUrl);
  url.searchParams.set("latitude", String(site.latitudeDeg));
  url.searchParams.set("longitude", String(site.longitudeDeg));
  url.searchParams.set("hourly", "cloud_cover,relative_humidity_2m");
  url.searchParams.set("timezone", "GMT");
  url.searchParams.set("timeformat", "unixtime");
  url.searchParams.set("past_days", "1");
  url.searchParams.set("forecast_days", "3");
  return url;
}

/**
 * Maps an Open-Meteo response body into `HourlyForecast`. Hours where either value is null are
 * left out (the verdict counts them as not clear). Throws the fixed invalid-response error on a
 * schema mismatch.
 */
export function mapForecastResponse(body: unknown): HourlyForecast {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(FORECAST_RESPONSE_INVALID);
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

/** Fetches and maps the forecast. Throws a fixed-message `Error` on non-2xx, timeout, network or schema failure. */
export async function fetchForecast(
  fetchFn: typeof fetch,
  site: ForecastCoords,
  baseUrl: string = OPEN_METEO_BASE_URL,
): Promise<HourlyForecast> {
  let response: Response;
  try {
    response = await fetchFn(forecastUrl(site, baseUrl), { signal: AbortSignal.timeout(FORECAST_TIMEOUT_MS) });
  } catch (_error) {
    // eslint-disable-next-line preserve-caught-error -- the cause can quote the request URL, which carries the coordinates.
    throw new Error(FORECAST_REQUEST_FAILED);
  }
  if (!response.ok) {
    throw new Error(FORECAST_REQUEST_FAILED);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    // A body that is not JSON is a bad response; anything else (the timeout firing mid-body) is a failed request.
    // eslint-disable-next-line preserve-caught-error -- fixed, value-free messages only (see the module comment).
    throw new Error(error instanceof SyntaxError ? FORECAST_RESPONSE_INVALID : FORECAST_REQUEST_FAILED);
  }
  return mapForecastResponse(body);
}
