import { Hourglass, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * The one segmented control (ui-sky-modes, charge C3): a `role="group"` of 44 px `aria-pressed` buttons, so the
 * settings panel's theme and language and the live sky's mode menu share their hover, pressed, focus and red-mode
 * states. Island-safe (React, lucide and `cn`). Horizontal: equal-width pills in a rounded track (the settings panel).
 * Vertical: full-width rows, icon then label (the sky-view menu).
 *
 * Loading (the owner's answer to impl review F2, 2026-10-17): while a choice is applied (the language reload), the
 * chosen option is `busy`: `aria-busy="true"`, heading ink and a spinner before its label (shape and motion carry it,
 * not hue, so red mode reads it; with reduced motion a static hourglass instead). The group's `busyStatus` is said once
 * by a visually hidden `role="status"` beside the group. The other options are `disabled`: a pressed one keeps its fill
 * (it is still the current choice), an unpressed one fades to `text-faint`, which reads as disabled on purpose.
 */

/** Focus is a `--ring` outline offset from the control, so it shows on a pressed (filled) segment too. */
export const SEGMENT_FOCUS_CLASS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const GROUP_CLASS = {
  horizontal: "grid auto-cols-fr grid-flow-col gap-0.5 rounded-full border border-border p-0.5",
  vertical: "grid gap-0.5 rounded-2xl border border-border p-0.5",
} as const;

const SEGMENT_CLASS = cn(
  "inline-flex h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold",
  "text-muted-foreground transition-colors hover:text-heading",
  "aria-pressed:bg-selected aria-pressed:text-selected-foreground",
  SEGMENT_FOCUS_CLASS,
  // A disabled option fades; a pressed one keeps its fill (the current language while another one loads).
  "disabled:cursor-not-allowed disabled:not-aria-pressed:text-faint disabled:not-aria-pressed:hover:text-faint",
  // The option being applied: heading ink beside its spinner, never faded.
  "aria-busy:cursor-progress aria-busy:text-heading",
);

/** The busy option's indicator: a spinner, or a static hourglass when the reader asks for reduced motion. */
function BusyIndicator() {
  return (
    <>
      <LoaderCircle className="size-4 motion-safe:animate-spin motion-reduce:hidden" />
      <Hourglass className="size-4 motion-safe:hidden" />
    </>
  );
}

const SEGMENT_SHAPE_CLASS = {
  horizontal: "justify-center rounded-full px-2",
  vertical: "w-full justify-start rounded-xl px-3",
} as const;

export interface SegmentedOption<T extends string> {
  value: T;
  /** The visible text. */
  label: ReactNode;
  /** The accessible name when the visible text is abbreviated (the theme's short labels); the text is then hidden from it. */
  ariaLabel?: string;
  /** A decorative icon before the label (`aria-hidden`). */
  icon?: ReactNode;
  /** The option's own language (the language switch names each language in itself). */
  lang?: string;
  disabled?: boolean;
  /** The choice being applied: `aria-busy`, a spinner before the label, and a tap does nothing. */
  busy?: boolean;
}

interface SegmentedGroupProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The id of the visible label naming the group; or `label` for an unlabelled group. */
  labelledBy?: string;
  label?: string;
  orientation?: "horizontal" | "vertical";
  /**
   * What the visually hidden status says while an option is `busy` ("Changing language…"). The live region is
   * rendered (empty) whenever this is set, so the text is announced when it appears.
   */
  busyStatus?: string;
  className?: string;
  /** A class for every segment, for the `/design` hover and focus specimens. */
  segmentClassName?: string;
}

export function SegmentedGroup<T extends string>({
  options,
  value,
  onChange,
  labelledBy,
  label,
  orientation = "horizontal",
  busyStatus,
  className,
  segmentClassName,
}: SegmentedGroupProps<T>) {
  const busy = options.some((option) => option.busy);
  return (
    <>
      <div
        role="group"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        className={cn(GROUP_CLASS[orientation], className)}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            lang={option.lang}
            aria-label={option.ariaLabel}
            aria-pressed={option.value === value}
            // The busy option stays enabled, so focus stays on it while the status is announced; its tap is ignored.
            aria-busy={option.busy ? true : undefined}
            disabled={option.disabled}
            data-segment={option.value}
            className={cn(SEGMENT_CLASS, SEGMENT_SHAPE_CLASS[orientation], segmentClassName)}
            onClick={() => {
              if (!option.busy) onChange(option.value);
            }}
          >
            {option.busy ? (
              <span aria-hidden="true" className="inline-flex shrink-0">
                <BusyIndicator />
              </span>
            ) : (
              option.icon && (
                <span aria-hidden="true" className="inline-flex shrink-0">
                  {option.icon}
                </span>
              )
            )}
            {option.ariaLabel ? <span aria-hidden="true">{option.label}</span> : option.label}
          </button>
        ))}
      </div>
      {/* Beside the group, never inside a busy element, which a screen reader may hold back until it is done. */}
      {busyStatus !== undefined && (
        <span role="status" className="sr-only" data-segmented-status>
          {busy ? busyStatus : ""}
        </span>
      )}
    </>
  );
}
