import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChoiceCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Merged last; `/design` uses it to pin the hover and focus looks as specimens. */
  className?: string;
}

/*
 * A radio choice shown as a card (ui-onboarding): onboarding's sky scene, telescope and eyepiece-set choices. The
 * native radio is visually hidden inside the label, so arrow keys, form submission and the accessible name (title,
 * then description) work as for any radio; the card shows its state. Checked is the ink border plus the filled corner
 * dot (not colour alone), focus the `--ring` outline every control uses, disabled a dashed border and muted text.
 * Group the cards in a `fieldset` with a legend or `aria-labelledby`.
 */
export function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  disabled = false,
  className,
}: ChoiceCardProps) {
  return (
    <label
      className={cn(
        "group border-border bg-surface relative flex min-h-11 cursor-pointer flex-col gap-1 rounded-lg border px-4 py-3 transition-colors",
        "hover:bg-accent has-checked:border-selected has-checked:ring-selected has-checked:ring-1",
        "has-focus-visible:outline-ring has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
        "has-disabled:text-muted-foreground has-disabled:hover:bg-surface has-disabled:cursor-not-allowed has-disabled:border-dashed",
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      <span className="text-label text-heading group-has-disabled:text-muted-foreground pr-6 font-semibold">
        {title}
      </span>
      {description ? <span className="text-muted-foreground text-sm">{description}</span> : null}
      <span
        aria-hidden="true"
        className="border-border group-has-checked:border-selected absolute top-3.5 right-3 flex size-4 items-center justify-center rounded-full border"
      >
        {/* Keeps its fill in forced-colors mode, where the border, ring and background would all flatten. */}
        <span className="bg-selected hidden size-2 rounded-full group-has-checked:block forced-colors:forced-color-adjust-none" />
      </span>
    </label>
  );
}
