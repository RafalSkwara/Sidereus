import React, { useState, useSyncExternalStore } from "react";
import { MapPin, Save } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { ServerError } from "@/components/forms/ServerError";
import { SubmitButton } from "@/components/forms/SubmitButton";
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
  serverError?: string | null;
}

type FieldName = "name" | "latitudeDeg" | "longitudeDeg" | "bortle" | "minAltitudeDeg" | "timeZone";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly string[] = ["name", "latitudeDeg", "longitudeDeg", "bortle", "minAltitudeDeg", "timeZone"];

const BORTLE_LABELS: Record<number, string> = {
  1: "Excellent dark site",
  2: "Truly dark site",
  3: "Rural sky",
  4: "Rural to suburban",
  5: "Suburban sky",
  6: "Bright suburban sky",
  7: "Suburban to city",
  8: "City sky",
  9: "Inner-city sky",
};

const selectBase =
  "w-full rounded-lg border bg-white/10 px-3 py-2 text-white focus:ring-2 focus:outline-none transition-colors [&>option]:bg-slate-900";

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
  return <p className="mt-1 text-xs text-red-300">{message}</p>;
}

export default function SiteForm({ action, initial, serverError }: Props) {
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
    initial?.timeZoneSource === "auto" ? `Automatic, currently ${initial.timeZone}` : "Automatic (from coordinates)";
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
          next[field as FieldName] ??= issue.message;
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
        label="Name"
        value={name}
        onChange={(v) => {
          setName(v);
          clearError("name");
        }}
        placeholder="Back garden"
        error={errors.name}
        icon={<MapPin className="size-4" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id="latitudeDeg"
          label="Latitude (°)"
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
          label="Longitude (°)"
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
      <p className="-mt-2 text-xs text-blue-100/50">
        Coordinates are rounded to 2 decimals (about 1 km) when saved. North and east are positive.
      </p>

      <div>
        <label htmlFor="bortle" className="mb-1 block text-sm text-blue-100/80">
          Sky darkness (Bortle class)
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
            errors.bortle ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400",
          )}
        >
          <option value="" disabled>
            Choose a class
          </option>
          {Object.entries(BORTLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {value} · {label}
            </option>
          ))}
        </select>
        <FieldError message={errors.bortle} />
      </div>

      <FormField
        id="minAltitudeDeg"
        label="Minimum altitude (°)"
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
        hint={
          <p className="mt-1 text-xs text-blue-100/50">
            Objects lower than this, e.g. behind trees or roofs, are skipped.
          </p>
        }
      />

      <div>
        <label htmlFor="timeZone" className="mb-1 block text-sm text-blue-100/80">
          Time zone
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
            errors.timeZone ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400",
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

      <ServerError message={serverError} />

      <SubmitButton pendingText="Saving..." icon={<Save className="size-4" />}>
        Save site
      </SubmitButton>
    </form>
  );
}
