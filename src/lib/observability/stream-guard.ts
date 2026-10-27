/**
 * A body stream that logs its own failure (stream-error-boundary, Phase 1). A page's HTML is sent as it renders, so a
 * render error after the first chunk is a rejected read with a 200 already on the wire: nothing above the stream sees
 * it. The guard passes chunks through unchanged, and when the source read rejects it leaves one `logFailure` line and
 * errors the returned stream with the same value, so the client sees exactly what it saw before. A cancel is the
 * client leaving, not a failure: it reaches the source and logs nothing.
 */

import { logFailure, type FailureExtra, type FailureStep } from "@/lib/observability/log-failure";

export function guardStream(
  source: ReadableStream<Uint8Array>,
  step: FailureStep,
  extra?: FailureExtra,
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let cancelled = false;
  // Nothing is read ahead (a high-water mark of 0): a read of the source happens only when the client reads.
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        let result: ReadableStreamReadResult<Uint8Array>;
        // Only the source read is a failure of the source: closing or enqueuing after a cancel throws, and is not.
        try {
          result = await reader.read();
        } catch (error) {
          // A read that settles after the client left is not a failure the user saw, and the stream is closed already.
          if (!cancelled) {
            logFailure(step, error, extra);
            controller.error(error);
          }
          return;
        }
        if (cancelled) {
          return;
        }
        if (result.done) {
          controller.close();
        } else {
          controller.enqueue(result.value);
        }
      },
      cancel(reason) {
        cancelled = true;
        return reader.cancel(reason);
      },
    },
    { highWaterMark: 0 },
  );
}
