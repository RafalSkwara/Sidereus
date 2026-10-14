import type { Messages } from "@/i18n";
import { findDeepSky } from "@/lib/catalogue";
import { expectationFor, type ExpectationKey } from "@/lib/engine";
import type { AccountPlan, PlanRead } from "@/lib/account-plan";

/**
 * The server side of "what to expect" (M-3 S-04, what-to-expect): the catalogue lookup around the engine's pure rule,
 * the sentence in the request's language, and which of the two lines a plan read earns. Server-only: it imports the
 * catalogue, so no island may import it.
 */

/** The key for a catalogue object seen from a site of this Bortle class through this aperture; null for an unknown id. */
export function expectationKeyFor(id: string, bortle: number, apertureMm: number): ExpectationKey | null {
  const object = findDeepSky(id);
  return object ? expectationFor(object, bortle, apertureMm) : null;
}

/** The phrase for a key, in the catalogue's language. */
export function expectationText(key: ExpectationKey, messages: Messages): string {
  return messages.tonight.expect.phrase[key];
}

/**
 * What a page shows for the request's plan: `lines` on a confirmed full plan, `locked` (the one muted line) only on an
 * explicit free read, and `none` when the read failed, so a paying user is never told they lack the plan because of a
 * transient error (D-13). `access` is `getAccountPlan` (fails closed, decides the lines); `read` is the same memoised
 * read as `accountPlanForCopy` (tells free from unknown, decides the locked line).
 */
export function expectationView(access: AccountPlan, read: PlanRead): "lines" | "locked" | "none" {
  if (access === "full") {
    return "lines";
  }
  return read === "free" ? "locked" : "none";
}
