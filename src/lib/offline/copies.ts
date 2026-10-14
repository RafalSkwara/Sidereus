// The stored Tonight copies (S-06, offline-night-plan, Phase 3): every decision the service worker makes, as pure
// functions over plain data (URLs, HTML strings, the JSON index), so the rules are unit-tested here and `src/sw.ts`
// only wires them to Workbox and the Cache API. A copy is one *pair*: a Tonight shell and the server-island response
// it references by exact URL (the island URL changes on every render, so a shell replays only with its own island).
// The index holds site ids and names, never coordinates; nothing here logs.
import { SKY_CHECKED_PARAM } from "@/lib/sky-checks/redirect";
import { parseTargetParam } from "@/lib/targets";
import { isGearId } from "@/lib/tonight/gear-choice";

/**
 * The seven Tonight pages, matched exactly: `/tonight/all` (a 301) and any other `/tonight/*` path are not pages.
 * `listCopies` orders the `/offline` list by this array, so a page's position here is its place there: new pages go last.
 */
export const TONIGHT_PAGES = [
  "/tonight",
  "/tonight/targets",
  "/tonight/plan",
  "/tonight/moon",
  "/tonight/planets",
  "/tonight/nights",
  "/tonight/events",
] as const;

export type TonightPage = (typeof TONIGHT_PAGES)[number];
/**
 * The finder chart (finder-chart Phase 5): a stored page keyed by its target as well, one pair per site, target and
 * night kind. It is not a Tonight page: it has no next-night copy and its island says which plan it was rendered for.
 */
export const FINDER_PAGE = "/tonight/finder";
export type StoredPage = TonightPage | typeof FINDER_PAGE;
/** The plan an island was rendered for (`data-plan`); `unknown` when the plan read failed or the value is missing. */
export type CopyPlan = "full" | "free" | "unknown";
/** `next` is the background copy of the evening after tonight (`?night=next`). */
export type CopyKind = "tonight" | "next";
/** Which offline notice the stored copy calls for; the page script reveals it (Phase 4). */
export type CopyNotice = "prepared" | "old-forecast" | "stale";

/** The index's own key in the worker's Tonight cache. */
export const INDEX_KEY = "/__offline/index.json";
/** The page served when a request needs the network and there is no stored copy for it. */
export const OFFLINE_PAGE = "/offline";
/** A site's copies expire this long after its last refresh. */
export const EXPIRY_MS = 36 * 60 * 60 * 1000;
/** A `next` copy younger than this is not fetched again when its `tonight` copy is refreshed. */
export const NEXT_REFRESH_MS = 60 * 60 * 1000;

// Their notices are baked into the island props, so a copy stored with them would show "Saved" forever.
const NOTICE_PARAMS = ["logged", SKY_CHECKED_PARAM, "error", "milestone"];
const ISLAND_PREFIX = "/_server-islands/";
// Resolves the relative URLs found in HTML; only the path and query are ever kept.
const BASE = "http://localhost";
// `ownerFingerprint` (owner.ts): a SHA-256 in hex, never the user id itself.
const OWNER = /^[0-9a-f]{64}$/;

/** What the island's `[data-offline-copy]` element says about the copy (`OfflineCopy.astro`). */
export interface IslandCopy {
  /** Whose copy it is: a fingerprint of the user id (`ownerFingerprint`), never the id or the email. */
  owner: string;
  siteId: string;
  siteName: string;
  kind: CopyKind;
  nightDate: string;
  preparedAt: string;
  validUntil: string;
  forecastFetchedAt: string | null;
  /** The finder chart's canonical target key (`M31`, `jupiter`); `null` on every Tonight page. */
  target: string | null;
  /** The target's display name as the island rendered it; `null` with no target. */
  targetName: string | null;
  /** Which plan the island was rendered for. Never `"free"` by default: a missing value reads as `"unknown"`. */
  plan: CopyPlan;
  /**
   * When the server read that plan (`data-plan-at`), not when the page was rendered: a chart built after a demotion from
   * a plan read before it keeps the earlier time (finder-chart review F1). An island or a stored copy without it reads
   * as `preparedAt`.
   */
  planAt: string;
}

