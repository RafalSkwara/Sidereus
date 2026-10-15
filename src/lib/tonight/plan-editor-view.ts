import { getMessages } from "@/i18n";
import { targetOptions } from "@/lib/observations/target-options";
import type { TargetOption } from "@/lib/observations/target-search";
import type { Locale } from "@/lib/preferences";
import type { TonightSessionPlan } from "@/lib/tonight/build";
import type { EditorEntry, EditorRow } from "@/lib/tonight/plan-editor";

/** What the plan editor island is given (adjustable-session-plan Phase 5), worded on the server. */
export interface PlanEditorData {
  /** The plan's rows in their order, named and worded as the timeline shows them. */
  rows: EditorRow[];
  /**
   * What "add" may offer, as the picker's options in the catalogue's order: tonight's candidates (`plan.candidates`) and
   * the current rows, so a row removed in the editor can be added back; each `detail` is its window ("Window 21:40–23:10").
   * The island leaves out what is already on the list.
   */
  candidates: TargetOption[];
  /** Saved targets with no window tonight (D4): listed apart, removable, never a row. */
  notTonight: EditorEntry[];
}

/**
 * The editor's data for one Session plan, or `null` when the plan offers no editing (`candidates` is `null`: not asked
 * for, another night, or a night that does not pass). Server-only: the options come from the catalogue
 * (`targetOptions`), so the island never imports it, and every string is worded here, in the page's locale.
 */
export function planEditorData(plan: TonightSessionPlan, locale: Locale): PlanEditorData | null {
  if (plan.candidates === null) {
    return null;
  }
  const t = getMessages(locale).tonight.pages.plan;
  const rows = plan.rows.map((row): EditorRow => ({
    key: row.key,
    label: row.name,
    line: t.rowLine({ best: row.bestTime, window: row.windowText, direction: row.bestDirection }),
    bestAt: row.bestAt,
    windowEnd: row.windowEnd,
  }));
  const detailOf = new Map<string, string>(plan.candidates.map((option) => [option.key, option.detail]));
  for (const row of plan.rows) {
    if (!detailOf.has(row.key)) {
      detailOf.set(row.key, t.candidateDetail({ window: row.windowText }));
    }
  }
  const candidates = targetOptions(locale).flatMap((option) => {
    const detail = detailOf.get(option.key);
    return detail === undefined ? [] : [{ ...option, detail }];
  });
  return { rows, candidates, notTonight: plan.notTonight.map(({ key, label }) => ({ key, label })) };
}
