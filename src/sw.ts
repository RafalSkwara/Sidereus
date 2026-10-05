/// <reference lib="webworker" />
// The service worker (S-06, offline-night-plan), bundled by scripts/build-sw.mjs (npm `postbuild`: a Vite library build
// plus workbox-build's injectManifest) and served at /sw.js with scope /. It precaches the build's static assets and
// stores each Tonight page the user opens as a pair (shell + server-island response, plus the next-night copy) to
// replay offline or when the network times out. Every decision lives in src/lib/offline/copies.ts; this file only
// wires it to Workbox routes and the Cache API. It holds site ids and names, never coordinates, and logs nothing.
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import type { RouteHandlerCallbackOptions, RouteMatchCallbackOptions } from "workbox-core/types.js";

import {
  INDEX_KEY,
  OFFLINE_PAGE,
  addAssets,
  assetUrlsIn,
  chooseCopy,
  commitPair,
  copyMetaFromIsland,
  emptyIndex,
  expire,
  islandUrlFromShell,
  listCopies,
  markFromDevice,
  mayStoreShell,
  needsNextCopy,
  parseIndex,
  pathKey,
  referencedAssetKeys,
  referencedKeys,
  shellKeyFor,
  tonightPageOf,
  type CopyIndex,
  type CopyMeta,
  type TonightPage,
} from "@/lib/offline/copies";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

/** Shells, islands, `/offline` and the index. */
const TONIGHT_CACHE = "sidereus-tonight-v1";
/** The `/_astro/*` files stored pairs reference, kept across deploys that drop them from the precache and server. */
const ASSETS_CACHE = "sidereus-assets-v1";
// At a dark site the network is often there but useless: past this, a stored copy beats waiting.
const NETWORK_TIMEOUT_MS = 4000;
const BACKGROUND_TIMEOUT_MS = 30_000;
// A shell whose island has not arrived by then never will (the page was closed or the island failed).
const PENDING_TTL_MS = 2 * 60 * 1000;
const TRACKED_CLIENTS = 20;
// Plain HTML form POSTs; each starts a different user's (or no user's) store.
const AUTH_POSTS = new Set(["/api/auth/signin", "/api/auth/signup", "/api/auth/signout"]);
// The middleware adds `Vary: Cookie, Accept-Language` to every HTML response; a match must not depend on it.
const MATCH: CacheQueryOptions = { ignoreVary: true };

void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// --- The index: one JSON entry, and one writer ---------------------------------------------------------------------

// The island, its duplicate (preload + script), the next-night copy and the purges all read-modify-write the index
// from concurrent fetch events; every mutation runs through this one queue.
let indexQueue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = indexQueue.then(task, task);
  indexQueue = run.catch(() => undefined);
  return run;
}

async function readIndex(cache: Cache): Promise<CopyIndex | undefined> {
  const stored = await cache.match(INDEX_KEY);
  return stored ? parseIndex(await stored.json().catch(() => null)) : undefined;
}

async function writeIndex(cache: Cache, index: CopyIndex): Promise<void> {
  await cache.put(INDEX_KEY, new Response(JSON.stringify(index), { headers: { "content-type": "application/json" } }));
}

/** Inside `serial` only: the index, created (with a new scope) when there is none, e.g. after a purge. */
async function loadIndex(): Promise<{ cache: Cache; index: CopyIndex }> {
  const cache = await caches.open(TONIGHT_CACHE);
  let index = await readIndex(cache);
  if (!index) {
    index = emptyIndex(crypto.randomUUID());
    await writeIndex(cache, index);
  }
  return { cache, index };
}

/** The scope a commit must still find when it lands; queued at once, so it precedes any later purge. */
function currentScope(): Promise<string> {
  return serial(async () => (await loadIndex()).index.userScope);
}

/**
 * A response to store: the text and its content type only. No `Vary`, and none of the network's encoding or length
 * headers, which described the network body rather than this text.
 */
function storable(body: string, contentType: string): Response {
  return new Response(body, { headers: { "content-type": contentType } });
}

