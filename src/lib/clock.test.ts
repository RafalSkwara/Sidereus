import { describe, expect, it } from "vitest";

import { TEST_NOW_COOKIE, readTestNow, requestNow } from "./clock";

const COOKIE = `${TEST_NOW_COOKIE}=2026-10-24T19:30:00Z`;

describe("the e2e clock seam (test-suite-diet owner decision 6.6)", () => {
  it("honours the cookie only against a loopback Supabase, exactly", () => {
    const loopback = ["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321", "http://localhost"];
    expect(loopback.length).toBe(4);
    for (const url of loopback) {
      expect(readTestNow(COOKIE, url)?.toISOString(), url).toBe("2026-10-24T19:30:00.000Z");
    }
    // Hosted, lookalike and unusable URLs: the cookie is ignored (a production Worker's Supabase is the hosted project).
    const notLoopback: (string | undefined)[] = [
      "https://abcd.supabase.co",
      "https://127.0.0.1.evil.example",
      "https://localhost.example.com",
      "https://evil.example/127.0.0.1",
      "http://127.0.0.2:54321",
      "",
      undefined,
      "not a url",
    ];
    expect(notLoopback.length).toBe(8);
    for (const url of notLoopback) {
      expect(readTestNow(COOKIE, url), String(url)).toBeNull();
    }
  });

  it("ignores a malformed, out-of-range or absent cookie value, and finds the cookie among others", () => {
    const loopback = "http://127.0.0.1:54321";
    const bad = [
      `${TEST_NOW_COOKIE}=yesterday`,
      `${TEST_NOW_COOKIE}=2026-10-24`,
      `${TEST_NOW_COOKIE}=2026-10-24T19:30:00+02:00`,
      `${TEST_NOW_COOKIE}=2026-13-45T25:61:61Z`,
      `${TEST_NOW_COOKIE}=1999-01-01T00:00:00Z`,
      `${TEST_NOW_COOKIE}=2999-01-01T00:00:00Z`,
      `${TEST_NOW_COOKIE}=`,
      "sidereus-lang=en",
    ];
    expect(bad.length).toBe(8);
    for (const cookie of bad) {
      expect(readTestNow(cookie, loopback), cookie).toBeNull();
    }
    expect(readTestNow(null, loopback)).toBeNull();
    expect(readTestNow(undefined, loopback)).toBeNull();
    expect(readTestNow(`sidereus-lang=en; ${COOKIE}; sidereus-theme=dark`, loopback)?.toISOString()).toBe(
      "2026-10-24T19:30:00.000Z",
    );
    // A percent-encoded value (a browser may encode the colons) reads the same.
    expect(readTestNow(`${TEST_NOW_COOKIE}=2026-10-24T19%3A30%3A00Z`, loopback)?.toISOString()).toBe(
      "2026-10-24T19:30:00.000Z",
    );
  });

  it("is the real clock without a pinned instant, and the pinned instant with one", () => {
    const before = Date.now();
    const real = requestNow({}).getTime();
    expect(real).toBeGreaterThanOrEqual(before);
    expect(real).toBeLessThanOrEqual(Date.now());
    const pinned = new Date("2026-10-24T19:30:00Z");
    expect(requestNow({ testNow: pinned })).toBe(pinned);
  });
});
