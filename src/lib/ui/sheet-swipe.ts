/*
 * Swipe down to close a bottom sheet (ui-quick-nav, owner P6 2026-10-17, plan D12). Browser code, shared by the app's
 * two bottom sheets: the settings panel (`TopbarControls`) and the quick nav (`QuickNav.astro`), both native
 * `popover="auto"` panels built from `ui/topbar-popover.ts`. A new bottom sheet attaches it too.
 *
 * - Only while the panel is open and is a sheet (below `sm`; from `sm` it hangs under the bar and never drags).
 * - Where a drag starts: the handle zone (`[data-sheet-handle]`: the grab bar, and the quick nav's heading; it takes no
 *   browser touch gesture), or, for touch, the body (`[data-sheet-body]`) while it is scrolled to its top and the finger
 *   moves down. A finger moving up in the body is the list's scroll, never the sheet's.
 * - The sheet follows the finger (`translate`, never above its resting place), closes past `CLOSE_SHARE` of its height
 *   or on a downward flick, else snaps back. With reduced motion it never moves: a release past the threshold just
 *   closes it. The animations are `[data-sheet-drag]` rules in `global.css`.
 * - Touch through touch events (a non-passive `touchmove`, which iOS Safari needs to keep the page from scrolling);
 *   mouse and pen through pointer events on the handle zone. A click that ends a drag is swallowed, so a swipe that
 *   started on a row never follows its link.
 * - Esc and the outside tap stay the popover's own light dismiss. `hidePopover()` returns focus to the button.
 */

/** Share of the sheet's height past which a release closes it. */
const CLOSE_SHARE = 0.3;
/** A release at least this fast (px/ms, downward) after `FLICK_MIN_PX` closes it whatever the distance. */
const FLICK_PX_PER_MS = 0.5;
const FLICK_MIN_PX = 24;
/** Movement before a touch counts as a drag (a tap stays a tap). */
const SLOP_PX = 8;
/** The window the release velocity is measured over. */
const VELOCITY_WINDOW_MS = 100;
/** The settle animation's length in `global.css`, plus a margin, in case `transitionend` never fires. */
const SETTLE_FALLBACK_MS = 260;
const SHEET_QUERY = "(width < 40rem)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

interface Sample {
  y: number;
  t: number;
}

/** Whether a release `distance` px down, at `velocity` px/ms, closes a sheet `height` px tall. */
export function releaseCloses(distance: number, velocity: number, height: number): boolean {
  return distance >= height * CLOSE_SHARE || (distance >= FLICK_MIN_PX && velocity >= FLICK_PX_PER_MS);
}

/** The downward speed over the last `VELOCITY_WINDOW_MS` of `samples` (px/ms), 0 without two samples apart in time. */
function releaseVelocity(samples: readonly Sample[]): number {
  const last = samples[samples.length - 1];
  const first = samples.find((sample) => last.t - sample.t <= VELOCITY_WINDOW_MS) ?? last;
  const elapsed = last.t - first.t;
  return elapsed > 0 ? (last.y - first.y) / elapsed : 0;
}

