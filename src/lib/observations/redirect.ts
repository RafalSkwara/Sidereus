import type { MessageKey } from "@/i18n";
import { MILESTONES, isMilestoneKey, type MilestoneKey } from "@/lib/progress/milestones";
import { parseTargetParam, type TargetKey } from "@/lib/targets";
import { isKnownTarget } from "@/lib/targets/labels";
import { observationInputSchema, returnTargetSchema, type TonightReturnPage } from "./schemas";

/** The log form's path; `POST /api/log` sends the user back here on failure. */
export const LOG_FORM = "/log/new";

/** The log list (roadmap S-07). */
export const LOG_LIST = "/log";

/** The progress page (observing-progress, M-3 S-05): a view of the observation log itself. */
export const PROGRESS_PAGE = "/log/progress";

/** Tonight's dashboard, where a save without a known return page lands. */
const TONIGHT = "/tonight";

/** The focused Tonight pages (tonight-dashboard) a "Mark observed" link carries in `from`. */
const TONIGHT_PAGES: Record<TonightReturnPage, string> = {
  targets: "/tonight/targets",
  moon: "/tonight/moon",
  planets: "/tonight/planets",
};

/**
 * The Tonight page a ranking-flow save returns to, from the form's `from` value: the focused page that linked to
 * the form, else Tonight itself (a missing or unknown value, or `log`, whose manual entry returns to the log).
 */
export function tonightReturnPath(from: unknown): string {
  const target = returnTargetSchema.safeParse(from).data;
  return target && target !== "log" ? TONIGHT_PAGES[target] : TONIGHT;
}

/** A value that already passed the target schema is a well-formed key; this asks whether the catalogue has it. */
const isKnown = (value: string) => isKnownTarget(value as TargetKey);

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
 * carried only when it parses on its own as a target key the catalogue knows (a well-formed "NGC1" is dropped), a
 * calendar date or a uuid, so nothing typed by hand (and never a coordinate) ends up in the URL. The rating is
 * never carried.
 *
 * Server-side: `isKnownTarget` reads the catalogue, and only routes import this module (no island may).
 */
export function formRedirect(raw: Record<string, unknown>, error: MessageKey): string {
  const query = new URLSearchParams();
  for (const [field, param, schema] of PREFILL) {
    const value = raw[field];
    if (typeof value === "string" && schema.safeParse(value).success && (field !== "target" || isKnown(value))) {
      query.set(param, value);
    }
  }
  // The return target survives a failed save: manual entry (S-07) keeps its mode (the form comes back with the
  // object picker, not the ranking's fixed object), and a focused Tonight page stays the page the save returns to.
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
 * A relative success URL (it may already have a query, as `/log?saved=M31` does) with one `milestone=<key>` per
 * milestone the save newly stored, in the order given (`MILESTONES` order). No keys leaves the URL unchanged. The
 * values are keys from the fixed set, never a typed value.
 */
export function withMilestones(url: string, keys: readonly MilestoneKey[]): string {
  if (keys.length === 0) {
    return url;
  }
  const hash = url.indexOf("#");
  const path = hash === -1 ? url : url.slice(0, hash);
  const fragment = hash === -1 ? "" : url.slice(hash);
  const query = new URLSearchParams(keys.map((key) => ["milestone", key])).toString();
  return `${path}${path.includes("?") ? "&" : "?"}${query}${fragment}`;
}

/**
 * The milestones a page celebrates, from its `milestone` params (`withMilestones` writes them): each value that is a
 * key of the fixed set, once, in `MILESTONES` order. Signed out, nothing is celebrated, so a crafted link shows a
 * visitor nothing. The values are never shown as typed: callers render catalogue copy for the keys.
 */
export function readMilestoneParam(url: URL, signedIn: boolean): MilestoneKey[] {
  if (!signedIn) {
    return [];
  }
  const asked = new Set(url.searchParams.getAll("milestone").filter(isMilestoneKey));
  return MILESTONES.map(({ key }) => key).filter((key) => asked.has(key));
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
