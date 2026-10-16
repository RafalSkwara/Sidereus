import type { MessageKey } from "@/i18n";
import type { WriteFault } from "./fault";
import { logFailure, logNotice, type FailureStep } from "./log-failure";

/**
 * The one step every save and delete route takes on a failed write (error-visibility, Phase 4): trace what the
 * result's `fault` says and pick the `?error=` value. A real server fault is an error-level line (it can become a
 * Workers Issue) and redirects with the neutral `errors.serverFault`, because the entity's "could not save" would
 * blame the user's data for the server's failure. A refusal (`42501`), a session fault and a zero-row update are
 * the user's request or the session, not an outage: a warn-level notice and the entity's own key. A result without a
 * `fault` is a user mistake (an input check) and leaves no line.
 *
 * Only the fault's `code` and `status` reach the line (through `logFailure`'s own shape checks); nothing else of the
 * result is read.
 */

/** The redirect key of a server fault: neutral copy that fits a save and a delete (decision D3). */
export const SERVER_FAULT_KEY: MessageKey = "errors.serverFault";

export function saveFailureKey(step: FailureStep, result: { message: MessageKey; fault?: WriteFault }): MessageKey {
  const { fault } = result;
  if (fault === undefined) {
    return result.message;
  }
  const extra = fault.status === undefined ? undefined : { status: fault.status };
  if (fault.kind === "server") {
    logFailure(step, fault, extra);
    return SERVER_FAULT_KEY;
  }
  logNotice(step, fault, extra);
  return result.message;
}
