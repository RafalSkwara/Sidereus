import type { TonightView } from "@/lib/tonight/build";
import type { RecordedHeadline } from "./claim";

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
