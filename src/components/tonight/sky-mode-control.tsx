import { FoldVertical, Maximize2, RectangleHorizontal, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, type ComponentProps } from "react";
import { SegmentedGroup } from "@/components/ui/segmented";
import { getMessages } from "@/i18n";
import { SKY_MODES, type Locale, type SkyMode, type Theme } from "@/lib/preferences";
import { cn } from "@/lib/utils";

/*
 * The live sky's mode control (ui-sky-modes, owner answer Q1 A): one 44 px icon button at the top right of the
 * verdict's column, in the same place in every mode, opening a small native popover with the three modes as a vertical
 * `SegmentedGroup`. The native popover opens before hydration, closes on Esc or an outside tap and returns focus to the
 * button; choosing a mode closes it and puts focus back on the button too. The panel carries the page's theme (it sits
 * inside the band's `night-sky` scope): rendered by the server, so a tap before hydration gets it too, and copied from
 * `<html>` as it opens, which follows a theme changed since (impl review F4). The panel is placed under the trigger as
 * it opens and closes when the page scrolls the trigger away, so it never hangs detached in the viewport.
 *
 * The trigger always shows `SkyViewIcon`, never the current mode's icon (ui-sky-mode-trigger, owner pick C): the mode
 * icons are the menu's options, and DEFAULT's rectangle on the trigger read as an image that failed to load. The
 * current mode stays in the accessible name and in `data-sky-mode-trigger`.
 *
 * Island-safe: React, lucide, `SegmentedGroup`, the catalogue, the preferences and `cn` (`island-imports.test.ts`).
 */

const MODE_ICONS: Record<SkyMode, LucideIcon> = {
  hidden: FoldVertical,
  default: RectangleHorizontal,
  expanded: Maximize2,
};

/**
 * "Change the sky view", lucide-style (stroke 2, round caps): option C's star over the hills on the horizon (owner, on
 * #222: exactly as drawn there), and the up / down cue for the band's height beside it. The grid is 34 x 24, drawn at
 * 28 x 20 px (`h-5 w-7`), so the cue gets its own room instead of squeezing the horizon. Read by shape alone, so red
 * mode needs no hue.
 */
export function SkyViewIcon({ className, ...props }: ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 34 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-7", className)}
      {...props}
    >
      <path d="M9 3.75l1.2 2.8L13 7.75 10.2 8.95 9 11.75 7.8 8.95 5 7.75l2.8-1.2z" />
      <path d="m4 20.25 5-5 3.5 3.5L15 16.25l2 2" />
      <path d="M4 20.25h13" />
      <path d="m23 9 3-3 3 3" />
      <path d="m23 15 3 3 3-3" />
    </svg>
  );
}

/** The trigger: a bare 44 px target like the pan chevrons, its face passed in so the contrast test covers it. */
export const SKY_MODE_TRIGGER_CLASS =
  "group pointer-events-auto flex size-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

/**
 * The menu: a bordered surface panel in the top layer, placed under the trigger with its right edge on the button's
 * as it opens (computed geometry, the trigger's own box).
 */
export const SKY_MODE_MENU_SURFACE_CLASS =
  "w-56 rounded-lg border border-border bg-surface p-2 text-foreground shadow-2xl";
const PANEL_CLASS = cn("fixed inset-auto m-0", SKY_MODE_MENU_SURFACE_CLASS);
/** The menu's heading. */
export const SKY_MODE_MENU_LABEL_CLASS = "text-label px-2 pt-1 pb-2 font-semibold text-muted-foreground";
/** The gap between the trigger and the menu, px. */
const PANEL_GAP_PX = 4;
/** How far the trigger may move under an open menu (a page scroll) before the menu closes, px. */
const DETACH_PX = 1;

interface SkyModeControlProps {
  mode: SkyMode;
  locale: Locale;
  /** The page's theme (`locals.theme`), rendered on the panel by the server. */
  theme: Theme;
  /** Applies a mode (the island remembers it and redraws). */
  onChoose: (mode: SkyMode) => void;
  /** The icon's face, the pan chevrons' (`PAN_FACE_CLASS`, pinned by the contrast test). */
  faceClassName: string;
  className?: string;
}

export function SkyModeControl({ mode, locale, theme, onChoose, faceClassName, className }: SkyModeControlProps) {
  const t = getMessages(locale).tonight.sky.mode;
  const id = useId();
  const panelId = `sky-mode-${id.replace(/:/g, "")}`;
  const labelId = `${panelId}-label`;
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // As it opens, the panel takes the page's current theme (not the navy sky's around it: ui-sky-light's rule for
  // popovers in the scope) and its place under the trigger. While it is open, a page scroll that moves the trigger
  // closes it (impl review F4): the panel is `fixed` from one measurement. Comparing the trigger's place with the one
  // measured at opening ignores a scroll event that a scroll-into-view queued just before the tap.
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    let openedAt: number | null = null;
    const detach = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (openedAt === null || !box || Math.abs(box.top - openedAt) <= DETACH_PX) return;
      element.hidePopover();
    };
    const prepare = (event: Event) => {
      if ((event as ToggleEvent).newState !== "open") {
        openedAt = null;
        window.removeEventListener("scroll", detach);
        return;
      }
      const applied = document.documentElement.dataset.theme;
      if (applied) element.dataset.theme = applied;
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      element.style.top = `${String(Math.round(box.bottom + PANEL_GAP_PX))}px`;
      element.style.right = `${String(Math.round(document.documentElement.clientWidth - box.right))}px`;
      openedAt = box.top;
      window.addEventListener("scroll", detach, { passive: true });
    };
    element.addEventListener("beforetoggle", prepare);
    return () => {
      element.removeEventListener("beforetoggle", prepare);
      window.removeEventListener("scroll", detach);
    };
  }, []);

  return (
    <div className={className}>
      <button
        ref={trigger}
        type="button"
        popoverTarget={panelId}
        aria-label={t.trigger({ mode: t.options[mode] })}
        aria-haspopup="dialog"
        className={SKY_MODE_TRIGGER_CLASS}
        data-sky-mode-trigger={mode}
      >
        <span className={faceClassName}>
          <SkyViewIcon aria-hidden="true" />
        </span>
      </button>
      <div
        ref={panel}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-labelledby={labelId}
        className={PANEL_CLASS}
        data-theme={theme}
        data-sky-mode-menu
      >
        <p id={labelId} className={SKY_MODE_MENU_LABEL_CLASS}>
          {t.label}
        </p>
        <SegmentedGroup
          orientation="vertical"
          labelledBy={labelId}
          value={mode}
          onChange={(next) => {
            panel.current?.hidePopover();
            trigger.current?.focus();
            onChoose(next);
          }}
          options={SKY_MODES.map((value) => {
            const OptionIcon = MODE_ICONS[value];
            return {
              value,
              label: t.options[value],
              icon: <OptionIcon className="size-4" />,
            };
          })}
          className="border-0 p-0"
        />
      </div>
    </div>
  );
}
