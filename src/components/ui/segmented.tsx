import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * The one segmented control (ui-sky-modes, charge C3): a `role="group"` of 44 px `aria-pressed` buttons, so the
 * settings panel's theme and language and the live sky's mode menu share their hover, pressed, focus and red-mode
 * states. Island-safe (React and `cn` only). Horizontal: equal-width pills in a rounded track (the settings panel).
 * Vertical: full-width rows, icon then label (the sky-view menu).
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
  // A disabled option (the other language while one loads) fades; the pressed one keeps its fill.
  "disabled:cursor-progress disabled:not-aria-pressed:text-faint disabled:not-aria-pressed:hover:text-faint",
);

const SEGMENT_SHAPE_CLASS = {
  horizontal: "justify-center rounded-full px-2",
  vertical: "w-full justify-start rounded-xl px-3",
} as const;

export interface SegmentedOption<T extends string> {
  value: T;
  /** The visible text (or content, such as a busy spinner). */
  label: ReactNode;
  /** The accessible name when the visible text is abbreviated (the theme's short labels); the text is then hidden from it. */
  ariaLabel?: string;
  /** A decorative icon before the label (`aria-hidden`). */
  icon?: ReactNode;
  /** The option's own language (the language switch names each language in itself). */
  lang?: string;
  disabled?: boolean;
}

interface SegmentedGroupProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** The id of the visible label naming the group; or `label` for an unlabelled group. */
  labelledBy?: string;
  label?: string;
  orientation?: "horizontal" | "vertical";
  /** While a choice is being applied (the language reload). */
  busy?: boolean;
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
  busy,
  className,
  segmentClassName,
}: SegmentedGroupProps<T>) {
  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      aria-busy={busy}
      className={cn(GROUP_CLASS[orientation], className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.lang}
          aria-label={option.ariaLabel}
          aria-pressed={option.value === value}
          disabled={option.disabled}
          data-segment={option.value}
          className={cn(SEGMENT_CLASS, SEGMENT_SHAPE_CLASS[orientation], segmentClassName)}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.icon && (
            <span aria-hidden="true" className="inline-flex shrink-0">
              {option.icon}
            </span>
          )}
          {option.ariaLabel ? <span aria-hidden="true">{option.label}</span> : option.label}
        </button>
      ))}
    </div>
  );
}
