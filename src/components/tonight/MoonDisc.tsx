import { useMemo } from "react";
import { moonDiscPaths } from "@/lib/moon-disc/geometry";
import type { MoonDiscState } from "@/lib/moon-disc/state";
import { cn } from "@/lib/utils";

/*
 * One Moon state's disc, shared by the Moon card's time slider and the Moon summary band (tonight-nightfall). Static:
 * no client state of its own, so Astro can render it on the server without a client directive.
 *
 * Browser-safe on purpose, like the slider that hydrates it: it imports only React, `@/lib/moon-disc/*` and `cn`,
 * never astronomy-engine or the engine.
 */

interface MoonDiscProps {
  state: MoonDiscState;
  /** The lit part's clip-path id; unique on the page, and safe inside `url(#…)`. */
  clipId: string;
  /** The image's accessible name, "Moon at 23:40: Waxing gibbous, 63% lit". */
  label: string;
  /** The disc's size utilities; the Moon card's size by default. */
  className?: string;
}

/**
 * Back to front: the plain dark disc (no earthshine), the lit part, the maria clipped to the lit part, then the limb.
 * Lunar north up, IAU lunar east (Mare Crisium) right. The `moon-*` tokens draw it the same in the dark and light
 * themes (a bright lit part on a dark disc) and in red in red mode.
 */
export default function MoonDisc({ state, clipId, label, className = "size-24 sm:size-28" }: MoonDiscProps) {
  const { litPath, mariaPaths } = useMemo(() => moonDiscPaths(state), [state]);
  return (
    <svg
      viewBox="-1.04 -1.04 2.08 2.08"
      role="img"
      aria-label={label}
      className={cn("block shrink-0", className)}
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