/** One stored pair. Keys and URLs are path + query; times are ISO strings. */
export interface CopyMeta extends IslandCopy {
  page: StoredPage;
  /** The stored shell's key in the Tonight cache (unique per pair, so a replacement never deletes the new shell). */
  shellKey: string;
  /** The exact island URL the stored shell references; the island response is stored under it. */
  islandUrl: string;
  storedAt: string;
  /** The `/_astro/*` files the pair needs, kept in the assets cache while any pair references them. */
  assets: string[];
}

export interface CopyIndex {
  /**
   * A random id given to the index when it is created, so after a purge (sign-out, sign-in) a commit that started
   * before it (an island in flight, the next-night fetch) sees a different scope and stores nothing.
   */
  userScope: string;
  /**
   * The user every stored copy belongs to (a fingerprint, as on the island); `null` until the first commit. A commit by
   * anyone else purges every copy first (`needsReset`), whatever sign-in or sign-out the worker did not see.
   */
  owner: string | null;
  /** The site of the most recently committed `tonight` copy: what a bare `/tonight` means (the remembered cookie). */
  lastSiteId: string | null;
  copies: CopyMeta[];
  /**
   * The `planAt` of the newest answer the device saw for a free account (a server time: an island's `data-plan-at`, a
   * locked finder answer's, or its `Date` header when that has none); `null` when none. A finder pair whose plan was
   * read at or before it is refused, so a chart built from a plan read before a demotion cannot come back after the
   * demotion cleared the charts (reviews F12, F1). A full island whose plan was read later clears it.
   */
  freeSince: string | null;
}

/** An index change and the cache entries it leaves unreferenced. */
export interface IndexChange {
  index: CopyIndex;
  /** Shell and island keys in the Tonight cache. */
  deleteKeys: string[];
  /** `/_astro/*` keys in the assets cache that no remaining pair references. */
  deleteAssets: string[];
}

export function emptyIndex(userScope: string): CopyIndex {
  return { userScope, owner: null, lastSiteId: null, copies: [], freeSince: null };
}

/**
 * Whether a commit by `owner` must first purge every stored copy and start a new scope: the index belongs to another
 * user, or holds copies from before owners were recorded. A new or empty index is simply adopted.
 */
export function needsReset(index: CopyIndex, owner: string): boolean {
  if (index.owner === owner) return false;
  return index.owner !== null || index.copies.length > 0;
}

/** A URL or key reduced to path + query, the form every key and URL in the index takes. */
export function pathKey(url: string | URL): string {
  const parsed = typeof url === "string" ? new URL(url, BASE) : url;
  return parsed.pathname + parsed.search;
}

/** The shell's key: derived from its island URL, so each pair has its own. */
export function shellKeyFor(islandUrl: string): string {
  return `/__offline/shell?island=${encodeURIComponent(islandUrl)}`;
}

/**
 * The Tonight page a URL is, and the site it asks for (`?site=`, only when it is shaped like a site id; anything else
 * means the remembered site, as on the server). Every other query param is ignored. `undefined` for any other path.
 */
export function tonightPageOf(url: URL): { page: TonightPage; siteId: string | undefined } | undefined {
  const page = TONIGHT_PAGES.find((candidate) => candidate === url.pathname);
  if (!page) return undefined;
  return { page, siteId: siteIdOf(url) };
}

function siteIdOf(url: URL): string | undefined {
  const site = url.searchParams.get("site");
  return isGearId(site) ? site : undefined;
}

/**
 * The stored page a URL is, with its site and target: the seven Tonight pages (`target: null`) and the finder chart,
 * the latter only with an `?object=` that `parseTargetParam` accepts, as its canonical key (`?object=31` is `M31`, so
 * a link with a bare Messier number finds the copy stored under the island's `M31`; review F14b). Anything else is
 * `undefined`: neither served from the store nor stored.
 */
