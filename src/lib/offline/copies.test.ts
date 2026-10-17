import { describe, expect, it } from "vitest";
import {
  EXPIRY_MS,
  FINDER_PAGE,
  INDEX_KEY,
  NEXT_REFRESH_MS,
  OFFLINE_PAGE,
  TONIGHT_PAGES,
  addAssets,
  answerTime,
  assetUrlsIn,
  chooseCopy,
  commitPair,
  copyMetaFor,
  copyMetaFromIsland,
  dropFinderCopies,
  emptyIndex,
  expire,
  holdsUserData,
  islandUrlFromShell,
  isSignedOutPage,
  listCopies,
  lockedFinderPlan,
  markFromDevice,
  mayStoreShell,
  needsNextCopy,
  needsReset,
  parseIndex,
  referencedAssetKeys,
  referencedKeys,
  shellKeyFor,
  awaitsNetwork,
  storeRequestFrom,
  storedPageOf,
  tonightPageOf,
  type CopyIndex,
  type CopyMeta,
  type StoredPage,
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
    target: null,
    targetName: null,
    plan: "full",
    // The plan is read when the page starts; unless a case says otherwise it is read as it was prepared.
    planAt: overrides.preparedAt ?? "2026-10-05T19:00:00.000Z",
    shellKey: shellKeyFor(islandUrl),
    islandUrl,
    storedAt: "2026-10-05T19:00:00.000Z",
    assets: [],
    ...overrides,
  };
}

/** A stored finder chart for `target` (its island URL is unique per call unless given). */
function chart(target: string, overrides: Partial<CopyMeta> = {}): CopyMeta {
  return copy({ page: FINDER_PAGE, target, targetName: target, ...overrides });
}

function indexOf(...copies: CopyMeta[]): CopyIndex {
  return { ...emptyIndex("scope-1"), owner: OWNER_A, lastSiteId: copies.at(-1)?.siteId ?? null, copies };
}

describe("tonightPageOf", () => {
  it("matches exactly the seven Tonight pages, the events page last, and nothing near them", () => {
    const pages = [
      "/tonight",
      "/tonight/targets",
      "/tonight/plan",
      "/tonight/moon",
      "/tonight/planets",
      "/tonight/nights",
      "/tonight/events",
    ];
    const none = [
      "/tonight/all",
      "/tonight/",
      "/tonight/plan/extra",
      "/tonightx",
      "/log",
      "/",
      "/tonight/finder?object=M31",
    ];
    expect(pages).toHaveLength(7);
    expect(none).toHaveLength(7);
    // The events page is last, so it is the last Tonight page on /offline.
    expect(TONIGHT_PAGES).toHaveLength(7);
    expect(TONIGHT_PAGES.at(-1)).toBe("/tonight/events");
    expect(TONIGHT_PAGES.at(-2)).toBe("/tonight/nights");
    for (const path of pages) {
      expect(tonightPageOf(url(path))?.page, `matches ${path}`).toBe(path);
    }
    for (const path of none) {
      expect(tonightPageOf(url(path)), `is none for ${path}`).toBeUndefined();
    }
  });

  it("reads the requested site and ignores every other param; a site param that is not a site id is no site", () => {
    expect(tonightPageOf(url(`/tonight/plan?site=${SITE_A}&telescope=x&night=next&sort=alt&logged=M31`))).toEqual({
      page: "/tonight/plan",
      siteId: SITE_A,
    });
    expect(tonightPageOf(url("/tonight?site=nope"))?.siteId).toBeUndefined();
  });
});

describe("storedPageOf", () => {
  it("is each Tonight page with no target and the finder chart with its site and the object's key, and none otherwise", () => {
    const rows: [string, string, unknown][] = [
      [
        "a Tonight page ignores the object param",
        `/tonight/plan?site=${SITE_A}&object=M31`,
        { page: "/tonight/plan", siteId: SITE_A, target: null },
      ],
      ["a Tonight page with no site", "/tonight", { page: "/tonight", siteId: undefined, target: null }],
      [
        "the chart keeps site and key, ignores the other params",
        `/tonight/finder?object=M31&from=targets&site=${SITE_A}&telescope=x&night=next`,
        { page: FINDER_PAGE, siteId: SITE_A, target: "M31" },
      ],
      [
        "a planet's chart",
        "/tonight/finder?object=jupiter",
        { page: FINDER_PAGE, siteId: undefined, target: "jupiter" },
      ],
      ["a Caldwell chart", "/tonight/finder?object=NGC869", { page: FINDER_PAGE, siteId: undefined, target: "NGC869" }],
      ["no object", "/tonight/finder", undefined],
      ["an empty object", "/tonight/finder?object=", undefined],
      ["M0", "/tonight/finder?object=M0", undefined],
      ["M31x", "/tonight/finder?object=M31x", undefined],
      ["a path below the finder", "/tonight/finder/extra?object=M31", undefined],
      ["an unknown Tonight path", "/tonight/all", undefined],
      ["the log", "/log", undefined],
    ];
    expect(rows).toHaveLength(12);
    for (const [label, path, expected] of rows) {
      expect(storedPageOf(url(path)), `${label}: ${path}`).toEqual(expected);
    }
  });

  it("reads a bare Messier number as the island's canonical key (F14b)", () => {
    expect(storedPageOf(url("/tonight/finder?object=31"))?.target).toBe("M31");
  });
});

