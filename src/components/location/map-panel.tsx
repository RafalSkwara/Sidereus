import { useEffect, useEffectEvent, useRef, useState } from "react";
import L from "leaflet";
import leafletCssUrl from "leaflet/dist/leaflet.css?url";
import { getMessages } from "@/i18n";
import { POINT_ZOOM, pickFromMap, type MapPoint, type MapView } from "@/lib/location/map-view";
import type { Locale } from "@/lib/preferences";

/*
 * The map of "Pick from map" (S-09). The only module that imports Leaflet: `LocationPicker` loads it with
 * `import("./map-panel")` on the button's click, which is the user's consent, so no map code, CSS or tile is
 * requested before it. Leaflet touches `window` when imported, which this lazy chunk also keeps out of SSR.
 *
 * Leaflet's stylesheet comes by URL and is injected on first use, never as a plain CSS import: the build emits
 * one site-wide CSS file, and a plain import could be merged into it (and precached). `scripts/build-sw.mjs`
 * fails the build if leaflet.css's own rules reach a shared stylesheet. The theme overrides live in global.css.
 *
 * Privacy (PRD NFR): every pick goes through `pickFromMap`, which rounds to about 1 km before `onPick`, and the
 * pin moves to the rounded point. Tiles come straight from OpenStreetMap (cross-origin, so the service worker
 * never stores them). Nothing here logs.
 */

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";

/** The pin: an inline SVG in `currentColor`, coloured by `.map-pin` in global.css (Leaflet's PNG icons are unused). */
const PIN_ICON = L.divIcon({
  className: "map-pin",
  html: '<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M12 1.5c-4.1 0-7.5 3.3-7.5 7.4 0 5.6 7.5 13.6 7.5 13.6s7.5-8 7.5-13.6c0-4.1-3.4-7.4-7.5-7.4Zm0 10.1a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z"/></svg>',
  iconSize: [32, 32],
  iconAnchor: [16, 30],
});

let leafletCss: Promise<void> | undefined;
const LEAFLET_CSS_FAILED = "leaflet.css failed to load";

/** Adds Leaflet's stylesheet to the page once and resolves when it has loaded; a failed load is retried next time. */
function loadLeafletCss(): Promise<void> {
  leafletCss ??= new Promise<void>((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = leafletCssUrl;
    link.dataset.leafletCss = "";
    link.addEventListener("load", () => {
      resolve();
    });
    link.addEventListener("error", () => {
      link.remove();
      reject(new Error(LEAFLET_CSS_FAILED));
    });
    document.head.appendChild(link);
  });
  leafletCss.catch(() => {
    leafletCss = undefined;
  });
  return leafletCss;
}

interface Props {
  locale: Locale;
  /** Where the map opens, fixed when the panel opens (`initialMapView`). */
  view: MapView;
  /** The host's coordinates while the panel is open: typing new ones moves the pin, without recentring. */
  current: MapPoint | null;
  /** An already granted device position that arrived after opening: recentre there unless a pin is placed. */
  recentreTo: MapPoint | null;
  onPick: (point: MapPoint) => void;
  /** Leaflet's stylesheet could not be loaded, so there is no usable map. */
  onFailed: () => void;
  /** The map is built and can take picks. */
  onReady: () => void;
  /** Drops the pin at the map's centre whenever the number changes: the keyboard way to pick. */
  pinAtCentreSignal: number;
}

