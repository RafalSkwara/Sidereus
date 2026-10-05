import type { HTMLAttributes, ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  endContent?: ReactNode;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
}

/**
 * The one field error style. Give it the `id` the control names in `aria-describedby`. It is an alert, so a
 * screen reader announces it when it appears; never wrap it in another `role="alert"`.
 */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-destructive mt-1.5 flex items-start gap-1.5 text-sm">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export function FormField({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  hint,
  icon,
  endContent,
  min,
  max,
  step,
  inputMode,
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div>
      <Label htmlFor={id} className="mb-1.5">
        {label}
      </Label>
      <div className="relative">
        {icon ? (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2">
            {icon}
          </span>
        ) : null}
        <Input
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(icon && "pl-10", endContent && "pr-11")}
        />
        {endContent}
      </div>
      {error ? <FieldError id={errorId} message={error} /> : hint ? <div id={hintId}>{hint}</div> : null}
    </div>
  );
}
