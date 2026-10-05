import { cn } from "@/lib/utils";

/*
 * The time sliders' native range input (MoonTimeSlider, TonightSkyView), restyled from tokens only, so red mode stays
 * red: the browser's own track and thumb carry system greys. 44 px tall for touch; the track is thin, the thumb a
 * primary dot with a surface rim. The thumb's -mt-1.75 centres the 20 px thumb on the 6 px WebKit track
 * ((6 - 20) / 2 = -7 px); Firefox centres it itself.
 *
 * `track`: `border` draws the track in the border colour (the Moon slider); `transparent` leaves it to an overlay
 * behind the input (the live sky, whose overlay also marks the dark window).
 *
 * Island-safe: imports only `cn`.
 */

const TRACK_CLASSES = {
  border: ["[&::-webkit-slider-runnable-track]:bg-border", "[&::-moz-range-track]:bg-border"],
  transparent: ["[&::-webkit-slider-runnable-track]:bg-transparent", "[&::-moz-range-track]:bg-transparent"],
} as const;

export function rangeClasses(track: keyof typeof TRACK_CLASSES): string {
  return cn(
    "block h-11 w-full cursor-pointer appearance-none rounded-full bg-transparent",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full",
    "[&::-webkit-slider-thumb]:-mt-1.75 [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none",
    "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-primary",
    "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full",
    "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2",
    "[&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-primary",
    ...TRACK_CLASSES[track],
  );
}
