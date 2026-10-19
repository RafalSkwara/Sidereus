import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClientReport } from "./reporter";
import { CLIENT_ERROR_PATH } from "./steps";

/**
 * The page's reporter and its two global handlers (error-visibility Phase 9, D9, D13, D15). What a report may carry is the
 * privacy rule (a step and an error's name, never a message, a stack, a file name or a URL); which events reach it is the
 * signal rule (only the site's own scripts, so an extension's or the console's error never reads as ours); the cap keeps
 * a looping page from flooding the endpoint. Every test imports a fresh module, because the page has one reporter whose
 * cap and dedupe live as long as the module.
 */

const ORIGIN = "https://sidereus.example";
// Text a real failure could carry: a coordinate pair, an email, a URL and a script path.
const CANARY = "52.2297,21.0122 ada.lovelace@example.test https://example.test/tonight?lat=52.2297";
const OWN_SCRIPT = `${ORIGIN}/_astro/TonightSkyView.abc123.js`;

type Listener = (event: unknown) => void;

function fakeWindow() {
  const listeners = new Map<string, Listener[]>();
  const window = {
    location: { origin: ORIGIN },
    addEventListener: vi.fn((type: string, listener: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    }),
  };
  return {
    window,
    listenerCount: (type: string) => listeners.get(type)?.length ?? 0,
    dispatch: (type: string, event: unknown) => {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

/** A page whose `sendBeacon` accepts every report; `bodies()` reads what the beacons carried. */
function setup({ beacon = true }: { beacon?: boolean | "missing" } = {}) {
  const page = fakeWindow();
  const beacons: { url: string; blob: Blob }[] = [];
  const sendBeacon = vi.fn((url: string, blob: Blob) => {
    beacons.push({ url, blob });
    return beacon === true;
  });
  const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("window", page.window);
  vi.stubGlobal("navigator", beacon === "missing" ? { onLine: true } : { onLine: true, sendBeacon });
  vi.stubGlobal("fetch", fetchMock);
  return {
    ...page,
    beacons,
    fetchMock,
    bodies: async (): Promise<string[]> => Promise.all(beacons.map(({ blob }) => blob.text())),
    sent: async (): Promise<ClientReport[]> =>
      (await Promise.all(beacons.map(({ blob }) => blob.text()))).map((text) => JSON.parse(text) as ClientReport),
  };
}

async function freshModule() {
  vi.resetModules();
  return import("./browser");
}

function error(name: string, message = CANARY): Error {
  const value = new Error(message);
  value.name = name;
  value.stack = `${name}: ${message}\n    at ${OWN_SCRIPT}:1:1`;
  return value;
}

function errorEvent(value: unknown, filename = OWN_SCRIPT) {
  return { error: value, message: CANARY, filename, lineno: 3, colno: 9 };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("installErrorReporting: the window error handler", () => {
  it("sends exactly the step and the name of an error from our own script, never its message, stack or file", async () => {
    const page = setup();
    const { installErrorReporting } = await freshModule();
    installErrorReporting();
    page.dispatch("error", errorEvent(error("TypeError")));

    expect(page.beacons).toHaveLength(1);
    expect(page.beacons[0].url).toBe(CLIENT_ERROR_PATH);
    expect(page.beacons[0].blob.type).toBe("text/plain");
    expect(await page.sent()).toEqual([{ step: "island.uncaught", name: "TypeError" }]);
    const [body] = await page.bodies();
    expect(body).not.toMatch(/52\.2297|ada\.lovelace|example\.test|_astro|TonightSkyView|sidereus\.example/);
  });

  it("ignores an event with no error object and a script that is not ours, and still reports a script that is", async () => {
    const page = setup();
    const { installErrorReporting } = await freshModule();
    installErrorReporting();

    const strangers: [string, ReturnType<typeof errorEvent>][] = [
      ["a cross-origin 'Script error.' (no error object)", errorEvent(null, "")],
      ["an event whose error is undefined", errorEvent(undefined)],
      ["console input in Chromium (empty file name)", errorEvent(new TypeError("x"), "")],
      ["console input in WebKit (the string undefined)", errorEvent(new TypeError("x"), "undefined")],
      ["a foreign origin", errorEvent(new TypeError("x"), "https://cdn.example.test/lib.js")],
      ["a foreign origin that has an /_astro/ path", errorEvent(new TypeError("x"), "https://evil.test/_astro/x.js")],
      ["a host that merely starts with our origin", errorEvent(new TypeError("x"), `${ORIGIN}.evil.test/_astro/x.js`)],
      ["our origin but not under /_astro/", errorEvent(new TypeError("x"), `${ORIGIN}/sw.js`)],
      ["our origin and a look-alike directory", errorEvent(new TypeError("x"), `${ORIGIN}/_astro-extra/x.js`)],
    ];
    expect(strangers).toHaveLength(9);
    for (const [, event] of strangers) page.dispatch("error", event);
    expect(page.beacons, strangers.map(([label]) => label).join("; ")).toHaveLength(0);

    // Non-vacuity: the handler is live, and an own script right after the strangers is reported.
    page.dispatch("error", errorEvent(new TypeError("x")));
    expect(await page.sent()).toEqual([{ step: "island.uncaught", name: "TypeError" }]);
  });

  it("reports a hydration error as island.hydration and keeps the message out of the body", async () => {
    const page = setup();
    const { installErrorReporting } = await freshModule();
    installErrorReporting();
    const hydration = error("Error", `Hydration failed because the server rendered HTML didn't match ${CANARY}`);
    page.dispatch("error", errorEvent(hydration));
    page.dispatch("error", errorEvent(error("RangeError", `Error while hydrating ${CANARY}`)));

    expect(await page.sent()).toEqual([
      { step: "island.hydration", name: "Error" },
      { step: "island.hydration", name: "RangeError" },
    ]);
    for (const body of await page.bodies())
      expect(body).not.toMatch(/server rendered|while hydrating|52\.2297|ada\.lovelace|example\.test/);
  });

  it("does not let an error object whose message getter throws break the handler: the report still goes out", async () => {
    // An event's error is whatever the page threw, so the hydration check that reads its message runs on untrusted input.
    const page = setup();
    const { installErrorReporting } = await freshModule();
    installErrorReporting();
    const hostile = Object.defineProperty(new TypeError("x"), "message", {
      get() {
        throw new RangeError("the getter ran");
      },
    });
    expect(() => {
      page.dispatch("error", errorEvent(hostile));
    }).not.toThrow();
    expect(await page.sent()).toEqual([{ step: "island.uncaught", name: "TypeError" }]);
  });
});

describe("installErrorReporting: the unhandledrejection handler", () => {
  it("reports a rejection with no file name filter, by name only, and a non-Error reason as a step alone", async () => {
    const page = setup();
    const { installErrorReporting } = await freshModule();
    installErrorReporting();
    page.dispatch("unhandledrejection", { reason: error("RangeError") });
    page.dispatch("unhandledrejection", { reason: CANARY });

    expect(await page.sent()).toEqual([
      { step: "island.unhandled-rejection", name: "RangeError" },
      { step: "island.unhandled-rejection" },
    ]);
    for (const body of await page.bodies()) expect(body).not.toMatch(/52\.2297|ada\.lovelace|example\.test/);
  });
});

describe("the page's one reporter", () => {
  it("stops after 5 reports, whichever handler or site they come from", async () => {
    const page = setup();
    const { installErrorReporting, report } = await freshModule();
    installErrorReporting();
    page.dispatch("error", errorEvent(error("ErrorOne")));
    page.dispatch("unhandledrejection", { reason: error("ErrorTwo") });
    report("island.import", error("ErrorThree"));
    page.dispatch("error", errorEvent(error("ErrorFour")));
    page.dispatch("unhandledrejection", { reason: error("ErrorFive") });
    expect(page.beacons).toHaveLength(5);

    page.dispatch("error", errorEvent(error("ErrorSix")));
    report("island.geocode", error("ErrorSeven"));
    expect(page.beacons).toHaveLength(5);
  });

  it("registers each handler once however often it is installed, and hands events to a reporter it is given", async () => {
    const page = setup();
    const { installErrorReporting } = await freshModule();
    const given = { report: vi.fn() };
    installErrorReporting(given);
    installErrorReporting(given);
    installErrorReporting();

    expect(page.listenerCount("error")).toBe(1);
    expect(page.listenerCount("unhandledrejection")).toBe(1);
    page.dispatch("error", errorEvent(error("TypeError")));
    expect(given.report).toHaveBeenCalledTimes(1);
    expect(given.report).toHaveBeenCalledWith("island.uncaught", expect.any(Error));
    expect(page.beacons).toHaveLength(0);
  });

  it("falls back to a keepalive fetch when sendBeacon is missing or refuses the report", async () => {
    for (const beacon of ["missing", false] as const) {
      const page = setup({ beacon });
      const { report } = await freshModule();
      report("island.import", error("TypeError"));

      expect(page.fetchMock, `sendBeacon ${String(beacon)}`).toHaveBeenCalledTimes(1);
      expect(page.fetchMock).toHaveBeenCalledWith(CLIENT_ERROR_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "island.import", name: "TypeError" }),
        keepalive: true,
      });
      vi.unstubAllGlobals();
    }
  });

  it("does not use the fetch fallback when sendBeacon accepts the report", async () => {
    const page = setup();
    const { report } = await freshModule();
    report("island.import", error("TypeError"));
    expect(page.beacons).toHaveLength(1);
    expect(page.fetchMock).not.toHaveBeenCalled();
  });

  it("never throws or surfaces a rejection when the send fails, and reportAnd still returns its fallback", async () => {
    const page = setup();
    // The beacon refuses, so each report reaches the fetch fallback: the first one throws at once, the rest reject.
    vi.stubGlobal("navigator", { onLine: true, sendBeacon: () => false });
    let calls = 0;
    vi.stubGlobal("fetch", () => {
      calls += 1;
      if (calls === 1) throw new Error(CANARY);
      return Promise.reject(new Error(CANARY));
    });
    const { installErrorReporting, report, reportAnd } = await freshModule();
    installErrorReporting();

    expect(() => {
      report("island.import", error("TypeError"));
      page.dispatch("error", errorEvent(error("RangeError")));
      page.dispatch("unhandledrejection", { reason: error("SyntaxError") });
    }).not.toThrow();
    expect(calls).toBe(3);
    expect(reportAnd("island.import", "fallback")(error("EvalError"))).toBe("fallback");

    // A rejection nobody handled would fail the run as an unhandled rejection: let the microtasks drain first.
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
