import type { MessageKey } from "@/i18n";
import { observationInputSchema } from "./schemas";

/** The log form's path; `POST /api/log` sends the user back here on failure. */
export const LOG_FORM = "/log/new";

const { messier, night, siteId, telescopeId } = observationInputSchema.shape;

/** Form field → query parameter of the form page, with the schema field that must accept the value. */
const PREFILL = [
  ["messier", "object", messier],
  ["night", "night", night],
  ["siteId", "site", siteId],
  ["telescopeId", "telescope", telescopeId],
] as const;

/**
 * Where a failed save goes: back to the form with its prefill and a fixed message key. Each value is
 * carried only when it parses on its own as a Messier number, a calendar date or a uuid, so nothing
 * typed by hand (and never a coordinate) ends up in the URL. The rating is never carried.
 */
export function formRedirect(raw: Record<string, unknown>, error: MessageKey): string {
  const query = new URLSearchParams();
  for (const [field, param, schema] of PREFILL) {
    const value = raw[field];
    if (typeof value === "string" && schema.safeParse(value).success) {
      query.set(param, value);
    }
  }
  query.set("error", error);
  return `${LOG_FORM}?${query.toString()}`;
}