function withoutVary(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.delete("vary");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function isHtml200(response: Response): boolean {
  const type = response.headers.get("content-type")?.split(";")[0]?.trim();
  return response.status === 200 && !response.redirected && type === "text/html";
}

/** Signing in, up or out, or a bounce to sign-in: no copy of anyone's night stays on the device. */
function purge(): Promise<void> {
  pending.clear();
  tonightClients.clear();
  return serial(async () => {
    await Promise.all([caches.delete(TONIGHT_CACHE), caches.delete(ASSETS_CACHE)]);
  });
}

/** Expires old sites, then drops every entry no stored pair references (in both runtime caches). */
function sweep(): Promise<void> {
  return serial(async () => {
    const cache = await caches.open(TONIGHT_CACHE);
    const stored = await readIndex(cache);
    const { index } = expire(stored ?? emptyIndex(""), new Date());
    if (stored && index !== stored) await writeIndex(cache, index);
    const keep = referencedKeys(index);
    const keepAssets = referencedAssetKeys(index);
    const assets = await caches.open(ASSETS_CACHE);
    await Promise.all([
      ...(await cache.keys()).filter((key) => !keep.has(pathKey(key.url))).map((key) => cache.delete(key, MATCH)),
      ...(await assets.keys())
        .filter((key) => !keepAssets.has(pathKey(key.url)))
        .map((key) => assets.delete(key, MATCH)),
    ]);
  });
}

/** `/offline` in the user's current language and theme, fetched with their cookies. */
async function storeOfflinePage(): Promise<void> {
  const response = await fetch(OFFLINE_PAGE, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(BACKGROUND_TIMEOUT_MS),
  });
  if (!isHtml200(response)) return;
  const page = storable(await response.text(), response.headers.get("content-type") ?? "text/html");
  // Queued, so a purge that starts meanwhile is not undone by a late put.
  await serial(async () => {
    await (await caches.open(TONIGHT_CACHE)).put(OFFLINE_PAGE, page);
  });
}

async function storedOfflinePage(): Promise<Response | undefined> {
  return (await caches.open(TONIGHT_CACHE)).match(OFFLINE_PAGE, MATCH);
}

// --- Which /_astro files a Tonight page loads ---------------------------------------------------------------------

// The HTML names a page's stylesheets, entry scripts and island components, but not what those import in turn (shared
// chunks, fonts). The page's own requests name those, so each Tonight page (client) is followed for a while.
interface TonightClient {
  /** Every `/_astro/*` path the page requested. */
  assets: Set<string>;
  /** The island URLs of the pairs committed for this page (its own and its next-night copy). */
  islands: Set<string>;
  /** Paths requested after a commit, added to those pairs in one write. */
  late: Set<string>;
  flush?: Promise<void>;
}

const tonightClients = new Map<string, TonightClient>();

function trackClient(id: string): TonightClient {
  let client = tonightClients.get(id);
  if (!client) {
    client = { assets: new Set(), islands: new Set(), late: new Set() };
    tonightClients.set(id, client);
    for (const old of [...tonightClients.keys()].slice(0, -TRACKED_CLIENTS)) tonightClients.delete(old);
  }
  return client;
}

/** The tracked Tonight page behind a request, also one opened before this worker started (looked up by its URL). */
async function tonightClient(id: string): Promise<TonightClient | undefined> {
  if (!id) return undefined;
  const known = tonightClients.get(id);
  if (known) return known;
  const client = await self.clients.get(id);
  return client && tonightPageOf(new URL(client.url)) ? trackClient(id) : undefined;
}

/** Copies the given files into the assets cache: from there already, else the precache, else the network. */
async function keepAssets(paths: Iterable<string>): Promise<void> {
  const cache = await caches.open(ASSETS_CACHE);
  await Promise.all(
    [...paths].map(async (path) => {
      if (await cache.match(path, MATCH)) return;
      const response = (await matchPrecache(path)) ?? (await fetch(path).catch(() => undefined));
      if (response?.ok) await cache.put(path, withoutVary(response));
    }),
  );
}

