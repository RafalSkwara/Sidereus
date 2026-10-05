import { describe, expect, it } from "vitest";

import { layoutSessionPlan, type SessionPlanRowInput } from "./session-plan";

// An axis from 18:00 to 06:00 UTC across midnight, twelve hours long.
const axis = { start: new Date("2026-10-10T18:00:00Z"), end: new Date("2026-10-11T06:00:00Z") };
const at = (iso: string) => new Date(iso);

function row(key: string, start: string, end: string, best: string, kind: SessionPlanRowInput["kind"] = "object") {
  return { kind, key, window: { start: at(start), end: at(end) }, bestAt: at(best).getTime() };
}

describe("layoutSessionPlan", () => {
  it("orders rows by best time across midnight", () => {
    const layout = layoutSessionPlan({
      axis,
      dark: null,
      moonSpans: [],
      rows: [
        row("M1", "2026-10-11T01:00:00Z", "2026-10-11T03:00:00Z", "2026-10-11T02:00:00Z"),
        row("M2", "2026-10-10T20:00:00Z", "2026-10-10T23:00:00Z", "2026-10-10T21:00:00Z"),
        row("M3", "2026-10-10T22:00:00Z", "2026-10-11T01:00:00Z", "2026-10-11T00:00:00Z"),
      ],
    });
    expect(layout.rows.map((r) => r.key)).toEqual(["M2", "M3", "M1"]);
    expect(layout.rows[1]).toMatchObject({ from: 4 / 12, to: 7 / 12, best: 6 / 12 });
    expect(layout.hours).toHaveLength(13);
  });

  it("keeps the input order on a tie", () => {
    const best = "2026-10-10T22:00:00Z";
    const layout = layoutSessionPlan({
      axis,
      dark: null,
      moonSpans: [],
      rows: [
        row("moon", "2026-10-10T20:00:00Z", "2026-10-11T00:00:00Z", best, "moon"),
        row("jupiter", "2026-10-10T21:00:00Z", "2026-10-10T23:00:00Z", best, "planet"),
        row("M31", "2026-10-10T19:00:00Z", "2026-10-11T01:00:00Z", best),
      ],
    });
    expect(layout.rows.map((r) => r.key)).toEqual(["moon", "jupiter", "M31"]);
  });

  it("clamps a window that crosses an axis end", () => {
    const layout = layoutSessionPlan({
      axis,
      dark: { start: at("2026-10-10T17:00:00Z"), end: at("2026-10-11T07:00:00Z") },
      moonSpans: [],
      rows: [row("venus", "2026-10-10T16:00:00Z", "2026-10-10T19:00:00Z", "2026-10-10T17:30:00Z", "planet")],
    });
    expect(layout.dark).toEqual({ from: 0, to: 1 });
    expect(layout.rows[0]).toMatchObject({ from: 0, to: 1 / 12, best: 0 });
  });

  it("drops rows whose window lies wholly outside the axis", () => {
    const layout = layoutSessionPlan({
      axis,
      dark: null,
      moonSpans: [],
      rows: [
        row("early", "2026-10-10T15:00:00Z", "2026-10-10T17:00:00Z", "2026-10-10T16:00:00Z"),
        row("inside", "2026-10-10T20:00:00Z", "2026-10-10T21:00:00Z", "2026-10-10T20:30:00Z"),
        row("late", "2026-10-11T07:00:00Z", "2026-10-11T08:00:00Z", "2026-10-11T07:30:00Z"),
      ],
    });
    expect(layout.rows.map((r) => r.key)).toEqual(["inside"]);
  });

  it("marks moonrise and moonset only inside the axis", () => {
    const layout = layoutSessionPlan({
      axis,
      dark: null,
      // Up at sunset and setting at 21:00, then rising at 03:00 and up at sunrise.
      moonSpans: [
        { start: axis.start, end: at("2026-10-10T21:00:00Z") },
        { start: at("2026-10-11T03:00:00Z"), end: axis.end },
      ],
      rows: [],
    });
    expect(layout.moonEvents).toEqual([
      { kind: "set", at: 3 / 12, time: at("2026-10-10T21:00:00Z").getTime() },
      { kind: "rise", at: 9 / 12, time: at("2026-10-11T03:00:00Z").getTime() },
    ]);
  });

  it("has no dark span without a dark window", () => {
    const layout = layoutSessionPlan({ axis, dark: null, moonSpans: [], rows: [] });
    expect(layout.dark).toBeNull();
  });
});
