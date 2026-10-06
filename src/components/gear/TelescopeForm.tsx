import React, { useEffect, useMemo, useState } from "react";
import { Save, Telescope } from "lucide-react";
import { Combobox } from "@/components/forms/Combobox";
import { FormField } from "@/components/forms/FormField";
import { ServerError } from "@/components/forms/ServerError";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { getMessages, plural, translateKey } from "@/i18n";
import type { Locale } from "@/lib/preferences";
import { telescopeFill } from "@/lib/gear/catalogue/fill";
import { loadTelescopes } from "@/lib/gear/catalogue/load";
import { searchCatalogue } from "@/lib/gear/catalogue/search";
import type { TelescopeEntry } from "@/lib/gear/catalogue/types";
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
  /** A message key from `?error=`; translated here, unknown values read as the generic message. */
  serverError?: string | null;
  locale: Locale;
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

const getKey = (entry: TelescopeEntry) => entry.id;
const getLabel = (entry: TelescopeEntry) => entry.name;

export default function TelescopeForm({ action, initial, serverError, locale }: Props) {
  const m = getMessages(locale);
  const t = m.telescopeForm;
  const [name, setName] = useState(initial?.name ?? "");
  const [aperture, setAperture] = useState(initial ? String(initial.apertureMm) : "");
  const [focalLength, setFocalLength] = useState(initial ? String(initial.focalLengthMm) : "");
  const [errors, setErrors] = useState<FieldErrors>({});
  // The catalogue loads after mount, in its own chunk; until then (or if it fails) the fields below work on their own.
  const [catalogue, setCatalogue] = useState<readonly TelescopeEntry[]>([]);
  const [catalogueState, setCatalogueState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [catalogueText, setCatalogueText] = useState("");
  const c = m.gearCatalogue;
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);

  useEffect(() => {
    let cancelled = false;
    loadTelescopes().then(
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

  function detail(entry: TelescopeEntry) {
    return c.detail.telescope({
      aperture: number.format(entry.apertureMm),
      focalLength: number.format(entry.focalLengthMm),
      ratio: number.format(entry.focalLengthMm / entry.apertureMm),
      discontinued: entry.discontinued === true,
    });
  }

  function select(entry: TelescopeEntry) {
    const fill = telescopeFill(entry);
    setName(fill.name);
    setAperture(fill.apertureMm);
    setFocalLength(fill.focalLengthMm);
    setCatalogueText(entry.name);
    setErrors((prev) => ({ ...prev, name: undefined, apertureMm: undefined, focalLengthMm: undefined }));
  }

  const ratio = focalRatio(aperture, focalLength);

  function validate() {
    const result = telescopeInputSchema.safeParse({ name, apertureMm: aperture, focalLengthMm: focalLength });
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
        label={c.telescope.label}
        placeholder={c.telescope.placeholder}
        options={catalogue}
        state={catalogueState}
        text={catalogueText}
        onTextChange={setCatalogueText}
        filter={searchCatalogue}
        getKey={getKey}
        getLabel={getLabel}
        getDetail={detail}
        onSelect={select}
        hint={c.telescope.hint}
        status={{
          noMatch: c.telescope.noMatch,
          loading: c.telescope.loading,
          unavailable: c.telescope.unavailable,
          more: (hidden) => plural(locale, hidden, c.telescope.more)({ count: number.format(hidden) }),
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
        icon={<Telescope className="size-4" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          id="apertureMm"
          label={t.aperture}
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
          label={m.common.focalLengthMm}
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
        <p className="text-heading mb-1 block text-sm font-semibold">{t.focalRatio}</p>
        <p
          aria-live="polite"
          className="border-border bg-background text-foreground w-full rounded-lg border px-3 py-2 font-mono tabular-nums"
        >
          {ratio ? `f/${ratio}` : "-"}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">{t.focalRatioHint}</p>
      </div>

      <ServerError message={serverError ? translateKey(m, serverError, "errors.generic") : null} />

      <SubmitButton pendingText={m.common.saving} icon={<Save className="size-4" />}>
        {t.submit}
      </SubmitButton>
    </form>
  );
}
