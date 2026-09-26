import { describe, expect, it } from "vitest";
import { LOCALE_COOKIE, THEME_COOKIE, preferenceCookie, resolveLocale, resolveTheme } from "./preferences";

describe("resolveTheme", () => {
  it("returns a valid cookie value", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("defaults to dark when the cookie is missing or invalid", () => {
    expect(resolveTheme()).toBe("dark");
    expect(resolveTheme("")).toBe("dark");
    expect(resolveTheme("red")).toBe("dark");
    expect(resolveTheme("LIGHT")).toBe("dark");
  });
});

describe("resolveLocale", () => {
  it("prefers a valid cookie over the header", () => {
    expect(resolveLocale("en", "pl-PL,pl;q=0.9")).toBe("en");
    expect(resolveLocale("pl", "en-GB")).toBe("pl");
  });

  it("ignores an invalid cookie and falls back to the header", () => {
    expect(resolveLocale("de", "pl")).toBe("pl");
    expect(resolveLocale("PL", "en")).toBe("en");
  });

  it("orders ranges by q-value, not header position", () => {
    expect(resolveLocale(undefined, "en;q=0.5, pl")).toBe("pl");
    expect(resolveLocale(undefined, "pl;q=0.4, en;q=0.8")).toBe("en");
  });

  it("keeps header order for equal q-values", () => {
    expect(resolveLocale(undefined, "pl, en")).toBe("pl");
    expect(resolveLocale(undefined, "en, pl")).toBe("en");
  });

  it("matches on the primary subtag, case-insensitively", () => {
    expect(resolveLocale(undefined, "pl-PL")).toBe("pl");
    expect(resolveLocale(undefined, "PL-pl,en;q=0.5")).toBe("pl");
    expect(resolveLocale(undefined, "de-DE, pl;q=0.3")).toBe("pl");
  });

  it("skips ranges with q=0", () => {
    expect(resolveLocale(undefined, "pl;q=0, en;q=0.1")).toBe("en");
  });

  it("falls back to English for a wildcard or unsupported languages", () => {
    expect(resolveLocale(undefined, "*")).toBe("en");
    expect(resolveLocale(undefined, "fr-FR, de;q=0.8, *;q=0.5")).toBe("en");
  });

  it("falls back to English for an empty or missing header", () => {
    expect(resolveLocale(undefined, "")).toBe("en");
    expect(resolveLocale(undefined, null)).toBe("en");
    expect(resolveLocale()).toBe("en");
  });
});

describe("preferenceCookie", () => {
  it("writes a one-year, site-wide, SameSite=Lax cookie", () => {
    expect(preferenceCookie(THEME_COOKIE, "light")).toBe(
      "sidereus-theme=light; path=/; max-age=31536000; SameSite=Lax",
    );
    expect(preferenceCookie(LOCALE_COOKIE, "pl")).toBe("sidereus-lang=pl; path=/; max-age=31536000; SameSite=Lax");
  });
});