export function storedPageOf(
  url: URL,
): { page: StoredPage; siteId: string | undefined; target: string | null } | undefined {
  const tonight = tonightPageOf(url);
  if (tonight) return { ...tonight, target: null };
  if (url.pathname !== FINDER_PAGE) return undefined;
  const target = parseTargetParam(url.searchParams.get("object"));
  return target === null ? undefined : { page: FINDER_PAGE, siteId: siteIdOf(url), target };
}

/** Whether a shell may be stored: a stored page, not with a notice param in its URL. */
export function mayStoreShell(url: URL): boolean {
  return storedPageOf(url) !== undefined && NOTICE_PARAMS.every((param) => !url.searchParams.has(param));
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt);/gi, (entity, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" }[lower] ?? entity;
  });
}

// Quoted values may hold `>` (a site name can), so a tag ends only outside quotes.
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function tagsOf(html: string, name: string): Map<string, string>[] {
  const tags = new RegExp(
    `<${name}\\b((?:\\s+[^\\s"'>/=]+(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'>]+))?)*)\\s*/?>`,
    "gi",
  );
  return [...html.matchAll(tags)].map((tag) => {
    const attributes = new Map<string, string>();
    // Groups that did not take part in a match are undefined at runtime, whatever the typings say.
    const [, list = ""] = tag as (string | undefined)[];
    for (const match of list.matchAll(ATTRIBUTE)) {
      const [, key = "", double, single, bare] = match as (string | undefined)[];
      attributes.set(key.toLowerCase(), decodeEntities(double ?? single ?? bare ?? ""));
    }
    return attributes;
  });
}

/** The island URL a shell will fetch, from its `<link rel="preload" as="fetch">`; none for a POST island. */
export function islandUrlFromShell(html: string): string | undefined {
  const preload = tagsOf(html, "link").find(
    (link) =>
      link.get("rel") === "preload" &&
      link.get("as") === "fetch" &&
      pathKey(link.get("href") ?? "/").startsWith(ISLAND_PREFIX),
  );
  const href = preload?.get("href");
  return href ? pathKey(href) : undefined;
}

function isoOrUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

/**
 * The copy's metadata from island HTML, or `undefined` when there is none: signed out, the island answers 200 with an
 * empty body, and such a response must never be committed.
 */
export function copyMetaFromIsland(html: string): IslandCopy | undefined {
  const element = tagsOf(html, "div").find((div) => div.has("data-offline-copy"));
  if (!element) return undefined;
  const owner = element.get("data-owner");
  const siteId = element.get("data-site-id");
  const siteName = element.get("data-site-name");
  const kind = element.get("data-kind");
  const nightDate = element.get("data-night-date");
  const preparedAt = isoOrUndefined(element.get("data-prepared-at"));
  const validUntil = isoOrUndefined(element.get("data-valid-until"));
  if (!isGearId(siteId) || !siteName || !nightDate || !preparedAt || !validUntil) return undefined;
  if (kind !== "tonight" && kind !== "next") return undefined;
  if (!owner || !OWNER.test(owner)) return undefined;
  // A target the island names must be one that parses: a chart stored under a key nothing can ask for is useless.
  const rawTarget = element.get("data-target");
  const rawName = element.get("data-target-name");
  const target = rawTarget === undefined ? null : parseTargetParam(rawTarget);
  if (rawTarget !== undefined && target === null) return undefined;
  return {
    owner,
    siteId,
    siteName,
    kind,
    nightDate,
    preparedAt,
    validUntil,
    forecastFetchedAt: isoOrUndefined(element.get("data-forecast-fetched-at")) ?? null,
    target,
    targetName: target === null ? null : rawName !== undefined && rawName !== "" ? rawName : target,
    plan: planOf(element.get("data-plan")),
    planAt: isoOrUndefined(element.get("data-plan-at")) ?? preparedAt,
  };
}

