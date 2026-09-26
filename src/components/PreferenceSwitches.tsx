import { useState } from "react";
import { getMessages } from "@/i18n";
import { LOCALE_COOKIE, THEME_COOKIE, preferenceCookie, type Locale, type Theme } from "@/lib/preferences";
import { cn } from "@/lib/utils";

interface PreferenceSwitchesProps {
  theme: Theme;
  locale: Locale;
}

const groupClass = "flex gap-0.5 rounded-full border border-border p-0.5";
const segmentClass = cn(
  "inline-flex h-10 min-w-11 cursor-pointer items-center justify-center rounded-full px-2 text-[13px] font-semibold",
  "text-muted-foreground transition-colors hover:text-heading",
  "aria-pressed:bg-selected aria-pressed:text-selected-foreground",
  "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
);

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/**
 * Theme (moon/sun) and language (EN/PL) segmented controls. The server already rendered the
 * resolved theme on <html data-theme>; this island only mirrors a choice into the attribute and cookie.
 */
export default function PreferenceSwitches({ theme: initialTheme, locale }: PreferenceSwitchesProps) {
  const labels = getMessages(locale).preferences;
  const [theme, setTheme] = useState<Theme>(initialTheme);

  function chooseTheme(next: Theme) {
    document.documentElement.dataset.theme = next;
    document.cookie = preferenceCookie(THEME_COOKIE, next);
    setTheme(next);
  }

  function chooseLocale(next: Locale) {
    if (next === locale) return;
    document.cookie = preferenceCookie(LOCALE_COOKIE, next);
    // Copy is rendered on the server, so a language change needs a fresh page.
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-2">
      <div role="group" aria-label={labels.theme} className={groupClass}>
        <button
          type="button"
          aria-label={labels.dark}
          aria-pressed={theme === "dark"}
          className={segmentClass}
          onClick={() => {
            chooseTheme("dark");
          }}
        >
          <MoonIcon />
        </button>
        <button
          type="button"
          aria-label={labels.light}
          aria-pressed={theme === "light"}
          className={segmentClass}
          onClick={() => {
            chooseTheme("light");
          }}
        >
          <SunIcon />
        </button>
      </div>
      <div role="group" aria-label={labels.language} className={groupClass}>
        <button
          type="button"
          lang="en"
          title={labels.english}
          aria-pressed={locale === "en"}
          className={segmentClass}
          onClick={() => {
            chooseLocale("en");
          }}
        >
          EN
        </button>
        <button
          type="button"
          lang="pl"
          title={labels.polish}
          aria-pressed={locale === "pl"}
          className={segmentClass}
          onClick={() => {
            chooseLocale("pl");
          }}
        >
          PL
        </button>
      </div>
    </div>
  );
}