async function noteAsset(clientId: string, path: string): Promise<void> {
  const client = await tonightClient(clientId);
  if (!client || client.assets.has(path)) return;
  client.assets.add(path);
  if (client.islands.size === 0) return;
  client.late.add(path);
  client.flush ??= new Promise((resolve) => setTimeout(resolve, 1000)).then(async () => {
    client.flush = undefined;
    const late = [...client.late];
    client.late.clear();
    const islands = [...client.islands];
    await serial(async () => {
      const cache = await caches.open(TONIGHT_CACHE);
      const index = await readIndex(cache);
      if (index?.copies.some((copy) => islands.includes(copy.islandUrl))) {
        await writeIndex(cache, addAssets(index, islands, late));
      }
    });
    await keepAssets(late);
  });
  await client.flush;
}

// --- Pairs: a shell waits for its island -------------------------------------------------------------------------

interface PendingShell {
  page: TonightPage;
  shell: string;
  contentType: string;
  scope: string;
  at: number;
}

/** Stored shells whose island has not answered yet, by the exact island URL each references. */
const pending = new Map<string, PendingShell>();
/** Shells still streaming in: the browser asks for the island from the head, before the shell has fully arrived. */
const shellReads = new Set<Promise<void>>();

function recordShell(page: TonightPage, response: Response, event: ExtendableEvent): void {
  const scope = currentScope();
  const read = (async () => {
    const shell = await response.text();
    const islandUrl = islandUrlFromShell(shell);
    if (!islandUrl) return;
    const now = Date.now();
    for (const [key, entry] of pending) if (now - entry.at > PENDING_TTL_MS) pending.delete(key);
    pending.set(islandUrl, {
      page,
      shell,
      contentType: response.headers.get("content-type") ?? "text/html",
      scope: await scope,
      at: now,
    });
  })().catch(() => undefined);
  shellReads.add(read);
  void read.finally(() => shellReads.delete(read));
  event.waitUntil(read);
}

/** Stores a pair and updates the index, unless a purge came in between or this island was already committed. */
function commit(
  meta: CopyMeta,
  shell: { body: string; contentType: string },
  island: { body: string; contentType: string },
  scope: string,
): Promise<CopyIndex | undefined> {
  return serial(async () => {
    const { cache, index } = await loadIndex();
    if (index.userScope !== scope) return undefined;
    const change = commitPair(index, meta);
    if (change.index === index) return undefined;
    await cache.put(meta.shellKey, storable(shell.body, shell.contentType));
    await cache.put(meta.islandUrl, storable(island.body, island.contentType));
    await writeIndex(cache, change.index);
    const assets = await caches.open(ASSETS_CACHE);
    await Promise.all([
      ...change.deleteKeys.map((key) => cache.delete(key, MATCH)),
      ...change.deleteAssets.map((key) => assets.delete(key, MATCH)),
    ]);
    return change.index;
  });
}

async function afterCommit(assets: readonly string[]): Promise<void> {
  await keepAssets(assets);
  await storeOfflinePage().catch(() => undefined);
  await sweep();
}

async function commitIsland(islandUrl: string, response: Response, clientId: string): Promise<void> {
  if (!isHtml200(response)) return;
  await Promise.race([
    Promise.allSettled([...shellReads]),
    new Promise((resolve) => setTimeout(resolve, BACKGROUND_TIMEOUT_MS)),
  ]);
  const shell = pending.get(islandUrl);
  if (!shell) return;
  const body = await response.text();
  // Signed out, the island answers 200 with an empty body: nothing to store.
  const island = copyMetaFromIsland(body);
  if (!island) return;
  const client = await tonightClient(clientId);
  const meta: CopyMeta = {
    ...island,
    page: shell.page,
    shellKey: shellKeyFor(islandUrl),
    islandUrl,
    storedAt: new Date().toISOString(),
    assets: [...new Set([...assetUrlsIn(shell.shell), ...assetUrlsIn(body), ...(client?.assets ?? [])])].sort(),
  };
  const index = await commit(
    meta,
    { body: shell.shell, contentType: shell.contentType },
    { body, contentType: response.headers.get("content-type") ?? "text/html" },
    shell.scope,
  );
  if (!index) return;
  pending.delete(islandUrl);
  client?.islands.add(islandUrl);
  await afterCommit(meta.assets);
  if (meta.kind === "tonight" && needsNextCopy(index, meta.siteId, meta.page, new Date())) {
    await storeNextCopy(meta, shell.scope, client);
  }
}

