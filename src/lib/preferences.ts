// Theme and language preferences, remembered on the device in cookies (PRD FR-025, FR-026).
// Pure and island-safe: no astro:* or server-only imports, so the middleware and the
// PreferenceSwitches island share the same names and rules.

export const THEMES = ["dark", "light"] as const;
export type Theme = (typeof THEMES)[number];

export const LOCALES = ["en", "pl"] as const;
export type Locale = (typeof LOCALES)[number];

export const THEME_COOKIE = "sidereus-theme";
export const LOCALE_COOKIE = "sidereus-lang";

/** One year, in seconds. */
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const DEFAULT_THEME: Theme = "dark";
export const DEFAULT_LOCALE: Locale = "en";

export function isTheme(value: unknown): value is Theme {
  return (THEMES as readonly unknown[]).includes(value);
}

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly unknown[]).includes(value);
}

/** Dark is the default (PRD NFR); light is opt-in and never follows the OS setting. */
export function resolveTheme(cookie?: string): Theme {
  return isTheme(cookie) ? cookie : DEFAULT_THEME;
}

/**
 * A valid cookie wins. Otherwise the highest-q `Accept-Language` range whose primary subtag is a
 * supported locale (ties keep header order). Otherwise English.
 */
export function resolveLocale(cookie?: string, acceptLanguage?: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const ranges = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [range = "", ...params] = part.split(";").map((s) => s.trim());
      let q = 1;
      for (const param of params) {
        const [key, value = ""] = param.split("=").map((s) => s.trim());
        if (key.toLowerCase() === "q") q = Number(value);
      }
      return { primary: range.split("-")[0]?.toLowerCase() ?? "", q, index };
    })
    .filter((r) => r.primary !== "" && Number.isFinite(r.q) && r.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { primary } of ranges) {
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

/** `document.cookie` assignment string for a preference cookie. */
export function preferenceCookie(name: typeof THEME_COOKIE | typeof LOCALE_COOKIE, value: string): string {
  return `${name}=${encodeURIComponent(value)}; path=/; max-age=${PREFERENCE_COOKIE_MAX_AGE}; SameSite=Lax`;
}
