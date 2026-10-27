import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { guardStream } from "./stream-guard";

/**
 * The guard is the only protection of three risks: a body that fails while it is read leaves exactly one line and
 * still fails for the client, a clean body leaves none, and a client that goes away (a cancel) is not a failure.
 */

let errors: MockInstance<typeof console.error>;
beforeEach(() => {
  errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  errors.mockRestore();
});

const bytes = (text: string) => new TextEncoder().encode(text);

/** A stream that gives one chunk, then fails (or ends) on the next read. */
function source(finish: "error" | "close", onCancel?: (reason: unknown) => void): ReadableStream<Uint8Array> {
  let sent = false;
  return new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (!sent) {
          sent = true;
          controller.enqueue(bytes("head"));
        } else if (finish === "error") {
          controller.error(new RangeError("render failed"));
        } else {
          controller.close();
        }
      },
      cancel(reason) {
        onCancel?.(reason);
      },
    },
    { highWaterMark: 0 },
  );
}

describe("guardStream", () => {
  it("logs one line for an error after a chunk, and the consumer still gets the chunk and then the same error", async () => {
    const reader = guardStream(source("error"), "request.stream", { route: "/tonight" }).getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("head");
    await expect(reader.read()).rejects.toThrow("render failed");
    expect(errors).toHaveBeenCalledExactlyOnceWith("sidereus: request.stream failed", {
      step: "request.stream",
      name: "RangeError",
      route: "/tonight",
    });
  });

  it("logs nothing for a stream that ends cleanly and passes its chunks through", async () => {
    const reader = guardStream(source("close"), "request.stream").getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("head");
    expect((await reader.read()).done).toBe(true);
    expect(errors).not.toHaveBeenCalled();
  });

  it("logs nothing when the consumer cancels, and forwards the cancel to the source", async () => {
    const onCancel = vi.fn();
    const reader = guardStream(source("error", onCancel), "request.stream").getReader();
    await reader.read();
    await reader.cancel("gone");
    expect(onCancel).toHaveBeenCalledExactlyOnceWith("gone");
    expect(errors).not.toHaveBeenCalled();
  });

  it("logs nothing and throws nothing when the consumer cancels while a read of the source is pending", async () => {
    // The second pull never settles, as an island waiting on the forecast: the cancel then resolves the guard's pending
    // read as done, and the guard must not try to close a stream the client already cancelled.
    let sent = false;
    const pending = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          if (!sent) {
            sent = true;
            controller.enqueue(bytes("head"));
            return undefined;
          }
          return new Promise<void>(() => undefined);
        },
      },
      { highWaterMark: 0 },
    );
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const reader = guardStream(pending, "request.stream", { route: "/tonight" }).getReader();
      await reader.read();
      const waiting = reader.read();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await reader.cancel("gone");
      expect((await waiting).done).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(errors).not.toHaveBeenCalled();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });

  it("logs nothing when the pending read of the source rejects because the consumer cancelled", async () => {
    // A source whose cancel rejects the read it has pending (not every runtime resolves it as done): that rejection is
    // the client leaving, not a failure the user saw.
    let rejectRead: (error: unknown) => void = () => undefined;
    const fake = {
      getReader: () => ({
        read: () =>
          new Promise<never>((_, reject) => {
            rejectRead = reject;
          }),
        cancel: () => {
          rejectRead(new RangeError("aborted by cancel"));
          return Promise.resolve();
        },
      }),
    } as unknown as ReadableStream<Uint8Array>;
    const reader = guardStream(fake, "request.stream", { route: "/tonight" }).getReader();
    const waiting = reader.read();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await reader.cancel("gone");
    expect((await waiting).done).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errors).not.toHaveBeenCalled();
  });
});
