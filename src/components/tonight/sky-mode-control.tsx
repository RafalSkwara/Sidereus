import { FoldVertical, Maximize2, RectangleHorizontal, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { SegmentedGroup } from "@/components/ui/segmented";
import { getMessages } from "@/i18n";
import { SKY_MODES, type Locale, type SkyMode } from "@/lib/preferences";

/*
 * The live sky's mode control (ui-sky-modes, owner answer Q1 A): one 44 px icon button at the top right of the
 * verdict's column, in the same place in every mode, opening a small native popover with the three modes as a vertical
 * `SegmentedGroup`. The native popover opens before hydration, closes on Esc or an outside tap and returns focus to the
 * button; choosing a mode closes it and puts focus back on the button too. The panel carries the page's theme (it sits
 * inside the band's `night-sky` scope), copied from `<html>` as it opens.
 *
 * Island-safe: React, lucide, `SegmentedGroup`, the catalogue, the preferences and `cn` (`island-imports.test.ts`).
 */

const MODE_ICONS: Record<SkyMode, LucideIcon> = {
  hidden: FoldVertical,
  default: RectangleHorizontal,
  expanded: Maximize2,
};

/** The trigger: a bare 44 px target like the pan chevrons, its face passed in so the contrast test covers it. */
const TRIGGER_CLASS =
  "group pointer-events-auto flex size-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

/**
 * The menu: a bordered surface panel in the top layer, placed under the trigger with its right edge on the button's
 * as it opens (computed geometry, the trigger's own box).
 */
const PANEL_CLASS =
  "fixed inset-auto m-0 w-56 rounded-lg border border-border bg-surface p-2 text-foreground shadow-2xl";
/** The gap between the trigger and the menu, px. */
const PANEL_GAP_PX = 4;

interface SkyModeControlProps {
  mode: SkyMode;
  locale: Locale;
  /** Applies a mode (the island remembers it and redraws). */
  onChoose: (mode: SkyMode) => void;
  /** The icon's face, the pan chevrons' (`PAN_FACE_CLASS`, pinned by the contrast test). */
  faceClassName: string;
  className?: string;
}

export function SkyModeControl({ mode, locale, onChoose, faceClassName, className }: SkyModeControlProps) {
  const t = getMessages(locale).tonight.sky.mode;
  const id = useId();
  const panelId = `sky-mode-${id.replace(/:/g, "")}`;
  const labelId = `${panelId}-label`;
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const Icon = MODE_ICONS[mode];

  // As it opens, the panel takes the page's theme (not the navy sky's around it: ui-sky-light's rule for popovers in the
  // scope) and its place under the trigger.
  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const prepare = (event: Event) => {
      if ((event as ToggleEvent).newState !== "open") return;
      const theme = document.documentElement.dataset.theme;
      if (theme) element.dataset.theme = theme;
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      element.style.top = `${String(Math.round(box.bottom + PANEL_GAP_PX))}px`;
      element.style.right = `${String(Math.round(document.documentElement.clientWidth - box.right))}px`;
    };
    element.addEventListener("beforetoggle", prepare);
    return () => {
      element.removeEventListener("beforetoggle", prepare);
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
        className={TRIGGER_CLASS}
        data-sky-mode-trigger={mode}
      >
        <span className={faceClassName}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </button>
      <div
        ref={panel}
        id={panelId}
        popover="auto"
        role="dialog"
        aria-labelledby={labelId}
        className={PANEL_CLASS}
        data-sky-mode-menu
      >
        <p id={labelId} className="text-label text-muted-foreground px-2 pt-1 pb-2 font-semibold">
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
