import React, { useEffect, useRef, useState } from "react";
import { LocateFixed, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { ServerError } from "@/components/forms/ServerError";
import { Button } from "@/components/ui/button";
import { getMessages, plural, translateKey, type Messages } from "@/i18n";
import type { Locale } from "@/lib/preferences";
import { roundCoordinate } from "@/lib/gear/coordinates";
import { AFOV_PRESET_OPTIONS, type AfovPreset } from "@/lib/gear/eyepiece-presets";
import { GEOCODING_FAILED, PLACE_QUERY_MIN_LENGTH, searchPlaces, type PlaceResult } from "@/lib/onboarding/geocode";
import {
  DEFAULT_EYEPIECE_KIT_ID,
  DEFAULT_SKY_SCENE_ID,
  DEFAULT_TELESCOPE_PRESET_ID,
  EYEPIECE_KIT_PRESETS,
  SKY_SCENES,
  TELESCOPE_PRESETS,
  type EyepieceKitItem,
  type EyepieceKitPresetId,
  type SkySceneId,
  type TelescopePresetId,
} from "@/lib/onboarding/presets";
import { MAX_ONBOARDING_EYEPIECES, onboardingInputSchema } from "@/lib/onboarding/schemas";
import { cn } from "@/lib/utils";

/*
 * First-run setup (S-03): one page, three sections (Where / Sky / Kit), one native POST.
 *
 * The form's payload is exactly the hidden inputs below, one per `onboardingInputSchema` field;
 * the visible text controls have an empty `name`, so they are never submitted themselves.
 *
 * Privacy (PRD NFR): a device position is rounded with `roundCoordinate` before it enters state,
 * place-search results arrive rounded from `searchPlaces`, and typed coordinates are rounded into the
 * hidden inputs. Nothing here logs, and coordinates never go into a URL.
 *
 * Island-safe imports only: never `timezone.ts` or any `store.ts`.
 */

interface Props {
  action: string;
  /** A message key from `?error=`; translated here, unknown values read as the generic message. */
  serverError?: string | null;
  locale: Locale;
}

/** How the current coordinates were chosen; drives the confirmation line. */
type WhereSource = { kind: "device" } | { kind: "place"; label: string } | { kind: "manual" };

type GeoStatus = "idle" | "locating" | "denied" | "unavailable";
type SearchStatus = "idle" | "searching" | "done" | "failed";

interface EyepieceRow {
  key: number;
  name: string;
  focalLength: string;
  afovPreset: AfovPreset;
  afovDeg: string;
}

type EyepieceField = "name" | "focalLengthMm" | "afovPreset" | "afovDeg";
type RowErrors = Partial<Record<EyepieceField, string>>;

interface Errors {
  where?: string;
  telescopeName?: string;
  apertureMm?: string;
  focalLengthMm?: string;
  eyepieces?: string;
  rows: Record<number, RowErrors | undefined>;
}

const NO_ERRORS: Errors = { rows: {} };

const SEARCH_DEBOUNCE_MS = 300;

const selectBase =
  "h-11 w-full rounded-lg border bg-surface px-3 text-foreground outline-none transition-shadow focus-visible:ring-[3px]";
const inputBase =
  "h-11 w-full rounded-lg border bg-surface px-3 text-foreground placeholder:text-faint outline-none transition-shadow focus-visible:ring-[3px]";
const inputOk = "border-input focus-visible:border-ring focus-visible:ring-ring/50";
const inputBad = "border-destructive focus-visible:ring-destructive/20";

/** A radio card: the native radio is visually hidden, the label shows its checked and focus state. */
const radioCard = cn(
  "group relative flex min-h-11 cursor-pointer flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3 transition-colors",
  "hover:bg-accent has-[:checked]:border-selected has-[:checked]:ring-1 has-[:checked]:ring-selected",
  "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
);

const sectionClass = "flex flex-col gap-4 rounded-2xl border border-border bg-surface/40 p-4 sm:p-6";
const kickerClass = "text-xs font-semibold tracking-[0.18em] text-primary uppercase";
const headingClass = "font-display text-2xl font-semibold text-heading";

function telescopePreset(id: TelescopePresetId) {
  return TELESCOPE_PRESETS.find((preset) => preset.id === id) ?? TELESCOPE_PRESETS[0];
}

function kitPreset(id: EyepieceKitPresetId) {
  return EYEPIECE_KIT_PRESETS.find((kit) => kit.id === id) ?? EYEPIECE_KIT_PRESETS[0];
}

function sceneFor(id: SkySceneId) {
  return SKY_SCENES.find((scene) => scene.id === id) ?? SKY_SCENES[0];
}

/** A typed coordinate as the rounded string the form submits; anything unparsable is left for the schema to reject. */
function roundedCoordinate(value: string): string {
  const trimmed = value.trim();
  const n = Number(trimmed);
  return trimmed !== "" && Number.isFinite(n) ? String(roundCoordinate(n)) : trimmed;
}

function kitRow(eyepiece: EyepieceKitItem, key: number): EyepieceRow {
  return {
    key,
    name: eyepiece.name,
    focalLength: String(eyepiece.focalLengthMm),
    afovPreset: eyepiece.afovPreset,
    afovDeg: "",
  };
}

function presetLabel(presets: Messages["eyepiecePresets"], option: AfovPreset): string {
  return option === "other" ? presets.other : presets[option].long;
}

/** The radio mark in a card's corner; filled while the card's radio is checked. */
function CheckDot() {
  return (
    <span
      aria-hidden="true"
      className="border-border group-has-[:checked]:border-selected absolute top-3 right-3 flex size-4 items-center justify-center rounded-full border"
    >
      <span className="bg-selected hidden size-2 rounded-full group-has-[:checked]:block" />
    </span>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-destructive mt-1 text-xs">
      {message}
    </p>
  );
}

export default function OnboardingWizard({ action, serverError, locale }: Props) {
  const m = getMessages(locale);
  const t = m.onboarding;
  const number = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 1 });

  // Where ------------------------------------------------------------------------------------
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [source, setSource] = useState<WhereSource | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
  const [manualOpen, setManualOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const searchController = useRef<AbortController | undefined>(undefined);
  const summaryRef = useRef<HTMLParagraphElement>(null);

  // Sky --------------------------------------------------------------------------------------
  const [sceneId, setSceneId] = useState<SkySceneId>(DEFAULT_SKY_SCENE_ID);

  // Kit --------------------------------------------------------------------------------------
  const initialTelescope = telescopePreset(DEFAULT_TELESCOPE_PRESET_ID);
  const [telescopeId, setTelescopeId] = useState<TelescopePresetId>(DEFAULT_TELESCOPE_PRESET_ID);
  const [telescopeName, setTelescopeName] = useState<string>(t.telescopes[DEFAULT_TELESCOPE_PRESET_ID]);
  const [aperture, setAperture] = useState(String(initialTelescope.apertureMm));
  const [focalLength, setFocalLength] = useState(String(initialTelescope.focalLengthMm));
  const [kitId, setKitId] = useState<EyepieceKitPresetId>(DEFAULT_EYEPIECE_KIT_ID);
  const [rows, setRows] = useState<EyepieceRow[]>(() =>
    kitPreset(DEFAULT_EYEPIECE_KIT_ID).eyepieces.map((eyepiece, index) => kitRow(eyepiece, index)),
  );
  // Row keys only grow, so a removed row's key (and its field ids) is never reused.
  const nextRowKey = useRef(kitPreset(DEFAULT_EYEPIECE_KIT_ID).eyepieces.length);

  const [errors, setErrors] = useState<Errors>(NO_ERRORS);
  const [showSummary, setShowSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cancel a pending search when the island goes away.
  useEffect(
    () => () => {
      clearTimeout(searchTimer.current);
      searchController.current?.abort();
    },
    [],
  );

  // Coming back to this page from the browser's history cache re-enables the submit button.
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) setSubmitting(false);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const hasLocation = latitude.trim() !== "" && longitude.trim() !== "";

  function setLocation(lat: number, lon: number, next: WhereSource) {
    setLatitude(String(lat));
    setLongitude(String(lon));
    setSource(next);
    setErrors((prev) => ({ ...prev, where: undefined }));
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unavailable");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Rounded before anything else sees it: the raw position never reaches state.
        const lat = roundCoordinate(position.coords.latitude);
        const lon = roundCoordinate(position.coords.longitude);
        setLocation(lat, lon, { kind: "device" });
        setGeoStatus("idle");
      },
      (error) => {
        setGeoStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
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
    setLocation(place.latitudeDeg, place.longitudeDeg, { kind: "place", label: place.label });
    setQuery("");
    setResults([]);
    setSearchStatus("idle");
    // The results list is gone; land on the confirmation instead of losing focus to the page.
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  function changeManual(field: "latitude" | "longitude", value: string) {
    if (field === "latitude") setLatitude(value);
    else setLongitude(value);
    setSource({ kind: "manual" });
    setErrors((prev) => ({ ...prev, where: undefined }));
  }

  function chooseTelescope(id: TelescopePresetId) {
    const preset = telescopePreset(id);
    setTelescopeId(id);
    setTelescopeName(t.telescopes[id]);
    setAperture(String(preset.apertureMm));
    setFocalLength(String(preset.focalLengthMm));
    setErrors((prev) => ({ ...prev, telescopeName: undefined, apertureMm: undefined, focalLengthMm: undefined }));
  }

  function chooseKit(id: EyepieceKitPresetId) {
    setKitId(id);
    setRows(kitPreset(id).eyepieces.map((eyepiece) => kitRow(eyepiece, nextRowKey.current++)));
    setErrors((prev) => ({ ...prev, eyepieces: undefined, rows: {} }));
  }

  function updateRow(key: number, patch: Partial<EyepieceRow>, cleared: EyepieceField[]) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setErrors((prev) => {
      const rowErrors = prev.rows[key];
      if (!rowErrors) return prev;
      const next = { ...rowErrors };
      for (const field of cleared) next[field] = undefined;
      return { ...prev, rows: { ...prev.rows, [key]: next } };
    });
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((row) => row.key !== key));
    setErrors((prev) => ({ ...prev, eyepieces: undefined, rows: { ...prev.rows, [key]: undefined } }));
    requestAnimationFrame(() => document.getElementById("add-eyepiece")?.focus());
  }

  function addRow() {
    if (rows.length >= MAX_ONBOARDING_EYEPIECES) return;
    const key = nextRowKey.current++;
    setRows((prev) => [...prev, { key, name: "", focalLength: "", afovPreset: "plossl", afovDeg: "" }]);
    requestAnimationFrame(() => document.getElementById(`eyepiece-${key}-name`)?.focus());
  }

  // Payload ----------------------------------------------------------------------------------
  const eyepiecesJson = JSON.stringify(
    rows.map((row) => ({
      name: row.name,
      focalLengthMm: row.focalLength,
      afovPreset: row.afovPreset,
      ...(row.afovPreset === "other" ? { afovDeg: row.afovDeg } : {}),
    })),
  );
  const payload = {
    latitudeDeg: roundedCoordinate(latitude),
    longitudeDeg: roundedCoordinate(longitude),
    bortle: String(sceneFor(sceneId).bortle),
    telescopeName,
    apertureMm: aperture,
    focalLengthMm: focalLength,
    eyepieces: eyepiecesJson,
  };

  /** Validates the payload, shows every error inline and returns the id of the first invalid control. */
  function validate(): string | null {
    const result = onboardingInputSchema.safeParse(payload);
    if (result.success) {
      setErrors(NO_ERRORS);
      return null;
    }
    const next: Errors = { rows: {} };
    const translate = (message: string) => translateKey(m, message, "errors.checkFields");
    for (const issue of result.error.issues) {
      const [field, index, rowField] = issue.path;
      if (field === "latitudeDeg" || field === "longitudeDeg" || field === "bortle") {
        next.where ??= translate(issue.message);
      } else if (field === "telescopeName" || field === "apertureMm" || field === "focalLengthMm") {
        next[field] ??= translate(issue.message);
      } else if (field === "eyepieces") {
        const row = typeof index === "number" ? rows.at(index) : undefined;
        if (row && typeof rowField === "string") {
          const rowErrors: RowErrors = (next.rows[row.key] ??= {});
          rowErrors[rowField as EyepieceField] ??= translate(issue.message);
        } else {
          next.eyepieces ??= translate(issue.message);
        }
      }
    }
    setErrors(next);

    if (next.where) return manualOpen ? "manual-latitude" : "place-search";
    if (next.telescopeName) return "telescope-name";
    if (next.apertureMm) return "telescope-aperture";
    if (next.focalLengthMm) return "telescope-focal-length";
    for (const row of rows) {
      const rowErrors = next.rows[row.key];
      if (!rowErrors) continue;
      const field = (["name", "focalLengthMm", "afovPreset", "afovDeg"] as const).find((f) => rowErrors[f]);
      if (field) return `eyepiece-${row.key}-${field}`;
    }
    return "add-eyepiece";
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!hasLocation || submitting) {
      e.preventDefault();
      return;
    }
    const invalid = validate();
    if (invalid !== null) {
      e.preventDefault();
      setShowSummary(true);
      document.getElementById(invalid)?.focus();
      return;
    }
    setShowSummary(false);
    setSubmitting(true);
  }

  // Rendering helpers ------------------------------------------------------------------------
  const whereSummary =
    source === null || !hasLocation
      ? null
      : source.kind === "device"
        ? t.where.usingDevice
        : source.kind === "place"
          ? t.where.usingPlace({ place: source.label })
          : t.where.usingCoordinates;

  const geoHint =
    geoStatus === "locating"
      ? t.where.locating
      : geoStatus === "denied"
        ? t.where.locationDenied
        : geoStatus === "unavailable"
          ? t.where.locationUnavailable
          : null;

  const searchMessage =
    searchStatus === "searching"
      ? t.where.searching
      : searchStatus === "failed"
        ? `${translateKey(m, GEOCODING_FAILED, "errors.generic")} ${t.where.searchFallback}`
        : searchStatus === "done"
          ? results.length === 0
            ? t.where.noResults
            : plural(locale, results.length, t.where.resultsCount)({ count: number.format(results.length) })
          : null;

  const hasErrors =
    [errors.where, errors.telescopeName, errors.apertureMm, errors.focalLengthMm, errors.eyepieces].some(Boolean) ||
    Object.values(errors.rows).some((row) => row && Object.values(row).some(Boolean));

  return (
    <form method="POST" action={action} className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
      {Object.entries(payload).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {serverError ? (
        <div role="alert">
          <ServerError message={translateKey(m, serverError, "errors.generic")} />
        </div>
      ) : null}

      {/* 1 · Where ------------------------------------------------------------------------- */}
      <section aria-labelledby="where-heading" className={sectionClass}>
        <div className="flex flex-col gap-1">
          <p className={kickerClass}>{t.where.kicker}</p>
          <h2 id="where-heading" className={headingClass}>
            {t.where.heading}
          </h2>
          <p className="text-muted-foreground text-sm">{t.where.hint}</p>
        </div>

        <div className="flex flex-col">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 w-full rounded-lg text-[15px] font-semibold sm:w-auto sm:self-start"
            onClick={locateMe}
            disabled={geoStatus === "locating"}
          >
            <LocateFixed className="size-4" />
            {t.where.useLocation}
          </Button>
          <p aria-live="polite" className="text-muted-foreground mt-2 text-sm empty:mt-0">
            {geoHint}
          </p>
        </div>

        <div className="text-muted-foreground flex items-center gap-3 text-xs tracking-[0.18em] uppercase">
          <span className="bg-border h-px flex-1" aria-hidden="true" />
          {t.where.or}
          <span className="bg-border h-px flex-1" aria-hidden="true" />
        </div>

        <div>
          <label htmlFor="place-search" className="text-heading mb-1 block text-sm font-semibold">
            {t.where.searchLabel}
          </label>
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="place-search"
              type="search"
              name=""
              autoComplete="off"
              enterKeyHint="search"
              spellCheck={false}
              value={query}
              placeholder={t.where.searchPlaceholder}
              aria-describedby="place-search-status"
              aria-invalid={errors.where && !manualOpen ? true : undefined}
              onChange={(e) => {
                changeQuery(e.target.value);
              }}
              onKeyDown={(e) => {
                // Enter in the search box searches; it must not submit the whole setup.
                if (e.key === "Enter") e.preventDefault();
                if (e.key === "Escape" && query !== "") {
                  e.preventDefault();
                  changeQuery("");
                }
              }}
              className={cn(inputBase, "pl-10", errors.where && !manualOpen ? inputBad : inputOk)}
            />
          </div>
          <p
            id="place-search-status"
            aria-live="polite"
            className={cn(
              "mt-1 text-xs empty:mt-0",
              searchStatus === "failed" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {searchMessage}
          </p>
          {results.length > 0 ? (
            <ul
              aria-label={t.where.resultsLabel}
              className="border-border mt-2 flex flex-col overflow-hidden rounded-lg border"
            >
              {results.map((place) => (
                <li key={place.id} className="border-border border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      pickPlace(place);
                    }}
                    className="text-foreground hover:bg-accent focus-visible:bg-accent flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-[15px] outline-none"
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
              "focus-visible:ring-ring/50 flex items-center gap-2 rounded-lg text-sm outline-none focus-visible:ring-[3px]",
              whereSummary && "border-selected text-heading mt-3 border px-3 py-2 font-semibold",
            )}
          >
            {whereSummary ? (
              <>
                <MapPin className="text-primary size-4 shrink-0" aria-hidden="true" />
                {whereSummary}
              </>
            ) : null}
          </p>
        </div>

        <details
          open={manualOpen}
          onToggle={(e) => {
            setManualOpen(e.currentTarget.open);
          }}
          className="group"
        >
          <summary className="text-primary-strong hover:text-heading flex min-h-11 cursor-pointer items-center text-sm font-semibold underline-offset-4 hover:underline">
            {t.where.manualToggle}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="manual-latitude"
                name=""
                label={m.siteForm.latitude}
                type="number"
                step={0.01}
                min={-90}
                max={90}
                inputMode="decimal"
                value={latitude}
                onChange={(v) => {
                  changeManual("latitude", v);
                }}
                placeholder="52.23"
                error={errors.where}
              />
              <FormField
                id="manual-longitude"
                name=""
                label={m.siteForm.longitude}
                type="number"
                step={0.01}
                min={-180}
                max={180}
                inputMode="decimal"
                value={longitude}
                onChange={(v) => {
                  changeManual("longitude", v);
                }}
                placeholder="21.01"
              />
            </div>
            <p className="text-muted-foreground text-xs">{m.siteForm.coordinatesHint}</p>
          </div>
        </details>

        {errors.where && !manualOpen ? (
          <p role="alert" className="text-destructive text-sm">
            {errors.where}
          </p>
        ) : null}
      </section>

      {/* 2 · Sky --------------------------------------------------------------------------- */}
      <section aria-labelledby="sky-heading" className={sectionClass}>
        <div className="flex flex-col gap-1">
          <p className={kickerClass}>{t.sky.kicker}</p>
          <h2 id="sky-heading" className={headingClass}>
            {t.sky.heading}
          </h2>
          <p id="sky-hint" className="text-muted-foreground text-sm">
            {t.sky.hint}
          </p>
        </div>
        <fieldset aria-labelledby="sky-heading" aria-describedby="sky-hint" className="flex flex-col gap-2">
          {SKY_SCENES.map((scene) => (
            <label key={scene.id} className={radioCard}>
              <input
                type="radio"
                name="skyScene"
                value={scene.id}
                checked={sceneId === scene.id}
                onChange={() => {
                  setSceneId(scene.id);
                }}
                className="peer sr-only"
              />
              <span className="text-heading pr-6 text-[15px] font-semibold">{t.scenes[scene.id].title}</span>
              <span className="text-muted-foreground text-sm">{t.scenes[scene.id].description}</span>
              <CheckDot />
            </label>
          ))}
        </fieldset>
      </section>

      {/* 3 · Kit --------------------------------------------------------------------------- */}
      <section aria-labelledby="kit-heading" className={sectionClass}>
        <div className="flex flex-col gap-1">
          <p className={kickerClass}>{t.kit.kicker}</p>
          <h2 id="kit-heading" className={headingClass}>
            {t.kit.heading}
          </h2>
        </div>

        <fieldset className="flex flex-col gap-3" aria-describedby="telescope-hint">
          <legend className="text-heading mb-1 text-[15px] font-semibold">{t.kit.telescope}</legend>
          <p id="telescope-hint" className="text-muted-foreground -mt-1 text-sm">
            {t.kit.telescopeHint}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TELESCOPE_PRESETS.map((preset) => (
              <label key={preset.id} className={radioCard}>
                <input
                  type="radio"
                  name="telescopePreset"
                  value={preset.id}
                  checked={telescopeId === preset.id}
                  onChange={() => {
                    chooseTelescope(preset.id);
                  }}
                  className="peer sr-only"
                />
                <span className="text-heading pr-6 text-[15px] font-semibold">{t.telescopes[preset.id]}</span>
                <span className="text-muted-foreground text-sm">
                  {m.gear.telescopes.aperture({ mm: number.format(preset.apertureMm) })} ·{" "}
                  {m.gear.telescopes.focalLength({ mm: number.format(preset.focalLengthMm) })}
                </span>
                <CheckDot />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="border-border flex flex-col gap-4 rounded-xl border p-4">
          <FormField
            id="telescope-name"
            name=""
            label={m.common.name}
            value={telescopeName}
            onChange={(v) => {
              setTelescopeName(v);
              setErrors((prev) => ({ ...prev, telescopeName: undefined }));
            }}
            error={errors.telescopeName}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="telescope-aperture"
              name=""
              label={m.telescopeForm.aperture}
              type="number"
              step={1}
              min={20}
              max={1000}
              inputMode="decimal"
              value={aperture}
              onChange={(v) => {
                setAperture(v);
                setErrors((prev) => ({ ...prev, apertureMm: undefined }));
              }}
              error={errors.apertureMm}
            />
            <FormField
              id="telescope-focal-length"
              name=""
              label={m.common.focalLengthMm}
              type="number"
              step={1}
              min={100}
              max={5000}
              inputMode="decimal"
              value={focalLength}
              onChange={(v) => {
                setFocalLength(v);
                setErrors((prev) => ({ ...prev, focalLengthMm: undefined }));
              }}
              error={errors.focalLengthMm}
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-3" aria-describedby="eyepieces-hint">
          <legend className="text-heading mb-1 text-[15px] font-semibold">{t.kit.eyepieces}</legend>
          <p id="eyepieces-hint" className="text-muted-foreground -mt-1 text-sm">
            {t.kit.eyepiecesHint}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {EYEPIECE_KIT_PRESETS.map((kit) => (
              <label key={kit.id} className={radioCard}>
                <input
                  type="radio"
                  name="eyepieceKit"
                  value={kit.id}
                  checked={kitId === kit.id}
                  onChange={() => {
                    chooseKit(kit.id);
                  }}
                  className="peer sr-only"
                />
                <span className="text-heading pr-6 text-[15px] font-semibold">{t.eyepieceKits[kit.id]}</span>
                <span className="text-muted-foreground text-sm">
                  {kit.eyepieces.length > 0
                    ? kit.eyepieces.map((eyepiece) => eyepiece.name).join(" · ")
                    : t.kit.emptyKit}
                </span>
                <CheckDot />
              </label>
            ))}
          </div>
        </fieldset>

        {rows.length === 0 ? <p className="text-muted-foreground text-sm">{t.kit.noEyepieces}</p> : null}

        <ol className="flex flex-col gap-3">
          {rows.map((row, index) => {
            const rowErrors = errors.rows[row.key] ?? {};
            const label = number.format(index + 1);
            const typeId = `eyepiece-${row.key}-afovPreset`;
            return (
              <li key={row.key} className="border-border relative rounded-xl border p-4">
                <fieldset className="flex flex-col gap-3">
                  <legend className="text-heading flex min-h-11 items-center pr-12 text-sm font-semibold">
                    {t.kit.eyepieceLegend({ number: label })}
                  </legend>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive absolute top-4 right-3 size-11"
                    aria-label={t.kit.removeEyepiece({ number: label })}
                    onClick={() => {
                      removeRow(row.key);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  <FormField
                    id={`eyepiece-${row.key}-name`}
                    name=""
                    label={m.common.name}
                    value={row.name}
                    onChange={(v) => {
                      updateRow(row.key, { name: v }, ["name"]);
                    }}
                    placeholder={m.eyepieceForm.namePlaceholder}
                    error={rowErrors.name}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      id={`eyepiece-${row.key}-focalLengthMm`}
                      name=""
                      label={m.common.focalLengthMm}
                      type="number"
                      step={0.1}
                      min={2}
                      max={60}
                      inputMode="decimal"
                      value={row.focalLength}
                      onChange={(v) => {
                        updateRow(row.key, { focalLength: v }, ["focalLengthMm"]);
                      }}
                      placeholder="25"
                      error={rowErrors.focalLengthMm}
                    />
                    <div>
                      <label htmlFor={typeId} className="text-heading mb-1 block text-sm font-semibold">
                        {m.eyepieceForm.type}
                      </label>
                      <select
                        id={typeId}
                        name=""
                        value={row.afovPreset}
                        onChange={(e) => {
                          updateRow(row.key, { afovPreset: e.target.value as AfovPreset }, ["afovPreset", "afovDeg"]);
                        }}
                        aria-invalid={rowErrors.afovPreset ? true : undefined}
                        className={cn(selectBase, rowErrors.afovPreset ? inputBad : inputOk)}
                      >
                        {AFOV_PRESET_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {presetLabel(m.eyepiecePresets, option)}
                          </option>
                        ))}
                      </select>
                      <FieldError message={rowErrors.afovPreset} />
                    </div>
                  </div>
                  {row.afovPreset === "other" ? (
                    <FormField
                      id={`eyepiece-${row.key}-afovDeg`}
                      name=""
                      label={m.eyepieceForm.afov}
                      type="number"
                      step={1}
                      min={30}
                      max={120}
                      inputMode="numeric"
                      value={row.afovDeg}
                      onChange={(v) => {
                        updateRow(row.key, { afovDeg: v }, ["afovDeg"]);
                      }}
                      placeholder="100"
                      error={rowErrors.afovDeg}
                    />
                  ) : null}
                </fieldset>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-2">
          <Button
            id="add-eyepiece"
            type="button"
            variant="outline"
            size="lg"
            className="h-11 w-full rounded-lg text-[15px] font-semibold sm:w-auto sm:self-start"
            disabled={rows.length >= MAX_ONBOARDING_EYEPIECES}
            aria-describedby={rows.length >= MAX_ONBOARDING_EYEPIECES ? "eyepiece-limit" : undefined}
            onClick={addRow}
          >
            <Plus className="size-4" />
            {m.gear.eyepieces.add}
          </Button>
          {rows.length >= MAX_ONBOARDING_EYEPIECES ? (
            <p id="eyepiece-limit" className="text-muted-foreground text-xs">
              {t.kit.eyepieceLimit}
            </p>
          ) : null}
          {errors.eyepieces ? (
            <p role="alert" className="text-destructive text-sm">
              {errors.eyepieces}
            </p>
          ) : null}
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {showSummary && hasErrors ? (
          <div role="alert">
            <ServerError message={m.errors.checkFields} />
          </div>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full rounded-lg text-base font-semibold"
          disabled={!hasLocation || submitting}
          aria-describedby={hasLocation ? undefined : "location-required"}
        >
          {submitting ? (
            <>
              <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
              {m.common.saving}
            </>
          ) : (
            t.submit
          )}
        </Button>
        {hasLocation ? null : (
          <p id="location-required" className="text-muted-foreground text-center text-sm">
            {t.locationRequired}
          </p>
        )}
      </div>
    </form>
  );
}
