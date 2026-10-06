import { describe, expect, it } from "vitest";
import {
  EXPIRY_MS,
  INDEX_KEY,
  NEXT_REFRESH_MS,
  OFFLINE_PAGE,
  addAssets,
  assetUrlsIn,
  chooseCopy,
  commitPair,
  copyMetaFromIsland,
  emptyIndex,
  expire,
  holdsUserData,
  islandUrlFromShell,
  isSignedOutPage,
  listCopies,
  markFromDevice,
  mayStoreShell,
  needsNextCopy,
  needsReset,
  parseIndex,
  referencedAssetKeys,
  referencedKeys,
  shellKeyFor,
  tonightPageOf,
  type CopyIndex,
  type CopyMeta,
} from "./copies";

const SITE_A = "11111111-1111-4111-8111-111111111111";
const SITE_B = "22222222-2222-4222-8222-222222222222";
const ISLAND = "/_server-islands/TonightContent?e=abc&p=def&s=ghi";
const OWNER_A = "a".repeat(64);
const OWNER_B = "b".repeat(64);

const url = (path: string) => new URL(path, "https://sidereus.example");

function copy(overrides: Partial<CopyMeta> = {}): CopyMeta {
  const islandUrl = overrides.islandUrl ?? `/_server-islands/TonightContent?e=${Math.random()}`;
  return {
    owner: OWNER_A,
    siteId: SITE_A,
    siteName: "Backyard",
    page: "/tonight",
    kind: "tonight",
    nightDate: "2026-10-05",
    preparedAt: "2026-10-05T19:00:00.000Z",
    validUntil: "2026-10-06T04:30:00.000Z",
    forecastFetchedAt: null,
    shellKey: shellKeyFor(islandUrl),
    islandUrl,
    storedAt: "2026-10-05T19:00:00.000Z",
    assets: [],
    ...overrides,
  };
}

function indexOf(...copies: CopyMeta[]): CopyIndex {
  return { ...emptyIndex("scope-1"), owner: OWNER_A, lastSiteId: copies.at(-1)?.siteId ?? null, copies };
}

describe("tonightPageOf", () => {
  it.each(["/tonight", "/tonight/targets", "/tonight/plan", "/tonight/moon", "/tonight/planets", "/tonight/nights"])(
    "matches %s exactly",
    (path) => {
      expect(tonightPageOf(url(path))?.page).toBe(path);
    },
  );

  it.each(["/tonight/all", "/tonight/", "/tonight/plan/extra", "/tonightx", "/log", "/"])("is none for %s", (path) => {
    expect(tonightPageOf(url(path))).toBeUndefined();
  });

  it("reads the requested site and ignores every other param", () => {
    expect(tonightPageOf(url(`/tonight/plan?site=${SITE_A}&telescope=x&night=next&sort=alt&logged=M31`))).toEqual({
      page: "/tonight/plan",
      siteId: SITE_A,
    });
  });

  it("treats a site param that is not a site id as no site", () => {
    expect(tonightPageOf(url("/tonight?site=nope"))?.siteId).toBeUndefined();
  });
});

describe("mayStoreShell", () => {
  it.each([
    "/tonight",
    `/tonight/moon?site=${SITE_A}`,
    "/tonight/targets?sort=name&telescope=x",
    "/tonight?night=next",
  ])("stores %s", (path) => {
    expect(mayStoreShell(url(path))).toBe(true);
  });

  it.each([
    "/tonight?logged=M31",
    "/tonight?skyChecked=1",
    "/tonight/plan?error=errors.generic",
    "/tonight/all",
    "/log",
  ])("refuses %s", (path) => {
    expect(mayStoreShell(url(path))).toBe(false);
  });
});

describe("islandUrlFromShell", () => {
  it("reads the preload href, unescaped", () => {
    const html = `<html><head><link rel="stylesheet" href="/_astro/a.css"><link rel="preload" as="fetch" href="/_server-islands/TonightContent?e=abc&amp;p=def&amp;s=ghi" crossorigin="anonymous"></head></html>`;
    expect(islandUrlFromShell(html)).toBe(ISLAND);
  });

  it("is none for a shell with no island preload", () => {
    expect(
      islandUrlFromShell(`<html><head><link rel="preload" as="fetch" href="/api/x"></head></html>`),
    ).toBeUndefined();
    expect(islandUrlFromShell("<html><body>no island</body></html>")).toBeUndefined();
  });
});

