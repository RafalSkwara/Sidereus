// The page's offline state (S-06, offline-night-plan, Phase 4). Browser code, started by the layout's script on every
// page:
// - `<html data-offline>` follows `navigator.onLine` and the `online`/`offline` events (real offline only);
// - a Tonight island's offline notice (`OfflineCopy.astro`) is revealed when the page came from the device
//   (`<html data-from-device>`, added by the service worker to every stored shell it serves, even after a network
//   timeout while `navigator.onLine` is still true) or the device is offline;
// - controls marked `data-needs-network` (Mark observed, the sky-check form, Log and Gear, sign-out) are disabled
//   while `data-offline` is set: `aria-disabled`, "Needs a connection" as their description, clicks and submits
//   swallowed. Their look is CSS keyed on the same attributes (global.css).
// Server islands arrive after load, so every DOM insertion re-applies the state (like `hash-scroll.ts`). It reads the
// copy's kind and validity only: never coordinates.
import type { CopyNotice } from "@/lib/offline/copies";

/** The layout's hidden "Needs a connection" text, the description of a control without its own caption. */
export const NEEDS_CONNECTION_ID = "offline-needs-connection";

const NEEDS_NETWORK = "[data-needs-network]";
// The interactive parts of a marked element: itself when it is a link or button, else the ones inside it (a form).
const CONTROLS = "a[href], button";

/**
 * Which notice a stored copy shows: `stale` once its night is over (its server-computed `validUntil`), `old-forecast`
 * for the next-night copy, else `prepared`. The same rule the worker uses to pick the copy (`chooseCopy`).
 */
export function noticeFor(kind: string | undefined, validUntil: string | undefined, now: number): CopyNotice {
  const until = validUntil ? Date.parse(validUntil) : Number.NaN;
  if (!Number.isFinite(until) || now >= until) return "stale";
  return kind === "next" ? "old-forecast" : "prepared";
}

/** Adds or removes one id in an `aria-describedby` token list, keeping the others. */
export function withDescription(current: string | null, id: string, on: boolean): string | null {
  const ids = (current ?? "").split(/\s+/).filter((token) => token !== "" && token !== id);
  if (on) ids.push(id);
  return ids.length > 0 ? ids.join(" ") : null;
}

function setAttr(element: Element, name: string, value: string | null) {
  if (element.getAttribute(name) === value) return;
  if (value === null) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, value);
  }
}

function controlsOf(marked: Element): Element[] {
  return marked.matches(CONTROLS) ? [marked] : [...marked.querySelectorAll(CONTROLS)];
}

function applyNotices(root: HTMLElement, offline: boolean) {
  const copy = document.querySelector<HTMLElement>("[data-offline-copy]");
  const notices = document.querySelectorAll<HTMLElement>("[data-offline-notice]");
  const show = copy && (offline || root.hasAttribute("data-from-device"));
  const wanted = show ? noticeFor(copy.dataset.kind, copy.dataset.validUntil, Date.now()) : null;
  for (const notice of notices) {
    const hidden = notice.dataset.offlineNotice !== wanted;
    if (notice.hidden !== hidden) notice.hidden = hidden;
  }
}

function applyControls(offline: boolean) {
  for (const marked of document.querySelectorAll<HTMLElement>(NEEDS_NETWORK)) {
    // A control with its own visible caption names it in the attribute; the others use the layout's hidden text.
    const own = marked.dataset.needsNetwork;
    const description = own !== undefined && own !== "" ? own : NEEDS_CONNECTION_ID;
    for (const control of controlsOf(marked)) {
      setAttr(control, "aria-disabled", offline ? "true" : null);
      setAttr(
        control,
        "aria-describedby",
        withDescription(control.getAttribute("aria-describedby"), description, offline),
      );
    }
  }
}

function apply() {
  const root = document.documentElement;
  const offline = !navigator.onLine;
  if (root.hasAttribute("data-offline") !== offline) root.toggleAttribute("data-offline", offline);
  applyNotices(root, offline);
  applyControls(offline);
}

/** Swallows a click or submit on a network-only control while offline; the control stays focusable. */
function swallow(event: Event) {
  if (!document.documentElement.hasAttribute("data-offline")) return;
  const target = event.target;
  if (!(target instanceof Element) || !target.closest(NEEDS_NETWORK)) return;
  event.preventDefault();
  event.stopPropagation();
}

export function startOfflinePageState(): void {
  apply();
  window.addEventListener("online", apply);
  window.addEventListener("offline", apply);
  // A page kept in the back/forward cache, or left open past its night, is re-checked when it shows again.
  window.addEventListener("pageshow", apply);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") apply();
  });
  document.addEventListener("click", swallow, true);
  document.addEventListener("submit", swallow, true);
  // Server islands (and their notices and Mark observed links) are inserted after load.
  new MutationObserver((records) => {
    if (records.some((record) => record.addedNodes.length > 0)) apply();
  }).observe(document.body, { childList: true, subtree: true });
}
