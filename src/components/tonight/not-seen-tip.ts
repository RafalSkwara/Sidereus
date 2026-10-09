/**
 * The "not seen yet" tooltip's browser logic (observing-progress). The markup is `NotSeenMark` (the button, inside a
 * card's heading) and `NotSeenTip` (the tooltip, outside it); the button's `aria-describedby` names the tooltip.
 *
 * One state, `data-open` on the tooltip: a click on the button toggles it, Esc and a pointer press outside close it.
 * Hover and keyboard focus open it through CSS alone, under `@media (hover: hover)` (`global.css`), so a tap never
 * leaves a stuck `:hover`; Esc also dismisses that (`data-dismissed`, cleared when the pointer or focus leaves the
 * button). The listeners are delegated on the document, so markup a server island inserts later needs no wiring, and
 * calling this more than once (or from two inlined copies) adds them once. It holds no `console`: client `<script>` blocks are not linted, modules
 * like this one are.
 */

const BUTTON = "[data-not-seen-button]";
const TOOLTIP = "[data-not-seen-tooltip]";

function buttonIn(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest(BUTTON) : null;
}

/** The tooltip a button describes, found by the id in its `aria-describedby`. */
function tooltipOf(button: Element): HTMLElement | null {
  const id = button.getAttribute("aria-describedby");
  return id ? document.getElementById(id) : null;
}

function isShown(tooltip: HTMLElement): boolean {
  return getComputedStyle(tooltip).display !== "none";
}

export function initNotSeenTip(): void {
  // The guard is the DOM marker, not a module flag: the build inlines this script into every page that uses it, so
  // two copies are two module instances that would each add the listeners. The marker is also what e2e waits for: a
  // tap before the listeners exist would do nothing.
  if (document.documentElement.dataset.notSeenTip === "ready") return;
  document.documentElement.dataset.notSeenTip = "ready";

  document.addEventListener("click", (event) => {
    const button = buttonIn(event.target);
    const tooltip = button ? tooltipOf(button) : null;
    if (!tooltip) return;
    tooltip.removeAttribute("data-dismissed");
    tooltip.toggleAttribute("data-open");
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const own = buttonIn(target);
    for (const tooltip of document.querySelectorAll<HTMLElement>(TOOLTIP)) {
      tooltip.removeAttribute("data-dismissed");
      if (!tooltip.hasAttribute("data-open")) continue;
      const inside = tooltip.contains(target) || (own !== null && tooltipOf(own) === tooltip);
      if (!inside) tooltip.removeAttribute("data-open");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const tooltip of document.querySelectorAll<HTMLElement>(TOOLTIP)) {
      if (!isShown(tooltip)) continue;
      tooltip.removeAttribute("data-open");
      tooltip.setAttribute("data-dismissed", "");
    }
  });

  // A dismissed tooltip may open again once both the pointer and the focus have left its button. Leaving by one
  // alone is not enough: after Esc the still-focused button matches `:focus-visible` (a key was pressed), so
  // clearing the dismissal when only the pointer leaves would bring the tooltip straight back.
  const forget = (event: Event) => {
    const button = buttonIn(event.target);
    const tooltip = button ? tooltipOf(button) : null;
    if (!button || !tooltip) return;
    const next = event instanceof MouseEvent || event instanceof FocusEvent ? event.relatedTarget : null;
    if (next instanceof Node && button.contains(next)) return;
    const stillFocused = event.type === "mouseout" && document.activeElement === button;
    const stillHovered = event.type === "focusout" && button.matches(":hover");
    if (stillFocused || stillHovered) return;
    tooltip.removeAttribute("data-dismissed");
  };
  document.addEventListener("mouseout", forget);
  document.addEventListener("focusout", forget);

  // A tooltip opened by Enter or Space must not outlive the focus: when focus moves from its button to any other
  // element (Tab), it closes, unless it moves onto the tooltip itself. A focusout with no related target is a press
  // on a non-focusable spot (the tooltip's own text, or the page): `pointerdown` above decides those.
  document.addEventListener("focusout", (event) => {
    const button = buttonIn(event.target);
    const tooltip = button ? tooltipOf(button) : null;
    const next = event.relatedTarget;
    if (!button || !tooltip || !(next instanceof Node)) return;
    if (button.contains(next) || tooltip.contains(next)) return;
    tooltip.removeAttribute("data-open");
  });
}
