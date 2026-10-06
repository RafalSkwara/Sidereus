import React, { useState } from "react";
import { CalendarDays, Save } from "lucide-react";
import { FieldError, FormField } from "@/components/forms/FormField";
import { ServerError } from "@/components/forms/ServerError";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { getMessages, translateKey } from "@/i18n";
import type { Locale } from "@/lib/preferences";
import type { TargetOption } from "@/lib/observations/target-search";
import {
  MIN_NIGHT,
  observationInputSchema,
  observationUpdateSchema,
  type ReturnTarget,
} from "@/lib/observations/schemas";
import type { TargetKey } from "@/lib/targets";
import { cn } from "@/lib/utils";
import { TargetPicker } from "./TargetPicker";

interface GearOption {
  id: string;
  name: string;
}

/**
 * `ranking`: the object is fixed by Tonight's "Mark observed" (S-06). `manual`: any object, chosen in the picker,
 * and the save returns to the log (S-07, FR-022). `edit`: an existing entry, every field editable (S-07, FR-017).
 */
export type ObservationFormMode = "ranking" | "manual" | "edit";

interface Props {
  action: string;
  mode: ObservationFormMode;
  /**
   * The prefill: from the ranking its object, night, site and telescope (FR-016); for manual entry an optional
   * object and the likeliest night. The rating always starts empty.
   */
  initial: { target?: TargetKey; night: string; siteId: string; telescopeId: string; rating?: number };
  /** Every target (Messier and Caldwell objects, the Moon, then planets) for the picker; required in `manual` and `edit` modes. */
  targetOptions?: readonly TargetOption[];
  /**
   * `edit` only: the name snapshot of the entry's site or telescope when that gear has been deleted since (FR-021).
   * The select then offers it as an empty value, meaning "keep it", and `initial` selects it with an empty id.
   */
  deletedSite?: string;
  deletedTelescope?: string;
  sites: readonly GearOption[];
  telescopes: readonly GearOption[];
  /**
   * The latest night any of the user's sites has reached; the server checks the chosen site's own
   * night, so this only keeps the date picker from offering nights that are certainly in the future.
   */
  maxNight: string;
  /** A message key from `?error=`; translated here, unknown values read as the generic message. */
  serverError?: string | null;
  /**
   * Where the save returns (`returnTargetSchema`), posted as `from`: the focused Tonight page whose "Mark observed"
   * linked here (tonight-dashboard), or `log` for manual entry, which `manual` mode posts on its own.
   */
  returnTo?: ReturnTarget;
  locale: Locale;
}

type FieldName = "target" | "night" | "rating" | "siteId" | "telescopeId";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly string[] = ["target", "night", "rating", "siteId", "telescopeId"];
const RATINGS = [1, 2, 3, 4, 5] as const;

// The rating scale as a row of radio "keys": the shared --ring outline on focus, the selected fill once chosen
// (as a pressed sky answer, SkyAnswerForm). Forced colors flatten the fill, so there the checked key keeps a
// thick border and an underlined number instead.
const ratingOption = cn(
  "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface font-mono text-body font-semibold text-heading transition-colors",
  "hover:bg-accent has-[:checked]:border-selected has-[:checked]:bg-selected has-[:checked]:text-selected-foreground has-[:checked]:hover:bg-selected",
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
  "forced-colors:has-[:checked]:border-4 forced-colors:has-[:checked]:underline forced-colors:has-[:checked]:decoration-2 forced-colors:has-[:checked]:underline-offset-4",
);