/** `data-plan` as a plan: only exactly `full` or `free`; a missing or unrecognised value is `unknown`, never `free`. */
function planOf(value: string | undefined): CopyPlan {
  return value === "full" || value === "free" ? value : "unknown";
}

/**
 * The metadata of a pair to commit, or `undefined` when the shell and its island do not belong together (review
 * F14a): no metadata at all (signed out), a finder shell whose island has no target or was not rendered for the full
 * plan, a Tonight shell whose island names a target, or a target other than the shell URL's canonical `?object=`.
 */
export function copyMetaFor(shellPage: StoredPage, shellUrl: URL, islandHtml: string): IslandCopy | undefined {
  const island = copyMetaFromIsland(islandHtml);
  if (!island) return undefined;
  if (shellPage !== FINDER_PAGE) return island.target === null ? island : undefined;
  if (island.target === null || island.plan !== "full") return undefined;
  return storedPageOf(shellUrl)?.target === island.target ? island : undefined;
}

/** What a locked finder state says: the plan, and when the server read it (`null` when it did not say). */
export interface LockedFinder {
  plan: "free" | "unknown";
  planAt: string | null;
}

/**
 * What a locked finder state says about the plan: the `data-plan` and `data-plan-at` of the element marked
 * `data-finder-state="locked"` (the shell's and the island's locked root), `undefined` when the page has no such
 * element. Only `"free"` clears the stored charts: a missing or unreadable plan (`"unknown"`) clears nothing (review
 * F11).
 */
export function lockedFinderPlan(html: string): LockedFinder | undefined {
  const locked = tagsOf(html, "[a-zA-Z][\\w-]*").find((tag) => tag.get("data-finder-state") === "locked");
  if (!locked) return undefined;
  return {
    plan: locked.get("data-plan") === "free" ? "free" : "unknown",
    planAt: isoOrUndefined(locked.get("data-plan-at")) ?? null,
  };
}

/**
 * The server's time for a locked finder answer, to record as `freeSince`: its own `planAt`; failing that its `Date`
 * header rounded up to the end of its second (the header has no milliseconds, so a render later in the same second is
 * not mistaken for a later one). With neither, `undefined`: the device's clock is not the server's, so the charts are
 * dropped without moving `freeSince` (review F6b).
 */
export function answerTime(planAt: string | null, dateHeader: string | null): string | undefined {
  if (planAt !== null) return planAt;
  const parsed = dateHeader === null ? Number.NaN : Date.parse(dateHeader);
  return Number.isNaN(parsed) ? undefined : new Date(parsed + 999).toISOString();
}

/**
 * The `/_astro/*` files a shell or island references (stylesheets, scripts, island component and renderer URLs),
 * path only, sorted. What those files import in turn is not in the HTML; the worker adds what the page requests.
 */
export function assetUrlsIn(html: string): string[] {
  return [...new Set(html.match(/\/_astro\/[\w.\-/@~%+]+/g) ?? [])].sort();
}

/** Marks a shell served from storage (`<html data-from-device …>`), so the page says it is a stored copy. */
export function markFromDevice(html: string): string {
  return html.replace(/<html(?=[\s>])/i, "<html data-from-device");
}

/** Whether a page was rendered for no user (`<html data-signed-out>`, set by the layout). */
export function isSignedOutPage(html: string): boolean {
  return tagsOf(html, "html").at(0)?.has("data-signed-out") ?? false;
}

/**
 * Whether anything a user left is on the device: an owned or non-empty index, or a stored `/offline` page rendered
 * signed in (its Topbar shows the email). A page rendered signed out purges only then, so it does not thrash.
 */
export function holdsUserData(index: CopyIndex | undefined, offlinePage: string | undefined): boolean {
  if (index && (index.owner !== null || index.copies.length > 0)) return true;
  return offlinePage !== undefined && !isSignedOutPage(offlinePage);
}

function referencedAssets(copies: readonly CopyMeta[]): Set<string> {
  return new Set(copies.flatMap((copy) => copy.assets));
}

