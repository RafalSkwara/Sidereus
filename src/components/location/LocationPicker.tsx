import { useEffect, useRef, useState } from "react";
import { CircleAlert, Crosshair, LocateFixed, MapPin, MapPinned, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMessages, plural, translateKey } from "@/i18n";
import type { Locale } from "@/lib/preferences";
import { GEOCODING_FAILED, PLACE_QUERY_MIN_LENGTH, searchPlaces, type PlaceResult } from "@/lib/location/geocode";
import { geolocationAlreadyGranted, locateDevice } from "@/lib/location/locate";
import { DEVICE_RECENTRE_TIMEOUT_MS, initialMapView, type MapPoint, type MapView } from "@/lib/location/map-view";
import { cn } from "@/lib/utils";

/*
 * The shared location picker (S-08, S-09): "Use my location", place search, "Pick from map" and the confirmation
 * line, used by onboarding and the add/edit site form. The host owns the coordinates (its own fields or hidden inputs),
 * validation and the confirmation text; the picker only reports picks through `onPick`.
 *
 * Privacy (PRD NFR): the browser is asked for its position only on the button click, and both
 * `locateDevice` and `searchPlaces` round to about 1 km before a pick leaves them, so a raw position
 * never reaches state. Nothing here logs, and coordinates never go into a URL. The text controls have
 * an empty `name`, so the picker never adds to the host form's payload.
 *
 * The map (S-09) is the third way: its code (`map-panel.tsx`, the only Leaflet importer), its CSS and its tiles
 * load only after the "Pick from map" click, which is the user's consent. It recentres on the device only when
 * geolocation was already granted (checked without a prompt); otherwise it starts at the host's coordinates or a
 * neutral view of Europe.
 *
 * Island-safe imports only.
 */

/** A chosen location, already rounded, and how it was chosen. */
export interface LocationPick {
  latitudeDeg: number;
  longitudeDeg: number;
  source: { kind: "device" } | { kind: "place"; label: string; name: string } | { kind: "map" };
}

interface Props {
  locale: Locale;
  onPick: (pick: LocationPick) => void;
  /** The confirmation line under the search; `null` hides it. */
  summary: string | null;
  /** Marks the search box invalid when the host has a location error to show. */
  invalid?: boolean;
  /** The id of the host's location error, so the invalid search box names it (`aria-describedby`). */
  errorId?: string;
  /** The host's coordinates, parsed (`parseCurrent`): where the map opens, and where its pin follows typing. */
  current?: MapPoint | null;
  /** Closes the map whenever the number changes (the host's Undo). */
  closeSignal?: number;
}

type GeoStatus = "idle" | "locating" | "denied" | "unavailable";
type SearchStatus = "idle" | "searching" | "done" | "failed";
type MapStatus = "idle" | "loading" | "open" | "failed";

type MapPanelComponent = (typeof import("./map-panel"))["default"];
let mapPanel: Promise<MapPanelComponent> | undefined;

/** The map's chunk, fetched once per page; a failed load is not memoised, so the button can retry. */
function loadMapPanel(): Promise<MapPanelComponent> {
  mapPanel ??= import("./map-panel").then((module) => module.default);
  // The browser may cache a failed `import()`, so a reload can be what recovers (the failure message says so).
  mapPanel.catch(() => {
    mapPanel = undefined;
  });
  return mapPanel;
}

/** An already granted device position, or `null` if there is none within the recentre timeout. Never prompts. */
async function grantedDevicePosition(): Promise<MapPoint | null> {
  if (!(await geolocationAlreadyGranted(navigator.permissions))) return null;
  // A failed or slow lookup only means the map stays on its neutral view; there is nothing to report.
  const position = locateDevice("geolocation" in navigator ? navigator.geolocation : undefined).catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(resolve, DEVICE_RECENTRE_TIMEOUT_MS, null));
  return Promise.race([position, timeout]);
}

const SEARCH_DEBOUNCE_MS = 300;