export default function MapPanel({
  locale,
  view,
  current,
  recentreTo,
  onPick,
  onFailed,
  onReady,
  pinAtCentreSignal,
}: Props) {
  const t = getMessages(locale).location;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // Set once the user drags, zooms or pans with the keys: a late device position then no longer moves the map.
  const userMovedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);

  // The host passes a new function every render; the map's listeners are bound once.
  const place = useEffectEvent((latitudeDeg: number, longitudeDeg: number) => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const point = pickFromMap(latitudeDeg, longitudeDeg);
    marker.setLatLng([point.latitudeDeg, point.longitudeDeg]);
    if (!map.hasLayer(marker)) marker.addTo(map);
    onPick(point);
  });
  const fail = useEffectEvent(() => {
    onFailed();
  });
  const announceReady = useEffectEvent(() => {
    onReady();
  });

  // One map per open panel: `view` is fixed at open, so this runs once and `map.remove()` cleans up.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    loadLeafletCss()
      .then(() => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        // No box zoom: its shift-drag box is drawn in Leaflet's blue and white, and a pin picker doesn't need it.
        const map = L.map(container, { keyboard: true, zoomControl: false, attributionControl: true, boxZoom: false });
        // Set at once, so the cleanup removes a map even if building the rest of it throws.
        mapRef.current = map;
        // Leaflet's own zoom titles are English; these are the catalogue's (they are also the buttons' aria-labels).
        L.control.zoom({ zoomInTitle: t.zoomIn, zoomOutTitle: t.zoomOut }).addTo(map);
        map.setView([view.latitudeDeg, view.longitudeDeg], view.zoom);
        map.attributionControl.setPrefix(false);
        L.tileLayer(TILE_URL, {
          maxZoom: 19,
          attribution: `<a href="${COPYRIGHT_URL}" target="_blank" rel="noopener noreferrer">${t.mapAttribution}</a>`,
        })
          .once("tileerror", () => {
            setTilesFailed(true);
          })
          .addTo(map);
        const marker = L.marker([view.latitudeDeg, view.longitudeDeg], {
          icon: PIN_ICON,
          draggable: true,
          keyboard: false,
        });
        if (view.pinned) marker.addTo(map);
        // Registered after the first setView, so only the user's (or a recentre's) moves count.
        map.once("dragstart zoomstart keydown", () => {
          userMovedRef.current = true;
        });
        map.on("click", (event: L.LeafletMouseEvent) => {
          place(event.latlng.lat, event.latlng.lng);
        });
        marker.on("dragend", () => {
          const at = marker.getLatLng();
          place(at.lat, at.lng);
        });
        observer = new ResizeObserver(() => {
          map.invalidateSize();
        });
        observer.observe(container);
        markerRef.current = marker;
        setReady(true);
        announceReady();
        // Leaflet made the container focusable (tabindex 0): land there, where the arrow keys pan.
        container.focus();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // The stylesheet failed or building the map threw: the picker shows "could not be loaded", and the cause
        // still reaches the browser's error reporting (no console here, see the no-console lint).
        fail();
        if (!(error instanceof Error && error.message === LEAFLET_CSS_FAILED)) reportError(error);
      });
    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // `view` and the strings are fixed for the panel's life; the map must not be rebuilt on a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coordinates typed into the host form move the pin, without moving the map; cleared ones remove it.
  const latitudeDeg = current?.latitudeDeg;
  const longitudeDeg = current?.longitudeDeg;
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!ready || !map || !marker) return;
    if (latitudeDeg === undefined || longitudeDeg === undefined) {
      marker.remove();
      return;
    }
    marker.setLatLng([latitudeDeg, longitudeDeg]);
    if (!map.hasLayer(marker)) marker.addTo(map);
  }, [ready, latitudeDeg, longitudeDeg]);

  // A device position that arrives late recentres the neutral view, unless the user already placed a pin or moved.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!ready || !map || !marker || !recentreTo || map.hasLayer(marker) || userMovedRef.current) return;
    map.setView([recentreTo.latitudeDeg, recentreTo.longitudeDeg], POINT_ZOOM);
  }, [ready, recentreTo]);

  const lastPinAtCentre = useRef(pinAtCentreSignal);
  useEffect(() => {
    if (lastPinAtCentre.current === pinAtCentreSignal) return;
    lastPinAtCentre.current = pinAtCentreSignal;
    const centre = mapRef.current?.getCenter();
    if (centre) place(centre.lat, centre.lng);
  }, [pinAtCentreSignal]);

  return (
    <div role="region" aria-label={t.mapLabel}>
      <div className="border-border h-80 overflow-hidden rounded-lg border">
        {/* Leaflet makes this the focus stop (tabindex 0, arrow keys pan): name it for keyboard users. */}
        <div ref={containerRef} role="group" aria-label={t.mapKeyboardLabel} className="size-full" />
      </div>
      <p aria-live="polite" className="text-muted-foreground mt-1.5 text-sm empty:mt-0">
        {tilesFailed ? t.mapTilesFailed : null}
      </p>
    </div>
  );
}
