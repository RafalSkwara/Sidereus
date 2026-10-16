import { classifyFault, faultFrom } from "./fault";
import { logFailure, logNotice, type FailureStep } from "./log-failure";

/**
 * The one call a page makes when a read behind a "could not load" banner throws (error-visibility, impl review F8):
 * it classifies the thrown store error the way a failed save is classified (`saveFailureKey`), reading the
 * `StoreFault` the store left as the error's `cause`. A session fault (`PGRST301` to `PGRST303`) or an RLS refusal
 * (`42501`) is the user's session or request, not an outage: a warn-level notice that never becomes an Issue. Every
 * other throw, a thrown non-store error and a read with no code included (a network failure or a timeout), is an
 * error-level failure, because unknown is not benign.
 *
 * Only the step, the shaped name and the code reach the line (through `logFailure` / `logNotice`'s own checks).
 * Never throws.
 */
export function logReadFailure(step: FailureStep, error: unknown): void {
  const { code, status } = faultFrom(error);
  const kind = classifyFault({ code, status });
  if (kind === "session" || kind === "refused") {
    logNotice(step, error);
  } else {
    logFailure(step, error);
  }
}
