import React, { useState } from "react";
import { Eye, Save } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { ServerError } from "@/components/forms/ServerError";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { eyepieceInputSchema } from "@/lib/gear/schemas";
import { AFOV_PRESET_OPTIONS, EYEPIECE_PRESETS, presetForAfov, type AfovPreset } from "@/lib/gear/eyepiece-presets";
import { cn } from "@/lib/utils";

/** Stored values used to prefill the edit form. Only the AFOV is stored; the type is derived from it. */
export interface EyepieceFormValues {
  name: string;
  focalLengthMm: number;
  afovDeg: number;
}

interface Props {
  action: string;
  initial?: EyepieceFormValues;
  serverError?: string | null;
}

type FieldName = "name" | "focalLengthMm" | "afovPreset" | "afovDeg";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly string[] = ["name", "focalLengthMm", "afovPreset", "afovDeg"];

const selectBase =
  "w-full rounded-lg border bg-white/10 px-3 py-2 text-white focus:ring-2 focus:outline-none transition-colors [&>option]:bg-slate-900";

function presetLabel(option: AfovPreset): string {
  return option === "other" ? "Other (enter the AFOV)" : EYEPIECE_PRESETS[option].label;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-300">{message}</p>;
}

export default function EyepieceForm({ action, initial, serverError }: Props) {
  const initialPreset = initial ? presetForAfov(initial.afovDeg) : "";
  const [name, setName] = useState(initial?.name ?? "");
  const [focalLength, setFocalLength] = useState(initial ? String(initial.focalLengthMm) : "");
  // "" means nothing chosen yet (new eyepiece).
  const [preset, setPreset] = useState<AfovPreset | "">(initialPreset);
  const [afov, setAfov] = useState(initial && initialPreset === "other" ? String(initial.afovDeg) : "");
  const [errors, setErrors] = useState<FieldErrors>({});

  const isOther = preset === "other";

  function validate() {
    const result = eyepieceInputSchema.safeParse({
      name,
      focalLengthMm: focalLength,
      afovPreset: preset,
      afovDeg: afov,
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
        placeholder="25 mm Plössl"
        error={errors.name}
        icon={<Eye className="size-4" />}
      />

      <FormField
        id="focalLengthMm"
        label="Focal length (mm)"
        type="number"
        step={0.1}
        min={2}
        max={60}
        inputMode="decimal"
        value={focalLength}
        onChange={(v) => {
          setFocalLength(v);
          clearError("focalLengthMm");
        }}
        placeholder="25"
        error={errors.focalLengthMm}
      />

      <div>
        <label htmlFor="afovPreset" className="mb-1 block text-sm text-blue-100/80">
          Eyepiece type
        </label>
        <select
          id="afovPreset"
          name="afovPreset"
          value={preset}
          onChange={(e) => {
            setPreset(e.target.value as AfovPreset);
            clearError("afovPreset");
            clearError("afovDeg");
          }}
          className={cn(
            selectBase,
            errors.afovPreset ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400",
          )}
        >
          <option value="" disabled>
            Choose a type
          </option>
          {AFOV_PRESET_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {presetLabel(option)}
            </option>
          ))}
        </select>
        {errors.afovPreset ? (
          <FieldError message={errors.afovPreset} />
        ) : (
          <p className="mt-1 text-xs text-blue-100/50">
            The type sets the apparent field of view. Check the eyepiece barrel or its box if unsure.
          </p>
        )}
      </div>

      {isOther ? (
        <FormField
          id="afovDeg"
          label="Apparent field of view (°)"
          type="number"
          step={1}
          min={30}
          max={120}
          inputMode="numeric"
          value={afov}
          onChange={(v) => {
            setAfov(v);
            clearError("afovDeg");
          }}
          placeholder="100"
          error={errors.afovDeg}
        />
      ) : null}

      <ServerError message={serverError} />

      <SubmitButton pendingText="Saving..." icon={<Save className="size-4" />}>
        Save eyepiece
      </SubmitButton>
    </form>
  );
}
