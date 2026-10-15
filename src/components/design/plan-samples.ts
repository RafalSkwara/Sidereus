import { getMessages } from "@/i18n";
import type { ForecastResult } from "@/lib/forecast/service";
import type { SiteRecord, TelescopeRecord } from "@/lib/gear/store";
import type { Locale } from "@/lib/preferences";
import { isTargetKey, type TargetKey } from "@/lib/targets";
import { buildTonight, type TonightSessionPlan } from "@/lib/tonight/build";
import {
  editPlan,
  editorAnnouncement,
  savedKeys,
  type PlanEditorAction,
  type PlanEditorState,
} from "@/lib/tonight/plan-editor";
import { planEditorData, type PlanEditorData } from "@/lib/tonight/plan-editor-view";

/**
 * Sample Session plans for the /design editor specimens (adjustable-session-plan Phase 5, dev only), from fixed data:
 * no clock, no network, no store. The same clear night as the page's panorama (Warsaw, 10 October 2026, a 150 mm
 * reflector), built by the real `buildTonight` with the editor's candidates, once as suggested and once with a saved
 * list: the latest-peaking target moved to the top (so a target whose window ends before it peaks carries the order hint), plus M7,
 * which never clears Warsaw's 15° minimum altitude (declination −35°), so it is listed under "Not on tonight's plan".
 */

const SITE: SiteRecord = {
  id: "sample-site",
  name: "Back garden",
  latitudeDeg: 52.23,
  longitudeDeg: 21.01,
  bortle: 4,
  minAltitudeDeg: 15,
  timeZone: "Europe/Warsaw",
  timeZoneSource: "auto",
  createdAt: "2026-09-01T00:00:00Z",
};
const TELESCOPE: TelescopeRecord = {
  id: "sample-telescope",
  name: "150 mm reflector",
  apertureMm: 150,
  focalLengthMm: 750,
  createdAt: "",
};
const NOW = new Date("2026-10-10T18:00:00Z");
const MINUTE_MS = 60_000;
const FORECAST: ForecastResult = {
  forecast: {
    hours: Array.from({ length: 48 }, (_, i) => ({
      start: new Date(Date.UTC(2026, 9, 10) + i * 60 * MINUTE_MS),
      cloudCoverPct: 5,
      humidityPct: 60,
    })),
  },
  fetchedAt: new Date(NOW.getTime() - 20 * MINUTE_MS),
  fallback: false,
};
/** Below Warsaw's minimum altitude all night: a saved key with no window. */
const NO_WINDOW_KEY: TargetKey = "M7";

export interface PlanSample {
  plan: TonightSessionPlan;
  /** The editor's data for it (`planEditorData`). */
  editor: PlanEditorData;
}

export interface PlanSamples {
  /** The forms' hidden fields: the sample site's id and the night's date. */
  siteId: string;
  night: string;
  /** Tonight's suggested plan, as a full-plan user sees it before editing; `null` if the build fails. */
  suggested: PlanSample | null;
  /** The saved list applied: the user's order, an order hint and a "Not on tonight's plan" entry. */
  edited: PlanSample | null;
}

function sampleOf(plan: TonightSessionPlan | null, locale: Locale): PlanSample | null {
  const editor = plan ? planEditorData(plan, locale) : null;
  return plan && editor ? { plan, editor } : null;
}

export function planSamples(locale: Locale): PlanSamples {
  const build = (planEdits: TargetKey[] | null) =>
    buildTonight({ site: SITE, telescope: TELESCOPE, eyepieces: [], forecast: FORECAST, now: NOW }, locale, {
      withSessionPlan: true,
      withPlanCandidates: true,
      planEdits,
    });
  const suggested = build(null);
  const keys = (suggested.sessionPlan?.rows ?? []).map((row) => row.key).filter(isTargetKey);
  // The latest best time first, then the rest by best time: a row whose window ends before then carries the hint.
  const latest = keys.at(-1);
  const edited = build([...keys.slice(-1), ...keys.filter((key) => key !== latest), NO_WINDOW_KEY]);
  return {
    siteId: SITE.id,
    night: suggested.date,
    suggested: sampleOf(suggested.sessionPlan, locale),
    edited: sampleOf(edited.sessionPlan, locale),
  };
}

/**
 * What the editor's visually hidden status region (F6) says after a Move, a Remove and an Add on the saved sample list,
 * worded by the island's own `editorAnnouncement`, so `/design` can show the text that a screen reader hears.
 */
export function planStatusSamples(editor: PlanEditorData, locale: Locale): { action: string; text: string }[] {
  const t = getMessages(locale).tonight.pages.plan;
  const state: PlanEditorState = { rows: editor.rows, notTonight: editor.notTonight };
  const present = new Set(savedKeys(state));
  const option = editor.candidates.find((candidate) => !present.has(candidate.key));
  const actions: { action: string; run: PlanEditorAction | null }[] = [
    { action: "Move down", run: editor.rows[0] ? { type: "move-down", key: editor.rows[0].key } : null },
    { action: "Remove", run: editor.rows[1] ? { type: "remove", key: editor.rows[1].key } : null },
    {
      action: "Add",
      run: option
        ? {
            type: "add",
            row: { key: option.key, label: option.label, line: option.detail, bestAt: null, windowEnd: null },
          }
        : null,
    },
  ];
  return actions.flatMap(({ action, run }) => {
    const text = run ? editorAnnouncement(t, state, run, editPlan(state, run)) : null;
    return text === null ? [] : [{ action, text }];
  });
}
