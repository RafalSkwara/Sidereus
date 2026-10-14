// Everything Tonight's server islands load for one request: the user's sites, telescopes, eyepieces and log, the
// chosen site and telescope, the forecast and the built view. Shared by TonightContent (top five) and
// TargetsPageContent (every cleared object), so both pages always show the same night for the same setup.
// Framework-free: the Worker's KV cache, the forecast base URL and `waitUntil` come in from the island, wired once
// by `loadTonightFor` in `island.ts`.

import type { MessageKey } from "@/i18n";
import { addDays, type LogEntry } from "@/lib/engine";
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
import type { FinderFrom } from "@/lib/finder/from";
import type { TonightReturnPage } from "@/lib/observations/schemas";
import { observationStore } from "@/lib/observations/store";
import { openSkyChecksSince } from "@/lib/sky-checks/pending";
import { skyCheckStore, type SkyCheckRecord } from "@/lib/sky-checks/store";
import type { TypedSupabaseClient } from "@/lib/supabase";
import type { Locale } from "@/lib/preferences";
import { buildTonight, type TonightView } from "@/lib/tonight/build";
import { chooseOwned, selectorKind } from "@/lib/tonight/gear-choice";
import { tonightDateForSite } from "@/lib/tonight/tonight-date";
import type { TargetKey } from "@/lib/targets";

// Fixed, value-free message keys: nothing about the site (coordinates included) ever reaches the page or a log.
const SITES_FAILED: MessageKey = "errors.load.sites";
const TELESCOPES_FAILED: MessageKey = "errors.load.telescopes";
const EYEPIECES_FAILED: MessageKey = "tonight.eyepiecesFailed";
const LOG_FAILED: MessageKey = "tonight.logFailed";
const TONIGHT_FAILED: MessageKey = "tonight.failed";
const PLAN_EDITS_FAILED: MessageKey = "errors.load.sessionPlan";

/**
 * Reads the user's saved Session plan for one site and night: the target keys in their order, or `null` for none (and
 * for an account that may not edit, which the reader itself checks before it queries). It throws only on a failed read.
 */
