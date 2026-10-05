import { useState, type ReactNode } from "react";
import { getMessages } from "@/i18n";
import { LOCALE_COOKIE, THEME_COOKIE, nextTheme, preferenceCookie, type Locale, type Theme } from "@/lib/preferences";
import { cn } from "@/lib/utils";

interface TopbarControlsProps {
  theme: Theme;
  locale: Locale;
  /** The signed-in user's email, or `null` when signed out (no account section, no sign-out). */
  email: string | null;
}

const SETTINGS_ID = "settings-panel";

// Focus is a `--ring` outline offset from the control, so it shows on a pressed (filled) control too.
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const iconButton = cn(
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border",
  "text-muted-foreground transition-colors hover:text-heading",
  "aria-pressed:border-selected aria-pressed:bg-selected aria-pressed:text-selected-foreground",
  focusRing,
);
const groupClass = "grid auto-cols-fr grid-flow-col gap-0.5 rounded-full border border-border p-0.5";
const segmentClass = cn(
  "inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold",
  "text-muted-foreground transition-colors hover:text-heading",
  "aria-pressed:bg-selected aria-pressed:text-selected-foreground",
  focusRing,
  "disabled:cursor-progress",
);
const sectionLabel = "text-label font-semibold text-muted-foreground";

/*
 * Native popover (`popover` + `popovertarget`): it opens before hydration, closes on Esc or an outside tap and
 * returns focus to the settings button. A bottom sheet on phones, a panel under the bar from `sm`.
 */
const panelClass = cn(
  "fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-2xl border-0 border-t border-border bg-surface text-foreground",
  "p-5 shadow-2xl backdrop:bg-background/70",
  // Under the Topbar from `sm`, its right edge aligned with the bar's (`right-topbar-edge`, global.css).
  "sm:inset-x-auto sm:top-23 sm:right-topbar-edge sm:bottom-auto sm:w-80",
  "sm:rounded-2xl sm:border sm:p-4 sm:backdrop:bg-transparent",
);

function Icon({ children }: { children: ReactNode }) {
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
      className="shrink-0"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const MoonIcon = () => (
  <Icon>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </Icon>
);
const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);
/** An eye: red night mode protects the observer's dark-adapted eyes. */
const RedEyeIcon = () => (
  <Icon>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const SlidersIcon = () => (
  <Icon>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Icon>
);

/** Remembers the language and reloads: copy is rendered on the server, so a language change needs a fresh page. */
function reloadInLocale(next: Locale) {
  document.cookie = preferenceCookie(LOCALE_COOKIE, next);
  window.location.reload();
}

/**
 * The stateful end of the top bar: the theme button (cycles dark → light → red, shows the current theme) and the
 * settings popover (who is signed in, theme, language, sign out). One island, so the button and the settings theme
 * control never disagree. The server already rendered
 * the resolved theme on <html data-theme>; this island mirrors choices into the attribute and the cookies.
 */
export default function TopbarControls({ theme: initialTheme, locale, email }: TopbarControlsProps) {
  const m = getMessages(locale);
  const p = m.preferences;
  const [theme, setTheme] = useState<Theme>(initialTheme);
  // Set once a language is picked: the reload can take a moment, so the tap is acknowledged at once.
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);

  function chooseTheme(next: Theme) {
    if (next === theme) return;
    document.documentElement.dataset.theme = next;
    document.cookie = preferenceCookie(THEME_COOKIE, next);
    setTheme(next);
  }

  function chooseLocale(next: Locale) {
    if (next === locale || pendingLocale) return;
    setPendingLocale(next);
    reloadInLocale(next);
  }

  const themeSegments: { value: Theme; label: string; short: string; icon: ReactNode }[] = [
    { value: "dark", label: p.dark, short: p.darkShort, icon: <MoonIcon /> },
    { value: "light", label: p.light, short: p.lightShort, icon: <SunIcon /> },
    { value: "red", label: p.red, short: p.redShort, icon: <RedEyeIcon /> },
  ];
  const current = themeSegments.find((segment) => segment.value === theme) ?? themeSegments[0];
  const upcoming = themeSegments.find((segment) => segment.value === nextTheme(theme)) ?? themeSegments[0];
  const localeSegments: { value: Locale; text: string }[] = [
    { value: "en", text: p.english },
    { value: "pl", text: p.polish },
  ];

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={p.cycle({ current: current.short, next: upcoming.short })}
        title={p.cycle({ current: current.short, next: upcoming.short })}
        // Signed out, the Topbar also carries the sign-in link, and in Polish the row overflows a 320 px phone; the
        // theme stays one tap away in the settings panel there. Signed in, the button stays (red mode at the eyepiece).
        className={cn(iconButton, !email && "max-sm:hidden")}
        onClick={() => {
          chooseTheme(nextTheme(theme));
        }}
      >
        {current.icon}
      </button>
      <button
        type="button"
        popoverTarget={SETTINGS_ID}
        aria-label={m.nav.settings}
        aria-haspopup="dialog"
        className={iconButton}
      >
        <SlidersIcon />
      </button>

      {/*
       * The panel carries the page theme itself (ui-sky-light): on Tonight the Topbar sits in the `night-sky` scope, and
       * the settings sheet should still look like the rest of the page, not like the navy sky behind it.
       */}
      <div
        id={SETTINGS_ID}
        popover="auto"
        role="dialog"
        aria-label={m.nav.settings}
        data-theme={theme}
        className={panelClass}
      >
        <div className="bg-border mx-auto mb-4 h-1 w-10 rounded-full sm:hidden" aria-hidden="true" />
        {/* The phone sheet clears the home indicator (`pb-safe-area`, global.css). */}
        <div className="pb-safe-area grid gap-4 sm:pb-0">
          {email && (
            <div className="border-border grid gap-0.5 border-b pb-3">
              <p className="text-faint text-xs">{m.nav.signedInAs}</p>
              <p className="text-heading truncate text-sm">{email}</p>
            </div>
          )}

          <div className="grid gap-1.5">
            <p id="settings-theme-label" className={sectionLabel}>
              {p.theme}
            </p>
            <div role="group" aria-labelledby="settings-theme-label" className={groupClass}>
              {themeSegments.map(({ value, label, short, icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-label={label}
                  aria-pressed={theme === value}
                  className={segmentClass}
                  onClick={() => {
                    chooseTheme(value);
                  }}
                >
                  {icon}
                  <span aria-hidden="true">{short}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <p id="settings-language-label" className={sectionLabel}>
              {p.language}
            </p>
            <div
              role="group"
              aria-labelledby="settings-language-label"
              aria-busy={pendingLocale !== null}
              className={groupClass}
            >
              {localeSegments.map(({ value, text }) => (
                <button
                  key={value}
                  type="button"
                  lang={value}
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

          {email && (
            <form method="POST" action="/api/auth/signout" className="border-border border-t pt-3">
              <button
                type="submit"
                className={cn(
                  "text-muted-foreground hover:text-heading inline-flex min-h-11 cursor-pointer items-center rounded-md text-sm transition-colors",
                  focusRing,
                )}
              >
                {m.nav.signOut}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
