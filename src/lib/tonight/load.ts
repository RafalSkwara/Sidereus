// Everything Tonight's server islands load for one request: the user's sites, telescopes, eyepieces and log, the
// chosen site and telescope, the forecast and the built view. Shared by TonightContent (top five) and
// AllObjectsContent (every cleared object), so both pages always show the same night for the same setup.
// Framework-free: the Worker's KV cache, the forecast base URL and `waitUntil` come in from the island.

import type { MessageKey } from "@/i18n";
import type { LogEntry } from "@/lib/engine";
import type { ForecastCache } from "@/lib/forecast/cache";
import { getForecast } from "@/lib/forecast/service";
import {
  eyepieceStore,
  siteStore,
  telescopeStore,
  type EyepieceRecord,
  type SiteRecord,
  type TelescopeRecord,
} from "@/lib/gear/store";
import { observationStore } from "@/lib/observations/store";
import type { TypedSupabaseClient } from "@/lib/supabase";
import type { Locale } from "@/lib/preferences";
import { buildTonight, type TonightView } from "@/lib/tonight/build";
import { chooseOwned, selectorKind } from "@/lib/tonight/gear-choice";

// Fixed, value-free message keys: nothing about the site (coordinates included) ever reaches the page or a log.
const SITES_FAILED: MessageKey = "errors.load.sites";
const TELESCOPES_FAILED: MessageKey = "errors.load.telescopes";
const EYEPIECES_FAILED: MessageKey = "tonight.eyepiecesFailed";
const LOG_FAILED: MessageKey = "tonight.logFailed";
const TONIGHT_FAILED: MessageKey = "tonight.failed";

export interface LoadTonightInput {
  /** `null` signed out or unconfigured: nothing is loaded. */
  supabase: TypedSupabaseClient | null;
  locale: Locale;
  /** The site and telescope picked on the page (`?site=` / `?telescope=` or the remembered cookies). */
  siteId?: string;
  telescopeId?: string;
  now: Date;
  cache: ForecastCache;
  forecastBaseUrl?: string;
  /** Runs the forecast cache write after the response (the Worker's `waitUntil`). */
  defer: (task: Promise<void>) => void;
  /** How many cleared objects get full entries; see `buildTonight`. */
  limit?: number;
}

export interface TonightLoad {
  sites: SiteRecord[];
  telescopes: TelescopeRecord[];
  eyepieces: EyepieceRecord[];
  sitesError: MessageKey | null;
  telescopesError: MessageKey | null;
  eyepiecesError: MessageKey | null;
  /** A log that fails to load ranks as an empty one, with this notice (never an error page). */
  logError: MessageKey | null;
  site: SiteRecord | undefined;
  telescope: TelescopeRecord | undefined;
  /** FR-012 / FR-019: a selector, and naming the telescope on the ranking, only matter with two or more. */
  multipleSites: boolean;
  multipleTelescopes: boolean;
  /** No site and no telescope (e.g. onboarding abandoned): one route back to setup. */
  needsSetup: boolean;
  view: TonightView | null;
  tonightError: MessageKey | null;
}

/** Loads one list; a failure only affects what depends on it, never the whole page. */
async function load<T>(
  list: () => Promise<T[]>,
  failed: MessageKey,
): Promise<{ items: T[]; error: MessageKey | null }> {
  try {
    return { items: await list(), error: null };
  } catch {
    return { items: [], error: failed };
  }
}

export async function loadTonight(input: LoadTonightInput): Promise<TonightLoad> {
  const { supabase, locale, siteId, telescopeId, now } = input;
  let sites: SiteRecord[] = [];
  let telescopes: TelescopeRecord[] = [];
  let eyepieces: EyepieceRecord[] = [];
  let log: LogEntry[] = [];
  let sitesError: MessageKey | null = null;
  let telescopesError: MessageKey | null = null;
  let eyepiecesError: MessageKey | null = null;
  let logError: MessageKey | null = null;

  if (supabase) {
    const [siteResult, telescopeResult, eyepieceResult, logResult] = await Promise.all([
      load(() => siteStore.list(supabase), SITES_FAILED),
      load(() => telescopeStore.list(supabase), TELESCOPES_FAILED),
      load(() => eyepieceStore.list(supabase), EYEPIECES_FAILED),
      load(() => observationStore.listForRanking(supabase), LOG_FAILED),
    ]);
    ({ items: sites, error: sitesError } = siteResult);
    ({ items: telescopes, error: telescopesError } = telescopeResult);
    ({ items: eyepieces, error: eyepiecesError } = eyepieceResult);
    ({ items: log, error: logError } = logResult);
  }

  // The site and the telescope are the ones picked on the page when the user owns them, else the oldest (FR-012,
  // FR-019); both lists are in `created_at` order. The forecast, the verdict, the ranking, the strip and the log
  // prefill all follow the chosen site.
  const site = chooseOwned(sites, siteId);
  const telescope = chooseOwned(telescopes, telescopeId);
  const needsSetup = supabase !== null && !sitesError && !telescopesError && !site && !telescope;

  let view: TonightView | null = null;
  let tonightError: MessageKey | null = null;
  if (site && telescope) {
    try {
      // getForecast never throws: an outage with nothing cached yields null, and the verdict turns marginal;
      // a saved copy served in an outage comes back flagged `fallback`, and buildTonight caps it at marginal.
      const result = await getForecast({
        fetchFn: globalThis.fetch.bind(globalThis),
        cache: input.cache,
        siteId: site.id,
        coords: { latitudeDeg: site.latitudeDeg, longitudeDeg: site.longitudeDeg },
        now,
        ...(input.forecastBaseUrl ? { baseUrl: input.forecastBaseUrl } : {}),
        defer: input.defer,
      });
      view = buildTonight({ site, telescope, eyepieces, forecast: result, now, log }, locale, { limit: input.limit });
    } catch {
      tonightError = TONIGHT_FAILED;
    }
  }

  return {
    sites,
    telescopes,
    eyepieces,
    sitesError,
    telescopesError,
    eyepiecesError,
    logError,
    site,
    telescope,
    multipleSites: selectorKind(sites.length) !== "none",
    multipleTelescopes: selectorKind(telescopes.length) !== "none",
    needsSetup,
    view,
    tonightError,
  };
}

/**
 * The log form for one ranked object, by its target key ("M31"), prefilled with the ranking's night, site and
 * telescope (FR-016).
 */
export function logHref(tonight: TonightView, target: string): string {
  const query = new URLSearchParams({
    object: target,
    night: tonight.date,
    site: tonight.siteId,
    telescope: tonight.telescopeId,
  });
  return `/log/new?${query.toString()}`;
}
