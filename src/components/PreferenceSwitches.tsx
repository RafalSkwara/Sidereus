import { useState } from "react";
import { getMessages } from "@/i18n";
import { LOCALE_COOKIE, THEME_COOKIE, preferenceCookie, type Locale, type Theme } from "@/lib/preferences";
import { cn } from "@/lib/utils";

interface PreferenceSwitchesProps {
  theme: Theme;
  locale: Locale;
}

const LOCALE_SEGMENTS: { value: Locale; text: string }[] = [
  { value: "en", text: "EN" },
  { value: "pl", text: "PL" },
];

/** Remembers the language and reloads: copy is rendered on the server, so a language change needs a fresh page. */
function reloadInLocale(next: Locale) {
  document.cookie = preferenceCookie(LOCALE_COOKIE, next);
  window.location.reload();
}

const groupClass = "flex gap-0.5 rounded-full border border-border p-0.5";
const segmentClass = cn(
  "inline-flex h-10 min-w-11 cursor-pointer items-center justify-center rounded-full px-2 text-[13px] font-semibold",
  "text-muted-foreground transition-colors hover:text-heading",
  "aria-pressed:bg-selected aria-pressed:text-selected-foreground",
  "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-progress",
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
  // Set once a language is picked: the reload can take a moment, so the tap is acknowledged at once.
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);

  function chooseTheme(next: Theme) {
    document.documentElement.dataset.theme = next;
    document.cookie = preferenceCookie(THEME_COOKIE, next);
    setTheme(next);
  }

  function chooseLocale(next: Locale) {
    if (next === locale || pendingLocale) return;
    setPendingLocale(next);
    reloadInLocale(next);
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
      <div role="group" aria-label={labels.language} aria-busy={pendingLocale !== null} className={groupClass}>
        {LOCALE_SEGMENTS.map(({ value, text }) => (
          <button
            key={value}
            type="button"
            lang={value}
            title={value === "en" ? labels.english : labels.polish}
            aria-pressed={locale === value}
            disabled={pendingLocale !== null}
            className={segmentClass}
            onClick={() => {
              chooseLocale(value);
            }}
          >
            {pendingLocale === value ? (
              <>
                <span
                  className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
                  aria-hidden="true"
                />
                <span className="sr-only">{text}</span>
              </>
            ) : (
              text
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