describe("copyMetaFromIsland", () => {
  const island = (attributes: string) =>
    `<link rel="stylesheet" href="/_astro/x.css"><div hidden data-offline-copy ${attributes}></div><p>…</p>`;
  const full = `data-owner="${OWNER_A}" data-site-id="${SITE_A}" data-site-name="Tom &amp; &quot;Jerry&quot; > ridge" data-night-date="2026-10-05" data-kind="tonight" data-prepared-at="2026-10-05T19:00:00.000Z" data-valid-until="2026-10-06T04:30:00.000Z" data-forecast-fetched-at="2026-10-05T18:00:00.000Z"`;

  it("parses the metadata element", () => {
    expect(copyMetaFromIsland(island(full))).toEqual({
      owner: OWNER_A,
      siteId: SITE_A,
      siteName: 'Tom & "Jerry" > ridge',
      kind: "tonight",
      nightDate: "2026-10-05",
      preparedAt: "2026-10-05T19:00:00.000Z",
      validUntil: "2026-10-06T04:30:00.000Z",
      forecastFetchedAt: "2026-10-05T18:00:00.000Z",
    });
  });

  it("keeps a missing forecast time as null", () => {
    const html = island(full.replace(/ data-forecast-fetched-at="[^"]*"/, ""));
    expect(copyMetaFromIsland(html)?.forecastFetchedAt).toBeNull();
  });

  it("is none for an island without the element (signed out: an empty body)", () => {
    expect(copyMetaFromIsland("")).toBeUndefined();
    expect(copyMetaFromIsland("<div data-site-id='x'></div>")).toBeUndefined();
  });

  it("is none for an unknown kind or an unreadable time", () => {
    expect(copyMetaFromIsland(island(full.replace('data-kind="tonight"', 'data-kind="later"')))).toBeUndefined();
    expect(copyMetaFromIsland(island(full.replace("2026-10-06T04:30:00.000Z", "soon")))).toBeUndefined();
  });

  it("is none without an owner fingerprint, or with something that is not one", () => {
    expect(copyMetaFromIsland(island(full.replace(/data-owner="[^"]*" /, "")))).toBeUndefined();
    expect(copyMetaFromIsland(island(full.replace(OWNER_A, "user@example.com")))).toBeUndefined();
    expect(copyMetaFromIsland(island(full.replace(OWNER_A, SITE_A)))).toBeUndefined();
  });
});

describe("assetUrlsIn", () => {
  it("lists every /_astro file once, sorted, without query or fragment", () => {
    const html = `<link href="/_astro/b.css" rel="stylesheet"><script type="module" src="/_astro/a.js?v=1"></script>
      <astro-island component-url="/_astro/Sky.x1.js" renderer-url="/_astro/client.y2.js"></astro-island>
      <style>@font-face{src:url(/_astro/font.woff2)}</style><link href="/_astro/b.css">`;
    expect(assetUrlsIn(html)).toEqual([
      "/_astro/Sky.x1.js",
      "/_astro/a.js",
      "/_astro/b.css",
      "/_astro/client.y2.js",
      "/_astro/font.woff2",
    ]);
  });
});

describe("markFromDevice", () => {
  it("marks the first html tag only", () => {
    expect(markFromDevice('<!doctype html><html lang="en" data-theme="dark"><body><html></body></html>')).toBe(
      '<!doctype html><html data-from-device lang="en" data-theme="dark"><body><html></body></html>',
    );
  });

  it("does not touch a lookalike tag", () => {
    expect(markFromDevice("<html-like></html-like>")).toBe("<html-like></html-like>");
  });
});

describe("commitPair", () => {
  it("adds a pair and remembers its site and owner", () => {
    const first = copy({ siteId: SITE_B });
    const { index, deleteKeys, deleteAssets } = commitPair(emptyIndex("s"), first);
    expect(index.copies).toEqual([first]);
    expect(index.lastSiteId).toBe(SITE_B);
    expect(index.owner).toBe(OWNER_A);
    expect(deleteKeys).toEqual([]);
    expect(deleteAssets).toEqual([]);
  });

  it("is a no-op when the same island URL is committed again", () => {
    const first = copy({ islandUrl: ISLAND });
    const once = commitPair(emptyIndex("s"), first).index;
    const twice = commitPair(once, copy({ islandUrl: ISLAND, storedAt: "2026-10-05T20:00:00.000Z" }));
    expect(twice.index).toBe(once);
    expect(twice.deleteKeys).toEqual([]);
  });

  it("replaces the previous pair for the same site, page and kind, returning its keys", () => {
    const old = copy({ assets: ["/_astro/old.css", "/_astro/shared.js"] });
    const fresh = copy({ assets: ["/_astro/new.css", "/_astro/shared.js"] });
    const { index, deleteKeys, deleteAssets } = commitPair(indexOf(old), fresh);
    expect(index.copies).toEqual([fresh]);
    expect(deleteKeys).toEqual([old.shellKey, old.islandUrl]);
    expect(deleteAssets).toEqual(["/_astro/old.css"]);
  });

  it("keeps an asset another pair still references", () => {
    const plan = copy({ page: "/tonight/plan", assets: ["/_astro/shared.js"] });
    const old = copy({ assets: ["/_astro/shared.js", "/_astro/old.css"] });
    const { deleteAssets } = commitPair(indexOf(plan, old), copy({ assets: [] }));
    expect(deleteAssets).toEqual(["/_astro/old.css"]);
  });

  it("keeps other kinds, pages and sites", () => {
    const next = copy({ kind: "next" });
    const plan = copy({ page: "/tonight/plan" });
    const other = copy({ siteId: SITE_B });
    const { index } = commitPair(indexOf(next, plan, other), copy());
    expect(index.copies).toHaveLength(4);
  });

  it("moves the last site only for a page the user opened, not a next-night copy", () => {
    const start = indexOf(copy({ siteId: SITE_A }));
    expect(commitPair(start, copy({ siteId: SITE_B, kind: "next" })).index.lastSiteId).toBe(SITE_A);
    expect(commitPair(start, copy({ siteId: SITE_B })).index.lastSiteId).toBe(SITE_B);
  });
});

describe("needsReset", () => {
  it("adopts the owner of a commit into a new or empty index", () => {
    expect(needsReset(emptyIndex("s"), OWNER_B)).toBe(false);
  });

  it("keeps the store for the same owner", () => {
    expect(needsReset(indexOf(copy()), OWNER_A)).toBe(false);
  });

  it("purges first for a commit by another owner, even with no copies left", () => {
    expect(needsReset(indexOf(copy()), OWNER_B)).toBe(true);
    expect(needsReset({ ...emptyIndex("s"), owner: OWNER_A }, OWNER_B)).toBe(true);
  });

  it("purges first when copies are there without an owner (stored before owners)", () => {
    expect(needsReset({ ...indexOf(copy()), owner: null }, OWNER_A)).toBe(true);
  });
});

describe("signed-out pages", () => {
  const signedOut = '<!doctype html><html lang="en" data-theme="dark" data-signed-out><body></body></html>';
  const signedIn = '<!doctype html><html lang="en" data-theme="dark"><body>me@example.com</body></html>';

  it("reads the layout's mark on the html tag only", () => {
    expect(isSignedOutPage(signedOut)).toBe(true);
    expect(isSignedOutPage(signedIn)).toBe(false);
    expect(isSignedOutPage('<html lang="en"><body data-signed-out></body></html>')).toBe(false);
  });

  it("finds user data in an owned or non-empty index, or a signed-in /offline page", () => {
    expect(holdsUserData(undefined, undefined)).toBe(false);
    expect(holdsUserData(emptyIndex("s"), signedOut)).toBe(false);
    expect(holdsUserData({ ...emptyIndex("s"), owner: OWNER_A }, signedOut)).toBe(true);
    expect(holdsUserData(indexOf(copy()), undefined)).toBe(true);
    expect(holdsUserData(emptyIndex("s"), signedIn)).toBe(true);
  });
});

describe("addAssets", () => {
  it("adds files to the named pairs only", () => {
    const a = copy({ assets: ["/_astro/a.js"] });
    const b = copy({ page: "/tonight/plan" });
    const index = addAssets(indexOf(a, b), [a.islandUrl], ["/_astro/chunk.js", "/_astro/a.js"]);
    expect(index.copies[0]?.assets).toEqual(["/_astro/a.js", "/_astro/chunk.js"]);
    expect(index.copies[1]?.assets).toEqual([]);
  });
});

describe("expire", () => {
  const stored = new Date("2026-10-05T19:00:00.000Z");
  const at = (ms: number) => new Date(stored.getTime() + ms);

  it("keeps a site just under 36 h after its last refresh and drops it at exactly 36 h", () => {
    const index = indexOf(copy({ assets: ["/_astro/a.js"] }));
    expect(expire(index, at(EXPIRY_MS - 1)).index.copies).toHaveLength(1);
    const { index: after, deleteKeys, deleteAssets } = expire(index, at(EXPIRY_MS));
    expect(after.copies).toEqual([]);
    expect(after.lastSiteId).toBeNull();
    expect(deleteKeys).toEqual([index.copies[0]?.shellKey, index.copies[0]?.islandUrl]);
    expect(deleteAssets).toEqual(["/_astro/a.js"]);
  });

  it("counts a site's newest copy, so an older page of a refreshed site stays", () => {
    const old = copy({ page: "/tonight/moon", storedAt: "2026-10-04T08:00:00.000Z" });
    const fresh = copy({ storedAt: stored.toISOString() });
    expect(expire(indexOf(old, fresh), at(EXPIRY_MS - 1)).index.copies).toHaveLength(2);
  });

  it("expires per site and moves the last site to the newest site left", () => {
    const a = copy({ siteId: SITE_A, storedAt: "2026-10-04T10:00:00.000Z" });
    const b = copy({ siteId: SITE_B, storedAt: stored.toISOString() });
    const index: CopyIndex = { ...indexOf(b, a), lastSiteId: SITE_A };
    const { index: after } = expire(index, new Date("2026-10-05T22:00:00.000Z"));
    expect(after.copies).toEqual([b]);
    expect(after.lastSiteId).toBe(SITE_B);
  });
});

describe("chooseCopy", () => {
  const tonight = copy({ islandUrl: "/_server-islands/T?e=tonight" });
  const next = copy({
    kind: "next",
    nightDate: "2026-10-06",
    validUntil: "2026-10-07T04:31:00.000Z",
    islandUrl: "/_server-islands/T?e=next",
  });
  const before = new Date(Date.parse(tonight.validUntil) - 1);
  const atRollover = new Date(tonight.validUntil);

  it("serves tonight's copy before its validUntil", () => {
    expect(chooseCopy(indexOf(tonight, next), "/tonight", SITE_A, before)).toEqual({
      copy: tonight,
      notice: "prepared",
    });
  });

  it("serves the next-night copy from exactly validUntil", () => {
    expect(chooseCopy(indexOf(tonight, next), "/tonight", SITE_A, atRollover)).toEqual({
      copy: next,
      notice: "old-forecast",
    });
  });

  it("serves tonight's copy as stale when there is no next-night copy", () => {
    expect(chooseCopy(indexOf(tonight), "/tonight", SITE_A, atRollover)).toEqual({ copy: tonight, notice: "stale" });
  });

  it("serves tonight's copy as stale once the next-night copy is past its own validUntil", () => {
    expect(chooseCopy(indexOf(tonight, next), "/tonight", SITE_A, new Date(next.validUntil))).toEqual({
      copy: tonight,
      notice: "stale",
    });
  });

  it("uses the last site when the navigation names none", () => {
    const other = copy({ siteId: SITE_B, siteName: "Ridge" });
    const index: CopyIndex = { ...indexOf(tonight, other), lastSiteId: SITE_B };
    expect(chooseCopy(index, "/tonight", undefined, before)?.copy).toBe(other);
    expect(chooseCopy(index, "/tonight", SITE_A, before)?.copy).toBe(tonight);
  });

  it("is none for a page, a site or an index with nothing stored", () => {
    expect(chooseCopy(indexOf(tonight), "/tonight/plan", SITE_A, before)).toBeUndefined();
    expect(chooseCopy(indexOf(tonight), "/tonight", SITE_B, before)).toBeUndefined();
    expect(chooseCopy(emptyIndex("s"), "/tonight", undefined, before)).toBeUndefined();
  });

  it("never serves an expired site", () => {
    const later = new Date(Date.parse(tonight.storedAt) + EXPIRY_MS);
    expect(chooseCopy(indexOf(tonight, next), "/tonight", SITE_A, later)).toBeUndefined();
  });
});

describe("needsNextCopy", () => {
  const now = new Date("2026-10-05T21:00:00.000Z");

  it("fetches a missing next-night copy", () => {
    expect(needsNextCopy(indexOf(copy()), SITE_A, "/tonight", now)).toBe(true);
  });

  it("refreshes one 1 h old or more, not a younger one", () => {
    const at = (ms: number) => indexOf(copy({ kind: "next", storedAt: new Date(now.getTime() - ms).toISOString() }));
    expect(needsNextCopy(at(NEXT_REFRESH_MS - 1), SITE_A, "/tonight", now)).toBe(false);
    expect(needsNextCopy(at(NEXT_REFRESH_MS), SITE_A, "/tonight", now)).toBe(true);
  });
});

describe("listCopies", () => {
  it("lists the copy served now, one per site and page, by site then page", () => {
    const now = new Date("2026-10-05T21:00:00.000Z");
    const index = indexOf(
      copy({ page: "/tonight/plan" }),
      copy(),
      copy({ kind: "next", nightDate: "2026-10-06" }),
      copy({ siteId: SITE_B, siteName: "Alpine hut" }),
    );
    expect(listCopies(index, now).map(({ siteName, page, kind, notice }) => [siteName, page, kind, notice])).toEqual([
      ["Alpine hut", "/tonight", "tonight", "prepared"],
      ["Backyard", "/tonight", "tonight", "prepared"],
      ["Backyard", "/tonight/plan", "tonight", "prepared"],
    ]);
  });
});

describe("referenced keys", () => {
  it("keeps the index, the offline page and every pair's shell and island", () => {
    const a = copy({ assets: ["/_astro/a.js"] });
    expect(referencedKeys(indexOf(a))).toEqual(new Set([INDEX_KEY, OFFLINE_PAGE, a.shellKey, a.islandUrl]));
    expect(referencedAssetKeys(indexOf(a))).toEqual(new Set(["/_astro/a.js"]));
  });
});

describe("parseIndex", () => {
  it("reads back a stored index and drops malformed copies", () => {
    const good = copy();
    const parsed = parseIndex(
      JSON.parse(
        JSON.stringify({ userScope: "s", owner: OWNER_A, lastSiteId: SITE_A, copies: [good, { page: "/x" }] }),
      ),
    );
    expect(parsed).toEqual({ userScope: "s", owner: OWNER_A, lastSiteId: SITE_A, copies: [good] });
  });

  it("reads an index stored without an owner as unowned", () => {
    expect(parseIndex({ userScope: "s", copies: [] })?.owner).toBeNull();
  });

  it("drops a copy whose times cannot be read, which would never expire", () => {
    const parsed = parseIndex({ userScope: "s", owner: null, lastSiteId: null, copies: [copy({ storedAt: "soon" })] });
    expect(parsed?.copies).toEqual([]);
  });

  it("is none for something that is not an index", () => {
    expect(parseIndex(null)).toBeUndefined();
    expect(parseIndex({ copies: [] })).toBeUndefined();
  });
});