function changeRemoving(removed: readonly CopyMeta[], next: CopyIndex): IndexChange {
  const kept = referencedAssets(next.copies);
  return {
    index: next,
    deleteKeys: removed.flatMap((copy) => [copy.shellKey, copy.islandUrl]),
    deleteAssets: [...referencedAssets(removed)].filter((asset) => !kept.has(asset)).sort(),
  };
}

/** The later of two optional ISO times (`null` is no time). */
function laterOf(a: string | null, b: string): string {
  return a !== null && Date.parse(a) > Date.parse(b) ? a : b;
}

/**
 * Commits a pair, replacing the previous pair for the same site, page, target and kind. Idempotent per island URL: the
 * browser may fetch one island twice (the preload and the script), and the second commit changes nothing.
 *
 * The plan the island was rendered for moves the index's `freeSince` (finder-chart D-14): an island rendered for a free
 * account sets it and takes every stored chart with it; a full island whose plan was read after it clears it;
 * `unknown` changes nothing. A finder pair is refused unless it is a full chart whose plan was read after `freeSince`,
 * so a chart built from a plan read before the device last saw a free account never comes back, however late it was
 * rendered (reviews F11, F12, F1). All the times compared are `planAt`, the server's plan-read time.
 */
export function commitPair(index: CopyIndex, meta: CopyMeta): IndexChange {
  const unchanged = { index, deleteKeys: [], deleteAssets: [] };
  if (index.copies.some((copy) => copy.islandUrl === meta.islandUrl)) return unchanged;
  if (meta.page === FINDER_PAGE) {
    const stale = index.freeSince !== null && Date.parse(meta.planAt) <= Date.parse(index.freeSince);
    if (meta.plan !== "full" || meta.target === null || stale) return unchanged;
  }
  const replaced = index.copies.filter(
    (copy) =>
      copy.siteId === meta.siteId && copy.page === meta.page && copy.target === meta.target && copy.kind === meta.kind,
  );
  const demoted = meta.plan === "free";
  // A full island whose plan was read after the last free one is the plan's return; an older one proves nothing.
  const returned =
    meta.plan === "full" && index.freeSince !== null && Date.parse(meta.planAt) > Date.parse(index.freeSince);
  const removed = demoted
    ? [...new Set([...replaced, ...index.copies.filter((copy) => copy.page === FINDER_PAGE)])]
    : replaced;
  const next: CopyIndex = {
    ...index,
    owner: meta.owner,
    // Only a page the user opened moves the remembered site; the next-night copy follows it.
    lastSiteId: meta.kind === "tonight" ? meta.siteId : (index.lastSiteId ?? meta.siteId),
    copies: [...index.copies.filter((copy) => !removed.includes(copy)), meta],
    freeSince: demoted ? laterOf(index.freeSince, meta.planAt) : returned ? null : index.freeSince,
  };
  return changeRemoving(removed, next);
}

/**
 * Removes every stored finder pair (the account lost the full plan) and returns its keys and the assets no remaining
 * pair references. With `freeSince`, also records the time the free plan was seen (the later of it and the index's
 * own), so a chart rendered before it is refused afterwards. Unchanged when there is nothing to do.
 */
export function dropFinderCopies(index: CopyIndex, freeSince?: string): IndexChange {
  const removed = index.copies.filter((copy) => copy.page === FINDER_PAGE);
  const since = freeSince === undefined ? index.freeSince : laterOf(index.freeSince, freeSince);
  if (removed.length === 0 && since === index.freeSince) return { index, deleteKeys: [], deleteAssets: [] };
  return changeRemoving(removed, {
    ...index,
    copies: index.copies.filter((copy) => copy.page !== FINDER_PAGE),
    freeSince: since,
  });
}

/** Adds files a page requested after its pair was committed (imports of imports, fonts) to the given pairs. */
export function addAssets(index: CopyIndex, islandUrls: readonly string[], assets: readonly string[]): CopyIndex {
  return {
    ...index,
    copies: index.copies.map((copy) =>
      islandUrls.includes(copy.islandUrl)
        ? { ...copy, assets: [...new Set([...copy.assets, ...assets])].sort() }
        : copy,
    ),
  };
}