describe("mayStoreShell", () => {
  it("stores a Tonight page and a finder chart with their plain params", () => {
    const paths = [
      "/tonight",
      `/tonight/moon?site=${SITE_A}`,
      "/tonight/targets?sort=name&telescope=x",
      "/tonight?night=next",
      "/tonight/finder?object=M13&from=targets",
      "/tonight/finder?object=M13&from=plan",
      `/tonight/plan?site=${SITE_A}`,
    ];
    expect(paths).toHaveLength(7);
    for (const path of paths) {
      expect(mayStoreShell(url(path)), `stores ${path}`).toBe(true);
    }
  });

  it("refuses a page that carries a notice param, an unknown page and a chart without its object", () => {
    const paths = [
      "/tonight?logged=M31",
      "/tonight?skyChecked=1",
      "/tonight?milestone=first-galaxy",
      "/tonight/planets?logged=jupiter&milestone=first-planet",
      "/tonight/plan?error=errors.generic",
      "/tonight/plan?saved=plan",
      `/tonight/plan?site=${SITE_A}&saved=plan-reset`,
      "/tonight/all",
      "/tonight/finder",
      "/tonight/finder?object=M13&error=errors.generic",
      "/log",
    ];
    expect(paths).toHaveLength(11);
    for (const path of paths) {
      expect(mayStoreShell(url(path)), `refuses ${path}`).toBe(false);
    }
  });
});

describe("awaitsNetwork", () => {
  it("is true for the landing after a save or reset", () => {
    const paths = [
      "/tonight/plan?saved=plan",
      "/tonight/plan?saved=plan-reset",
      `/tonight/plan?site=${SITE_A}&saved=plan`,
      `/tonight/plan?saved=plan-reset&site=${SITE_A}`,
    ];
    expect(paths).toHaveLength(4);
    for (const path of paths) {
      expect(awaitsNetwork(url(path)), `true for ${path}`).toBe(true);
    }
  });

  it("is false for the plan page without a save value, for another value and for any other page", () => {
    const paths = [
      "/tonight/plan",
      `/tonight/plan?site=${SITE_A}`,
      "/tonight/plan?saved=",
      "/tonight/plan?saved=site",
      "/tonight/plan?saved=Plan",
      "/tonight/plan?saved=plan-resets",
      "/tonight/plan?saved=other",
      "/tonight/plan?error=errors.sessionPlan.notVisible",
      "/tonight/plan?logged=plan",
      "/tonight?saved=plan",
      "/tonight/targets?saved=plan",
      "/tonight/planets?saved=plan",
      "/tonight/plan/extra?saved=plan",
      "/gear?saved=plan",
      "/log?saved=plan",
    ];
    expect(paths).toHaveLength(15);
    for (const path of paths) {
      expect(awaitsNetwork(url(path)), `false for ${path}`).toBe(false);
    }
  });
});

describe("storeRequestFrom", () => {
  const ORIGIN = "https://sidereus.example";
  const ask = (path: string) => ({ type: "store-page", url: path });

  it("accepts a Tonight page with the site param, as a URL on the origin, also absolute and without its hash", () => {
    const rows: [string, string][] = [
      [`/tonight/plan?site=${SITE_A}`, `${ORIGIN}/tonight/plan?site=${SITE_A}`],
      [`${ORIGIN}/tonight/plan?site=${SITE_A}#plan-heading`, `${ORIGIN}/tonight/plan?site=${SITE_A}`],
    ];
    expect(rows).toHaveLength(2);
    for (const [path, href] of rows) {
      expect(storeRequestFrom(ask(path), ORIGIN)?.href, `accepts ${path}`).toBe(href);
    }
  });

  it("accepts the plan page with no param", () => {
    expect(storeRequestFrom(ask("/tonight/plan"), ORIGIN)?.pathname).toBe("/tonight/plan");
  });

  it("refuses every other page, origin, extra param, notice param, site that is not an id and a second site", () => {
    const rows: [string, string][] = [
      ...TONIGHT_PAGES.filter((page) => page !== "/tonight/plan").flatMap((page): [string, string][] => [
        [`only the plan page asks to be stored (F10 f): ${page}`, page],
        [`only the plan page asks to be stored (F10 f): ${page} with a site`, `${page}?site=${SITE_A}`],
      ]),
      ["another origin", `https://evil.example/tonight/plan?site=${SITE_A}`],
      ["a protocol-relative URL", "//evil.example/tonight/plan"],
      ["the finder", "/tonight/finder?object=M13"],
      ["an unknown Tonight path", "/tonight/all"],
      ["the log", "/log"],
      ["an api path", "/api/tonight/plan"],
      ["the offline page", "/offline"],
      ["the landing", "/"],
      ["a telescope param", `/tonight/plan?site=${SITE_A}&telescope=${SITE_B}`],
      ["a night param", `/tonight/plan?site=${SITE_A}&night=next`],
      ["a sort param", "/tonight/plan?sort=name"],
      ["a saved notice", `/tonight/plan?site=${SITE_A}&saved=plan`],
      ["a reset notice", "/tonight/plan?saved=plan-reset"],
      ["an error notice", `/tonight/plan?site=${SITE_A}&error=errors.generic`],
      ["a logged notice", "/tonight?logged=M31"],
      ["a milestone notice", "/tonight?milestone=first-galaxy"],
      ["an empty site", "/tonight/plan?site="],
      ["a site that is a word", "/tonight/plan?site=nope"],
      ["a site that is coordinates", "/tonight/plan?site=40.4168,-3.7038"],
      ["two sites", `/tonight/plan?site=${SITE_A}&site=${SITE_B}`],
      ["an unparseable URL", "http://"],
    ];
    expect(rows).toHaveLength(33);
    for (const [label, path] of rows) {
      expect(storeRequestFrom(ask(path), ORIGIN), `${label}: ${path}`).toBeNull();
    }
  });

  it("refuses a message of the wrong type or shape", () => {
    const messages: unknown[] = [
      null,
      undefined,
      "store-page",
      42,
      {},
      { type: "purge", url: "/tonight/plan" },
      { type: "list-copies" },
      { type: "store-page" },
      { type: "store-page", url: 42 },
      { type: "store-page", url: null },
      { type: ["store-page"], url: "/tonight/plan" },
    ];
    expect(messages).toHaveLength(11);
    messages.forEach((data, i) => {
      expect(storeRequestFrom(data, ORIGIN), `message ${i}: ${JSON.stringify(data)}`).toBeNull();
    });
  });
});

