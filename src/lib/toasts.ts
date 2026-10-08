// Toasts (ui-user-adjustments, Phase 2). Browser code, started by `ToastRegion.astro` on every page.
// A `Notice` rendered with `toast` carries `data-toast` and is already `position: fixed` (`toast-region`), so a
// server-rendered one never paints inline. This script adopts it into the one fixed container (stacking only),
// starts its 10 s timer, removes the notice's URL param with `history.replaceState`, and closes it on its ×. Notices
// that arrive after load (a Tonight server island's) are adopted when they are inserted.
// A dismissible notice (`dismissible`, no `data-toast`) closes on its × too: its dismiss scope, the nearest
// `[data-dismiss-scope]` or the notice itself, is hidden and marked `data-dismissed`, so a script that re-shows it
// (`page-state.ts` and the offline notices) can honour the choice.
// Closing something that holds the keyboard focus first moves focus to `<main>` (WCAG 2.4.3), so it never falls back to
// `<body>` and sends the next Tab to the top of the page.
// The URL param names come from the fixed set below and are never values: no coordinates, nothing from the user.

/** How long a toast stays when nobody is hovering or focusing it. */
export const TOAST_MS = 10_000;

/** The query params a toast may clear: the ones the save redirects add (`gear`, `log`, `log/sky`, Tonight). */
export const TOAST_PARAMS = ["saved", "updated", "deleted", "logged", "skyChecked"] as const;
export type ToastParam = (typeof TOAST_PARAMS)[number];

/** The same location without the named query params, as `path?query#hash`: every other param and the hash stay. */
export function withoutParams(href: string, names: readonly string[]): string {
  const url = new URL(href, "http://localhost");
  for (const name of names) url.searchParams.delete(name);
  return `${url.pathname}${url.search}${url.hash}`;
}

const REGION = "[data-toast-region]";
const PENDING = "[data-toast]:not([data-toast-adopted])";
// The exit transition's longest wait: a fallback for a toast whose transition never ends (a hidden tab).
const EXIT_FALLBACK_MS = 400;

const stops = new WeakMap<HTMLElement, () => void>();

function clearParams(toast: HTMLElement) {
  const names = (toast.dataset.toastParam ?? "").split(/[\s,]+/).filter((name) => name !== "");
  if (names.length === 0) return;
  const current = `${location.pathname}${location.search}${location.hash}`;
  const next = withoutParams(current, names);
  if (next !== current) history.replaceState(history.state, "", next);
}

/** If `scope` holds the focus, moves it to `<main>` (made programmatically focusable, with no ring) before it goes. */
function releaseFocus(scope: HTMLElement) {
  if (!scope.contains(document.activeElement)) return;
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return;
  if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  main.classList.add("outline-none");
  main.focus({ preventScroll: true });
}

function close(toast: HTMLElement) {
  if (toast.hasAttribute("data-closing")) return;
  releaseFocus(toast);
  stops.get(toast)?.();
  toast.setAttribute("data-closing", "");
  const remove = () => toast.remove();
  // No transition (reduced motion) or an unrendered toast: gone at once.
  const duration = Number.parseFloat(getComputedStyle(toast).transitionDuration);
  if (!(duration > 0)) {
    remove();
    return;
  }
  toast.addEventListener("transitionend", remove, { once: true });
  setTimeout(remove, EXIT_FALLBACK_MS);
}

// The timer runs while nobody hovers or focuses the toast, so a keyboard user can reach the ×; it resumes with what
// was left.
function watch(toast: HTMLElement) {
  let remaining = TOAST_MS;
  let startedAt = 0;
  let timer: number | undefined;
  let hovered = false;
  let focused = false;

  const pause = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    remaining = Math.max(0, remaining - (Date.now() - startedAt));
  };
  const resume = () => {
    if (timer !== undefined) return;
    startedAt = Date.now();
    timer = window.setTimeout(() => {
      close(toast);
    }, remaining);
  };
  const update = () => {
    if (hovered || focused) {
      pause();
    } else {
      resume();
    }
  };

  toast.addEventListener("pointerenter", () => {
    hovered = true;
    update();
  });
  toast.addEventListener("pointerleave", () => {
    hovered = false;
    update();
  });
  toast.addEventListener("focusin", () => {
    focused = true;
    update();
  });
  toast.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && toast.contains(event.relatedTarget)) return;
    focused = false;
    update();
  });
  toast.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close(toast);
  });
  stops.set(toast, pause);
  resume();
}

function adopt(toast: HTMLElement) {
  const region = document.querySelector<HTMLElement>(REGION);
  if (!region) return;
  toast.setAttribute("data-toast-adopted", "");
  // Inside the region the toast is a flex item; its own fixed placement (the same as the region's) ends here.
  toast.classList.remove("toast-region");
  region.appendChild(toast);
  clearParams(toast);
  watch(toast);
}

function adoptAll() {
  for (const toast of document.querySelectorAll<HTMLElement>(PENDING)) adopt(toast);
}

function onClose(event: Event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest("[data-notice-close]");
  const notice = button?.closest<HTMLElement>("[data-notice]");
  if (!notice || notice.hasAttribute("data-specimen")) return;
  if (notice.hasAttribute("data-toast")) {
    close(notice);
    return;
  }
  const scope = notice.closest<HTMLElement>("[data-dismiss-scope]") ?? notice;
  releaseFocus(scope);
  scope.setAttribute("data-dismissed", "");
  scope.hidden = true;
}

export function startToasts(): void {
  adoptAll();
  document.addEventListener("click", onClose);
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement && (node.matches(PENDING) || node.querySelector(PENDING))) {
          adoptAll();
          return;
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
