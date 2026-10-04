import React, { useState, useSyncExternalStore } from "react";
import { MapPin, Save } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import LocationPicker, { type LocationPick } from "@/components/location/LocationPicker";
import { ServerError } from "@/components/forms/ServerError";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { getMessages, translateKey } from "@/i18n";
import type { Locale } from "@/lib/preferences";
import { SITE_FORM_DEFAULTS, siteInputSchema } from "@/lib/gear/schemas";
import { cn } from "@/lib/utils";

/** Stored values used to prefill the edit form. */
export interface SiteFormValues {
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
  bortle: number;
  minAltitudeDeg: number;
  timeZone: string;
  timeZoneSource: "auto" | "manual";
}

interface Props {
  action: string;
  initial?: SiteFormValues;
  /** A message key from `?error=`; translated here, unknown values read as the generic message. */
  serverError?: string | null;
  locale: Locale;
}

/** How the shown coordinates were last set; `null` means as loaded (or restored by Undo). */
type CoordinateSource = { kind: "device" } | { kind: "place"; label: string } | { kind: "manual" } | null;

type FieldName = "name" | "latitudeDeg" | "longitudeDeg" | "bortle" | "minAltitudeDeg" | "timeZone";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly string[] = ["name", "latitudeDeg", "longitudeDeg", "bortle", "minAltitudeDeg", "timeZone"];

const BORTLE_CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const selectBase =
  "w-full rounded-lg border bg-surface px-3 py-2 text-foreground outline-none transition-shadow focus-visible:ring-[3px]";

/*
 * The browser's zone list is read after hydration only (the server snapshot is `null`), so the
 * server-rendered markup and the first client render match.
 */
let browserZones: readonly string[] | undefined;
function getBrowserZones(): readonly string[] {
  browserZones ??= typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return browserZones;
}
function subscribeNever() {
  return () => undefined;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive mt-1 text-xs">{message}</p>;
}

