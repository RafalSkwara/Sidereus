// What the finder chart's server island loads for one request (finder-chart Phase 4): the plan guard first, then
// Tonight for the chosen site, telescope and night, the target's entry, the finding eyepiece, the star field and the
// engine's chart. Server-only: `loadTonightFor` reaches `cloudflare:workers` and `astro:env/server`, and the star
// field is loaded here only, by a dynamic import, so no other page parses it.

import { formatDesignation, loadFinderStars } from "@/lib/catalogue/finder-stars";
import { findDeepSky } from "@/lib/catalogue";
import { requireFullPlan } from "@/lib/account-plan";
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
import type { Locale } from "@/lib/preferences";
import { isPlanetKey, type TargetKey } from "@/lib/targets";
import type { TonightView } from "@/lib/tonight/build";
import { loadTonightFor } from "@/lib/tonight/island";

import type { FinderChartLabels } from "./steps";

export interface FinderLoadOptions {
  /** The object from `?object=`; `null` when the URL named none that parses (the page then says it is not on the list). */
  target: TargetKey | null;
  siteId?: string;
  telescopeId?: string;
  night?: "tonight" | "next";
}

export type FinderLoad =
  | { kind: "locked" }
  | { kind: "not-configured" }
  | { kind: "no-gear" | "not-ranked" | "failed"; view: TonightView | null }
  | { kind: "chart"; view: TonightView; chart: FinderChartData; labels: FinderChartLabels };

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
}

/** The target's row in tonight's ranking (a deep-sky object) or planet list; `null` when it is not on either. */
function resolveTarget(view: TonightView, target: TargetKey): Resolved | null {
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
    };
  }
  // Messier and Caldwell keys; the Moon has no chart.
  const entry = view.ranking?.entries.find((candidate) => candidate.id === target);
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
  };
}

/**
 * The finder chart for one request. The plan guard runs FIRST: a free or signed-out request returns `locked` before
 * Tonight, the star file or the engine is touched (the shell's check does not protect `/_server-islands/*`), and an
 * unconfigured database returns `not-configured`. A failed star load or engine error is logged (a fixed line and the
 * error's name only: a message or stack could carry the site's coordinates) and becomes `failed`.
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
  });
  if (load === null) {
    // Unreachable after the guard (it answers null only without a user or a database); never a chart.
    return { kind: "failed", view: null };
  }
  const noGear = load.needsSetup || (!load.sitesError && !load.site) || (!load.telescopesError && !load.telescope);
  if (noGear) {
    return { kind: "no-gear", view: load.view };
  }
  const { site, telescope, view } = load;
  if (!site || !telescope || !view) {
    // A failed gear read or a failed build: the loader already turned it into a fixed error key, no chart.
    return { kind: "failed", view };
  }

  const resolved = resolveTarget(view, options.target);
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
    // eslint-disable-next-line no-console -- a fixed line and the error's name only, never its message (it could carry coordinates).
    console.error("loadFinderFor: the star load failed", error instanceof Error ? error.name : typeof error);
    return { kind: "failed", view };
  }

  let chart: FinderChartData;
  try {
    const target: FinderTarget = {
      vector: resolved.vector(engineSite, time),
      magnitude: resolved.magnitude(time),
      isPlanet: resolved.isPlanet,
      majorAxisArcmin: resolved.majorAxisArcmin,
    };
    chart = finderChart({
      site: engineSite,
      time,
      bortle: site.bortle,
      minAltitudeDeg: site.minAltitudeDeg,
      target,
      stars,
      eyepieceFieldDeg: finding === null ? null : finding.trueFovDeg,
    });
  } catch (error) {
    // eslint-disable-next-line no-console -- a fixed line and the error's name only, never its message (it could carry coordinates).
    console.error("loadFinderFor: the chart failed", error instanceof Error ? error.name : typeof error);
    return { kind: "failed", view };
  }

  const route = chart.start === null ? [] : [chart.start.index, ...chart.hops.map((hop) => hop.index)];
  const labels: FinderChartLabels = {
    target: resolved.name,
    stars: Object.fromEntries(route.map((index) => [index, formatDesignation(stars[index].designation, locale)])),
    eyepiece: finding === null ? null : { name: finding.eyepiece.name, fieldDeg: finding.trueFovDeg },
    // The ranking's own refracted direction and time, so the chart's context line agrees with the row it opened from.
    direction: resolved.bestDirection,
    time: resolved.bestTime,
  };
  return { kind: "chart", view, chart, labels };
}
