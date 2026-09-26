import React, { useState } from "react";
import { Eye, Save } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { ServerError } from "@/components/forms/ServerError";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { getMessages, translateKey, type Messages } from "@/i18n";
import type { Locale } from "@/lib/preferences";
import { eyepieceInputSchema } from "@/lib/gear/schemas";
import { AFOV_PRESET_OPTIONS, presetForAfov, type AfovPreset } from "@/lib/gear/eyepiece-presets";
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
  /** A message key from `?error=`; translated here, unknown values read as the generic message. */
  serverError?: string | null;
  locale: Locale;
}

type FieldName = "name" | "focalLengthMm" | "afovPreset" | "afovDeg";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly string[] = ["name", "focalLengthMm", "afovPreset", "afovDeg"];

const selectBase =
  "w-full rounded-lg border bg-surface px-3 py-2 text-foreground outline-none transition-shadow focus-visible:ring-[3px]";

function presetLabel(presets: Messages["eyepiecePresets"], option: AfovPreset): string {
  return option === "other" ? presets.other : presets[option].long;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive mt-1 text-xs">{message}</p>;
}

export default function EyepieceForm({ action, initial, serverError, locale }: Props) {
  const m = getMessages(locale);
  const t = m.eyepieceForm;
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
        icon={<Eye className="size-4" />}
      />

      <FormField
        id="focalLengthMm"
        label={m.common.focalLengthMm}
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
        <label htmlFor="afovPreset" className="text-heading mb-1 block text-sm font-semibold">
          {t.type}
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
            errors.afovPreset
              ? "border-destructive focus-visible:ring-destructive/20"
              : "border-input focus-visible:border-ring focus-visible:ring-ring/50",
          )}
        >
          <option value="" disabled>
            {t.chooseType}
          </option>
          {AFOV_PRESET_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {presetLabel(m.eyepiecePresets, option)}
            </option>
          ))}
        </select>
        {errors.afovPreset ? (
          <FieldError message={errors.afovPreset} />
        ) : (
          <p className="text-muted-foreground mt-1 text-xs">{t.typeHint}</p>
        )}
      </div>

      {isOther ? (
        <FormField
          id="afovDeg"
          label={t.afov}
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

      <ServerError message={serverError ? translateKey(m, serverError, "errors.generic") : null} />

      <SubmitButton pendingText={m.common.saving} icon={<Save className="size-4" />}>
        {t.submit}
      </SubmitButton>
    </form>
  );
}
