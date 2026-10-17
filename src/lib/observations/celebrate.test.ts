import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import type { LogEntry } from "@/lib/engine";
import type { MilestoneKey } from "@/lib/progress/milestones";

import { reachedBySave } from "./celebrate";
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
    return Promise.resolve(inserted);
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
      route: "create",
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
      route: "create",
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
      route: "create",
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

  it("records first-galaxy from before when an edit moves it away (M31 to M13)", async () => {
    const fixture = new Fixture([M31]);
    const { celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      route: "create",
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

  it("still writes, reads and records the after-state after a failed before-read, and celebrates nothing", async () => {
    const fixture = new Fixture();
    fixture.failRead = new Set([1]);
    const { result, celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      route: "create",
      write: fixture.write((log) => [...log, M31]),
    });

    expect(result).toEqual({ ok: true });
    expect(fixture.calls).toEqual(["read", "write", "read", "record"]);
    expect(fixture.recorded).toEqual([[{ key: "first-galaxy", reachedNight: "2026-09-05" }]]);
    expect(celebrate).toEqual([]);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("sidereus: milestones.read-create failed", {
      step: "milestones.read-create",
      name: "Error",
    });
  });

  it("celebrates nothing after a failed record, still confirms the save, and logs the fixed line", async () => {
    const fixture = new Fixture();
    fixture.failRecord = new Error("a message that must never be logged", { cause: new TypeError("cause message") });
    const { result, celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: true,
      route: "create",
      write: fixture.write((log) => [...log, M31]),
    });

    expect(result).toEqual({ ok: true });
    expect(celebrate).toEqual([]);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith("sidereus: milestones.record-create failed", {
      step: "milestones.record-create",
      name: "TypeError",
    });
  });
});

describe("reachedBySave, a save that cannot count (counts: false)", () => {
  it("stores the milestone before a delete takes its only entry away", async () => {
    const fixture = new Fixture([M31]);
    const { celebrate } = await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: false,
      route: "delete",
      write: fixture.write(() => []),
    });

    expect(fixture.calls).toEqual(["read", "record", "write"]);
    expect(fixture.stored).toEqual(new Set(["first-galaxy"]));
    expect(celebrate).toEqual([]);
  });
});

describe("reachedBySave traces a failed milestone step under the route's own step", () => {
  it("names the edit route for a failed read and a failed record, with the cause's code and never a message", async () => {
    const fixture = new Fixture([M31]);
    fixture.failRead = new Set([1]);
    await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: false,
      route: "edit",
      write: fixture.write(() => [{ ...M31, rating: 2 }]),
    });
    expect(errors.mock.calls).toEqual([
      ["sidereus: milestones.read-edit failed", { step: "milestones.read-edit", name: "Error" }],
    ]);

    errors.mockClear();
    const recording = new Fixture([M31]);
    recording.failRecord = new Error("load with 52.37,4.89 in it", { cause: { code: "08006", details: "52.37" } });
    await reachedBySave({
      read: recording.read,
      record: recording.record,
      counts: false,
      route: "edit",
      write: recording.write(() => [{ ...M31, rating: 2 }]),
    });
    expect(errors.mock.calls).toEqual([
      ["sidereus: milestones.record-edit failed", { step: "milestones.record-edit", name: "Error", code: "08006" }],
    ]);
    expect(JSON.stringify(errors.mock.calls)).not.toContain("52.37");
  });

  it("names the delete route for a failed record, with the cause's name when the error is a plain wrapper", async () => {
    const fixture = new Fixture([M31]);
    fixture.failRecord = new Error("load", { cause: new TypeError("boom") });
    await reachedBySave({
      read: fixture.read,
      record: fixture.record,
      counts: false,
      route: "delete",
      write: fixture.write(() => []),
    });
    expect(errors).toHaveBeenCalledExactlyOnceWith("sidereus: milestones.record-delete failed", {
      step: "milestones.record-delete",
      name: "TypeError",
    });
  });
});
