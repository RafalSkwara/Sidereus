import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import type { LogEntry } from "@/lib/engine";
import type { MilestoneKey } from "@/lib/progress/milestones";

import { logMilestoneFailure, reachedBySave } from "./celebrate";
import type { MilestoneRecordInput } from "./milestone-store";

/**
 * The seams are plain functions over an in-memory log and an in-memory stored set (no `vi.mock`); the milestone
 * rule itself runs for real (`milestonesOf` over `observingProgress`), so a test states entries, not progress.
 * Catalogue facts: M31 and M33 are galaxies, M45 an open cluster (no milestone), and M2-M5, M9, M10, M12-M14 are
 * globular clusters.
 */

const M31: LogEntry = { target: "M31", night: "2026-09-05", rating: 4 };
const M13: LogEntry = { target: "M13", night: "2026-09-10", rating: 4 };

type Call = "read" | "write" | "record";

class Fixture {
  /** What the log holds right now. */
  log: LogEntry[];
  /** Milestones already stored, which `record` ignores like the table's unique key. */
  readonly stored = new Set<MilestoneKey>();
  readonly calls: Call[] = [];
  readonly recorded: MilestoneRecordInput[][] = [];
  /** A failing read, by call number (1-based). */
  failRead: ReadonlySet<number> = new Set();
  failRecord: Error | null = null;
  /** When set, `record` returns this instead of what it really inserted. */
  inserts: MilestoneKey[] | null = null;
  private reads = 0;

  constructor(log: LogEntry[] = []) {
    this.log = log;
  }

  readonly read = (): Promise<LogEntry[]> => {
    this.calls.push("read");
    this.reads += 1;
    if (this.failRead.has(this.reads)) {
      return Promise.reject(new Error("errors.load.observations with a secret value"));
    }
    return Promise.resolve([...this.log]);
  };

  readonly record = (states: MilestoneRecordInput[]): Promise<MilestoneKey[]> => {
    this.calls.push("record");
    this.recorded.push(states);
    if (this.failRecord) {
      return Promise.reject(this.failRecord);
    }
    const inserted = states.map((state) => state.key).filter((key) => !this.stored.has(key));
    inserted.forEach((key) => this.stored.add(key));
    return Promise.resolve(this.inserts ?? inserted);
  };

  /** A write that applies `change` to the log and succeeds. */
  write(change: (log: LogEntry[]) => LogEntry[]) {
    return () => {
      this.calls.push("write");
      this.log = change(this.log);
      return Promise.resolve({ ok: true as const });
    };
  }

  /** A write that fails and leaves the log alone. */
  readonly failingWrite = () => {
    this.calls.push("write");
    return Promise.resolve({ ok: false as const, message: "errors.save.observation" as const });
  };
}

let errors: MockInstance<typeof console.error>;

beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  errors.mockRestore();
});

