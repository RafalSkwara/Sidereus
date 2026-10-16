// What the finder chart's server island loads for one request (finder-chart Phase 4): the plan guard first, then
// Tonight for the chosen site, telescope and night, the target's entry, the finding eyepiece, the star field and the
// engine's chart. Server-only: `loadTonightFor` reaches `cloudflare:workers` and `astro:env/server`, and the star
// field is loaded here only, by a dynamic import, so no other page parses it.

import { formatDesignation, loadFinderStars } from "@/lib/catalogue/finder-stars";
import { findDeepSky } from "@/lib/catalogue";
import { requireFullPlan } from "@/lib/account-plan";
import { getMessages } from "@/i18n";
import {
  finderChart,
  findingEyepiece,
  planetFacts,
  planetJ2000Vector,
  type FinderChartData,
  type FinderTarget,
  type UnitVector,
} from "@/lib/engine";
import { toEngineSite } from "@/lib/gear/store";
import type { FinderFrom } from "@/lib/finder/from";
import { logFailure } from "@/lib/observability/log-failure";
import type { Locale } from "@/lib/preferences";
import { isPlanetKey, type TargetKey } from "@/lib/targets";
import type { TonightView } from "@/lib/tonight/build";
import { expectationKeyFor, expectationText } from "@/lib/tonight/expectation";
import { loadTonightFor } from "@/lib/tonight/island";

import type { FinderChartLabels } from "./steps";

export interface FinderLoadOptions {
  /** The object from `?object=`; `null` when the URL named none that parses (the page then says it is not on the list). */
  target: TargetKey | null;
  siteId?: string;
  telescopeId?: string;
  night?: "tonight" | "next";
  /**
   * The page the chart was opened from. `"plan"` (the Session plan, F9) also resolves an object that is below the
   * ranking's bar but has a window tonight, so a row the user added opens its chart; any other value, or none, keeps
   * a below-bar object `not-ranked`.
   */
  from?: FinderFrom | null;
}

export type FinderLoad =
  | { kind: "locked" }
  | { kind: "not-configured" }
  | { kind: "no-gear" | "not-ranked" | "failed"; view: TonightView | null }
  | {
      kind: "chart";
      view: TonightView;
      chart: FinderChartData;
      labels: FinderChartLabels;
      /** What the object will look like in this telescope (what-to-expect); `null` when the catalogue has no key for it. */
      expectation: { key: string; text: string } | null;
    };

