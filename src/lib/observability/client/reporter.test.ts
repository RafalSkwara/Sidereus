import { afterEach, describe, expect, it, vi } from "vitest";

import { createReporter, type ClientReport } from "./reporter";
import { NETWORK_STEPS } from "./steps";

/**
 * The reporter core builds the one payload a client may send, `{ step, name? }`, and keeps a browser from flooding the
 * endpoint: what it may carry is the privacy rule, the caps are the volume rule (D9, D10, D14).
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

// Text a real failure could carry: a coordinate pair, an email and a URL, in every property a browser error has.
const CANARY = "52.2297,21.0122 ada.lovelace@example.test https://example.test/tonight?lat=52.2297";

function leakyError(name: string): Error {
  const error = Object.assign(new Error(CANARY), { fileName: CANARY, lineNumber: 12, url: CANARY, code: 42 });
  error.name = name;
  error.stack = `${name}: ${CANARY}\n    at ${CANARY}:1:1`;
  return error;
}

function setup(maxTotal = 5) {
  const sent: ClientReport[] = [];
  const send = vi.fn((payload: ClientReport) => {
    sent.push(payload);
  });
  return { sent, send, reporter: createReporter({ send, maxTotal }) };
}

describe("createReporter", () => {
  it("sends only the step and a shaped name, never a message, stack, file name, line, URL or code", () => {
    const { sent, reporter } = setup();
    reporter.report("sw.index", leakyError("QuotaExceededError"));
    reporter.report("island.uncaught", CANARY);
    reporter.report("island.import", Object.assign(new Error("m"), { name: CANARY }));
    reporter.report("island.geocode", null);
    expect(sent).toEqual([
      { step: "sw.index", name: "QuotaExceededError" },
      { step: "island.uncaught" },
      { step: "island.import" },
      { step: "island.geocode" },
    ]);
    expect(JSON.stringify(sent)).not.toMatch(/52\.2297|ada\.lovelace|example\.test/);
  });

  it("sends one report per step and name, a different name or step again, and stops after the cap", () => {
    const { sent, reporter } = setup(4);
    reporter.report("sw.index", new RangeError("a"));
    reporter.report("sw.index", new RangeError("b"));
    reporter.report("sw.index", new TypeError("c"));
    reporter.report("sw.shell", new RangeError("d"));
    expect(sent).toHaveLength(3);
    reporter.report("sw.purge", new RangeError("e"));
    reporter.report("sw.sweep", new RangeError("f"));
    reporter.report("island.import", new RangeError("g"));
    expect(sent).toHaveLength(4);
    expect(sent.at(-1)).toEqual({ step: "sw.purge", name: "RangeError" });
  });

  it("drops a routine network fault at a network step but reports a storage fault there", () => {
    const { sent, reporter } = setup();
    const [step] = NETWORK_STEPS;
    reporter.report(step, new TypeError("Failed to fetch"));
    expect(sent).toEqual([]);
    reporter.report(step, Object.assign(new Error("full"), { name: "QuotaExceededError" }));
    expect(sent).toEqual([{ step, name: "QuotaExceededError" }]);
  });

  it("drops a report while the device is offline without using up its cap or its dedupe", () => {
    const { sent, reporter } = setup(1);
    vi.stubGlobal("navigator", { onLine: false });
    reporter.report("sw.index", new RangeError("x"));
    expect(sent).toEqual([]);
    vi.stubGlobal("navigator", { onLine: true });
    reporter.report("sw.index", new RangeError("x"));
    expect(sent).toEqual([{ step: "sw.index", name: "RangeError" }]);
  });

  it("never throws and never waits for send, whether send throws or rejects", async () => {
    const throwing = createReporter({
      send: () => {
        throw new Error(CANARY);
      },
      maxTotal: 5,
    });
    const rejecting = createReporter({ send: () => Promise.reject(new Error(CANARY)), maxTotal: 5 });
    expect(() => {
      throwing.report("sw.index", new RangeError("x"));
      rejecting.report("sw.index", new RangeError("x"));
    }).not.toThrow();

    // A send that never settles leaves report returning at once (the next report is still counted).
    const hanging = vi.fn(() => new Promise<void>(() => undefined));
    const reporter = createReporter({ send: hanging, maxTotal: 5 });
    reporter.report("sw.index", new RangeError("x"));
    reporter.report("sw.shell", new RangeError("x"));
    expect(hanging).toHaveBeenCalledTimes(2);

    // A rejection nobody handled would fail the run as an unhandled rejection: let the microtasks drain first.
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
