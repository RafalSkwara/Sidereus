import { describe, expect, it } from "vitest";

import { en } from "@/i18n/messages/en";
import type { TonightSessionPlan, TonightSessionPlanRow } from "@/lib/tonight/build";

import { planEditorData } from "./plan-editor-view";

const HOUR = 3_600_000;

function row(key: string, name: string, kind: TonightSessionPlanRow["kind"], bestHour: number): TonightSessionPlanRow {
  return {
    kind,
    key,
    label: key,
    name,
    href: "/tonight/targets",
    bestAt: bestHour * HOUR,
    bestTime: "22:40",
    windowText: "21:40–23:10",
    windowEnd: (bestHour + 1) * HOUR,
    bestDirection: "SW, 45°",
    track: [],
    peakAltitudeDeg: 45,
    from: 0.1,
    to: 0.4,
    best: 0.2,
    endsBeforePrevious: false,
  };
}

function plan(overrides: Partial<TonightSessionPlan>): TonightSessionPlan {
  return {
    sunsetText: null,
    sunriseText: null,
    dark: null,
    darkText: "",
    moonEvents: [],
    moonText: "",
    ticks: [],
    rows: [row("jupiter", "Jupiter", "planet", 23), row("M31", "M31 · Andromeda Galaxy", "object", 22)],
    minAltitudeDeg: 15,
    trackStep: 0.01,
    nextUp: null,
    edited: true,
    heldEdits: false,
    notTonight: [{ key: "M7", label: "M7" }],
    candidates: [
      { key: "M42", id: "M42", label: "M42 · Orion Nebula", detail: "Window 01:00–05:00", names: ["Orion Nebula"] },
    ],
    ...overrides,
  };
}

describe("planEditorData", () => {
  it("words the rows as the timeline does, keeping their order and times", () => {
    const data = planEditorData(plan({}), "en");
    expect(data?.rows).toEqual([
      {
        key: "jupiter",
        label: "Jupiter",
        line: en.tonight.pages.plan.rowLine({ best: "22:40", window: "21:40–23:10", direction: "SW, 45°" }),
        bestAt: 23 * HOUR,
        windowEnd: 24 * HOUR,
      },
      expect.objectContaining({ key: "M31", label: "M31 · Andromeda Galaxy", bestAt: 22 * HOUR }),
    ]);
    expect(data?.notTonight).toEqual([{ key: "M7", label: "M7" }]);
  });

  it("offers the candidates and the current rows, in catalogue order, each with its window", () => {
    const data = planEditorData(plan({}), "en");
    // Messier objects first, then the Moon and the planets (targetOptions' order), whatever the plan's order.
    expect(data?.candidates.map((option) => option.key)).toEqual(["M31", "M42", "jupiter"]);
    expect(data?.candidates.map((option) => option.detail)).toEqual([
      en.tonight.pages.plan.candidateDetail({ window: "21:40–23:10" }),
      "Window 01:00–05:00",
      en.tonight.pages.plan.candidateDetail({ window: "21:40–23:10" }),
    ]);
    // The picker's own names, so typing "31" or "Andromeda" finds the row again.
    expect(data?.candidates[0].names).toContain("Andromeda Galaxy");
  });

  it("never offers a target with no window tonight", () => {
    const data = planEditorData(plan({}), "en");
    expect(data?.candidates.some((option) => option.key === "M7")).toBe(false);
  });

  it("is null when the plan offers no editing", () => {
    expect(planEditorData(plan({ candidates: null }), "en")).toBeNull();
  });
});