/** Attaches the swipe to `panel` (a sheet with `[data-sheet-handle]` and `[data-sheet-body]`); returns the detach. */
export function attachSheetSwipe(panel: HTMLElement): () => void {
  const handle = panel.querySelector<HTMLElement>("[data-sheet-handle]");
  const body = panel.querySelector<HTMLElement>("[data-sheet-body]");
  const reducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches;

  let gesture: { startY: number; fromHandle: boolean; dragging: boolean; height: number; samples: Sample[] } | null =
    null;
  let swallowClick = false;
  let settleTimer: number | undefined;

  const reset = () => {
    window.clearTimeout(settleTimer);
    panel.style.removeProperty("translate");
    delete panel.dataset.sheetDrag;
  };

  /** Runs `done` once the settle transition ends (or its fallback timer fires). */
  const settle = (to: string, done: () => void) => {
    panel.dataset.sheetDrag = "settling";
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      panel.removeEventListener("transitionend", onEnd);
      done();
    };
    // The panel's own `translate`, not a row's colour transition bubbling up.
    const onEnd = (event: TransitionEvent) => {
      if (event.target === panel && event.propertyName === "translate") finish();
    };
    panel.addEventListener("transitionend", onEnd);
    settleTimer = window.setTimeout(finish, SETTLE_FALLBACK_MS);
    panel.style.translate = to;
  };

  const close = () => {
    if (reducedMotion()) {
      panel.hidePopover();
      reset();
      return;
    }
    settle("0 100%", () => {
      panel.hidePopover();
      reset();
    });
  };

  const snapBack = () => {
    if (reducedMotion() || !panel.style.translate) {
      reset();
      return;
    }
    settle("0 0", reset);
  };

  const canStart = () => panel.matches(":popover-open") && window.matchMedia(SHEET_QUERY).matches;

  const start = (y: number, t: number, fromHandle: boolean) => {
    reset();
    gesture = {
      startY: y,
      fromHandle,
      dragging: false,
      height: panel.getBoundingClientRect().height,
      samples: [{ y, t }],
    };
  };

  /** Follows a move; `true` when the gesture is the sheet's (the caller then cancels the browser's own). */
  const move = (y: number, t: number): boolean => {
    if (!gesture) return false;
    const dy = y - gesture.startY;
    if (!gesture.dragging) {
      // A finger moving up in the list is its scroll: let it go.
      if (dy < 0 && !gesture.fromHandle) {
        gesture = null;
        return false;
      }
      if (dy > SLOP_PX) {
        gesture.dragging = true;
        panel.dataset.sheetDrag = "dragging";
      }
    }
    gesture.samples.push({ y, t });
    if (gesture.samples.length > 32) gesture.samples.shift();
    if (gesture.dragging && !reducedMotion()) panel.style.translate = `0 ${String(Math.max(0, dy))}px`;
    return dy >= 0;
  };

  const end = () => {
    if (!gesture) return;
    const { dragging, samples, startY, height } = gesture;
    gesture = null;
    if (!dragging) return;
    swallowClick = true;
    const distance = samples[samples.length - 1].y - startY;
    if (releaseCloses(distance, releaseVelocity(samples), height)) close();
    else snapBack();
  };

  const cancel = () => {
    if (gesture?.dragging) snapBack();
    gesture = null;
  };

  // Touch: anywhere on the sheet, from the handle or from the body at its top.
  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1 || !canStart() || !(event.target instanceof Node)) {
      gesture = null;
      return;
    }
    const fromHandle = handle?.contains(event.target) ?? false;
    const atTop = body !== null && body.contains(event.target) && body.scrollTop <= 0;
    if (!fromHandle && !atTop) return;
    start(event.touches[0].clientY, event.timeStamp, fromHandle);
  };
  const onTouchMove = (event: TouchEvent) => {
    if (!gesture || event.touches.length !== 1) return;
    if (move(event.touches[0].clientY, event.timeStamp) && event.cancelable) event.preventDefault();
  };

  // Mouse and pen: the handle zone only (a touch pointer is the touch path's).
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "touch" || event.button !== 0 || !canStart()) return;
    handle?.setPointerCapture(event.pointerId);
    start(event.clientY, event.timeStamp, true);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === "touch" || !gesture) return;
    if (move(event.clientY, event.timeStamp)) event.preventDefault();
  };
  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== "touch") end();
  };
  const onPointerCancel = (event: PointerEvent) => {
    if (event.pointerType !== "touch") cancel();
  };

  // A new press starts clean: a drag that ended without a click must not swallow the next tap.
  const onAnyPointerDown = () => {
    swallowClick = false;
  };
  // The click that ends a drag (a row's link under the finger) is not a tap.
  const onClick = (event: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };
  const onToggle = (event: Event) => {
    if ((event as ToggleEvent).newState !== "closed") return;
    gesture = null;
    swallowClick = false;
    reset();
  };

  panel.addEventListener("touchstart", onTouchStart, { passive: true });
  panel.addEventListener("touchmove", onTouchMove, { passive: false });
  panel.addEventListener("touchend", end);
  panel.addEventListener("touchcancel", cancel);
  handle?.addEventListener("pointerdown", onPointerDown);
  handle?.addEventListener("pointermove", onPointerMove);
  handle?.addEventListener("pointerup", onPointerUp);
  handle?.addEventListener("pointercancel", onPointerCancel);
  panel.addEventListener("pointerdown", onAnyPointerDown, { capture: true });
  panel.addEventListener("click", onClick, { capture: true });
  panel.addEventListener("toggle", onToggle);

  return () => {
    panel.removeEventListener("touchstart", onTouchStart);
    panel.removeEventListener("touchmove", onTouchMove);
    panel.removeEventListener("touchend", end);
    panel.removeEventListener("touchcancel", cancel);
    handle?.removeEventListener("pointerdown", onPointerDown);
    handle?.removeEventListener("pointermove", onPointerMove);
    handle?.removeEventListener("pointerup", onPointerUp);
    handle?.removeEventListener("pointercancel", onPointerCancel);
    panel.removeEventListener("pointerdown", onAnyPointerDown, { capture: true });
    panel.removeEventListener("click", onClick, { capture: true });
    panel.removeEventListener("toggle", onToggle);
    reset();
  };
}
