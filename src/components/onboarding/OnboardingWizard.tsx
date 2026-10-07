import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { ChoiceCard } from "@/components/forms/ChoiceCard";
import { Combobox } from "@/components/forms/Combobox";
import { FieldError, FormField } from "@/components/forms/FormField";
import LocationPicker, { type LocationPick } from "@/components/location/LocationPicker";
import { ServerError } from "@/components/forms/ServerError";
import { Band } from "@/components/ui/band";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getMessages, plural, translateKey, type Messages } from "@/i18n";
import type { Locale } from "@/lib/preferences";
import { roundCoordinate } from "@/lib/gear/coordinates";
import { parseCurrent } from "@/lib/location/map-view";
import { AFOV_PRESET_OPTIONS, type AfovPreset } from "@/lib/gear/eyepiece-presets";
import { bundledEyepieces, eyepieceFill, telescopeFill } from "@/lib/gear/catalogue/fill";
import { loadEyepieces, loadTelescopes } from "@/lib/gear/catalogue/load";
import { searchCatalogue } from "@/lib/gear/catalogue/search";
import type { EyepieceEntry, TelescopeEntry } from "@/lib/gear/catalogue/types";
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
 * Privacy (PRD NFR): the shared `LocationPicker` reports picks already rounded (`locateDevice`,
 * `searchPlaces`), and typed coordinates are rounded into the hidden inputs. Nothing here logs, and
 * coordinates never go into a URL.
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
type WhereSource = { kind: "device" } | { kind: "place"; label: string } | { kind: "map" } | { kind: "manual" };

interface EyepieceRow {
  key: number;
  name: string;
  focalLength: string;
  afovPreset: AfovPreset;
  afovDeg: string;
  /** The row's catalogue search text; a pick (or a bundled row) shows the entry's name there. */
  modelText: string;
}

/** The kit card for the chosen catalogue telescope's own eyepieces. It lives outside `EYEPIECE_KIT_PRESETS`. */
const BUNDLED_KIT = "bundled";
type KitChoice = EyepieceKitPresetId | typeof BUNDLED_KIT;

type CatalogueState = "loading" | "ready" | "unavailable";

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

/** A step's hint under its band heading, and a sub-group's legend inside the kit band. */
const stepHint = "text-body text-muted-foreground";
const groupLegend = "text-label text-heading font-semibold";

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
    modelText: "",
  };
}

/** A row filled from a catalogue eyepiece (a pick, or a telescope's bundled one). */
function catalogueRow(entry: EyepieceEntry, key: number): EyepieceRow {
  const fill = eyepieceFill(entry);
  return {
    key,
    name: fill.name,
    focalLength: fill.focalLengthMm,
    afovPreset: fill.afovPreset,
    // The exact degrees show only for "other"; a named preset carries its own.
    afovDeg: fill.afovPreset === "other" ? fill.afovDeg : "",
    modelText: entry.name,
  };
}

const getTelescopeKey = (entry: TelescopeEntry) => entry.id;
const getTelescopeLabel = (entry: TelescopeEntry) => entry.name;
const getEyepieceKey = (entry: EyepieceEntry) => entry.id;
const getEyepieceLabel = (entry: EyepieceEntry) => entry.name;

function presetLabel(presets: Messages["eyepiecePresets"], option: AfovPreset): string {
  return option === "other" ? presets.other : presets[option].long;
}

