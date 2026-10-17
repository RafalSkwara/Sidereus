import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { AccountPlan } from "@/lib/account-plan";
import { getMessages } from "@/i18n";
import { installState, promptInstall, subscribeInstallState } from "@/lib/offline/install";
import {
  LOCALE_COOKIE,
  THEME_COOKIE,
  isTheme,
  nextTheme,
  preferenceCookie,
  type Locale,
  type Theme,
} from "@/lib/preferences";
import { Paintbrush } from "lucide-react";
import { attachSheetSwipe } from "@/lib/ui/sheet-swipe";
import { cn } from "@/lib/utils";
import { SEGMENT_FOCUS_CLASS, SegmentedGroup } from "@/components/ui/segmented";
import {
  TOPBAR_ICON_BUTTON_CLASS,
  TOPBAR_PANEL_BODY_CLASS,
  TOPBAR_PANEL_CLASS,
  TOPBAR_SHEET_GRIP_CLASS,
  TOPBAR_SHEET_HANDLE_CLASS,
} from "@/components/ui/topbar-popover";

interface TopbarControlsProps {
  theme: Theme;
  locale: Locale;
  /** The signed-in user's email, or `null` when signed out (no account section, no sign-out). */
  email: string | null;
  /** The signed-in account's plan (F-01): a full account's email is golden; `null` when signed out. */
  accountPlan?: AccountPlan | null;
}

const SETTINGS_ID = "settings-panel";
const SIGN_OUT_CAPTION_ID = "settings-signout-offline";