/** A site's last refresh: its most recently stored copy. */
function lastRefreshOf(copies: readonly CopyMeta[], siteId: string): number {
  return Math.max(...copies.filter((copy) => copy.siteId === siteId).map((copy) => Date.parse(copy.storedAt)));
}

/** Drops every copy of a site whose last refresh is 36 h old or more; the last site moves to the newest left. */
export function expire(index: CopyIndex, now: Date): IndexChange {
  const expired = index.copies.filter((copy) => now.getTime() - lastRefreshOf(index.copies, copy.siteId) >= EXPIRY_MS);
  if (expired.length === 0) return { index, deleteKeys: [], deleteAssets: [] };
  const copies = index.copies.filter((copy) => !expired.includes(copy));
  const lastSiteId = copies.some((copy) => copy.siteId === index.lastSiteId)
    ? index.lastSiteId
    : ([...copies].sort((a, b) => Date.parse(b.storedAt) - Date.parse(a.storedAt)).at(0)?.siteId ?? null);
  return changeRemoving(expired, { ...index, lastSiteId, copies });
}

/**
 * The copy to serve for a page at `now`: the requested site, else the last site (and, for a finder chart, the
 * target). Tonight's copy until its `validUntil`; then the next-night copy until its own; then tonight's again, as a
 * night that is over.
 */
export function chooseCopy(
  index: CopyIndex,
  page: StoredPage,
  siteId: string | undefined,
  now: Date,
  target: string | null = null,
): { copy: CopyMeta; notice: CopyNotice } | undefined {
  const { index: live } = expire(index, now);
  const site = siteId ?? live.lastSiteId;
  if (!site) return undefined;
  const find = (kind: CopyKind) =>
    live.copies.find(
      (copy) => copy.siteId === site && copy.page === page && copy.target === target && copy.kind === kind,
    );
  const isValid = (copy: CopyMeta) => now.getTime() < Date.parse(copy.validUntil);
  const tonight = find("tonight");
  const next = find("next");
  if (tonight && isValid(tonight)) return { copy: tonight, notice: "prepared" };
  if (next && isValid(next)) return { copy: next, notice: "old-forecast" };
  const stale = tonight ?? next;
  return stale ? { copy: stale, notice: "stale" } : undefined;
}

/**
 * Whether committing tonight's copy of a page should also fetch its next-night copy: none, or one 1 h old or more.
 * Never for a finder chart: each would cost a second chart build for a night the user did not ask about (D-13).
 */
export function needsNextCopy(index: CopyIndex, siteId: string, page: StoredPage, now: Date): boolean {
  if (page === FINDER_PAGE) return false;
  const next = index.copies.find((copy) => copy.siteId === siteId && copy.page === page && copy.kind === "next");
  return !next || now.getTime() - Date.parse(next.storedAt) >= NEXT_REFRESH_MS;
}

/** One stored page as the `/offline` page lists it: the copy that would be served now, one per site and page. */
export interface ListedCopy {
  siteId: string;
  siteName: string;
  page: StoredPage;
  /** The finder chart's canonical target key; `null` for a Tonight page. */
  target: string | null;
  /** The finder chart's target name as it was rendered; `null` for a Tonight page. */
  targetName: string | null;
  kind: CopyKind;
  nightDate: string;
  preparedAt: string;
  notice: CopyNotice;
}

const LISTED_PAGES: readonly StoredPage[] = [...TONIGHT_PAGES, FINDER_PAGE];