function equatorialVector(raHours: number, decDeg: number): UnitVector {
  const ra = (raHours * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** What a ranked row says about its target that the chart needs: its name, best time and where it is. */
interface Resolved {
  name: string;
  bestAt: number;
  bestTime: string;
  bestDirection: string;
  /** The finding eyepiece's narrowing: the object's major axis, or `null` (a planet: every eyepiece fits). */
  majorAxisArcmin: number | null;
  vector: (site: ReturnType<typeof toEngineSite>, time: Date) => UnitVector;
  magnitude: (time: Date) => number | null;
  isPlanet: boolean;
  /** The planet's fixed "what you'll see" note, already in the request's language; `null` for a deep-sky object. */
  planetNote: string | null;
}

/**
 * The target's row in tonight's ranking (a deep-sky object) or planet list; `null` when it is not on either. With
 * `fromPlan`, a deep-sky object the ranking does not list falls back to `view.reachable` (every object the telescope
 * can reach with a window tonight), so a below-bar object the user added to the plan still has its chart.
 */
function resolveTarget(view: TonightView, target: TargetKey, fromPlan: boolean): Resolved | null {
  if (isPlanetKey(target)) {
    const entry = view.solarSystem?.entries.find((candidate) => candidate.key === target);
    if (entry === undefined) {
      return null;
    }
    return {
      name: entry.name,
      bestAt: entry.bestAt,
      bestTime: entry.bestTime,
      bestDirection: entry.bestDirection,
      majorAxisArcmin: null,
      vector: (site, time) => planetJ2000Vector(target, site, time),
      magnitude: (time) => planetFacts(target, time).magnitude,
      isPlanet: true,
      planetNote: entry.note,
    };
  }
  // Messier and Caldwell keys; the Moon has no chart.
  const ranked = view.ranking?.entries.find((candidate) => candidate.id === target);
  const entry = ranked ?? (fromPlan ? view.reachable?.find((candidate) => candidate.id === target) : undefined);
  const object = entry === undefined ? undefined : findDeepSky(target);
  if (entry === undefined || object === undefined) {
    return null;
  }
  return {
    name: entry.label,
    bestAt: entry.bestAt,
    bestTime: entry.bestTime,
    bestDirection: entry.bestDirection,
    majorAxisArcmin: object.majorAxisArcmin,
    vector: () => equatorialVector(object.raHours, object.decDeg),
    magnitude: () => object.vMag,
    isPlanet: false,
    planetNote: null,
  };
}

/**
 * The finder chart for one request. The plan guard runs FIRST: a free or signed-out request returns `locked` before
 * Tonight, the star file or the engine is touched (the shell's check does not protect `/_server-islands/*`), and an
 * unconfigured database returns `not-configured`. Every way to `failed` leaves one line (a fixed line and the error's
 * name only: a message or stack could carry the site's coordinates): `finder.tonight` when Tonight did not load or
 * build (the swallowed read or build behind it is logged by the Tonight loader, so this line only says the finder
 * fell), `finder.stars` for the star file and `finder.chart` for anything else that throws on the way to the chart.
 */
export async function loadFinderFor(locals: App.Locals, options: FinderLoadOptions): Promise<FinderLoad> {
  const guard = await requireFullPlan(locals);
  if (!guard.ok) {
    return guard.reason === "not-configured" ? { kind: "not-configured" } : { kind: "locked" };
  }
  if (options.target === null) {
    return { kind: "not-ranked", view: null };
  }

  const load = await loadTonightFor(locals, {
    siteId: options.siteId,
    telescopeId: options.telescopeId,
    night: options.night,
    limit: Number.POSITIVE_INFINITY,
    ...(options.from === "plan" ? { withReachable: true } : {}),
  });
  if (load === null) {
    // Unreachable after the guard (it answers null only without a user or a database); never a chart.
    logFailure("finder.tonight");
    return { kind: "failed", view: null };
  }
  const noGear = load.needsSetup || (!load.sitesError && !load.site) || (!load.telescopesError && !load.telescope);
  if (noGear) {
    return { kind: "no-gear", view: load.view };
  }
  const { site, telescope, view } = load;
  if (!site || !telescope || !view) {
    // A failed gear read or a failed build: the loader already turned it into a fixed error key and logged its cause,
    // so this line only states that the finder fell to `failed`. No chart.
    logFailure("finder.tonight");
    return { kind: "failed", view };
  }

  // Everything from here to the chart sits in one guard: a throw while resolving the row, reading the kit, in the engine
  // or in the labels fails this one request to `failed` (a line, a 200) instead of the island answering with a 500.
  try {
    const resolved = resolveTarget(view, options.target, options.from === "plan");
    if (resolved === null) {
      return { kind: "not-ranked", view };
    }

    const locale: Locale = locals.locale;
    const engineSite = toEngineSite(site);
    const time = new Date(resolved.bestAt);
    const finding = findingEyepiece(telescope, load.eyepieces, resolved.majorAxisArcmin);

    let stars: Awaited<ReturnType<typeof loadFinderStars>>;
    try {
      stars = await loadFinderStars();
    } catch (error) {
      logFailure("finder.stars", error);
      return { kind: "failed", view };
    }

    const target: FinderTarget = {
      vector: resolved.vector(engineSite, time),
      magnitude: resolved.magnitude(time),
      isPlanet: resolved.isPlanet,
      majorAxisArcmin: resolved.majorAxisArcmin,
    };
    const chart = finderChart({
      site: engineSite,
      time,
      bortle: site.bortle,
      minAltitudeDeg: site.minAltitudeDeg,
      target,
      stars,
      eyepieceFieldDeg: finding === null ? null : finding.trueFovDeg,
    });

    const route = chart.start === null ? [] : [chart.start.index, ...chart.hops.map((hop) => hop.index)];
    const labels: FinderChartLabels = {
      target: resolved.name,
      stars: Object.fromEntries(route.map((index) => [index, formatDesignation(stars[index].designation, locale)])),
      eyepiece: finding === null ? null : { name: finding.eyepiece.name, fieldDeg: finding.trueFovDeg },
      // The ranking's own refracted direction and time, so the chart's context line agrees with the row it opened from.
      direction: resolved.bestDirection,
      time: resolved.bestTime,
    };
    // The line above the chart (what-to-expect): a planet's own note, or the deep-sky object's phrase for this site and
    // aperture in the request's language. Pure catalogue and gear data, nothing that carries coordinates.
    const deepSkyKey =
      resolved.planetNote === null ? expectationKeyFor(options.target, site.bortle, telescope.apertureMm) : null;
    const expectation =
      resolved.planetNote !== null
        ? { key: options.target, text: resolved.planetNote }
        : deepSkyKey === null
          ? null
          : { key: deepSkyKey, text: expectationText(deepSkyKey, getMessages(locale)) };
    return { kind: "chart", view, chart, labels, expectation };
  } catch (error) {
    logFailure("finder.chart", error);
    return { kind: "failed", view };
  }
}
