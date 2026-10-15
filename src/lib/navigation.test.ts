import { describe, expect, it } from "vitest";

import { currentDestination, isCurrentPage, NAV_ITEMS } from "./navigation";

describe("NAV_ITEMS", () => {
  it("lists Tonight, Log, Progress and My gear, in that order", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(["/tonight", "/log", "/log/progress", "/gear"]);
  });

  it("makes Progress a network-only destination with its own label and icon", () => {
    expect(NAV_ITEMS.find((item) => item.href === "/log/progress")).toEqual({
      href: "/log/progress",
      label: "progress",
      icon: "progress",
      needsNetwork: true,
    });
  });
});

describe("currentDestination", () => {
  it.each([
    ["/tonight", "/tonight"],
    ["/tonight/targets", "/tonight"],
    ["/log", "/log"],
    ["/log/new", "/log"],
    ["/log/sky", "/log"],
    ["/log/progress", "/log/progress"],
    ["/gear/sites/new", "/gear"],
  ] as const)("names %s as %s", (pathname, href) => {
    expect(currentDestination(pathname)).toBe(href);
  });

  it.each(["/login", "/", "/auth/signin"])("names no destination on %s", (pathname) => {
    expect(currentDestination(pathname)).toBeNull();
  });
});

describe("exactly one current destination", () => {
  // The app's pages under a destination; each must mark one item only, or the bars would carry two current items.
  const APP_PATHS = [
    "/tonight",
    "/tonight/targets",
    "/tonight/plan",
    "/tonight/moon",
    "/tonight/planets",
    "/tonight/nights",
    "/tonight/events",
    "/tonight/finder",
    "/log",
    "/log/new",
    "/log/sky",
    "/log/progress",
    "/log/0b0e5a52-3c1d-4f2a-9e1b-6d7c8a9b0c1d",
    "/gear",
    "/gear/sites/new",
    "/gear/telescopes/new",
    "/gear/eyepieces/new",
  ];

  it.each(APP_PATHS)("on %s", (pathname) => {
    const current = currentDestination(pathname);
    const marked = NAV_ITEMS.filter((item) => item.href === current);
    expect(marked).toHaveLength(1);
    // The chosen item really covers the path.
    expect(marked.every((item) => isCurrentPage(pathname, item.href))).toBe(true);
  });
});
