/**
 * Scrolling a focused Tonight page to its target once the server island renders it (tonight-dashboard,
 * interactive-sky). The list streams in after the browser has already tried the URL's fragment, so the page script
 * looks for its target again on every DOM change until it is shown. Used by the Targets page (fragments such as
 * `#washed-out`, `#more` and the live sky's `#object-<id>`, plus the return from "Mark observed") and the Planets page
 * (the live sky's `#planet-<key>`).
 *
 * Browser-only (`location`, `document`); safe because it looks ids up with `getElementById`, never as a selector.
 */

export interface ScrollTarget {
  target: Element;
  block: ScrollLogicalPosition;
}

/** The element the URL's fragment names, `null` for none or a malformed one (`#%E0`); a closed <details> opens. */
export function fragmentTarget(): Element | null {
  if (!location.hash) return null;
  let id: string;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return null;
  }
  const target = id ? document.getElementById(id) : null;
  if (target instanceof HTMLDetailsElement) target.open = true;
  return target;
}

const USER_INPUT = ["wheel", "touchmove", "keydown"] as const;

/**
 * Scrolls to what `find` returns, now or as soon as it appears. It stops once the target is shown, once the visitor
 * scrolls or types (never moving the page under them), or after 10 s if the target never arrives (an empty night, or
 * a stale link).
 */
export function scrollToWhenRendered(find: () => ScrollTarget | null): void {
  const scrollToTarget = () => {
    const found = find();
    found?.target.scrollIntoView({ block: found.block });
    return found !== null;
  };
  if (scrollToTarget()) return;
  const observer = new MutationObserver(() => {
    if (scrollToTarget()) stop();
  });
  const timer = window.setTimeout(stop, 10_000);
  function stop() {
    observer.disconnect();
    window.clearTimeout(timer);
    for (const type of USER_INPUT) window.removeEventListener(type, stop);
  }
  observer.observe(document.body, { childList: true, subtree: true });
  for (const type of USER_INPUT) window.addEventListener(type, stop, { passive: true });
}