export default function OnboardingWizard({ action, serverError, locale }: Props) {
  const m = getMessages(locale);
  const t = m.onboarding;
  const number = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 1 });

  // Where ------------------------------------------------------------------------------------
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [source, setSource] = useState<WhereSource | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  // Sky --------------------------------------------------------------------------------------
  const [sceneId, setSceneId] = useState<SkySceneId>(DEFAULT_SKY_SCENE_ID);

  // Kit --------------------------------------------------------------------------------------
  const initialTelescope = telescopePreset(DEFAULT_TELESCOPE_PRESET_ID);
  // `null` once a catalogue telescope is picked (and the generic radios show no choice).
  const [telescopeId, setTelescopeId] = useState<TelescopePresetId | null>(DEFAULT_TELESCOPE_PRESET_ID);
  const [chosenTelescope, setChosenTelescope] = useState<TelescopeEntry | null>(null);
  const [telescopeText, setTelescopeText] = useState("");
  const [telescopeName, setTelescopeName] = useState<string>(t.telescopes[DEFAULT_TELESCOPE_PRESET_ID]);
  const [aperture, setAperture] = useState(String(initialTelescope.apertureMm));
  const [focalLength, setFocalLength] = useState(String(initialTelescope.focalLengthMm));
  const [kitId, setKitId] = useState<KitChoice>(DEFAULT_EYEPIECE_KIT_ID);
  // Set when the user picks any kit card; a catalogue telescope then never swaps the kit for its own eyepieces.
  const [kitTouched, setKitTouched] = useState(false);
  // The catalogues load after mount, each in its own chunk; until then (or if one fails) the fields work on their own.
  const [telescopeCatalogue, setTelescopeCatalogue] = useState<readonly TelescopeEntry[]>([]);
  const [telescopeState, setTelescopeState] = useState<CatalogueState>("loading");
  const [eyepieceCatalogue, setEyepieceCatalogue] = useState<readonly EyepieceEntry[]>([]);
  const [eyepieceState, setEyepieceState] = useState<CatalogueState>("loading");
  const [rows, setRows] = useState<EyepieceRow[]>(() =>
    kitPreset(DEFAULT_EYEPIECE_KIT_ID).eyepieces.map((eyepiece, index) => kitRow(eyepiece, index)),
  );
  // Row keys only grow, so a removed row's key (and its field ids) is never reused.
  const nextRowKey = useRef(kitPreset(DEFAULT_EYEPIECE_KIT_ID).eyepieces.length);

  const [errors, setErrors] = useState<Errors>(NO_ERRORS);
  const [showSummary, setShowSummary] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    loadTelescopes().then(
      (entries) => {
        if (cancelled) return;
        setTelescopeCatalogue(entries);
        setTelescopeState("ready");
      },
      () => {
        if (!cancelled) setTelescopeState("unavailable");
      },
    );
    loadEyepieces().then(
      (entries) => {
        if (cancelled) return;
        setEyepieceCatalogue(entries);
        setEyepieceState("ready");
      },
      () => {
        if (!cancelled) setEyepieceState("unavailable");
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // A telescope picked before the eyepieces chunk arrived gets its "Came with" kit once it does, on the same terms as
  // a pick made afterwards (only while the user has not chosen a kit). Runs once per load; later picks go through
  // `selectTelescope`.
  useEffect(() => {
    if (eyepieceState !== "ready" || !chosenTelescope || kitTouched || kitId === BUNDLED_KIT) return;
    const bundled = bundledEyepieces(chosenTelescope, eyepieceCatalogue);
    if (bundled.length > 0) applyBundled(bundled);
    // Only the chunk's arrival should trigger this; picks and kit changes are handled where they happen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eyepieceState]);

  const hasLocation = latitude.trim() !== "" && longitude.trim() !== "";

  function pickLocation(pick: LocationPick) {
    setLatitude(String(pick.latitudeDeg));
    setLongitude(String(pick.longitudeDeg));
    switch (pick.source.kind) {
      case "device":
        setSource({ kind: "device" });
        break;
      case "place":
        setSource({ kind: "place", label: pick.source.label });
        break;
      case "map":
        setSource({ kind: "map" });
        break;
      default:
        pick.source satisfies never;
    }
    setErrors((prev) => ({ ...prev, where: undefined }));
  }

  function changeManual(field: "latitude" | "longitude", value: string) {
    if (field === "latitude") setLatitude(value);
    else setLongitude(value);
    setSource({ kind: "manual" });
    setErrors((prev) => ({ ...prev, where: undefined }));
  }

  /** A generic type: clears the catalogue pick, and a "Came with" kit gives way to the supplied pair. */
  function chooseTelescope(id: TelescopePresetId) {
    const preset = telescopePreset(id);
    setTelescopeId(id);
    setChosenTelescope(null);
    setTelescopeText("");
    setTelescopeName(t.telescopes[id]);
    setAperture(String(preset.apertureMm));
    setFocalLength(String(preset.focalLengthMm));
    setErrors((prev) => ({ ...prev, telescopeName: undefined, apertureMm: undefined, focalLengthMm: undefined }));
    if (kitId === BUNDLED_KIT) applyKit(DEFAULT_EYEPIECE_KIT_ID);
  }

  /** A catalogue telescope: clears the generic radios, fills the fields and, where it applies, offers its own eyepieces. */
  function selectTelescope(entry: TelescopeEntry) {
    const fill = telescopeFill(entry);
    setTelescopeId(null);
    setChosenTelescope(entry);
    setTelescopeText(entry.name);
    setTelescopeName(fill.name);
    setAperture(fill.apertureMm);
    setFocalLength(fill.focalLengthMm);
    setErrors((prev) => ({ ...prev, telescopeName: undefined, apertureMm: undefined, focalLengthMm: undefined }));

    const bundled = bundledEyepieces(entry, eyepieceCatalogue);
    if (bundled.length > 0) {
      // Auto-selected only while the user has not picked a kit; a "Came with" kit already chosen follows the telescope.
      if (!kitTouched || kitId === BUNDLED_KIT) applyBundled(bundled);
    } else if (kitId === BUNDLED_KIT) {
      applyKit(DEFAULT_EYEPIECE_KIT_ID);
    }
  }

  function applyKit(id: EyepieceKitPresetId) {
    setKitId(id);
    setRows(kitPreset(id).eyepieces.map((eyepiece) => kitRow(eyepiece, nextRowKey.current++)));
    setErrors((prev) => ({ ...prev, eyepieces: undefined, rows: {} }));
  }

  function applyBundled(bundled: readonly EyepieceEntry[]) {
    setKitId(BUNDLED_KIT);
    setRows(bundled.map((entry) => catalogueRow(entry, nextRowKey.current++)));
    setErrors((prev) => ({ ...prev, eyepieces: undefined, rows: {} }));
  }

  function chooseKit(id: KitChoice) {
    setKitTouched(true);
    if (id === BUNDLED_KIT) applyBundled(bundledEntries);
    else applyKit(id);
  }

  function selectEyepiece(key: number, entry: EyepieceEntry) {
    const row = catalogueRow(entry, key);
    updateRow(
      key,
      {
        name: row.name,
        focalLength: row.focalLength,
        afovPreset: row.afovPreset,
        afovDeg: row.afovDeg,
        modelText: row.modelText,
      },
      ["name", "focalLengthMm", "afovPreset", "afovDeg"],
    );
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
    setRows((prev) => [...prev, { key, name: "", focalLength: "", afovPreset: "plossl", afovDeg: "", modelText: "" }]);
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
  function summaryFor(shown: WhereSource): string {
    switch (shown.kind) {
      case "device":
        return m.location.usingDevice;
      case "place":
        return m.location.usingPlace({ place: shown.label });
      case "map":
        return m.location.usingMap;
      case "manual":
        return m.location.usingCoordinates;
      default:
        shown satisfies never;
        return m.location.usingCoordinates;
    }
  }
  const whereSummary = source === null || !hasLocation ? null : summaryFor(source);

  // The "Came with" card shows only once the eyepieces chunk has loaded and the telescope's bundled ids resolve.
  const bundledEntries =
    chosenTelescope && eyepieceState === "ready" ? bundledEyepieces(chosenTelescope, eyepieceCatalogue) : [];
  const showBundled = bundledEntries.length > 0;
  const c = m.gearCatalogue;

  function telescopeDetail(entry: TelescopeEntry) {
    return c.detail.telescope({
      aperture: number.format(entry.apertureMm),
      focalLength: number.format(entry.focalLengthMm),
      ratio: number.format(entry.focalLengthMm / entry.apertureMm),
      discontinued: entry.discontinued === true,
    });
  }

  function eyepieceDetail(entry: EyepieceEntry) {
    return c.detail.eyepiece({
      focalLength: number.format(entry.focalLengthMm),
      afov: number.format(entry.afovDeg),
      estimated: entry.afovEstimated === true,
      bundled: entry.bundled === true,
      zoomMin: entry.zoom ? number.format(entry.zoom.minMm) : undefined,
      zoomMax: entry.zoom ? number.format(entry.zoom.maxMm) : undefined,
      discontinued: entry.discontinued === true,
    });
  }

  const hasErrors =
    [errors.where, errors.telescopeName, errors.apertureMm, errors.focalLengthMm, errors.eyepieces].some(Boolean) ||
    Object.values(errors.rows).some((row) => row && Object.values(row).some(Boolean));

  return (
    <form method="POST" action={action} onSubmit={handleSubmit} noValidate>
      {Object.entries(payload).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {serverError ? (
        <div role="alert" className="mb-8">
          <ServerError message={translateKey(m, serverError, "errors.generic")} />
        </div>
      ) : null}

      <div>
        {/* 1 · Where ----------------------------------------------------------------------- */}
        <Band headingId="where-heading" heading={t.where.heading}>
          <div className="flex flex-col gap-4">
            <p className={stepHint}>{t.where.hint}</p>

            <LocationPicker
              locale={locale}
              onPick={pickLocation}
              summary={whereSummary}
              invalid={Boolean(errors.where) && !manualOpen}
              errorId="where-error"
              current={parseCurrent(latitude, longitude)}
            />

            <details
              open={manualOpen}
              onToggle={(e) => {
                setManualOpen(e.currentTarget.open);
              }}
              className="group"
            >
              <summary className="text-primary-strong hover:text-heading focus-visible:outline-ring text-label inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                {t.where.manualToggle}
                {/* The open/closed cue the inline-flex summary loses with its native marker. */}
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
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
                <p className="text-muted-foreground text-sm">{m.siteForm.coordinatesHint}</p>
              </div>
            </details>

            {errors.where && !manualOpen ? (
              <div className="-mt-2">
                <FieldError id="where-error" message={errors.where} />
              </div>
            ) : null}
          </div>
        </Band>

        {/* 2 · Sky ------------------------------------------------------------------------- */}
        <Band headingId="sky-heading" heading={t.sky.heading}>
          <div className="flex flex-col gap-4">
            <p id="sky-hint" className={stepHint}>
              {t.sky.hint}
            </p>
            <fieldset aria-labelledby="sky-heading" aria-describedby="sky-hint" className="flex flex-col gap-2">
              {SKY_SCENES.map((scene) => (
                <ChoiceCard
                  key={scene.id}
                  name="skyScene"
                  value={scene.id}
                  checked={sceneId === scene.id}
                  onChange={() => {
                    setSceneId(scene.id);
                  }}
                  title={t.scenes[scene.id].title}
                  description={t.scenes[scene.id].description}
                />
              ))}
            </fieldset>
          </div>
        </Band>

        {/* 3 · Kit ------------------------------------------------------------------------- */}
        <Band headingId="kit-heading" heading={t.kit.heading}>
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-3" aria-describedby="telescope-hint">
                <legend className={groupLegend}>{t.kit.telescope}</legend>
                <p id="telescope-hint" className="text-muted-foreground text-sm">
                  {t.kit.telescopeHint}
                </p>
                <Combobox
                  id="telescope-model"
                  label={c.telescope.label}
                  placeholder={c.telescope.placeholder}
                  options={telescopeCatalogue}
                  state={telescopeState}
                  text={telescopeText}
                  onTextChange={setTelescopeText}
                  filter={searchCatalogue}
                  getKey={getTelescopeKey}
                  getLabel={getTelescopeLabel}
                  getDetail={telescopeDetail}
                  onSelect={selectTelescope}
                  hint={c.telescope.hint}
                  status={{
                    noMatch: c.telescope.noMatch,
                    loading: c.telescope.loading,
                    unavailable: c.telescope.unavailable,
                    more: (hidden) => plural(locale, hidden, c.telescope.more)({ count: number.format(hidden) }),
                    keepTyping: c.keepTyping,
                  }}
                />

                {/* The fixed types stay as the fallback for a model the catalogue lacks or the user cannot name. */}
                <details className="group">
                  <summary className="text-primary-strong hover:text-heading focus-visible:outline-ring text-label inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                    {t.kit.genericToggle}
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <fieldset className="mt-2">
                    <legend className="sr-only">{t.kit.genericToggle}</legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {TELESCOPE_PRESETS.map((preset) => (
                        <ChoiceCard
                          key={preset.id}
                          name="telescopePreset"
                          value={preset.id}
                          checked={telescopeId === preset.id}
                          onChange={() => {
                            chooseTelescope(preset.id);
                          }}
                          title={t.telescopes[preset.id]}
                          description={
                            <>
                              {m.gear.telescopes.aperture({ mm: number.format(preset.apertureMm) })} ·{" "}
                              {m.gear.telescopes.focalLength({ mm: number.format(preset.focalLengthMm) })}
                            </>
                          }
                        />
                      ))}
                    </div>
                  </fieldset>
                </details>
              </fieldset>

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

            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-3" aria-describedby="eyepieces-hint">
                <legend className={groupLegend}>{t.kit.eyepieces}</legend>
                <p id="eyepieces-hint" className="text-muted-foreground text-sm">
                  {t.kit.eyepiecesHint}
                </p>
                {/* Four cards read as two by two; the usual three sit in one row. */}
                <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-3", showBundled && "sm:grid-cols-2")}>
                  {showBundled && chosenTelescope ? (
                    <ChoiceCard
                      name="eyepieceKit"
                      value={BUNDLED_KIT}
                      checked={kitId === BUNDLED_KIT}
                      onChange={() => {
                        chooseKit(BUNDLED_KIT);
                      }}
                      title={t.kit.cameWith({ model: chosenTelescope.name })}
                      description={t.kit.bundledList({
                        sizes: bundledEntries.map((entry) => number.format(entry.focalLengthMm)),
                      })}
                    />
                  ) : null}
                  {EYEPIECE_KIT_PRESETS.map((kit) => (
                    <ChoiceCard
                      key={kit.id}
                      name="eyepieceKit"
                      value={kit.id}
                      checked={kitId === kit.id}
                      onChange={() => {
                        chooseKit(kit.id);
                      }}
                      title={t.eyepieceKits[kit.id]}
                      description={
                        kit.eyepieces.length > 0
                          ? kit.eyepieces.map((eyepiece) => eyepiece.name).join(" · ")
                          : t.kit.emptyKit
                      }
                    />
                  ))}
                </div>
              </fieldset>

              {rows.length === 0 ? <p className="text-body text-muted-foreground">{t.kit.noEyepieces}</p> : null}

              {/* Ruled rows, as the gear hub's lists: no box inside the band. */}
              <ol className="divide-border border-border flex flex-col divide-y border-y empty:hidden">
                {rows.map((row, index) => {
                  const rowErrors = errors.rows[row.key] ?? {};
                  const label = number.format(index + 1);
                  const typeId = `eyepiece-${row.key}-afovPreset`;
                  const typeErrorId = `${typeId}-error`;
                  return (
                    <li key={row.key} className="relative py-4">
                      <fieldset className="flex flex-col gap-3">
                        <legend className={cn(groupLegend, "flex min-h-11 items-center pr-12")}>
                          {t.kit.eyepieceLegend({ number: label })}
                        </legend>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive absolute top-4 -right-3"
                          aria-label={t.kit.removeEyepiece({ number: label })}
                          onClick={() => {
                            removeRow(row.key);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                        <Combobox
                          id={`eyepiece-${row.key}-model`}
                          label={c.eyepiece.label}
                          placeholder={c.eyepiece.placeholder}
                          options={eyepieceCatalogue}
                          state={eyepieceState}
                          text={row.modelText}
                          onTextChange={(v) => {
                            updateRow(row.key, { modelText: v }, []);
                          }}
                          initialLabel={row.modelText || undefined}
                          filter={searchCatalogue}
                          getKey={getEyepieceKey}
                          getLabel={getEyepieceLabel}
                          getDetail={eyepieceDetail}
                          onSelect={(entry) => {
                            selectEyepiece(row.key, entry);
                          }}
                          status={{
                            noMatch: c.eyepiece.noMatch,
                            loading: c.eyepiece.loading,
                            unavailable: c.eyepiece.unavailable,
                            more: (hidden) => plural(locale, hidden, c.eyepiece.more)({ count: number.format(hidden) }),
                            keepTyping: c.keepTyping,
                          }}
                        />
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
                            <Label htmlFor={typeId} className="mb-1.5">
                              {m.eyepieceForm.type}
                            </Label>
                            <NativeSelect
                              id={typeId}
                              name=""
                              value={row.afovPreset}
                              onChange={(e) => {
                                updateRow(row.key, { afovPreset: e.target.value as AfovPreset }, [
                                  "afovPreset",
                                  "afovDeg",
                                ]);
                              }}
                              aria-invalid={rowErrors.afovPreset ? true : undefined}
                              aria-describedby={rowErrors.afovPreset ? typeErrorId : undefined}
                            >
                              {AFOV_PRESET_OPTIONS.map((option) => (
                                <NativeSelectOption key={option} value={option}>
                                  {presetLabel(m.eyepiecePresets, option)}
                                </NativeSelectOption>
                              ))}
                            </NativeSelect>
                            <FieldError id={typeErrorId} message={rowErrors.afovPreset} />
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
                  className="w-full sm:w-auto sm:self-start"
                  disabled={rows.length >= MAX_ONBOARDING_EYEPIECES}
                  aria-describedby={rows.length >= MAX_ONBOARDING_EYEPIECES ? "eyepiece-limit" : undefined}
                  onClick={addRow}
                >
                  <Plus className="size-4" />
                  {m.gear.eyepieces.add}
                </Button>
                {rows.length >= MAX_ONBOARDING_EYEPIECES ? (
                  <p id="eyepiece-limit" className="text-muted-foreground text-sm">
                    {t.kit.eyepieceLimit}
                  </p>
                ) : null}
                {errors.eyepieces ? <FieldError message={errors.eyepieces} /> : null}
              </div>
            </div>
          </div>
        </Band>
      </div>

      {/* The one primary action, ruled off from the last band. */}
      <div className="border-border mt-8 flex flex-col gap-3 border-t pt-8">
        {showSummary && hasErrors ? (
          <div role="alert">
            <ServerError message={m.errors.checkFields} />
          </div>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={!hasLocation || submitting}
          aria-describedby={hasLocation ? undefined : "location-required"}
        >
          {submitting ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
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