const nextCopiesInFlight = new Set<string>();

/**
 * The same page for the evening after tonight, rendered by the server from the same forecast (`?night=next`, which
 * records no sky check), so a plan is there after dawn rolls the night over. Same site; the telescope is the
 * remembered one, as on the page just stored. Best effort: any failure leaves the previous next-night copy.
 */
async function storeNextCopy(tonight: CopyMeta, scope: string, client: TonightClient | undefined): Promise<void> {
  const key = `${tonight.siteId} ${tonight.page}`;
  if (nextCopiesInFlight.has(key)) return;
  nextCopiesInFlight.add(key);
  try {
    const query = new URLSearchParams({ site: tonight.siteId, night: "next" });
    const signal = AbortSignal.timeout(BACKGROUND_TIMEOUT_MS);
    const shellResponse = await fetch(`${tonight.page}?${query.toString()}`, {
      credentials: "same-origin",
      redirect: "manual",
      signal,
    });
    if (!isHtml200(shellResponse)) return;
    const shell = await shellResponse.text();
    const islandUrl = islandUrlFromShell(shell);
    if (!islandUrl) return;
    const islandResponse = await fetch(islandUrl, { credentials: "same-origin", signal });
    if (!isHtml200(islandResponse)) return;
    const body = await islandResponse.text();
    const island = copyMetaFromIsland(body);
    if (island?.kind !== "next" || island.siteId !== tonight.siteId) return;
    const meta: CopyMeta = {
      ...island,
      page: tonight.page,
      shellKey: shellKeyFor(islandUrl),
      islandUrl,
      storedAt: new Date().toISOString(),
      // Same build as tonight's page, so the same imports and fonts beyond what this HTML names.
      assets: [...new Set([...tonight.assets, ...assetUrlsIn(shell), ...assetUrlsIn(body)])].sort(),
    };
    const index = await commit(
      meta,
      { body: shell, contentType: shellResponse.headers.get("content-type") ?? "text/html" },
      { body, contentType: islandResponse.headers.get("content-type") ?? "text/html" },
      scope,
    );
    if (!index) return;
    client?.islands.add(islandUrl);
    await afterCommit(meta.assets);
  } catch {
    // Offline or timed out: tonight's copy is stored; the next visit tries again.
  } finally {
    nextCopiesInFlight.delete(key);
  }
}

// --- Serving -------------------------------------------------------------------------------------------------------

/**
 * The network's answer, or the stored one when the network fails or takes longer than the timeout. With nothing
 * stored, a slow network is still waited for: a slow page beats no page.
 */