describe("islandUrlFromShell", () => {
  it("reads the preload href, unescaped, and is none for a shell with no island preload", () => {
    const html = `<html><head><link rel="stylesheet" href="/_astro/a.css"><link rel="preload" as="fetch" href="/_server-islands/TonightContent?e=abc&amp;p=def&amp;s=ghi" crossorigin="anonymous"></head></html>`;
    expect(islandUrlFromShell(html)).toBe(ISLAND);
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
      target: null,
      targetName: null,
      plan: "unknown",
      planAt: "2026-10-05T19:00:00.000Z",
    });
  });

  it("reads the plan, and a missing or unrecognised one as unknown, never free (F11)", () => {
    expect(copyMetaFromIsland(island(`${full} data-plan="full"`))?.plan).toBe("full");
    expect(copyMetaFromIsland(island(`${full} data-plan="free"`))?.plan).toBe("free");
    expect(copyMetaFromIsland(island(`${full} data-plan="platinum"`))?.plan).toBe("unknown");
    expect(copyMetaFromIsland(island(full))?.plan).toBe("unknown");
  });

  it("reads when the plan was read (taking preparedAt for a missing or unreadable time, F1), the target and its name, and a missing forecast time as null", () => {
    expect(
      copyMetaFromIsland(island(`${full} data-plan="full" data-plan-at="2026-10-05T18:59:58.500Z"`)),
    ).toMatchObject({
      planAt: "2026-10-05T18:59:58.500Z",
      preparedAt: "2026-10-05T19:00:00.000Z",
    });
    expect(copyMetaFromIsland(island(`${full} data-plan="full" data-plan-at="soon"`))?.planAt).toBe(
      "2026-10-05T19:00:00.000Z",
    );
    expect(copyMetaFromIsland(island(`${full} data-plan="full"`))?.planAt).toBe("2026-10-05T19:00:00.000Z");

    const targets: [string, object][] = [
      [`data-target="M13" data-target-name="M13"`, { target: "M13", targetName: "M13" }],
      [`data-target="jupiter" data-target-name="Jowisz"`, { target: "jupiter", targetName: "Jowisz" }],
      [`data-target="31"`, { target: "M31", targetName: "M31" }],
    ];
    expect(targets).toHaveLength(3);
    for (const [attributes, expected] of targets) {
      expect(copyMetaFromIsland(island(`${full} ${attributes}`)), attributes).toMatchObject(expected);
    }

    const html = island(full.replace(/ data-forecast-fetched-at="[^"]*"/, ""));
    expect(copyMetaFromIsland(html)?.forecastFetchedAt).toBeNull();
  });

  it("is none for an island without the element, a target that does not parse, an unknown kind, an unreadable time or no owner fingerprint", () => {
    const rows: [string, string][] = [
      ["an empty body (signed out)", ""],
      ["no metadata element", "<div data-site-id='x'></div>"],
      ["a target that does not parse", island(`${full} data-target="not-a-target"`)],
      ["an unknown kind", island(full.replace('data-kind="tonight"', 'data-kind="later"'))],
      ["an unreadable time", island(full.replace("2026-10-06T04:30:00.000Z", "soon"))],
      ["no owner", island(full.replace(/data-owner="[^"]*" /, ""))],
      ["an owner that is an email", island(full.replace(OWNER_A, "user@example.com"))],
      ["an owner that is an id", island(full.replace(OWNER_A, SITE_A))],
    ];
    expect(rows).toHaveLength(8);
    for (const [label, html] of rows) {
      expect(copyMetaFromIsland(html), label).toBeUndefined();
    }
  });
});

describe("copyMetaFor", () => {
  const attributes = (extra: string) =>
    `data-owner="${OWNER_A}" data-site-id="${SITE_A}" data-site-name="Backyard" data-night-date="2026-10-05" data-kind="tonight" data-prepared-at="2026-10-05T19:00:00.000Z" data-valid-until="2026-10-06T04:30:00.000Z" ${extra}`;
  const island = (extra: string) => `<div hidden data-offline-copy ${attributes(extra)}></div>`;
  const chartIsland = island('data-plan="full" data-target="M13" data-target-name="M13"');
  const shell = (path: string) => url(path);

  it("pairs a Tonight shell with an island that has no target, whatever its plan, and a finder shell with a full chart island of the same target; none for an island with no metadata", () => {
    for (const plan of ["full", "free", "unknown"]) {
      expect(copyMetaFor("/tonight/plan", shell("/tonight/plan"), island(`data-plan="${plan}"`))?.plan, plan).toBe(
        plan,
      );
    }
    expect(copyMetaFor(FINDER_PAGE, shell("/tonight/finder?object=M13&from=targets"), chartIsland)?.target).toBe("M13");
    // The shell may name the object by its bare number.
    expect(copyMetaFor(FINDER_PAGE, shell("/tonight/finder?object=13"), chartIsland)?.target).toBe("M13");
    expect(copyMetaFor("/tonight", shell("/tonight"), "")).toBeUndefined();
  });

  it("refuses the three mismatches (F14a)", () => {
    // A Tonight shell whose island names a target.
    expect(copyMetaFor("/tonight/targets", shell("/tonight/targets"), chartIsland)).toBeUndefined();
    // A finder shell whose island has no target.
    expect(copyMetaFor(FINDER_PAGE, shell("/tonight/finder?object=M13"), island('data-plan="full"'))).toBeUndefined();
    // A target other than the shell URL's.
    expect(copyMetaFor(FINDER_PAGE, shell("/tonight/finder?object=M31"), chartIsland)).toBeUndefined();
    expect(copyMetaFor(FINDER_PAGE, shell("/tonight/finder"), chartIsland)).toBeUndefined();
  });

  it("refuses a finder island that was not rendered for the full plan (F11)", () => {
    for (const plan of ["free", "unknown", "platinum"]) {
      const html = island(`data-plan="${plan}" data-target="M13" data-target-name="M13"`);
      expect(copyMetaFor(FINDER_PAGE, shell("/tonight/finder?object=M13"), html)).toBeUndefined();
    }
    expect(copyMetaFor(FINDER_PAGE, shell("/tonight/finder?object=M13"), island('data-target="M13"'))).toBeUndefined();
  });
});

describe("lockedFinderPlan", () => {
  const locked = (attributes: string) =>
    `<main><section class="space-y-6" data-finder-state="locked" ${attributes} aria-labelledby="x"><h2>…</h2></section></main>`;

  it("reads the plan of the locked root (island and shell alike) and when the server read it, and is none without a locked root (F1)", () => {
    expect(lockedFinderPlan(locked('data-plan="free"'))).toEqual({ plan: "free", planAt: null });
    expect(
      lockedFinderPlan('<html><body><div data-finder-state="locked" data-plan="free"></div></body></html>'),
    ).toEqual({ plan: "free", planAt: null });
    expect(lockedFinderPlan(locked('data-plan="free" data-plan-at="2026-10-13T12:00:01.250Z"'))).toEqual({
      plan: "free",
      planAt: "2026-10-13T12:00:01.250Z",
    });
    expect(lockedFinderPlan(locked('data-plan="free" data-plan-at="soon"'))?.planAt).toBeNull();
    expect(
      lockedFinderPlan('<div data-finder-state="chart" data-finder-chart data-plan="free"></div>'),
    ).toBeUndefined();
    expect(lockedFinderPlan('<p data-plan="free">data-finder-state="locked"</p>')).toBeUndefined();
    expect(lockedFinderPlan("")).toBeUndefined();
  });

  it("reads a missing or other plan as unknown, which drops nothing (F11)", () => {
    expect(lockedFinderPlan(locked(""))?.plan).toBe("unknown");
    expect(lockedFinderPlan(locked('data-plan="unknown"'))?.plan).toBe("unknown");
    expect(lockedFinderPlan(locked('data-plan="full"'))?.plan).toBe("unknown");
  });
});

describe("answerTime", () => {
  it("is the answer's own plan-read time, before its Date header (F1)", () => {
    expect(answerTime("2026-10-13T12:00:01.250Z", "Tue, 13 Oct 2026 12:00:03 GMT")).toBe("2026-10-13T12:00:01.250Z");
    expect(answerTime("2026-10-13T12:00:01.250Z", null)).toBe("2026-10-13T12:00:01.250Z");
  });

  it("is the server's Date header rounded up to the end of its second, and none without either, never the device's clock (F6b)", () => {
    expect(answerTime(null, "Tue, 13 Oct 2026 12:00:03 GMT")).toBe("2026-10-13T12:00:03.999Z");
    expect(answerTime(null, null)).toBeUndefined();
    expect(answerTime(null, "soon")).toBeUndefined();
  });
});

describe("assets", () => {
  it("lists every /_astro file once sorted, marks the first html tag only, adds files to the named pairs only and keeps the index, the offline page and every pair's keys", () => {
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

    expect(markFromDevice('<!doctype html><html lang="en" data-theme="dark"><body><html></body></html>')).toBe(
      '<!doctype html><html data-from-device lang="en" data-theme="dark"><body><html></body></html>',
    );
    expect(markFromDevice("<html-like></html-like>")).toBe("<html-like></html-like>");

    const a = copy({ assets: ["/_astro/a.js"] });
    const b = copy({ page: "/tonight/plan" });
    const index = addAssets(indexOf(a, b), [a.islandUrl], ["/_astro/chunk.js", "/_astro/a.js"]);
    expect(index.copies[0]?.assets).toEqual(["/_astro/a.js", "/_astro/chunk.js"]);
    expect(index.copies[1]?.assets).toEqual([]);

    const only = copy({ assets: ["/_astro/a.js"] });
    expect(referencedKeys(indexOf(only))).toEqual(new Set([INDEX_KEY, OFFLINE_PAGE, only.shellKey, only.islandUrl]));
    expect(referencedAssetKeys(indexOf(only))).toEqual(new Set(["/_astro/a.js"]));
  });
});

describe("commitPair", () => {
  it("adds a pair and remembers its site and owner, replaces the previous pair for the same site, page and kind returning its keys, and keeps an asset another pair still references", () => {
    const first = copy({ siteId: SITE_B });
    const added = commitPair(emptyIndex("s"), first);
    expect(added.index.copies).toEqual([first]);
    expect(added.index.lastSiteId).toBe(SITE_B);
    expect(added.index.owner).toBe(OWNER_A);
    expect(added.deleteKeys).toEqual([]);
    expect(added.deleteAssets).toEqual([]);

    const old = copy({ assets: ["/_astro/old.css", "/_astro/shared.js"] });
    const fresh = copy({ assets: ["/_astro/new.css", "/_astro/shared.js"] });
    const replaced = commitPair(indexOf(old), fresh);
    expect(replaced.index.copies).toEqual([fresh]);
    expect(replaced.deleteKeys).toEqual([old.shellKey, old.islandUrl]);
    expect(replaced.deleteAssets).toEqual(["/_astro/old.css"]);

    const plan = copy({ page: "/tonight/plan", assets: ["/_astro/shared.js"] });
    const oldToo = copy({ assets: ["/_astro/shared.js", "/_astro/old.css"] });
    expect(commitPair(indexOf(plan, oldToo), copy({ assets: [] })).deleteAssets).toEqual(["/_astro/old.css"]);
  });

  it("is a no-op when the same island URL is committed again, and keeps other kinds, pages and sites", () => {
    const once = commitPair(emptyIndex("s"), copy({ islandUrl: ISLAND })).index;
    const twice = commitPair(once, copy({ islandUrl: ISLAND, storedAt: "2026-10-05T20:00:00.000Z" }));
    expect(twice.index).toBe(once);
    expect(twice.deleteKeys).toEqual([]);

    const next = copy({ kind: "next" });
    const plan = copy({ page: "/tonight/plan" });
    const other = copy({ siteId: SITE_B });
    expect(commitPair(indexOf(next, plan, other), copy()).index.copies).toHaveLength(4);
  });

  it("moves the last site only for a page the user opened, not a next-night copy", () => {
    const start = indexOf(copy({ siteId: SITE_A }));
    expect(commitPair(start, copy({ siteId: SITE_B, kind: "next" })).index.lastSiteId).toBe(SITE_A);
    expect(commitPair(start, copy({ siteId: SITE_B })).index.lastSiteId).toBe(SITE_B);
  });
});

describe("commitPair for finder charts", () => {
  it("keeps M31 and M13 side by side and replaces M31's older pair only; keys a chart by site and kind; never lets a chart replace a Tonight page, or the other way round", () => {
    const m31 = chart("M31", { assets: ["/_astro/old.css", "/_astro/shared.js"] });
    const m13 = chart("M13");
    const tonight = copy({ page: "/tonight/targets" });
    const fresh = chart("M31", { assets: ["/_astro/shared.js"] });
    const { index, deleteKeys, deleteAssets } = commitPair(indexOf(m31, m13, tonight), fresh);
    expect(index.copies).toEqual([m13, tonight, fresh]);
    expect(deleteKeys).toEqual([m31.shellKey, m31.islandUrl]);
    expect(deleteAssets).toEqual(["/_astro/old.css"]);

    const bySite = commitPair(indexOf(chart("M31")), chart("M31", { siteId: SITE_B })).index;
    expect(bySite.copies).toHaveLength(2);
    expect(commitPair(bySite, chart("M31", { kind: "next" })).index.copies).toHaveLength(3);

    const withPage = commitPair(indexOf(copy({ page: "/tonight/targets" })), chart("M31")).index;
    expect(withPage.copies).toHaveLength(2);
    expect(commitPair(withPage, copy({ page: "/tonight/targets" })).index.copies).toHaveLength(2);
  });

  it("refuses a chart that is not a full one with a target", () => {
    const start = indexOf(copy());
    const refused = [chart("M31", { plan: "free" }), chart("M31", { plan: "unknown" }), chart("M31", { target: null })];
    expect(refused).toHaveLength(3);
    refused.forEach((candidate, i) => {
      expect(commitPair(start, candidate).index, `case ${i}: plan ${candidate.plan}, target ${candidate.target}`).toBe(
        start,
      );
    });
  });

  it("refuses a stale full chart after freeSince, and a newer full island clears it (F12)", () => {
    const demoted: CopyIndex = { ...indexOf(copy()), freeSince: "2026-10-05T19:30:00.000Z" };
    const stale = chart("M31", { planAt: "2026-10-05T19:30:00.000Z" });
    expect(commitPair(demoted, stale).index).toBe(demoted);
    expect(commitPair(demoted, chart("M31", { planAt: "2026-10-05T19:29:59.999Z" })).index).toBe(demoted);

    // The plan returns: a full chart whose plan was read after freeSince is stored and clears it.
    const back = commitPair(demoted, chart("M31", { planAt: "2026-10-05T19:30:00.001Z" })).index;
    expect(back.freeSince).toBeNull();
    expect(back.copies.filter((c) => c.page === FINDER_PAGE)).toHaveLength(1);
  });

  it("compares the plan-read time, not the render time: a chart built late from an earlier read is refused (F1)", () => {
    // Chart read full at 19:00, a free answer read at 19:10 dropped the charts, the chart was rendered at 19:20.
    const free = commitPair(
      indexOf(chart("M13")),
      copy({ page: "/tonight/targets", plan: "free", preparedAt: "2026-10-05T19:10:00.000Z" }),
    ).index;
    expect(free.freeSince).toBe("2026-10-05T19:10:00.000Z");
    const late = chart("M31", { planAt: "2026-10-05T19:00:00.000Z", preparedAt: "2026-10-05T19:20:00.000Z" });
    const refused = commitPair(free, late);
    expect(refused.index).toBe(free);
    expect(refused.index.freeSince).toBe("2026-10-05T19:10:00.000Z");
    expect(refused.deleteKeys).toEqual([]);
    // The same chart rendered from a plan read after the free answer is the plan's return.
    const back = commitPair(free, { ...late, planAt: "2026-10-05T19:15:00.000Z" }).index;
    expect(back.freeSince).toBeNull();
    expect(back.copies.filter((c) => c.page === FINDER_PAGE)).toHaveLength(1);
  });

  it("clears freeSince with a Tonight island whose plan was read later, and not with an earlier one", () => {
    const demoted: CopyIndex = { ...indexOf(copy()), freeSince: "2026-10-05T19:30:00.000Z" };
    const older = commitPair(demoted, copy({ page: "/tonight/plan", preparedAt: "2026-10-05T19:00:00.000Z" })).index;
    expect(older.freeSince).toBe("2026-10-05T19:30:00.000Z");
    expect(older.copies).toHaveLength(2);
    // Prepared later but its plan was read earlier: proves nothing.
    const slow = commitPair(
      demoted,
      copy({ page: "/tonight/plan", preparedAt: "2026-10-05T19:40:00.000Z", planAt: "2026-10-05T19:20:00.000Z" }),
    ).index;
    expect(slow.freeSince).toBe("2026-10-05T19:30:00.000Z");
    const newer = commitPair(demoted, copy({ page: "/tonight/plan", preparedAt: "2026-10-05T19:31:00.000Z" })).index;
    expect(newer.freeSince).toBeNull();
  });

  it("an island rendered for a free account is committed, sets freeSince and takes every chart with it (D-14a)", () => {
    const m31 = chart("M31", { assets: ["/_astro/chart.js", "/_astro/shared.js"] });
    const m13 = chart("M13");
    const plan = copy({ page: "/tonight/plan", assets: ["/_astro/shared.js"] });
    const free = copy({
      page: "/tonight/targets",
      plan: "free",
      preparedAt: "2026-10-05T20:00:01.000Z",
      planAt: "2026-10-05T20:00:00.000Z",
    });
    const { index, deleteKeys, deleteAssets } = commitPair(indexOf(m31, m13, plan), free);
    expect(index.copies).toEqual([plan, free]);
    expect(index.copies.filter((c) => c.page === FINDER_PAGE)).toHaveLength(0);
    expect(index.freeSince).toBe("2026-10-05T20:00:00.000Z");
    expect(deleteKeys).toEqual([m31.shellKey, m31.islandUrl, m13.shellKey, m13.islandUrl]);
    expect(deleteAssets).toEqual(["/_astro/chart.js"]);
  });

  it("an unknown plan commits a Tonight pair and drops nothing (F11)", () => {
    const m31 = chart("M31");
    const { index, deleteKeys } = commitPair(indexOf(m31), copy({ page: "/tonight/moon", plan: "unknown" }));
    expect(index.copies).toHaveLength(2);
    expect(index.copies).toContain(m31);
    expect(index.freeSince).toBeNull();
    expect(deleteKeys).toEqual([]);
  });
});

describe("dropFinderCopies", () => {
  it("removes only finder pairs and keeps an asset a Tonight pair still references; is the same index with no chart; records the time the free plan was seen, never moving it back", () => {
    const m31 = chart("M31", { assets: ["/_astro/chart.js", "/_astro/shared.js"] });
    const m13 = chart("M13", { siteId: SITE_B, assets: ["/_astro/chart.js"] });
    const plan = copy({ page: "/tonight/plan", assets: ["/_astro/shared.js"] });
    const { index, deleteKeys, deleteAssets } = dropFinderCopies(indexOf(plan, m31, m13));
    expect(index.copies).toEqual([plan]);
    expect(deleteKeys).toEqual([m31.shellKey, m31.islandUrl, m13.shellKey, m13.islandUrl]);
    expect(deleteAssets).toEqual(["/_astro/chart.js"]);
    expect(index.freeSince).toBeNull();

    const start = indexOf(copy());
    const none = dropFinderCopies(start);
    expect(none.index).toBe(start);
    expect(none.deleteKeys).toEqual([]);
    expect(none.deleteAssets).toEqual([]);

    const first = dropFinderCopies(start, "2026-10-05T20:00:00.000Z").index;
    expect(first.freeSince).toBe("2026-10-05T20:00:00.000Z");
    expect(dropFinderCopies(first, "2026-10-05T19:00:00.000Z").index).toBe(first);
    expect(dropFinderCopies(first, "2026-10-05T21:00:00.000Z").index.freeSince).toBe("2026-10-05T21:00:00.000Z");

    // An older free island never moves a later freeSince back.
    const later: CopyIndex = { ...indexOf(copy()), freeSince: "2026-10-05T21:00:00.000Z" };
    const older = commitPair(
      later,
      copy({ page: "/tonight/moon", plan: "free", preparedAt: "2026-10-05T20:00:00.000Z" }),
    );
    expect(older.index.freeSince).toBe("2026-10-05T21:00:00.000Z");
  });
});

describe("needsReset", () => {
  it("adopts the owner of a commit into a new or empty index and keeps the store for the same owner", () => {
    expect(needsReset(emptyIndex("s"), OWNER_B)).toBe(false);
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

  it("reads the layout's mark on the html tag only, and finds user data in an owned or non-empty index, or a signed-in /offline page", () => {
    expect(isSignedOutPage(signedOut)).toBe(true);
    expect(isSignedOutPage(signedIn)).toBe(false);
    expect(isSignedOutPage('<html lang="en"><body data-signed-out></body></html>')).toBe(false);

    expect(holdsUserData(undefined, undefined)).toBe(false);
    expect(holdsUserData(emptyIndex("s"), signedOut)).toBe(false);
    expect(holdsUserData({ ...emptyIndex("s"), owner: OWNER_A }, signedOut)).toBe(true);
    expect(holdsUserData(indexOf(copy()), undefined)).toBe(true);
    expect(holdsUserData(emptyIndex("s"), signedIn)).toBe(true);
  });
});

describe("expire", () => {
  const stored = new Date("2026-10-05T19:00:00.000Z");
  const at = (ms: number) => new Date(stored.getTime() + ms);

  it("keeps a site just under 36 h after its last refresh and drops it at exactly 36 h, counting the site's newest copy", () => {
    const index = indexOf(copy({ assets: ["/_astro/a.js"] }));
    expect(expire(index, at(EXPIRY_MS - 1)).index.copies).toHaveLength(1);
    const { index: after, deleteKeys, deleteAssets } = expire(index, at(EXPIRY_MS));
    expect(after.copies).toEqual([]);
    expect(after.lastSiteId).toBeNull();
    expect(deleteKeys).toEqual([index.copies[0]?.shellKey, index.copies[0]?.islandUrl]);
    expect(deleteAssets).toEqual(["/_astro/a.js"]);

    // An older page of a refreshed site stays.
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
  const other = copy({ siteId: SITE_B, siteName: "Ridge" });
  const before = new Date(Date.parse(tonight.validUntil) - 1);
  const atRollover = new Date(tonight.validUntil);
  const expired = new Date(Date.parse(tonight.storedAt) + EXPIRY_MS);

  it("serves tonight's copy before its validUntil, the next-night copy from exactly validUntil, tonight's as stale with none or past the next one's own, the last site when none is named, and nothing for another page or site, an empty index or an expired site", () => {
    const rows: [string, CopyIndex, StoredPage, string | undefined, Date, unknown][] = [
      ["before validUntil", indexOf(tonight, next), "/tonight", SITE_A, before, { copy: tonight, notice: "prepared" }],
      [
        "from validUntil",
        indexOf(tonight, next),
        "/tonight",
        SITE_A,
        atRollover,
        { copy: next, notice: "old-forecast" },
      ],
      ["no next-night copy", indexOf(tonight), "/tonight", SITE_A, atRollover, { copy: tonight, notice: "stale" }],
      [
        "next-night copy past its own validUntil",
        indexOf(tonight, next),
        "/tonight",
        SITE_A,
        new Date(next.validUntil),
        { copy: tonight, notice: "stale" },
      ],
      [
        "no site named: the last site",
        { ...indexOf(tonight, other), lastSiteId: SITE_B },
        "/tonight",
        undefined,
        before,
        { copy: other, notice: "prepared" },
      ],
      [
        "a site named wins over the last site",
        { ...indexOf(tonight, other), lastSiteId: SITE_B },
        "/tonight",
        SITE_A,
        before,
        { copy: tonight, notice: "prepared" },
      ],
      ["a page never stored", indexOf(tonight), "/tonight/plan", SITE_A, before, undefined],
      ["a site never stored", indexOf(tonight), "/tonight", SITE_B, before, undefined],
      ["an empty index", emptyIndex("s"), "/tonight", undefined, before, undefined],
      ["an expired site", indexOf(tonight, next), "/tonight", SITE_A, expired, undefined],
    ];
    expect(rows).toHaveLength(10);
    for (const [label, index, page, siteId, now, expected] of rows) {
      expect(chooseCopy(index, page, siteId, now), label).toEqual(expected);
    }
  });
});

describe("chooseCopy for finder charts", () => {
  const m31 = chart("M31", { islandUrl: "/_server-islands/F?e=m31" });
  const m13 = chart("M13", { islandUrl: "/_server-islands/F?e=m13" });
  const targets = copy({ page: "/tonight/targets" });
  const before = new Date(Date.parse(m31.validUntil) - 1);
  const after = new Date(m31.validUntil);
  const expired = new Date(Date.parse(m31.storedAt) + EXPIRY_MS);

  it("serves the chart of the asked target (stale once its night is over), and never a target never stored, a missing target, another site, an expired site or a Tonight page for a chart", () => {
    const rows: [string, CopyIndex, StoredPage, string, Date, string | undefined, unknown][] = [
      [
        "the asked target M13",
        indexOf(m31, m13),
        FINDER_PAGE,
        SITE_A,
        before,
        "M13",
        { copy: m13, notice: "prepared" },
      ],
      [
        "the asked target M31",
        indexOf(m31, m13),
        FINDER_PAGE,
        SITE_A,
        before,
        "M31",
        { copy: m31, notice: "prepared" },
      ],
      ["stale once its night is over", indexOf(m31), FINDER_PAGE, SITE_A, after, "M31", { copy: m31, notice: "stale" }],
      ["a target never stored", indexOf(m31), FINDER_PAGE, SITE_A, before, "M13", undefined],
      ["a missing target", indexOf(m31), FINDER_PAGE, SITE_A, before, undefined, undefined],
      ["another site", indexOf(m31), FINDER_PAGE, SITE_B, before, "M31", undefined],
      [
        "a Tonight page beside a chart",
        indexOf(m31, targets),
        "/tonight/targets",
        SITE_A,
        before,
        undefined,
        { copy: targets, notice: "prepared" },
      ],
      ["a chart asked of a Tonight copy", indexOf(targets), FINDER_PAGE, SITE_A, before, "M31", undefined],
      ["an expired site", indexOf(m31), FINDER_PAGE, SITE_A, expired, "M31", undefined],
    ];
    expect(rows).toHaveLength(9);
    for (const [label, index, page, siteId, now, target, expected] of rows) {
      expect(chooseCopy(index, page, siteId, now, target), label).toEqual(expected);
    }
  });
});

describe("needsNextCopy", () => {
  const now = new Date("2026-10-05T21:00:00.000Z");

  it("fetches a missing next-night copy, and refreshes one 1 h old or more, not a younger one", () => {
    expect(needsNextCopy(indexOf(copy()), SITE_A, "/tonight", now)).toBe(true);
    const at = (ms: number) => indexOf(copy({ kind: "next", storedAt: new Date(now.getTime() - ms).toISOString() }));
    expect(needsNextCopy(at(NEXT_REFRESH_MS - 1), SITE_A, "/tonight", now)).toBe(false);
    expect(needsNextCopy(at(NEXT_REFRESH_MS), SITE_A, "/tonight", now)).toBe(true);
  });

  it("is false for a finder chart, whatever is stored (no next-night copy of a chart, D-13)", () => {
    expect(needsNextCopy(indexOf(chart("M31")), SITE_A, FINDER_PAGE, now)).toBe(false);
    expect(needsNextCopy(emptyIndex("s"), SITE_A, FINDER_PAGE, now)).toBe(false);
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

  it("lists a site's seven pages in TONIGHT_PAGES order, the events page last (F7c)", () => {
    const now = new Date("2026-10-05T21:00:00.000Z");
    const index = indexOf(...[...TONIGHT_PAGES].reverse().map((page) => copy({ page })));
    expect(listCopies(index, now).map(({ page }) => page)).toEqual([...TONIGHT_PAGES]);
  });

  it("lists one entry per site and chart after the seven pages, ordered by the chart's name", () => {
    const now = new Date("2026-10-05T21:00:00.000Z");
    const index = indexOf(
      chart("M31", { targetName: "M31" }),
      chart("jupiter", { targetName: "Jowisz" }),
      chart("M13", { targetName: "M13" }),
      chart("M13", { kind: "next", nightDate: "2026-10-06" }),
      copy({ page: "/tonight/targets" }),
      chart("M13", { siteId: SITE_B, siteName: "Alpine hut" }),
    );
    expect(
      listCopies(index, now).map(({ siteName, page, target, targetName }) => [siteName, page, target, targetName]),
    ).toEqual([
      ["Alpine hut", FINDER_PAGE, "M13", "M13"],
      ["Backyard", "/tonight/targets", null, null],
      ["Backyard", FINDER_PAGE, "jupiter", "Jowisz"],
      ["Backyard", FINDER_PAGE, "M13", "M13"],
      ["Backyard", FINDER_PAGE, "M31", "M31"],
    ]);
  });
});

describe("parseIndex", () => {
  it("reads back a stored index, dropping malformed copies and a chart with no target, keeps a readable freeSince, reads a missing owner as unowned, and is none for something that is not an index", () => {
    const good = copy();
    const parsed = parseIndex(
      JSON.parse(
        JSON.stringify({ userScope: "s", owner: OWNER_A, lastSiteId: SITE_A, copies: [good, { page: "/x" }] }),
      ),
    );
    expect(parsed).toEqual({ userScope: "s", owner: OWNER_A, lastSiteId: SITE_A, copies: [good], freeSince: null });

    const m31 = chart("M31");
    const { target: _target, ...noTarget } = chart("M13");
    const withChart = parseIndex({
      userScope: "s",
      owner: OWNER_A,
      lastSiteId: SITE_A,
      copies: [m31, noTarget],
      freeSince: "2026-10-05T20:00:00.000Z",
    });
    expect(withChart?.copies).toEqual([m31]);
    expect(withChart?.freeSince).toBe("2026-10-05T20:00:00.000Z");
    expect(parseIndex({ userScope: "s", copies: [], freeSince: "soon" })?.freeSince).toBeNull();

    expect(parseIndex({ userScope: "s", copies: [] })?.owner).toBeNull();
    expect(parseIndex(null)).toBeUndefined();
    expect(parseIndex({ copies: [] })).toBeUndefined();
  });

  it("reads an index written before finder charts: no target, name, plan, plan-read time or freeSince", () => {
    const { target: _target, targetName: _name, plan: _plan, planAt: _planAt, ...old } = copy();
    const parsed = parseIndex({ userScope: "s", owner: OWNER_A, lastSiteId: SITE_A, copies: [old] });
    expect(parsed?.freeSince).toBeNull();
    expect(parsed?.copies).toEqual([copy({ ...old, plan: "unknown" })]);
    expect(parsed?.copies[0]).toMatchObject({
      target: null,
      targetName: null,
      plan: "unknown",
      planAt: old.preparedAt,
    });
  });

  it("keeps a stored plan-read time, and falls back to preparedAt for an unreadable one (F1)", () => {
    const stored = copy({ planAt: "2026-10-05T18:59:00.000Z" });
    const parsed = parseIndex({
      userScope: "s",
      owner: OWNER_A,
      lastSiteId: SITE_A,
      copies: [stored, { ...copy(), planAt: "soon" }],
    });
    expect(parsed?.copies.map((c) => c.planAt)).toEqual(["2026-10-05T18:59:00.000Z", "2026-10-05T19:00:00.000Z"]);
  });

  it("drops a copy whose times cannot be read, which would never expire", () => {
    const parsed = parseIndex({ userScope: "s", owner: null, lastSiteId: null, copies: [copy({ storedAt: "soon" })] });
    expect(parsed?.copies).toEqual([]);
  });
});
