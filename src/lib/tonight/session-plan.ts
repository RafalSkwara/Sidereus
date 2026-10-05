import type { Interval } from "@/lib/engine";

/**
 * The Session plan's layout (session-plan-timeline): the night on one axis, sunset to sunrise, with the dark window,
 * the Moon's rise and set and one row per target as fractions of the axis (0 at its start, 1 at its end), the rows in
 * the order they come up. Pure: no clock and no formatting; whatever a row carries besides its window passes through.
 */

/** A target as `buildTonight` hands it in. `window` is its best window, `bestAt` its peak (epoch ms). */
export interface SessionPlanRowInput {
  kind: "object" | "planet" | "moon";
  key: string;
  window: Interval;
  bestAt: number;
}

/** A row on the axis: its window `from`–`to` and its peak `best`, each clamped to [0, 1]. */
export type SessionPlanRow<R extends SessionPlanRowInput> = Omit<R, "window"> & {
  from: number;
  to: number;
  best: number;
};

export interface SessionPlanMoonEvent {
  kind: "rise" | "set";
  /** Fraction of the axis, inside (0, 1). */
  at: number;
  /** Epoch ms. */
  time: number;
}

export interface SessionPlanLayout<R extends SessionPlanRowInput> {
  /** The axis, epoch ms. */
  axis: { start: number; end: number };
  /** The dark window on the axis; `null` without one, or when it lies wholly outside the axis. */
  dark: { from: number; to: number } | null;
  /** Moonrises and moonsets strictly inside the axis, in time order. */
  moonEvents: SessionPlanMoonEvent[];
  /** By peak, earliest first; ties keep the input order. Rows whose window misses the axis are dropped. */
  rows: SessionPlanRow<R>[];
  /** Epoch ms of every whole hour on the axis (local, per `isWholeHour`), ends included, for ticks. */
  hours: number[];
}

export interface SessionPlanInput<R extends SessionPlanRowInput> {
  axis: Interval;
  dark: Interval | null;
  /** When the Moon is up over the axis; a span touching an axis end is up there, not rising or setting. */
  moonSpans: readonly Interval[];
  /** In tie order: the Moon, the planets, then the deep-sky objects by rank. */
  rows: readonly R[];
  /**
   * Whether an instant (always a whole quarter hour) starts a whole hour on the site's clock, so ticks land on local
   * hours in zones offset by :30 or :45; the caller decides with its time zone. Defaults to whole UTC hours.
   */
  isWholeHour?: (ms: number) => boolean;
}

const HOUR_MS = 3_600_000;
const QUARTER_MS = HOUR_MS / 4;

export function layoutSessionPlan<R extends SessionPlanRowInput>(input: SessionPlanInput<R>): SessionPlanLayout<R> {
  const start = input.axis.start.getTime();
  const end = input.axis.end.getTime();
  const length = end - start;
  const at = (ms: number): number => (length > 0 ? Math.min(1, Math.max(0, (ms - start) / length)) : 0);
  const overlaps = (interval: Interval): boolean => interval.end.getTime() >= start && interval.start.getTime() <= end;

  const dark =
    input.dark !== null && overlaps(input.dark)
      ? { from: at(input.dark.start.getTime()), to: at(input.dark.end.getTime()) }
      : null;

  const moonEvents: SessionPlanMoonEvent[] = [];
  for (const span of input.moonSpans) {
    const rise = span.start.getTime();
    const set = span.end.getTime();
    if (rise > start && rise < end) {
      moonEvents.push({ kind: "rise", at: at(rise), time: rise });
    }
    if (set > start && set < end) {
      moonEvents.push({ kind: "set", at: at(set), time: set });
    }
  }
  moonEvents.sort((a, b) => a.time - b.time);

  const rows = input.rows
    .filter((row) => overlaps(row.window))
    .map((row): SessionPlanRow<R> => {
      const { window, ...rest } = row;
      return { ...rest, from: at(window.start.getTime()), to: at(window.end.getTime()), best: at(row.bestAt) };
    })
    // Array.prototype.sort is stable, so ties keep the input order.
    .sort((a, b) => a.bestAt - b.bestAt);

  // Every zone offset is a whole number of quarter hours, so a local whole hour is always one of these instants.
  const isWholeHour = input.isWholeHour ?? ((ms: number) => ms % HOUR_MS === 0);
  const hours: number[] = [];
  for (let quarter = Math.ceil(start / QUARTER_MS) * QUARTER_MS; quarter <= end; quarter += QUARTER_MS) {
    if (isWholeHour(quarter)) {
      hours.push(quarter);
    }
  }

  return { axis: { start, end }, dark, moonEvents, rows, hours };
}
