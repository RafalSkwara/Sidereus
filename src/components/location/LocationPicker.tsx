import { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMessages, plural, translateKey } from "@/i18n";
import type { Locale } from "@/lib/preferences";
import { GEOCODING_FAILED, PLACE_QUERY_MIN_LENGTH, searchPlaces, type PlaceResult } from "@/lib/location/geocode";
import { locateDevice } from "@/lib/location/locate";
import { cn } from "@/lib/utils";

/*
 * The shared location picker (S-08): "Use my location", place search and the confirmation line, used by
 * onboarding and the add/edit site form. The host owns the coordinates (its own fields or hidden inputs),
 * validation and the confirmation text; the picker only reports picks through `onPick`.
 *
 * Privacy (PRD NFR): the browser is asked for its position only on the button click, and both
 * `locateDevice` and `searchPlaces` round to about 1 km before a pick leaves them, so a raw position
 * never reaches state. Nothing here logs, and coordinates never go into a URL. The text controls have
 * an empty `name`, so the picker never adds to the host form's payload.
 *
 * Island-safe imports only.
 */

/** A chosen location, already rounded, and how it was chosen. */
export interface LocationPick {
  latitudeDeg: number;
  longitudeDeg: number;
  source: { kind: "device" } | { kind: "place"; label: string; name: string };
}

interface Props {
  locale: Locale;
  onPick: (pick: LocationPick) => void;
  /** The confirmation line under the search; `null` hides it. */
  summary: string | null;
  /** Marks the search box invalid when the host has a location error to show. */
  invalid?: boolean;
}

type GeoStatus = "idle" | "locating" | "denied" | "unavailable";
type SearchStatus = "idle" | "searching" | "done" | "failed";

const SEARCH_DEBOUNCE_MS = 300;

export default function LocationPicker({ locale, onPick, summary, invalid = false }: Props) {
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

  // Cancel a pending search when the island goes away.
  useEffect(
    () => () => {
      clearTimeout(searchTimer.current);
      searchController.current?.abort();
    },
    [],
  );

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
            aria-describedby="place-search-status"
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
            searchStatus === "failed" ? "text-destructive" : "text-muted-foreground",
          )}
        >
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
    </>
  );
}
