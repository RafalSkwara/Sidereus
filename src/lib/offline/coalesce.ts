// One in-flight run per key, and at most one queued re-run behind it (adjustable-session-plan F2 b). The service
// worker's `store-page` handler uses it so a second request for a page that is already being stored is not dropped:
// it marks the key dirty with the latest value, and the task runs once more, for that value, after the current run.
// Three requests during one run collapse into one re-run (the latest). Pure and clock-free; nothing here logs.

/**
 * Wraps `task` so calls for one key never overlap. The returned function resolves when the key is idle again (every
 * run it started or joined has finished), so a caller can hand it to `waitUntil`. A task that rejects does not stop
 * the queued re-run; the first rejection is rethrown once the key is idle, so the caller decides what to do with it.
 */
export function createCoalescer<Value>(
  task: (value: Value) => Promise<void>,
): (key: string, value: Value) => Promise<void> {
  const running = new Map<string, Promise<void>>();
  const queued = new Map<string, Value>();

  async function drive(key: string, first: Value): Promise<void> {
    let value = first;
    let failure: { error: unknown } | undefined;
    try {
      for (;;) {
        try {
          await task(value);
        } catch (error) {
          failure ??= { error };
        }
        if (!queued.has(key)) break;
        value = queued.get(key) as Value;
        queued.delete(key);
      }
    } finally {
      running.delete(key);
    }
    if (failure) throw failure.error;
  }

  return (key, value) => {
    const current = running.get(key);
    if (current) {
      queued.set(key, value);
      return current;
    }
    const run = drive(key, value);
    running.set(key, run);
    return run;
  };
}