/** The copies the `/offline` page lists: per site the seven pages, then one entry per stored chart, ordered by name. */
export function listCopies(index: CopyIndex, now: Date): ListedCopy[] {
  const { index: live } = expire(index, now);
  const sites = [...new Set(live.copies.map((copy) => copy.siteId))];
  return sites
    .flatMap((siteId) => {
      const charts = [
        ...new Set(
          live.copies.filter((copy) => copy.siteId === siteId && copy.page === FINDER_PAGE).map((c) => c.target),
        ),
      ];
      return [
        ...TONIGHT_PAGES.map((page) => chooseCopy(live, page, siteId, now)),
        ...charts.map((target) => chooseCopy(live, FINDER_PAGE, siteId, now, target)),
      ];
    })
    .filter((choice) => choice !== undefined)
    .map(({ copy, notice }) => ({
      siteId: copy.siteId,
      siteName: copy.siteName,
      page: copy.page,
      target: copy.target,
      targetName: copy.targetName,
      kind: copy.kind,
      nightDate: copy.nightDate,
      preparedAt: copy.preparedAt,
      notice,
    }))
    .sort(
      (a, b) =>
        a.siteName.localeCompare(b.siteName) ||
        LISTED_PAGES.indexOf(a.page) - LISTED_PAGES.indexOf(b.page) ||
        (a.targetName ?? "").localeCompare(b.targetName ?? "") ||
        (a.target ?? "").localeCompare(b.target ?? ""),
    );
}

/** Every Tonight-cache key the index keeps alive (the index itself, `/offline`, each pair's shell and island). */
export function referencedKeys(index: CopyIndex): Set<string> {
  return new Set([INDEX_KEY, OFFLINE_PAGE, ...index.copies.flatMap((copy) => [copy.shellKey, copy.islandUrl])]);
}

/** Every `/_astro/*` key a stored pair references. */
export function referencedAssetKeys(index: CopyIndex): Set<string> {
  return referencedAssets(index.copies);
}

function isTime(value: unknown): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isCopyMeta(value: unknown): value is CopyMeta {
  if (typeof value !== "object" || value === null) return false;
  const copy = value as Record<string, unknown>;
  const strings = ["owner", "siteId", "siteName", "nightDate", "shellKey", "islandUrl"];
  // An unreadable time would never expire (`expire` compares numbers): such a copy is dropped instead.
  const times = ["preparedAt", "validUntil", "storedAt"];
  const stored =
    TONIGHT_PAGES.includes(copy.page as TonightPage) ||
    // A chart is keyed by its target: without one it could never be asked for.
    (copy.page === FINDER_PAGE && typeof copy.target === "string");
  return (
    strings.every((key) => typeof copy[key] === "string") &&
    times.every((key) => isTime(copy[key])) &&
    (copy.kind === "tonight" || copy.kind === "next") &&
    stored &&
    Array.isArray(copy.assets) &&
    copy.assets.every((asset) => typeof asset === "string")
  );
}

/**
 * A stored copy read back; one written before finder charts has no target, name or plan (`null`, `null`, `unknown`),
 * and one written before the plan-read time has no `planAt` (it reads as `preparedAt`).
 */
function withDefaults(copy: CopyMeta): CopyMeta {
  const stored = copy as Partial<CopyMeta>;
  return {
    ...copy,
    target: typeof stored.target === "string" ? stored.target : null,
    targetName: typeof stored.targetName === "string" ? stored.targetName : null,
    plan: planOf(stored.plan),
    planAt: typeof stored.planAt === "string" && isTime(stored.planAt) ? stored.planAt : copy.preparedAt,
  };
}

/** The stored index read back, or `undefined` when it is missing or not one (the worker then starts a new one). */
export function parseIndex(value: unknown): CopyIndex | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const index = value as Record<string, unknown>;
  if (typeof index.userScope !== "string" || !Array.isArray(index.copies)) return undefined;
  return {
    userScope: index.userScope,
    owner: typeof index.owner === "string" ? index.owner : null,
    lastSiteId: typeof index.lastSiteId === "string" ? index.lastSiteId : null,
    copies: index.copies.filter(isCopyMeta).map(withDefaults),
    freeSince: isTime(index.freeSince) ? (index.freeSince as string) : null,
  };
}
