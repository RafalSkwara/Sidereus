import { logFailure, logNotice } from "@/lib/observability/log-failure";
import type { TypedSupabaseClient } from "@/lib/supabase";
import type { TonightView } from "@/lib/tonight/build";
import type { RecordedHeadline } from "./claim";
import { skyCheckStore } from "./store";

/** What Tonight hands to `skyCheckStore.record` for the night it shows. */
export interface RecordableVerdict {
  siteId: string;
  night: string;
  headline: RecordedHeadline;
  darkStart: Date;
}

/**
 * The sky check Tonight records for the night it shows (verdict-check), or `null` when there is nothing to check:
 * no view, or a night with no dark window, which has no sky to judge and no start to freeze the headline at.
 */
export function recordableVerdict(
  view: Pick<TonightView, "siteId" | "date" | "headline" | "darkStart"> | null,
): RecordableVerdict | null {
  if (!view?.darkStart) {
    return null;
  }
  const headline = view.headline.id;
  if (headline === "noDarkness") {
    return null;
  }
  return { siteId: view.siteId, night: view.date, headline, darkStart: view.darkStart };
}

/**
 * Records the headline the way Tonight does, fire and forget, and traces both ways it can fail
 * (error-visibility): a result that is not ok logs `tonight.sky-check-record` with the fault's code and status, and a
 * rejection logs the error's name. The fault comes from the store: a database code, `request` when the request never
 * completed (a timeout, a dropped connection), `http` with the status when a gateway answered without a PostgREST
 * error body, and a class 22 or 23 code, which is our bug here. `logFailure` is for a server fault (or none at all:
 * unknown is not benign), `logNotice` for a refusal, a stale session or a zero-row outcome: the user's request or
 * session, not an outage. It never rejects, so the caller can hand it to the Worker's `waitUntil` as is, and nothing it
 * logs can cost Tonight its render.
 */
export function recordSkyVerdict(client: TypedSupabaseClient, input: RecordableVerdict): Promise<void> {
  return skyCheckStore.record(client, input).then(
    (result) => {
      if (result.ok) {
        return;
      }
      const { fault } = result;
      const log = fault === undefined || fault.kind === "server" ? logFailure : logNotice;
      log("tonight.sky-check-record", fault, { status: fault?.status });
    },
    (error: unknown) => {
      logFailure("tonight.sky-check-record", error);
    },
  );
}