export default function ObservationForm({
  action,
  mode,
  initial,
  targetOptions = [],
  deletedSite,
  deletedTelescope,
  sites,
  telescopes,
  maxNight,
  serverError,
  returnTo,
  locale,
}: Props) {
  const m = getMessages(locale);
  const t = m.log;
  const [target, setTarget] = useState<string>(initial.target ?? "");
  const [night, setNight] = useState(initial.night);
  const [siteId, setSiteId] = useState(initial.siteId);
  const [telescopeId, setTelescopeId] = useState(initial.telescopeId);
  const [rating, setRating] = useState(initial.rating === undefined ? "" : String(initial.rating));
  const [errors, setErrors] = useState<FieldErrors>({});
  const from = returnTo ?? (mode === "manual" ? "log" : undefined);

  function validate() {
    const schema = mode === "edit" ? observationUpdateSchema : observationInputSchema;
    const result = schema.safeParse({ target, night, rating, siteId, telescopeId });
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
    <form method="POST" action={action} className="space-y-5" onSubmit={handleSubmit} noValidate>
      {from && <input type="hidden" name="from" value={from} />}
      {mode === "ranking" ? (
        <input type="hidden" name="target" value={target} />
      ) : (
        <TargetPicker
          id="target"
          options={targetOptions}
          initial={initial.target}
          label={t.picker.label}
          placeholder={t.picker.placeholder}
          noMatch={t.picker.noMatch}
          error={errors.target}
          onChange={(value) => {
            setTarget(value ?? "");
            clearError("target");
          }}
        />
      )}

      <FormField
        id="night"
        label={t.night}
        type="date"
        min={MIN_NIGHT}
        max={maxNight}
        value={night}
        onChange={(v) => {
          setNight(v);
          clearError("night");
        }}
        error={errors.night}
        icon={<CalendarDays className="size-4" />}
        hint={<p className="text-muted-foreground mt-1.5 text-sm">{t.nightHint}</p>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="siteId" className="mb-1.5">
            {t.site}
          </Label>
          <NativeSelect
            id="siteId"
            name="siteId"
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              clearError("siteId");
            }}
            aria-invalid={errors.siteId ? true : undefined}
            aria-describedby={errors.siteId ? "siteId-error" : undefined}
          >
            {deletedSite !== undefined && (
              <NativeSelectOption value="">{t.list.deletedGear({ name: deletedSite })}</NativeSelectOption>
            )}
            {sites.map((site) => (
              <NativeSelectOption key={site.id} value={site.id}>
                {site.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError id="siteId-error" message={errors.siteId} />
        </div>
        <div>
          <Label htmlFor="telescopeId" className="mb-1.5">
            {t.telescope}
          </Label>
          <NativeSelect
            id="telescopeId"
            name="telescopeId"
            value={telescopeId}
            onChange={(e) => {
              setTelescopeId(e.target.value);
              clearError("telescopeId");
            }}
            aria-invalid={errors.telescopeId ? true : undefined}
            aria-describedby={errors.telescopeId ? "telescopeId-error" : undefined}
          >
            {deletedTelescope !== undefined && (
              <NativeSelectOption value="">{t.list.deletedGear({ name: deletedTelescope })}</NativeSelectOption>
            )}
            {telescopes.map((telescope) => (
              <NativeSelectOption key={telescope.id} value={telescope.id}>
                {telescope.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <FieldError id="telescopeId-error" message={errors.telescopeId} />
        </div>
      </div>

      <fieldset aria-describedby={cn("rating-low rating-high rating-hint", errors.rating && "rating-error")}>
        <legend className="text-label text-heading mb-2 font-semibold">{t.rating}</legend>
        <div className="flex gap-2">
          {RATINGS.map((value) => (
            <label key={value} className={ratingOption}>
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === String(value)}
                aria-invalid={errors.rating ? true : undefined}
                onChange={() => {
                  setRating(String(value));
                  clearError("rating");
                }}
                className="sr-only"
              />
              {value}
            </label>
          ))}
        </div>
        <div className="text-muted-foreground mt-1.5 flex justify-between gap-4 text-sm">
          <span id="rating-low">{t.ratingLow}</span>
          <span id="rating-high" className="text-right">
            {t.ratingHigh}
          </span>
        </div>
        <FieldError id="rating-error" message={errors.rating} />
        <p id="rating-hint" className="text-muted-foreground mt-2 text-sm">
          {t.ratingHint}
        </p>
      </fieldset>

      <ServerError message={serverError ? translateKey(m, serverError, "errors.generic") : null} />

      <SubmitButton pendingText={m.common.saving} icon={<Save className="size-4" />}>
        {mode === "edit" ? t.saveChanges : t.submit}
      </SubmitButton>
    </form>
  );
}
