import React, { useState } from "react";
import { CalendarDays, Save } from "lucide-react";
import { FormField } from "@/components/forms/FormField";
import { ServerError } from "@/components/forms/ServerError";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { getMessages, translateKey } from "@/i18n";
import type { Locale } from "@/lib/preferences";
import { MIN_NIGHT, observationInputSchema } from "@/lib/observations/schemas";
import { cn } from "@/lib/utils";

interface GearOption {
  id: string;
  name: string;
}

interface Props {
  action: string;
  messier: number;
  /** Prefill from the ranking: its night, site and telescope (FR-016). The rating always starts empty. */
  initial: { night: string; siteId: string; telescopeId: string };
  sites: readonly GearOption[];
  telescopes: readonly GearOption[];
  /**
   * The latest night any of the user's sites has reached; the server checks the chosen site's own
   * night, so this only keeps the date picker from offering nights that are certainly in the future.
   */
  maxNight: string;
  /** A message key from `?error=`; translated here, unknown values read as the generic message. */
  serverError?: string | null;
  locale: Locale;
}

type FieldName = "night" | "rating" | "siteId" | "telescopeId";
type FieldErrors = Partial<Record<FieldName, string>>;

const FIELD_NAMES: readonly string[] = ["night", "rating", "siteId", "telescopeId"];
const RATINGS = [1, 2, 3, 4, 5] as const;

const selectBase =
  "w-full rounded-lg border bg-surface px-3 py-2 text-foreground outline-none transition-shadow focus-visible:ring-[3px]";

const ratingOption = cn(
  "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface font-mono text-lg font-semibold text-heading transition-colors",
  "hover:bg-accent has-[:checked]:border-selected has-[:checked]:bg-selected/15 has-[:checked]:ring-1 has-[:checked]:ring-selected",
  "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
);

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-destructive mt-1 text-xs">
      {message}
    </p>
  );
}

function fieldBorder(error?: string): string {
  return error
    ? "border-destructive focus-visible:ring-destructive/20"
    : "border-input focus-visible:border-ring focus-visible:ring-ring/50";
}

export default function ObservationForm({
  action,
  messier,
  initial,
  sites,
  telescopes,
  maxNight,
  serverError,
  locale,
}: Props) {
  const m = getMessages(locale);
  const t = m.log;
  const [night, setNight] = useState(initial.night);
  const [siteId, setSiteId] = useState(initial.siteId);
  const [telescopeId, setTelescopeId] = useState(initial.telescopeId);
  const [rating, setRating] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate() {
    const result = observationInputSchema.safeParse({ messier: String(messier), night, rating, siteId, telescopeId });
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
      <input type="hidden" name="messier" value={messier} />

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
        hint={<p className="text-muted-foreground mt-1 text-xs">{t.nightHint}</p>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="siteId" className="text-heading mb-1 block text-sm font-semibold">
            {t.site}
          </label>
          <select
            id="siteId"
            name="siteId"
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              clearError("siteId");
            }}
            className={cn(selectBase, fieldBorder(errors.siteId))}
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.siteId} />
        </div>
        <div>
          <label htmlFor="telescopeId" className="text-heading mb-1 block text-sm font-semibold">
            {t.telescope}
          </label>
          <select
            id="telescopeId"
            name="telescopeId"
            value={telescopeId}
            onChange={(e) => {
              setTelescopeId(e.target.value);
              clearError("telescopeId");
            }}
            className={cn(selectBase, fieldBorder(errors.telescopeId))}
          >
            {telescopes.map((telescope) => (
              <option key={telescope.id} value={telescope.id}>
                {telescope.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.telescopeId} />
        </div>
      </div>

      <fieldset aria-describedby={cn("rating-low rating-high rating-hint", errors.rating && "rating-error")}>
        <legend className="text-heading mb-2 block text-sm font-semibold">{t.rating}</legend>
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
        <div className="text-muted-foreground mt-1 flex justify-between gap-4 text-xs">
          <span id="rating-low">{t.ratingLow}</span>
          <span id="rating-high" className="text-right">
            {t.ratingHigh}
          </span>
        </div>
        <FieldError id="rating-error" message={errors.rating} />
        <p id="rating-hint" className="text-muted-foreground mt-2 text-xs">
          {t.ratingHint}
        </p>
      </fieldset>

      <ServerError message={serverError ? translateKey(m, serverError, "errors.generic") : null} />

      <SubmitButton pendingText={m.common.saving} icon={<Save className="size-4" />}>
        {t.submit}
      </SubmitButton>
    </form>
  );
}
