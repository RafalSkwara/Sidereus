import { describe, expect, it } from "vitest";

import { createCoalescer } from "./coalesce";

/** A task whose runs the test finishes by hand, in order. */
function manualTask() {
  const started: string[] = [];
  const finishers: (() => void)[] = [];
  const rejecters: ((error: Error) => void)[] = [];
  const task = (value: string) => {
    started.push(value);
    return new Promise<void>((resolve, reject) => {
      finishers.push(resolve);
      rejecters.push(reject);
    });
  };
  return {
    task,
    started,
    finish: (n: number) => {
      finishers[n]();
    },
    fail: (n: number, error: Error) => {
      rejecters[n](error);
    },
  };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("createCoalescer", () => {
  it("re-runs once, for the latest value, after the run in flight (not dropped, not stacked)", async () => {
    const { task, started, finish } = manualTask();
    const run = createCoalescer(task);
    const first = run("plan", "A");
    const second = run("plan", "B");
    const third = run("plan", "C");
    expect(started).toEqual(["A"]);
    finish(0);
    await tick();
    expect(started).toEqual(["A", "C"]);
    finish(1);
    await Promise.all([first, second, third]);
    expect(started).toEqual(["A", "C"]);
  });

  it("resolves a joined call only when the re-run has finished, and keeps keys apart", async () => {
    const { task, started, finish } = manualTask();
    const run = createCoalescer(task);
    void run("plan", "A");
    let joinedDone = false;
    const joined = run("plan", "B").then(() => {
      joinedDone = true;
    });
    // Another key starts at once, beside the run in flight.
    const other = run("other", "X");
    expect(started).toEqual(["A", "X"]);
    finish(0);
    await tick();
    expect(joinedDone).toBe(false);
    finish(2);
    await joined;
    expect(joinedDone).toBe(true);
    finish(1);
    await other;
    expect(started).toEqual(["A", "X", "B"]);
  });

  it("still runs the queued re-run after a failure, then rethrows the first error and frees the key", async () => {
    const { task, started, finish, fail } = manualTask();
    const run = createCoalescer(task);
    const first = run("plan", "A");
    const caught = first.catch((error: unknown) => error);
    void run("plan", "B");
    fail(0, new Error("first"));
    await tick();
    expect(started).toEqual(["A", "B"]);
    finish(1);
    expect(await caught).toEqual(new Error("first"));
    const again = run("plan", "C");
    expect(started).toEqual(["A", "B", "C"]);
    finish(2);
    await again;
  });
});