describe("reachedBySave, a counting save", () => {
  it("reads, writes, reads again, records once, and celebrates a milestone the record inserted", async () => {
    const fixture = new Fixture();
    const { result, celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      write: fixture.write((log) => [...log, M31]),
    });

    expect(result).toEqual({ ok: true });
    expect(fixture.calls).toEqual(["read", "write", "read", "record"]);
    expect(fixture.recorded).toEqual([[{ key: "first-galaxy", reachedNight: "2026-09-05" }]]);
    expect(celebrate).toEqual(["first-galaxy"]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("does not celebrate a newly reached key that record did not return (already stored)", async () => {
    const fixture = new Fixture();
    fixture.stored.add("first-galaxy");
    const { celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      write: fixture.write((log) => [...log, M31]),
    });

    expect(fixture.recorded).toEqual([[{ key: "first-galaxy", reachedNight: "2026-09-05" }]]);
    expect(celebrate).toEqual([]);
  });

  it("records a key reached before and after (a backfill) but celebrates only the newly reached one", async () => {
    const fixture = new Fixture([M31]);
    const { celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      write: fixture.write((log) => [...log, M13]),
    });

    expect(fixture.recorded).toEqual([
      [
        { key: "first-galaxy", reachedNight: "2026-09-05" },
        { key: "first-globular", reachedNight: "2026-09-10" },
      ],
    ]);
    expect(fixture.stored).toEqual(new Set(["first-galaxy", "first-globular"]));
    expect(celebrate).toEqual(["first-globular"]);
  });

  it("records the after night where both states have the milestone", async () => {
    const fixture = new Fixture([M31]);
    const earlier: LogEntry = { target: "M33", night: "2026-09-02", rating: 5 };
    const { celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      write: fixture.write((log) => [...log, earlier]),
    });

    expect(fixture.recorded).toEqual([[{ key: "first-galaxy", reachedNight: "2026-09-02" }]]);
    expect(celebrate).toEqual([]);
  });

  it("records first-galaxy from before when an edit moves it away (M31 to M13)", async () => {
    const fixture = new Fixture([M31]);
    const { celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      write: fixture.write(() => [M13]),
    });

    expect(fixture.recorded).toEqual([
      [
        { key: "first-galaxy", reachedNight: "2026-09-05" },
        { key: "first-globular", reachedNight: "2026-09-10" },
      ],
    ]);
    expect(celebrate).toEqual(["first-globular"]);
  });

  it("celebrates in MILESTONES order whatever order record returns them in", async () => {
    const messier = ["M2", "M3", "M4", "M5", "M9", "M10", "M12", "M13", "M14"].map<LogEntry>((target, i) => ({
      target,
      night: `2026-08-${String(i + 1).padStart(2, "0")}`,
      rating: 4,
    }));
    const fixture = new Fixture(messier);
    fixture.inserts = ["messier-10", "first-galaxy"];
    const { celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      write: fixture.write((log) => [...log, M31]),
    });

    expect(celebrate).toEqual(["first-galaxy", "messier-10"]);
  });

  it("records nothing and celebrates nothing when the save reached nothing", async () => {
    const fixture = new Fixture();
    const { result, celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      write: fixture.write((log) => [...log, { target: "M45", night: "2026-09-01", rating: 4 }]),
    });

    expect(result).toEqual({ ok: true });
    expect(fixture.calls).toEqual(["read", "write", "read"]);
    expect(celebrate).toEqual([]);
  });

  it("still writes, reads and records the after-state after a failed before-read, and celebrates nothing", async () => {
    const fixture = new Fixture();
    fixture.failRead = new Set([1]);
    const { result, celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      write: fixture.write((log) => [...log, M31]),
    });

    expect(result).toEqual({ ok: true });
    expect(fixture.calls).toEqual(["read", "write", "read", "record"]);
    expect(fixture.recorded).toEqual([[{ key: "first-galaxy", reachedNight: "2026-09-05" }]]);
    expect(celebrate).toEqual([]);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("milestones: read failed", "Error");
  });

  it("records the before-state after a failed after-read, and celebrates nothing", async () => {
    const fixture = new Fixture([M31]);
    fixture.failRead = new Set([2]);
    const { result, celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      write: fixture.write((log) => [...log, M13]),
    });

    expect(result).toEqual({ ok: true });
    expect(fixture.recorded).toEqual([[{ key: "first-galaxy", reachedNight: "2026-09-05" }]]);
    expect(celebrate).toEqual([]);
    expect(errors).toHaveBeenCalledWith("milestones: read failed", "Error");
  });

  it("returns the write's failure unchanged and records and celebrates nothing", async () => {
    const fixture = new Fixture([M31]);
    const { result, celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      write: fixture.failingWrite,
    });

    expect(result).toEqual({ ok: false, message: "errors.save.observation" });
    expect(fixture.calls).toEqual(["read", "write"]);
    expect(celebrate).toEqual([]);
    expect(errors).not.toHaveBeenCalled();
  });

  it("celebrates nothing after a failed record, still confirms the save, and logs the fixed line", async () => {
    const fixture = new Fixture();
    fixture.failRecord = new Error("a message that must never be logged", { cause: new TypeError("cause message") });
    const { result, celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      write: fixture.write((log) => [...log, M31]),
    });

    expect(result).toEqual({ ok: true });
    expect(celebrate).toEqual([]);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("milestones: record failed", "Error", "TypeError");
  });
});

