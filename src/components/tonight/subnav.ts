// The Tonight sub-nav's scroll rules (ui-tonight-nav), pure so they are unit-tested here and `TonightSubNav.astro`'s
// script only measures and applies them. The row scrolls sideways on a phone (seven chips never fit), so the current
// chip is brought into view by setting the row's `scrollLeft`, never with `scrollIntoView`, which can also scroll the
// page vertically (the hash-scroll on Targets and Planets owns that).

/** Edges closer than this to the end of the scroll range count as reached (fractional layout widths). */
const EDGE_TOLERANCE_PX = 1;

/**
 * The row's `scrollLeft` that centres the chip, clamped to the row's scroll range. `chip.left` is the chip's position
 * in the row's scrolled content (`chipRect.left - rowRect.left + row.scrollLeft`), never a bare `offsetLeft`, which
 * counts from the nearest positioned ancestor and would shift the centring by the container's padding.
 */
export function scrollLeftFor(
  chip: { left: number; width: number },
  row: { width: number; scrollWidth: number },
): number {
  const max = Math.max(0, row.scrollWidth - row.width);
  const centred = chip.left + chip.width / 2 - row.width / 2;
  return Math.round(Math.min(max, Math.max(0, centred)));
}

/** Which edges have chips beyond them: the row fades those (`data-more-start` / `data-more-end`). */
export function edges(scrollLeft: number, width: number, scrollWidth: number): { start: boolean; end: boolean } {
  return {
    start: scrollLeft > EDGE_TOLERANCE_PX,
    end: scrollLeft + width < scrollWidth - EDGE_TOLERANCE_PX,
  };
}
