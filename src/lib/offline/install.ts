// Installing Sidereus to the home screen (S-06, offline-night-plan). Browser code: the settings popover's "Install app"
// entry reads `installState()`. Chromium fires `beforeinstallprompt` once, early, so this module captures it as soon as
// it is imported (the layout's script imports it on every page) and keeps it for a later tap; iOS has no prompt API, so
// there the entry explains Share → Add to Home Screen instead.

/** Chromium's install prompt event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** `prompt`: the browser's own install dialog is ready; `ios`: explain the Share sheet; `none`: hide the entry. */
export type InstallState = "installed" | "prompt" | "ios" | "none";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Keeps Chromium's own mini-infobar away; the settings entry offers the same prompt on request.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * An iOS browser that can add to the home screen: iPhone, iPod or iPad (iPadOS reports itself as a Mac with touch),
 * with a `Safari/` token, which Safari, Chrome and Firefox on iOS carry and in-app webviews (Instagram, Gmail) don't.
 */
function isIosBrowser(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && ua.includes("Safari/");
}

export function installState(): InstallState {
  if (typeof window === "undefined") return "none";
  if (installed || isStandalone()) return "installed";
  if (deferredPrompt) return "prompt";
  return isIosBrowser() ? "ios" : "none";
}

/** For `useSyncExternalStore`: called whenever the prompt arrives or the app gets installed. */
export function subscribeInstallState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Opens the browser's install dialog; the event can be used once, so it is dropped (and the entry hidden) at once. */
export async function promptInstall(): Promise<void> {
  const event = deferredPrompt;
  if (!event) return;
  deferredPrompt = null;
  notify();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") {
      installed = true;
      notify();
    }
  } catch {
    // A prompt the browser refuses (already shown, or gone) only means no install this time.
  }
}
