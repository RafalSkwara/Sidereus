import type { HTMLAttributes, ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const inputBase =
  "w-full rounded-lg border bg-surface px-3 py-2 text-foreground placeholder:text-faint outline-none transition-shadow focus-visible:ring-[3px]";

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
  return (
    <div>
      <label htmlFor={id} className="text-heading mb-1 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        {icon ? (
          <span className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2">{icon}</span>
        ) : null}
        <input
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
          className={cn(
            inputBase,
            icon && "pl-10",
            error
              ? "border-destructive focus-visible:ring-destructive/20"
              : "border-input focus-visible:border-ring focus-visible:ring-ring/50",
          )}
        />
        {endContent}
      </div>
      {error ? (
        <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}
