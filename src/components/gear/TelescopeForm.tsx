import React, { useState } from "react";
import { Save, Telescope } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { ServerError } from "@/components/forms/ServerError";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { telescopeInputSchema } from "@/lib/gear/schemas";

/** Stored values used to prefill the edit form. */
export interface TelescopeFormValues {
  name: string;
  apertureMm: number;
  focalLengthMm: number;
}

interface Props {
  action: string;
  initial?: TelescopeFormValues;
  serverError?: string | null;
}

type FieldName = "name" | "apertureMm" | "focalLengthMm";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly string[] = ["name", "apertureMm", "focalLengthMm"];

/** f/ratio = focal length ÷ aperture, or `null` while either value is missing or not positive. */
function focalRatio(aperture: string, focalLength: string): string | null {
  if (aperture.trim() === "" || focalLength.trim() === "") return null;
  const a = Number(aperture);
  const f = Number(focalLength);
  if (!Number.isFinite(a) || !Number.isFinite(f) || a <= 0 || f <= 0) return null;
  return (f / a).toFixed(1).replace(/\.0$/, "");
}

export default function TelescopeForm({ action, initial, serverError }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [aperture, setAperture] = useState(initial ? String(initial.apertureMm) : "");
  const [focalLength, setFocalLength] = useState(initial ? String(initial.focalLengthMm) : "");
  const [errors, setErrors] = useState<FieldErrors>({});

  const ratio = focalRatio(aperture, focalLength);

  function validate() {
    const result = telescopeInputSchema.safeParse({ name, apertureMm: aperture, focalLengthMm: focalLength });
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
        placeholder="130 mm Newtonian"
        error={errors.name}
        icon={<Telescope className="size-4" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id="apertureMm"
          label="Aperture (mm)"
          type="number"
          step={1}
          min={20}
          max={1000}
          inputMode="decimal"
          value={aperture}
          onChange={(v) => {
            setAperture(v);
            clearError("apertureMm");
          }}
          placeholder="130"
          error={errors.apertureMm}
        />
        <FormField
          id="focalLengthMm"
          label="Focal length (mm)"
          type="number"
          step={1}
          min={100}
          max={5000}
          inputMode="decimal"
          value={focalLength}
          onChange={(v) => {
            setFocalLength(v);
            clearError("focalLengthMm");
          }}
          placeholder="650"
          error={errors.focalLengthMm}
        />
      </div>

      <div>
        <p className="mb-1 block text-sm text-blue-100/80">Focal ratio</p>
        <p
          aria-live="polite"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/80 tabular-nums"
        >
          {ratio ? `f/${ratio}` : "-"}
        </p>
        <p className="mt-1 text-xs text-blue-100/50">
          Focal length ÷ aperture, a quick check that both numbers are right. Not saved.
        </p>
      </div>

      <ServerError message={serverError} />

      <SubmitButton pendingText="Saving..." icon={<Save className="size-4" />}>
        Save telescope
      </SubmitButton>
    </form>
  );
}
