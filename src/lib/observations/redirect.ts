import type { MessageKey } from "@/i18n";
import { parseTargetParam, type TargetKey } from "@/lib/targets";
import { observationInputSchema, returnTargetSchema } from "./schemas";

/** The log form's path; `POST /api/log` sends the user back here on failure. */
export const LOG_FORM = "/log/new";

/** The log list (roadmap S-07). */
export const LOG_LIST = "/log";

const { target, night, siteId, telescopeId } = observationInputSchema.shape;

/** Form field → query parameter of the form page, with the schema field that must accept the value. */
const PREFILL = [
  ["target", "object", target],
  ["night", "night", night],
  ["siteId", "site", siteId],
  ["telescopeId", "telescope", telescopeId],
] as const;

/**
 * Where a failed save goes: back to the form with its prefill and a fixed message key. Each value is
 * carried only when it parses on its own as a target key, a calendar date or a uuid, so nothing
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
  // Manual entry (S-07) keeps its mode: the form comes back with the object picker, not the ranking's fixed object.
  const from = returnTargetSchema.safeParse(raw.from);
  if (from.success && from.data) {
    query.set("from", from.data);
  }
  query.set("error", error);
  return `${LOG_FORM}?${query.toString()}`;
}

/** Where a failed edit goes: back to the entry's page with a fixed message key and nothing else. */
export function editRedirect(id: string, error: MessageKey): string {
  return `${LOG_LIST}/${encodeURIComponent(id)}?${new URLSearchParams({ error }).toString()}`;
}

export type LogNotice = "saved" | "updated" | "deleted";

const LOG_NOTICES: readonly LogNotice[] = ["saved", "updated", "deleted"];

/** The log after a successful write, naming the object the notice is about by its target key only. */
export function logNotice(kind: LogNotice, target: TargetKey): string {
  return `${LOG_LIST}?${new URLSearchParams({ [kind]: target }).toString()}`;
}

/**
 * The notice the log shows for its query (`logNotice`), or `null`. A bare Messier number, as links from before
 * target keys carry it, reads as that object's key.
 */
export function readLogNotice(params: URLSearchParams): { kind: LogNotice; target: TargetKey } | null {
  for (const kind of LOG_NOTICES) {
    const target = parseTargetParam(params.get(kind));
    if (target) {
      return { kind, target };
    }
  }
  return null;
}

/** The log page number from `?page=`: a positive integer, anything else (missing, junk, 0) reads as the first page. */
export function parseLogPage(param: string | null): number {
  if (!param || !/^\d{1,6}$/.test(param)) {
    return 1;
  }
  const page = Number(param);
  return page >= 1 ? page : 1;
}
