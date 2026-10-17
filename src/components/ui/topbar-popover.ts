import { cn } from "@/lib/utils";
import { SEGMENT_FOCUS_CLASS } from "@/components/ui/segmented";

/*
 * The Topbar's icon buttons and their panels (ui-quick-nav, charge C2): the settings panel (`TopbarControls`) and the
 * quick nav (`QuickNav.astro`) share these, so two buttons side by side open panels that look, sit and close alike. A
 * new Topbar control uses `TOPBAR_ICON_BUTTON_CLASS`, a new Topbar panel `TOPBAR_PANEL_CLASS`. Island-safe (`cn` and
 * `SEGMENT_FOCUS_CLASS` only).
 */

/**
 * A 44 px round icon button. Pressed (`aria-pressed`) or open (`aria-expanded="true"`, a disclosure's panel showing)
 * fills it, as the sub-nav's current chip is filled, so red mode tells it by its fill, not by hue.
 */
export const TOPBAR_ICON_BUTTON_CLASS = cn(
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border",
  "text-muted-foreground transition-colors hover:text-heading",
  "aria-pressed:border-selected aria-pressed:bg-selected aria-pressed:text-selected-foreground",
  "aria-expanded:border-selected aria-expanded:bg-selected aria-expanded:text-selected-foreground",
  SEGMENT_FOCUS_CLASS,
);

/**
 * A native popover (`popover="auto"` + `popovertarget`): it opens before hydration, closes on Esc or an outside tap and
 * returns focus to its button. A bottom sheet on phones, a panel under the bar from `sm` (`topbar-panel-top`, under the
 * Topbar strip, its right edge on the bar's, `right-topbar-edge`). Open, it is a column capped by `topbar-panel-max-h`:
 * the handle zone stays put and the body (`TOPBAR_PANEL_BODY_CLASS`) scrolls. `open:flex` only: a plain `flex` would
 * beat the closed popover's `display: none`.
 */
export const TOPBAR_PANEL_CLASS = cn(
  "fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none rounded-t-2xl border-0 border-t border-border bg-surface text-foreground",
  "topbar-panel-max-h overflow-hidden p-5 shadow-2xl backdrop:bg-background/70 open:flex open:flex-col",
  "sm:inset-x-auto sm:topbar-panel-top sm:right-topbar-edge sm:bottom-auto sm:w-80",
  "sm:rounded-2xl sm:border sm:p-4 sm:backdrop:bg-transparent",
);

/**
 * The sheet's handle zone (`data-sheet-handle`): the grab bar and, in the quick nav, the panel's heading. It does not
 * scroll. Below `sm` it takes no browser touch gesture (`touch-none`), so a drag on it is the sheet's swipe.
 */
export const TOPBAR_SHEET_HANDLE_CLASS = "shrink-0 max-sm:touch-none";

/** The grab bar itself: phones only, 16 px above the panel's content. */
export const TOPBAR_SHEET_GRIP_CLASS = "mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden";

/**
 * The panel's scrolling body (`data-sheet-body`). A scroll box clips its children's focus outlines (2 px offset +
 * 2 px), so it reaches 6 px into the panel's padding on every side and pads them back. Its content clears the home
 * indicator on a phone with `pb-safe-area sm:pb-0`.
 */
export const TOPBAR_PANEL_BODY_CLASS = "-m-1.5 min-h-0 overflow-y-auto overscroll-contain p-1.5";
