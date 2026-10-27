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
  // Nothing is read ahead (a high-water mark of 0): a read of the source happens only when the client reads.
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch (error) {
          logFailure(step, error, extra);
          controller.error(error);
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    },
    { highWaterMark: 0 },
  );
}
