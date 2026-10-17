import { describe, expect, it } from "vitest";

import { layoutSessionPlan, type SessionPlanRowInput } from "./session-plan";

// An axis from 18:00 to 06:00 UTC across midnight, twelve hours long.
const axis = { start: new Date("2026-10-10T18:00:00Z"), end: new Date("2026-10-11T06:00:00Z") };
const at = (iso: string) => new Date(iso);

function row(key: string, start: string, end: string, best: string, kind: SessionPlanRowInput["kind"] = "object") {
  return { kind, key, window: { start: at(start), end: at(end) }, bestAt: at(best).getTime() };
}

describe("layoutSessionPlan", () => {
  it("orders rows by best time across midnight, clamps a window that crosses an axis end and drops one wholly outside it", () => {
    const layout = layoutSessionPlan({
      axis,
      dark: null,
      moonSpans: [],
      rows: [
        row("M1", "2026-10-11T01:00:00Z", "2026-10-11T03:00:00Z", "2026-10-11T02:00:00Z"),
        row("venus", "2026-10-10T16:00:00Z", "2026-10-10T19:00:00Z", "2026-10-10T17:30:00Z", "planet"),
        row("early", "2026-10-10T15:00:00Z", "2026-10-10T17:00:00Z", "2026-10-10T16:00:00Z"),
        row("M3", "2026-10-10T22:00:00Z", "2026-10-11T01:00:00Z", "2026-10-11T00:00:00Z"),
        row("late", "2026-10-11T07:00:00Z", "2026-10-11T08:00:00Z", "2026-10-11T07:30:00Z"),
      ],
    });
    expect(layout.rows.map((r) => r.key)).toEqual(["venus", "M3", "M1"]);
    expect(layout.rows[0]).toMatchObject({ from: 0, to: 1 / 12, best: 0 });
    expect(layout.rows[1]).toMatchObject({ from: 4 / 12, to: 7 / 12, best: 6 / 12 });
  });
});