// Focus is a `--ring` outline offset from the control, so it shows on a pressed (filled) control too.
const focusRing = SEGMENT_FOCUS_CLASS;
const sectionLabel = "text-label font-semibold text-muted-foreground";
/** A quiet text button in the panel: Install app, Sign out. */
const textAction = cn(
  "text-muted-foreground hover:text-heading inline-flex min-h-11 cursor-pointer items-center rounded-md text-sm transition-colors",
  focusRing,
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

/** The page's applied theme changes only through this island, which keeps its own state for that. */
function subscribeNever(): () => void {
  return () => undefined;
}

/** Remembers the language and reloads: copy is rendered on the server, so a language change needs a fresh page. */
function reloadInLocale(next: Locale) {
  document.cookie = preferenceCookie(LOCALE_COOKIE, next);
  window.location.reload();
}

/**
 * The stateful end of the top bar: the theme button (cycles dark → light → red; a paintbrush in every theme, owner
 * 2026-10-17, since a moon beside the quick nav read as "tonight"; its label names the current and next theme) and the
 * settings popover (who is signed in, theme, language, install, sign out). One island, so the button and the settings theme
 * control never disagree. The server already rendered
 * the resolved theme on <html data-theme>; this island mirrors choices into the attribute and the cookies.
 */
export default function TopbarControls({
  theme: initialTheme,
  locale,
  email,
  accountPlan = null,
}: TopbarControlsProps) {
  const m = getMessages(locale);
  const p = m.preferences;
  // S-06: a page served from the device was rendered with the theme of its day; the layout's head script has already
  // applied the current cookie to <html data-theme>, so after hydration the controls start from that, not the prop.
  const appliedTheme = useSyncExternalStore(
    subscribeNever,
    () => {
      const applied = document.documentElement.dataset.theme;
      return isTheme(applied) ? applied : initialTheme;
    },
    () => initialTheme,
  );
  const [chosenTheme, setTheme] = useState<Theme | null>(null);
  const theme = chosenTheme ?? appliedTheme;
  // Set once a language is picked: the reload can take a moment, so the tap is acknowledged at once.
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);
  // S-06: "Install app" shows only where it can do something; the server renders it hidden ("none").
  const install = useSyncExternalStore(subscribeInstallState, installState, () => "none" as const);
  const [iosHintOpen, setIosHintOpen] = useState(false);
  // A swipe down closes the phone sheet (ui-quick-nav D12), with the quick nav's shared helper.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => (panelRef.current ? attachSheetSwipe(panelRef.current) : undefined), []);

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
        className={cn(TOPBAR_ICON_BUTTON_CLASS, !email && "max-sm:hidden")}
        onClick={() => {
          chooseTheme(nextTheme(theme));
        }}
      >
        <Paintbrush className="size-4.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        popoverTarget={SETTINGS_ID}
        aria-label={m.nav.settings}
        aria-haspopup="dialog"
        className={TOPBAR_ICON_BUTTON_CLASS}
      >
        <SlidersIcon />
      </button>

      {/*
       * The panel carries the page theme itself (ui-sky-light): on Tonight the Topbar sits in the `night-sky` scope, and
       * the settings sheet should still look like the rest of the page, not like the navy sky behind it.
       */}
      <div
        ref={panelRef}
        id={SETTINGS_ID}
        popover="auto"
        role="dialog"
        aria-label={m.nav.settings}
        data-theme={theme}
        className={TOPBAR_PANEL_CLASS}
      >
        <div className={TOPBAR_SHEET_HANDLE_CLASS} data-sheet-handle>
          <div className={TOPBAR_SHEET_GRIP_CLASS} aria-hidden="true" />
        </div>
        <div className={TOPBAR_PANEL_BODY_CLASS} data-sheet-body>
          {/* The phone sheet clears the home indicator (`pb-safe-area`, global.css). */}
          <div className="pb-safe-area grid gap-4 sm:pb-0">
            {email && (
              <div className="border-border grid gap-0.5 border-b pb-3">
                <p className="text-faint text-xs">{m.nav.signedInAs}</p>
                {/* A full-plan account's email is golden: the only sign of the plan for now (F-01 addendum). */}
                <p
                  className={cn("truncate text-sm", accountPlan === "full" ? "text-plan-full" : "text-heading")}
                  data-account-plan={accountPlan ?? undefined}
                >
                  {email}
                </p>
              </div>
            )}

            <div className="grid gap-1.5">
              <p id="settings-theme-label" className={sectionLabel}>
                {p.theme}
              </p>
              <SegmentedGroup
                labelledBy="settings-theme-label"
                value={theme}
                onChange={chooseTheme}
                options={themeSegments.map(({ value, label, short, icon }) => ({
                  value,
                  label: short,
                  ariaLabel: label,
                  icon,
                }))}
              />
            </div>

            <div className="grid gap-1.5">
              <p id="settings-language-label" className={sectionLabel}>
                {p.language}
              </p>
              {/*
               * While the page reloads in the chosen language, that segment is busy (a spinner, `aria-busy`) and the
               * other one is disabled; a hidden status says "Changing language…" (owner's answer to impl review F2).
               */}
              <SegmentedGroup
                labelledBy="settings-language-label"
                busyStatus={p.changingLanguage}
                value={locale}
                onChange={chooseLocale}
                options={localeSegments.map(({ value, text }) => ({
                  value,
                  lang: value,
                  label: text,
                  busy: pendingLocale === value,
                  disabled: pendingLocale !== null && pendingLocale !== value,
                }))}
              />
            </div>

            {(install === "prompt" || install === "ios") && (
              <div className="border-border grid gap-1 border-t pt-3">
                <button
                  type="button"
                  className={textAction}
                  aria-expanded={install === "ios" ? iosHintOpen : undefined}
                  aria-controls={install === "ios" ? "settings-install-hint" : undefined}
                  onClick={() => {
                    if (install === "prompt") {
                      void promptInstall();
                    } else {
                      setIosHintOpen((open) => !open);
                    }
                  }}
                >
                  {m.offline.install.action}
                </button>
                {install === "ios" && (
                  <p id="settings-install-hint" hidden={!iosHintOpen} className="text-foreground text-sm">
                    {m.offline.install.iosHint}
                  </p>
                )}
              </div>
            )}

            {email && (
              <form method="POST" action="/api/auth/signout" className="border-border border-t pt-3">
                {/* Signing out needs the network (S-06): disabled offline, with the caption under it (page-state.ts). */}
                <button type="submit" className={textAction} data-needs-network={SIGN_OUT_CAPTION_ID}>
                  {m.nav.signOut}
                </button>
                <p id={SIGN_OUT_CAPTION_ID} className="text-muted-foreground offline:block hidden text-sm">
                  {m.offline.needsConnection}
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