export default function SiteForm({ action, initial, serverError, locale }: Props) {
  const m = getMessages(locale);
  const t = m.siteForm;
  const [name, setName] = useState(initial?.name ?? "");
  const [latitude, setLatitude] = useState(initial ? String(initial.latitudeDeg) : "");
  const [longitude, setLongitude] = useState(initial ? String(initial.longitudeDeg) : "");
  const [bortle, setBortle] = useState(initial ? String(initial.bortle) : "");
  const [minAltitude, setMinAltitude] = useState(String(initial?.minAltitudeDeg ?? SITE_FORM_DEFAULTS.minAltitudeDeg));
  // "" stands for automatic mode; any other value is a pinned IANA zone.
  const [zone, setZone] = useState(initial?.timeZoneSource === "manual" ? initial.timeZone : "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [source, setSource] = useState<CoordinateSource>(null);
  // Set by any pick since the page loaded (Undo resets it): keeps the Undo note through a hand-tweak after a pick.
  const [pickerUsed, setPickerUsed] = useState(false);

  const zones = useSyncExternalStore(subscribeNever, getBrowserZones, () => null);
  const zoneOptions = zones ? [...zones] : [];
  if (zone !== "" && !zoneOptions.includes(zone)) {
    zoneOptions.unshift(zone);
  }

  // Edit only: the shown coordinates are no longer the saved ones (picked or typed).
  const coordinatesMoved =
    initial !== undefined && (Number(latitude) !== initial.latitudeDeg || Number(longitude) !== initial.longitudeDeg);
  // The saved zone describes the saved location only; a moved site gets its zone on save.
  const autoLabel =
    initial?.timeZoneSource === "auto" && !coordinatesMoved
      ? t.autoCurrent({ zone: initial.timeZone })
      : t.autoFromCoordinates;
  const timeZoneMode = zone === "" ? "auto" : "manual";

  function validate() {
    const result = siteInputSchema.safeParse({
      name,
      latitudeDeg: latitude,
      longitudeDeg: longitude,
      bortle,
      minAltitudeDeg: minAltitude,
      timeZoneMode,
      timeZone: zone,
    });
    const next: FieldErrors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && FIELD_NAMES.includes(field)) {
          next[field as FieldName] ??= translateKey(m, issue.message, "errors.checkFields");
        }
      }
    }
    setErrors(next);
    return result.success;
  }

  function clearError(field: FieldName) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function clearErrors(...fields: FieldName[]) {
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of fields) next[field] = undefined;
      return next;
    });
  }

  function pickLocation(pick: LocationPick) {
    setLatitude(String(pick.latitudeDeg));
    setLongitude(String(pick.longitudeDeg));
    setPickerUsed(true);
    const cleared: FieldName[] = ["latitudeDeg", "longitudeDeg"];
    if (pick.source.kind === "place") {
      setSource({ kind: "place", label: pick.source.label });
      // A picked town names an unnamed site; a name the user typed is never replaced.
      if (name.trim() === "") {
        setName(pick.source.name);
        cleared.push("name");
      }
    } else {
      setSource({ kind: "device" });
    }
    clearErrors(...cleared);
  }

  function undoLocation() {
    if (!initial) return;
    setLatitude(String(initial.latitudeDeg));
    setLongitude(String(initial.longitudeDeg));
    setSource(null);
    setPickerUsed(false);
    clearErrors("latitudeDeg", "longitudeDeg");
    document.getElementById("latitudeDeg")?.focus();
  }

  const locationSummary =
    source?.kind === "device"
      ? m.location.usingDevice
      : source?.kind === "place"
        ? m.location.usingPlace({ place: source.label })
        : null;

  // Edit only: a pick replaced the saved location, so offer the way back until Save.
  const showUndo = initial !== undefined && pickerUsed && coordinatesMoved;
  const coordinate = new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 2 });

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
    }
  }

  return (
    <form method="POST" action={action} className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="name"
        label={m.common.name}
        value={name}
        onChange={(v) => {
          setName(v);
          clearError("name");
        }}
        placeholder={t.namePlaceholder}
        error={errors.name}
        icon={<MapPin className="size-4" />}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="text-heading mb-3 text-sm font-semibold">{t.location}</legend>
        <LocationPicker locale={locale} onPick={pickLocation} summary={locationSummary} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            id="latitudeDeg"
            label={t.latitude}
            type="number"
            step={0.01}
            min={-90}
            max={90}
            inputMode="decimal"
            value={latitude}
            onChange={(v) => {
              setLatitude(v);
              setSource({ kind: "manual" });
              clearError("latitudeDeg");
            }}
            placeholder="52.23"
            error={errors.latitudeDeg}
          />
          <FormField
            id="longitudeDeg"
            label={t.longitude}
            type="number"
            step={0.01}
            min={-180}
            max={180}
            inputMode="decimal"
            value={longitude}
            onChange={(v) => {
              setLongitude(v);
              setSource({ kind: "manual" });
              clearError("longitudeDeg");
            }}
            placeholder="21.01"
            error={errors.longitudeDeg}
          />
        </div>
        <div className="-mt-2">
          <p className="text-muted-foreground text-xs">{t.coordinatesHint}</p>
          {/* Always rendered, so screen readers announce the Undo line when it fills in. */}
          <p
            role="status"
            className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 text-sm empty:mt-0"
          >
            {showUndo ? (
              <>
                {t.previousLocation({
                  latitude: coordinate.format(initial.latitudeDeg),
                  longitude: coordinate.format(initial.longitudeDeg),
                })}
                <button
                  type="button"
                  onClick={undoLocation}
                  className="text-primary-strong hover:text-heading focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-md font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]"
                >
                  {t.undoLocation}
                </button>
              </>
            ) : null}
          </p>
        </div>
      </fieldset>

      <div>
        <label htmlFor="bortle" className="text-heading mb-1 block text-sm font-semibold">
          {t.bortle}
        </label>
        <select
          id="bortle"
          name="bortle"
          value={bortle}
          onChange={(e) => {
            setBortle(e.target.value);
            clearError("bortle");
          }}
          className={cn(
            selectBase,
            errors.bortle
              ? "border-destructive focus-visible:ring-destructive/20"
              : "border-input focus-visible:border-ring focus-visible:ring-ring/50",
          )}
        >
          <option value="" disabled>
            {t.chooseBortle}
          </option>
          {BORTLE_CLASSES.map((value) => (
            <option key={value} value={value}>
              {t.bortleOption({ value: String(value), label: t.bortleLabels[value] })}
            </option>
          ))}
        </select>
        <FieldError message={errors.bortle} />
      </div>

      <FormField
        id="minAltitudeDeg"
        label={t.minAltitude}
        type="number"
        step={1}
        min={0}
        max={60}
        inputMode="numeric"
        value={minAltitude}
        onChange={(v) => {
          setMinAltitude(v);
          clearError("minAltitudeDeg");
        }}
        error={errors.minAltitudeDeg}
        hint={<p className="text-muted-foreground mt-1 text-xs">{t.minAltitudeHint}</p>}
      />

      <div>
        <label htmlFor="timeZone" className="text-heading mb-1 block text-sm font-semibold">
          {t.timeZone}
        </label>
        <input type="hidden" name="timeZoneMode" value={timeZoneMode} />
        <select
          id="timeZone"
          name="timeZone"
          value={zone}
          onChange={(e) => {
            setZone(e.target.value);
            clearError("timeZone");
          }}
          className={cn(
            selectBase,
            errors.timeZone
              ? "border-destructive focus-visible:ring-destructive/20"
              : "border-input focus-visible:border-ring focus-visible:ring-ring/50",
          )}
        >
          <option value="">{autoLabel}</option>
          {zoneOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <FieldError message={errors.timeZone} />
      </div>

      <ServerError message={serverError ? translateKey(m, serverError, "errors.generic") : null} />

      <SubmitButton pendingText={m.common.saving} icon={<Save className="size-4" />}>
        {t.submit}
      </SubmitButton>
    </form>
  );
}
