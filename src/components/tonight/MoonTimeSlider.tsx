import { useId, useMemo, useState, type ReactNode } from "react";
import { getMessages } from "@/i18n";
import { moonDiscPaths } from "@/lib/moon-disc/geometry";
import { moonDiscLabel, moonPhaseLine } from "@/lib/moon-disc/label";
import { nearestStateIndex, type MoonDiscState } from "@/lib/moon-disc/state";
import { cn } from "@/lib/utils";

/*
 * The Moon card's phase line, disc and time slider (moonlight-and-the-verdict): the states the server sampled across
 * tonight's window, one every `MOON_DISC_STEP_MINUTES`, redrawn in the browser with `moonDiscPaths`. The slider's
 * arrow keys step one state (10 minutes); "Now" jumps to the state nearest the moment of the click (review F1), clamped
 * into the window, so it stays right on a tab left open. With a single state there is nothing to slide, so only the
 * phase line and the disc show.
 *
 * Browser-safe on purpose: it imports only `@/lib/moon-disc/*`, `@/i18n` and `cn`, never astronomy-engine or the
 * engine, and receives `locale` as a prop. The server renders the state at `initialIndex`.
 *
 * Accessibility (review F7): the range input's `aria-valuetext` is the time shown, which is what a screen reader
 * announces on each step; the disc is an image named for that moment ("Moon at 23:40: Waxing gibbous, 63% lit"),
 * read when reached, never announced on a change, so a step is announced once.
 */

type Locale = Parameters<typeof getMessages>[0];

interface MoonTimeSliderProps {
  /** The Moon across the window, oldest first; at least one. */
  states: MoonDiscState[];
  /** Each state's time, "23:40" in the site's time zone, pre-formatted on the server. */
  timeLabels: string[];
  /** The state nearest the page load, clamped into the window. */
  initialIndex: number;
  locale: Locale;
  /** The night's facts beside the disc (when the Moon is up, what it does to faint objects), server-rendered. */
  children?: ReactNode;
}

const nowButtonClass = cn(
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border px-4",
  "text-sm font-semibold text-primary-strong transition-colors hover:text-heading",
  "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
);

/*
 * A native range input restyled from tokens only, so red mode stays red: the browser's own track and thumb carry
 * system greys. 44 px tall for touch; the track is thin, the thumb a primary dot with a surface rim.
 */
const rangeClass = cn(
  "block h-11 w-full cursor-pointer appearance-none rounded-full bg-transparent",
  "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border",
  "[&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none",
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-primary",
  "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-border",
  "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2",
  "[&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-primary",
);

/**
 * One state's disc: back to front, the plain dark disc (no earthshine), the lit part, the maria clipped to the lit
 * part, then the limb. Lunar north up, IAU lunar east (Mare Crisium) right. The `moon-*` tokens draw it the same in
 * the dark and light themes (a bright lit part on a dark disc) and in red in red mode.
 */
function MoonDisc({ state, clipId, label }: { state: MoonDiscState; clipId: string; label: string }) {
  const { litPath, mariaPaths } = useMemo(() => moonDiscPaths(state), [state]);
  return (
    <svg
      viewBox="-1.04 -1.04 2.08 2.08"
      role="img"
      aria-label={label}
      className="block size-24 shrink-0 sm:size-28"
      data-moon-disc
    >
      {litPath && (
        <defs>
          <clipPath id={clipId}>
            <path d={litPath} />
          </clipPath>
        </defs>
      )}
      <circle r="1" className="fill-moon-dark" />
      {litPath && (
        <>
          <path d={litPath} className="fill-moon-lit" />
          <g className="fill-moon-mare opacity-50" clipPath={`url(#${clipId})`}>
            {mariaPaths.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
        </>
      )}
      <circle r="1" className="stroke-moon-limb fill-none" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function MoonTimeSlider({ states, timeLabels, initialIndex, locale, children }: MoonTimeSliderProps) {
  const m = getMessages(locale).tonight.moon;
  const last = states.length - 1;
  const start = Math.min(Math.max(initialIndex, 0), last);
  const [index, setIndex] = useState(start);
  // The same on the server and in the browser, and unique within the Tonight island's render, so the clip path never
  // collides with another disc's (review F8). `@astrojs/react` numbers React roots per render, so the page shell's
  // islands can share the prefix; the `moon-lit-` prefix keeps these ids apart from theirs. Reduced to characters that
  // are safe in `url(#…)`.
  const clipId = `moon-lit-${useId().replace(/[^\w-]/g, "")}`;

  const state = states.at(index);
  if (state === undefined) {
    // No states: MoonCard renders the phase text instead and never mounts the island, but stay safe if it did.
    return null;
  }
  const time = timeLabels.at(index) ?? "";

  return (
    <div>
      <p className="font-display text-heading mt-1 text-2xl font-semibold" data-moon-phase>
        {moonPhaseLine(m, state)}
      </p>

      <div className="mt-4 flex items-center gap-4 sm:gap-5">
        <MoonDisc state={state} clipId={clipId} label={moonDiscLabel(m, state, time)} />
        {children && <div className="min-w-0 space-y-2 text-sm">{children}</div>}
      </div>

      {last > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-heading font-mono text-lg" data-moon-time>
              {time}
            </span>
            <button
              type="button"
              className={nowButtonClass}
              onClick={() => {
                setIndex(nearestStateIndex(states, Date.now()));
              }}
            >
              {m.card.now}
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={index}
            onChange={(event) => {
              setIndex(Number(event.currentTarget.value));
            }}
            aria-label={m.card.slider}
            aria-valuetext={time}
            className={cn("mt-1", rangeClass)}
          />
          <div className="text-muted-foreground flex justify-between font-mono text-xs" aria-hidden="true">
            <span>{timeLabels[0]}</span>
            <span>{timeLabels[last]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
