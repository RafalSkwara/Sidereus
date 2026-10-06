import React, { useEffect, useMemo, useState } from "react";
import { Eye, Save } from "lucide-react";
import { Combobox } from "@/components/forms/Combobox";
import { FieldError, FormField } from "@/components/forms/FormField";
import { ServerError } from "@/components/forms/ServerError";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getMessages, plural, translateKey, type Messages } from "@/i18n";
import type { Locale } from "@/lib/preferences";
import { eyepieceFill } from "@/lib/gear/catalogue/fill";
import { loadEyepieces } from "@/lib/gear/catalogue/load";
import { searchCatalogue } from "@/lib/gear/catalogue/search";
import type { EyepieceEntry } from "@/lib/gear/catalogue/types";
import { eyepieceInputSchema } from "@/lib/gear/schemas";
import { AFOV_PRESET_OPTIONS, presetForAfov, type AfovPreset } from "@/lib/gear/eyepiece-presets";

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

function presetLabel(presets: Messages["eyepiecePresets"], option: AfovPreset): string {
  return option === "other" ? presets.other : presets[option].long;
}

const getKey = (entry: EyepieceEntry) => entry.id;
const getLabel = (entry: EyepieceEntry) => entry.name;

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
  // The catalogue loads after mount, in its own chunk; until then (or if it fails) the fields below work on their own.
  const [catalogue, setCatalogue] = useState<readonly EyepieceEntry[]>([]);
  const [catalogueState, setCatalogueState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [catalogueText, setCatalogueText] = useState("");
  const c = m.gearCatalogue;
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);

  useEffect(() => {
    let cancelled = false;
    loadEyepieces().then(
      (entries) => {
        if (cancelled) return;
        setCatalogue(entries);
        setCatalogueState("ready");
      },
      () => {
        if (!cancelled) setCatalogueState("unavailable");
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  function detail(entry: EyepieceEntry) {
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

  function select(entry: EyepieceEntry) {
    const fill = eyepieceFill(entry);
    setName(fill.name);
    setFocalLength(fill.focalLengthMm);
    setPreset(fill.afovPreset);
    // The exact degrees show only for "other"; a named preset carries its own.
    setAfov(fill.afovPreset === "other" ? fill.afovDeg : "");
    setCatalogueText(entry.name);
    setErrors((prev) => ({
      ...prev,
      name: undefined,
      focalLengthMm: undefined,
      afovPreset: undefined,
      afovDeg: undefined,
    }));
  }

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
      <Combobox
        id="catalogue"
        label={c.eyepiece.label}
        placeholder={c.eyepiece.placeholder}
        options={catalogue}
        state={catalogueState}
        text={catalogueText}
        onTextChange={setCatalogueText}
        filter={searchCatalogue}
        getKey={getKey}
        getLabel={getLabel}
        getDetail={detail}
        onSelect={select}
        hint={c.eyepiece.hint}
        status={{
          noMatch: c.eyepiece.noMatch,
          loading: c.eyepiece.loading,
          unavailable: c.eyepiece.unavailable,
          more: (hidden) => plural(locale, hidden, c.eyepiece.more)({ count: number.format(hidden) }),
          keepTyping: c.keepTyping,
        }}
      />

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
        <Label htmlFor="afovPreset" className="mb-1.5">
          {t.type}
        </Label>
        <NativeSelect
          id="afovPreset"
          name="afovPreset"
          value={preset}
          onChange={(e) => {
            setPreset(e.target.value as AfovPreset);
            clearError("afovPreset");
            clearError("afovDeg");
          }}
          aria-invalid={errors.afovPreset ? true : undefined}
          aria-describedby={errors.afovPreset ? "afovPreset-error" : "afovPreset-hint"}
        >
          <NativeSelectOption value="" disabled>
            {t.chooseType}
          </NativeSelectOption>
          {AFOV_PRESET_OPTIONS.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {presetLabel(m.eyepiecePresets, option)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {errors.afovPreset ? (
          <FieldError id="afovPreset-error" message={errors.afovPreset} />
        ) : (
          <p id="afovPreset-hint" className="text-muted-foreground mt-1.5 text-sm">
            {t.typeHint}
          </p>
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
