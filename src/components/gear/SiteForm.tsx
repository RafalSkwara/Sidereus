import React, { useState, useSyncExternalStore } from "react";
import { MapPin, Save } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
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

  const zones = useSyncExternalStore(subscribeNever, getBrowserZones, () => null);
  const zoneOptions = zones ? [...zones] : [];
  if (zone !== "" && !zoneOptions.includes(zone)) {
    zoneOptions.unshift(zone);
  }

  const autoLabel =
    initial?.timeZoneSource === "auto" ? t.autoCurrent({ zone: initial.timeZone }) : t.autoFromCoordinates;
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
            clearError("longitudeDeg");
          }}
          placeholder="21.01"
          error={errors.longitudeDeg}
        />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">{t.coordinatesHint}</p>

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
