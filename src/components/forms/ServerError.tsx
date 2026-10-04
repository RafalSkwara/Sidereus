import { CircleAlert } from "lucide-react";

interface ServerErrorProps {
  message?: string | null;
}

/** A form- or section-level error on the no-go verdict surface (the field-level style is `FieldError`). */
export function ServerError({ message }: ServerErrorProps) {
  if (!message) return null;

  return (
    <p className="border-no-go-border bg-no-go-surface text-foreground flex items-start gap-2 rounded-lg border px-3 py-2 text-sm">
      <CircleAlert className="text-destructive mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