async function networkFirst(
  request: Request,
  stored: () => Promise<Response | undefined>,
): Promise<{ response: Response; fromNetwork: boolean }> {
  const network = fetch(request).then((response) => ({ response, fromNetwork: true }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<Response | undefined>((resolve) => {
    timer = setTimeout(() => {
      stored().then(resolve, () => {
        resolve(undefined);
      });
    }, NETWORK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      network,
      timedOut.then((response) => (response ? { response, fromNetwork: false } : network)),
    ]);
  } catch (error) {
    const response = await stored();
    if (response) return { response, fromNetwork: false };
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** The stored copy for a Tonight navigation, marked so the page says it came from the device. */
async function storedTonight(page: TonightPage, siteId: string | undefined): Promise<Response | undefined> {
  const cache = await caches.open(TONIGHT_CACHE);
  const index = await readIndex(cache);
  const choice = index && chooseCopy(index, page, siteId, new Date());
  if (!choice) return undefined;
  const shell = await cache.match(choice.copy.shellKey, MATCH);
  if (!shell) return undefined;
  return storable(markFromDevice(await shell.text()), shell.headers.get("content-type") ?? "text/html");
}

// Registered before the precache route, so this one answers every /_astro request: stored files first (they outlive
// a deploy), then the precache, then the network.
registerRoute(
  ({ url, sameOrigin }: RouteMatchCallbackOptions) => sameOrigin && url.pathname.startsWith("/_astro/"),
  async ({ request, url, event }: RouteHandlerCallbackOptions) => {
    event.waitUntil(noteAsset((event as FetchEvent).clientId, url.pathname).catch(() => undefined));
    const kept = await (await caches.open(ASSETS_CACHE)).match(url.pathname, MATCH);
    return kept ?? (await matchPrecache(url.pathname)) ?? fetch(request);
  },
);

// Tonight navigations: the six pages exactly, so a redirect here can only be the sign-in bounce.
registerRoute(
  ({ request, url, sameOrigin }: RouteMatchCallbackOptions) =>
    sameOrigin && request.mode === "navigate" && tonightPageOf(url) !== undefined,
  async ({ request, url, event }: RouteHandlerCallbackOptions) => {
    const target = tonightPageOf(url);
    if (!target) return fetch(request);
    const fetchEvent = event as FetchEvent;
    if (fetchEvent.resultingClientId) trackClient(fetchEvent.resultingClientId);
    try {
      const { response, fromNetwork } = await networkFirst(request, () => storedTonight(target.page, target.siteId));
      if (fromNetwork && response.type === "opaqueredirect") {
        event.waitUntil(purge());
      } else if (fromNetwork && isHtml200(response) && mayStoreShell(url)) {
        recordShell(target.page, response.clone(), event);
      }
      return response;
    } catch (error) {
      const offline = await storedOfflinePage();
      if (offline) return offline;
      throw error;
    }
  },
);

// Server islands. An island URL is new on every render, so a stored one is only ever asked for by its own stored
// shell (served from the device, or the page that just committed it): answer it from storage at once. Any other is
// fetched, and a 200 for a shell waiting on it commits the pair.
registerRoute(
  ({ url, sameOrigin }: RouteMatchCallbackOptions) => sameOrigin && url.pathname.startsWith("/_server-islands/"),
  async ({ request, url, event }: RouteHandlerCallbackOptions) => {
    const islandUrl = pathKey(url);
    const stored = await (await caches.open(TONIGHT_CACHE)).match(islandUrl, MATCH);
    if (stored) return stored;
    const response = await fetch(request);
    event.waitUntil(commitIsland(islandUrl, response.clone(), (event as FetchEvent).clientId).catch(() => undefined));
    return response;
  },
);

registerRoute(
  ({ url, sameOrigin }: RouteMatchCallbackOptions) => sameOrigin && AUTH_POSTS.has(url.pathname),
  async ({ request, event }: RouteHandlerCallbackOptions) => {
    await purge();
    const response = await fetch(request);
    // The new session's (or no session's) language and theme.
    event.waitUntil(storeOfflinePage().catch(() => undefined));
    return response;
  },
  "POST",
);

// Any other page or form post that fails at the network lands on /offline (if one is stored yet; else the browser's
// own error).
async function networkOrOffline({ request }: RouteHandlerCallbackOptions): Promise<Response> {
  try {
    return await fetch(request);
  } catch (error) {
    const offline = await storedOfflinePage();
    if (offline) return offline;
    throw error;
  }
}
const isNavigation = ({ request, sameOrigin }: RouteMatchCallbackOptions) => sameOrigin && request.mode === "navigate";
registerRoute(isNavigation, networkOrOffline, "GET");
registerRoute(isNavigation, networkOrOffline, "POST");

precacheAndRoute(self.__WB_MANIFEST);

// --- Lifecycle and messages ------------------------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(storeOfflinePage().catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(sweep().catch(() => undefined));
});

// The /offline page lists the stored pages: the copy each would serve now, one per site and page.
self.addEventListener("message", (event) => {
  const data: unknown = event.data;
  const port = event.ports.at(0);
  if (typeof data !== "object" || data === null || (data as { type?: unknown }).type !== "list-copies" || !port) return;
  event.waitUntil(
    (async () => {
      const index = await readIndex(await caches.open(TONIGHT_CACHE));
      port.postMessage({ copies: index ? listCopies(index, new Date()) : [] });
    })(),
  );
});
