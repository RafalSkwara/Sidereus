import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * The Nightfall band for React islands (ui-onboarding): the twin of `Band.astro`, for an island whose content spans
 * several bands inside one form (onboarding's Where / Sky / Kit), where the Astro component cannot render. Same markup
 * and classes as `Band.astro`; change both together. A full-width, unboxed section with a rule between it and the band
 * before it, a `text-title` heading that labels it, and an optional quiet `action` beside the heading.
 */
interface BandProps {
  /** The heading's id, which labels the section. */
  headingId: string;
  heading: string;
  /** An anchor id on the section itself. */
  id?: string;
  className?: string;
  /** Keep the heading for screen readers only: the page's own title already says it. */
  headingHidden?: boolean;
  action?: ReactNode;
  children?: ReactNode;
}

export function Band({ headingId, heading, id, className, headingHidden = false, action, children }: BandProps) {
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("border-border py-8 not-first:border-t first:pt-0 last:pb-0", className)}
    >
      {headingHidden ? (
        <h2 id={headingId} className="sr-only">
          {heading}
        </h2>
      ) : (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id={headingId} className="font-display text-title text-heading font-semibold break-words">
            {heading}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