export default function LocationPicker({
  locale,
  onPick,
  summary,
  invalid = false,
  errorId,
  current = null,
  closeSignal = 0,
}: Props) {
  const m = getMessages(locale);
  const t = m.location;
  const number = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 1 });

  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchController = useRef<AbortController | undefined>(undefined);
  const summaryRef = useRef<HTMLParagraphElement>(null);

  const [mapStatus, setMapStatus] = useState<MapStatus>("idle");
  const [MapPanel, setMapPanel] = useState<MapPanelComponent | null>(null);
  const [mapView, setMapView] = useState<MapView | null>(null);
  const [recentreTo, setRecentreTo] = useState<MapPoint | null>(null);
  // Counts openings, so a device position from an earlier opening never moves a later map.
  const mapOpening = useRef(0);
  const [pinAtCentreSignal, setPinAtCentreSignal] = useState(0);
  const pickMapRef = useRef<HTMLButtonElement>(null);

  // Cancel a pending search when the island goes away.
  useEffect(
    () => () => {
      clearTimeout(searchTimer.current);
      searchController.current?.abort();
    },
    [],
  );

  function openMap() {
    const opening = ++mapOpening.current;
    setMapView(initialMapView(current));
    setRecentreTo(null);
    setMapStatus("loading");
    loadMapPanel().then(
      (component) => {
        setMapPanel(() => component);
        setMapStatus((status) => (status === "loading" && mapOpening.current === opening ? "open" : status));
      },
      () => {
        if (mapOpening.current === opening) setMapStatus("failed");
      },
    );
    if (!current) {
      void grantedDevicePosition().then((position) => {
        if (position && mapOpening.current === opening) setRecentreTo(position);
      });
    }
  }

  function closeMap({ refocus }: { refocus: boolean }) {
    mapOpening.current++;
    setMapStatus("idle");
    // The "Pick from map" button comes back in place of "Close map": return focus to it.
    if (refocus) requestAnimationFrame(() => pickMapRef.current?.focus());
  }

  // The host's Undo closes the map (it moves focus itself, to the latitude field).
  const lastCloseSignal = useRef(closeSignal);
  useEffect(() => {
    if (lastCloseSignal.current === closeSignal) return;
    lastCloseSignal.current = closeSignal;
    mapOpening.current++;
    setMapStatus("idle");
  }, [closeSignal]);

  function locateMe() {
    setGeoStatus("locating");
    locateDevice("geolocation" in navigator ? navigator.geolocation : undefined).then(
      (position) => {
        onPick({ ...position, source: { kind: "device" } });
        setGeoStatus("idle");
      },
      (error: unknown) => {
        setGeoStatus(error instanceof Error && error.message === "denied" ? "denied" : "unavailable");
      },
    );
  }

  function cancelSearch() {
    clearTimeout(searchTimer.current);
    searchController.current?.abort();
    searchController.current = undefined;
  }

  function changeQuery(value: string) {
    setQuery(value);
    cancelSearch();
    const trimmed = value.trim();
    if (trimmed.length < PLACE_QUERY_MIN_LENGTH) {
      setResults([]);
      setSearchStatus("idle");
      return;
    }
    const controller = new AbortController();
    searchController.current = controller;
    searchTimer.current = setTimeout(() => {
      setSearchStatus("searching");
      searchPlaces(trimmed, locale, globalThis.fetch.bind(globalThis), controller.signal).then(
        (found) => {
          if (controller.signal.aborted) return;
          setResults(found);
          setSearchStatus("done");
        },
        () => {
          // A cancelled (stale) search rejects too; only the current one may show an error.
          if (controller.signal.aborted) return;
          setResults([]);
          setSearchStatus("failed");
        },
      );
    }, SEARCH_DEBOUNCE_MS);
  }

  function pickPlace(place: PlaceResult) {
    cancelSearch();
    onPick({
      latitudeDeg: place.latitudeDeg,
      longitudeDeg: place.longitudeDeg,
      source: { kind: "place", label: place.label, name: place.name },
    });
    setQuery("");
    setResults([]);
    setSearchStatus("idle");
    // The results list is gone; land on the confirmation instead of losing focus to the page.
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  const geoHint =
    geoStatus === "locating"
      ? t.locating
      : geoStatus === "denied"
        ? t.locationDenied
        : geoStatus === "unavailable"
          ? t.locationUnavailable
          : null;

  const searchMessage =
    searchStatus === "searching"
      ? t.searching
      : searchStatus === "failed"
        ? `${translateKey(m, GEOCODING_FAILED, "errors.generic")} ${t.searchFallback}`
        : searchStatus === "done"
          ? results.length === 0
            ? t.noResults
            : plural(locale, results.length, t.resultsCount)({ count: number.format(results.length) })
          : null;

  return (
    <>
      <div className="flex flex-col">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full sm:w-auto sm:self-start"
          onClick={locateMe}
          disabled={geoStatus === "locating"}
        >
          <LocateFixed className="size-4" />
          {t.useLocation}
        </Button>
        <p aria-live="polite" className="text-muted-foreground mt-2 text-sm empty:mt-0">
          {geoHint}
        </p>
      </div>

      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        <span className="bg-border h-px flex-1" aria-hidden="true" />
        {t.or}
        <span className="bg-border h-px flex-1" aria-hidden="true" />
      </div>

      <div>
        <Label htmlFor="place-search" className="mb-1.5">
          {t.searchLabel}
        </Label>
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="place-search"
            type="search"
            name=""
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
            value={query}
            placeholder={t.searchPlaceholder}
            aria-describedby={invalid && errorId ? `place-search-status ${errorId}` : "place-search-status"}
            aria-invalid={invalid ? true : undefined}
            onChange={(e) => {
              changeQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              // Enter in the search box searches; it must not submit the host form.
              if (e.key === "Enter") e.preventDefault();
              if (e.key === "Escape" && query !== "") {
                e.preventDefault();
                changeQuery("");
              }
            }}
            className="pl-10"
          />
        </div>
        <p
          id="place-search-status"
          aria-live="polite"
          className={cn(
            "mt-1.5 text-sm empty:mt-0",
            searchStatus === "failed" ? "text-destructive flex items-start gap-1.5" : "text-muted-foreground",
          )}
        >
          {/* The failure is an error: the icon carries it with the colour, as FieldError does (red mode). */}
          {searchStatus === "failed" ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : null}
          {searchMessage}
        </p>
        {results.length > 0 ? (
          <ul
            aria-label={t.resultsLabel}
            className="border-border mt-2 flex flex-col overflow-hidden rounded-lg border"
          >
            {results.map((place) => (
              <li key={place.id} className="border-border border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    pickPlace(place);
                  }}
                  className="text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-ring text-label flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2"
                >
                  <MapPin className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                  {place.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p
          ref={summaryRef}
          tabIndex={-1}
          role="status"
          className={cn(
            "focus-visible:outline-ring flex items-center gap-2 rounded-lg text-sm focus-visible:outline-2 focus-visible:outline-offset-2",
            summary && "border-selected text-heading mt-3 border px-3 py-2 font-semibold",
          )}
        >
          {summary ? (
            <>
              <MapPin className="text-primary size-4 shrink-0" aria-hidden="true" />
              {summary}
            </>
          ) : null}
        </p>
      </div>

      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        <span className="bg-border h-px flex-1" aria-hidden="true" />
        {t.or}
        <span className="bg-border h-px flex-1" aria-hidden="true" />
      </div>

      <div className="flex flex-col">
        {mapStatus === "open" ? null : (
          <Button
            ref={pickMapRef}
            type="button"
            variant="outline"
            size="lg"
            className="w-full sm:w-auto sm:self-start"
            onClick={openMap}
            disabled={mapStatus === "loading"}
            aria-expanded={false}
            data-needs-network="map-source"
          >
            <MapPinned className="size-4" />
            {t.pickFromMap}
          </Button>
        )}
        <p id="map-source" className={cn("text-muted-foreground text-sm", mapStatus === "open" ? "mb-3" : "mt-2")}>
          {t.mapSource}
        </p>
        <p
          aria-live="polite"
          className={cn(
            "mt-2 text-sm empty:mt-0",
            mapStatus === "failed" ? "text-destructive flex items-start gap-1.5" : "text-muted-foreground",
          )}
        >
          {mapStatus === "failed" ? <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : null}
          {mapStatus === "loading" ? t.mapLoading : mapStatus === "failed" ? t.mapFailed : null}
        </p>
        {mapStatus === "open" && MapPanel && mapView ? (
          <>
            <MapPanel
              locale={locale}
              view={mapView}
              current={current}
              recentreTo={recentreTo}
              onPick={(point) => {
                onPick({ ...point, source: { kind: "map" } });
              }}
              onFailed={() => {
                setMapStatus("failed");
              }}
              pinAtCentreSignal={pinAtCentreSignal}
            />
            {/* Neither button needs the network: an open map can always be closed, offline too. */}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  setPinAtCentreSignal((n) => n + 1);
                }}
              >
                <Crosshair className="size-4" />
                {t.pinAtCentre}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => {
                  closeMap({ refocus: true });
                }}
              >
                <X className="size-4" />
                {t.closeMap}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