export type PlanEditsReader = (siteId: string, nightDate: string) => Promise<TargetKey[] | null>;

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
  /** The fetch the forecast goes through; tests pass a fake. Default: the global `fetch`. */
  fetchFn?: typeof fetch;
  /** How many cleared objects get full entries; see `buildTonight`. */
  limit?: number;
  /**
   * Also read the user's recent open sky checks (verdict-check), alongside the other lists so it adds no round trip.
   * Only Tonight asks about the sky; its focused pages leave it off.
   */
  withSkyChecks?: boolean;
  /** Also build the interactive sky (interactive-sky); see `buildTonight`. Only the dashboard asks for it. */
  withSkyView?: boolean;
  /** Also build the Session plan (session-plan-timeline); see `buildTonight`. The dashboard and the plan page ask for it. */
  withSessionPlan?: boolean;
  /** Also build the sky events (sky-events); see `buildTonight`. The dashboard and the events page ask for it. */
  withSkyEvents?: boolean;
  /** `"next"` builds the evening after tonight (offline-night-plan); see `buildTonight`. Default `"tonight"`. */
  night?: "tonight" | "next";
  /**
   * Reads the saved Session plan (adjustable-session-plan), called only for `night: "tonight"`, with the one night date
   * the build uses, in parallel with the forecast. A throw leaves the view without edits and sets `planEditsError`.
   */
  readPlanEdits?: PlanEditsReader;
  /** Also list what the plan editor may add; see `buildTonight`. */
  withPlanCandidates?: boolean;
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
  /** The user's recent open sky checks when `withSkyChecks` is set; empty otherwise or when the read fails. */
  openSkyChecks: SkyCheckRecord[];
  /**
   * The saved plan could not be read (`readPlanEdits` threw): the view is the suggested plan. `null` or absent
   * otherwise (optional so the islands' own empty `TonightLoad` literals stay valid until they read edits).
   */
  planEditsError?: MessageKey | null;
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
  let openSkyChecks: SkyCheckRecord[] = [];

  if (supabase) {
    const [siteResult, telescopeResult, eyepieceResult, logResult, skyCheckResult] = await Promise.all([
      load(() => siteStore.list(supabase), SITES_FAILED),
      load(() => telescopeStore.list(supabase), TELESCOPES_FAILED),
      load(() => eyepieceStore.list(supabase), EYEPIECES_FAILED),
      load(() => observationStore.listSeenEntries(supabase), LOG_FAILED),
      // The question is optional, so a failed read only hides it: its error is dropped.
      input.withSkyChecks
        ? load(() => skyCheckStore.openRecent(supabase, { sinceNight: openSkyChecksSince(now) }), LOG_FAILED)
        : { items: [], error: null },
    ]);
    ({ items: sites, error: sitesError } = siteResult);
    ({ items: telescopes, error: telescopesError } = telescopeResult);
    ({ items: eyepieces, error: eyepiecesError } = eyepieceResult);
    ({ items: log, error: logError } = logResult);
    openSkyChecks = skyCheckResult.items;
  }

  // The site and the telescope are the ones picked on the page when the user owns them, else the oldest (FR-012,
  // FR-019); both lists are in `created_at` order. The forecast, the verdict, the ranking, the strip and the log
  // prefill all follow the chosen site.
  const site = chooseOwned(sites, siteId);
  const telescope = chooseOwned(telescopes, telescopeId);
  const needsSetup = supabase !== null && !sitesError && !telescopesError && !site && !telescope;

  let view: TonightView | null = null;
  let tonightError: MessageKey | null = null;
  let planEditsError: MessageKey | null = null;
  if (site && telescope) {
    // The one night date: the saved plan's read, the build and so the editor's form all name the same night.
    const tonightDate = tonightDateForSite(site, now);
    const nightDate = input.night === "next" ? addDays(tonightDate, 1) : tonightDate;
    // Only tonight has edits (D9). Started before the forecast so the two reads overlap; it never rejects.
    const editsRead =
      input.readPlanEdits && input.night !== "next"
        ? input.readPlanEdits(site.id, nightDate).then(
            (edits) => ({ edits, error: null }),
            () => ({ edits: null, error: PLAN_EDITS_FAILED }),
          )
        : null;
    try {
      // getForecast never throws: an outage with nothing cached yields null, and the verdict turns marginal;
      // a saved copy served in an outage, or in place of an incomplete 200, comes back flagged `fallback`, and
      // buildTonight caps it at marginal.
      const result = await getForecast({
        fetchFn: input.fetchFn ?? globalThis.fetch.bind(globalThis),
        cache: input.cache,
        siteId: site.id,
        coords: { latitudeDeg: site.latitudeDeg, longitudeDeg: site.longitudeDeg },
        now,
        ...(input.forecastBaseUrl ? { baseUrl: input.forecastBaseUrl } : {}),
        defer: input.defer,
      });
      const planEdits = editsRead === null ? null : await editsRead;
      planEditsError = planEdits?.error ?? null;
      view = buildTonight(
        { site, telescope, eyepieces, forecast: result, now, log, logKnown: logError === null },
        locale,
        {
          limit: input.limit,
          withSkyView: input.withSkyView,
          withSessionPlan: input.withSessionPlan,
          withSkyEvents: input.withSkyEvents,
          night: input.night,
          nightDate,
          planEdits: planEdits?.edits ?? null,
          withPlanCandidates: input.withPlanCandidates,
        },
      );
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
    openSkyChecks,
    planEditsError,
  };
}

/**
 * The log form for one ranked object, by its target key ("M31"), prefilled with the ranking's night, site and
 * telescope (FR-016). `from` names the focused Tonight page the link sits on (tonight-dashboard), so the save
 * returns there; without it the save returns to Tonight.
 */
export function logHref(tonight: TonightView, target: string, from?: TonightReturnPage): string {
  const query = new URLSearchParams({
    object: target,
    night: tonight.date,
    site: tonight.siteId,
    telescope: tonight.telescopeId,
  });
  if (from) {
    query.set("from", from);
  }
  return `/log/new?${query.toString()}`;
}

/**
 * The finder chart for one ranked object or planet, by its target key ("M31", "jupiter"), for the site, telescope and
 * night the page shows (finder-chart). `from` is the focused page the link sits on, so the chart's back link returns
 * there; `night` `"next"` carries the evening after tonight through. Ids and keys only, never coordinates.
 */
export function finderHref(
  tonight: TonightView,
  target: string,
  from: FinderFrom,
  night: "tonight" | "next" = "tonight",
): string {
  const query = new URLSearchParams({
    object: target,
    site: tonight.siteId,
    telescope: tonight.telescopeId,
    from,
  });
  if (night === "next") {
    query.set("night", "next");
  }
  return `/tonight/finder?${query.toString()}`;
}