describe("reachedBySave, a save that cannot count (counts: false)", () => {
  it("reads and records the before-state, then writes, and celebrates nothing (an edit to 1-2)", async () => {
    const fixture = new Fixture([M31]);
    const { result, celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: false,
      write: fixture.write(() => [{ ...M31, rating: 2 }]),
    });

    expect(result).toEqual({ ok: true });
    expect(fixture.calls).toEqual(["read", "record", "write"]);
    expect(fixture.recorded).toEqual([[{ key: "first-galaxy", reachedNight: "2026-09-05" }]]);
    expect(fixture.stored).toEqual(new Set(["first-galaxy"]));
    expect(celebrate).toEqual([]);
  });

  it("stores the milestone before a delete takes its only entry away", async () => {
    const fixture = new Fixture([M31]);
    const { celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: false,
      write: fixture.write(() => []),
    });

    expect(fixture.calls).toEqual(["read", "record", "write"]);
    expect(fixture.stored).toEqual(new Set(["first-galaxy"]));
    expect(celebrate).toEqual([]);
  });

  it("makes no record call when the log reached nothing", async () => {
    const fixture = new Fixture();
    await reachedBySave({ read: fixture.read, record: fixture.record, counts: false, write: fixture.write(() => []) });

    expect(fixture.calls).toEqual(["read", "write"]);
  });

  it("still writes after a failed read, with nothing recorded, and traces it", async () => {
    const fixture = new Fixture([M31]);
    fixture.failRead = new Set([1]);
    const { result, celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: false,
      write: fixture.write(() => []),
    });

    expect(result).toEqual({ ok: true });
    expect(fixture.calls).toEqual(["read", "write"]);
    expect(celebrate).toEqual([]);
    expect(errors).toHaveBeenCalledWith("milestones: read failed", "Error");
  });

  it("still writes after a failed record, and traces it", async () => {
    const fixture = new Fixture([M31]);
    fixture.failRecord = new Error("a message that must never be logged");
    const { result, celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: false,
      write: fixture.write(() => []),
    });

    expect(result).toEqual({ ok: true });
    expect(fixture.calls).toEqual(["read", "record", "write"]);
    expect(celebrate).toEqual([]);
    expect(errors).toHaveBeenCalledWith("milestones: record failed", "Error");
  });

  it("returns the write's failure unchanged", async () => {
    const fixture = new Fixture([M31]);
    const { result, celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: false,
      write: fixture.failingWrite,
    });

    expect(result).toEqual({ ok: false, message: "errors.save.observation" });
    expect(celebrate).toEqual([]);
  });
});

describe("logMilestoneFailure", () => {
  it("logs the fixed line for each step with the error's name only, never its message", () => {
    for (const step of ["read", "record", "list", "seen"] as const) {
      logMilestoneFailure(step, new RangeError("52.37,4.89 in a message"));
    }

    expect(errors.mock.calls).toEqual([
      ["milestones: read failed", "RangeError"],
      ["milestones: record failed", "RangeError"],
      ["milestones: list failed", "RangeError"],
      ["progress: seen read failed", "RangeError"],
    ]);
    expect(JSON.stringify(errors.mock.calls)).not.toContain("52.37");
  });

  it("adds the cause's name when there is one", () => {
    logMilestoneFailure("list", new Error("load", { cause: new TypeError("boom") }));

    expect(errors).toHaveBeenCalledWith("milestones: list failed", "Error", "TypeError");
  });

  it("names the type of a non-Error, never its value", () => {
    logMilestoneFailure("seen", "52.37,4.89");
    logMilestoneFailure("seen", new Error("load", { cause: { code: "42501", details: "52.37" } }));

    expect(errors.mock.calls).toEqual([
      ["progress: seen read failed", "string"],
      ["progress: seen read failed", "Error", "object"],
    ]);
  });
});
