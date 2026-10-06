// Registers the service worker (S-06, offline-night-plan): /sw.js, built by scripts/build-sw.mjs after `astro build`,
// scope /. Production builds only: `astro dev` serves no sw.js, and a worker caching dev modules would get in the way.

export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
  const register = () => {
    // A failed registration only means no offline copies on this visit; the page itself is unaffected.
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  };
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}
