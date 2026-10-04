import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * The one field look (Nightfall): 44 px tall, the shared radius, an inset surface and a 16 px body size (no
 * zoom on iOS). Focus thickens the border to the `--ring` colour; `aria-invalid` turns it to the no-go colour.
 * `NativeSelect` reuses `fieldClass`, so inputs and selects always match.
 */
export const fieldClass = cn(
  "h-11 w-full min-w-0 rounded-lg border border-input bg-surface px-3 text-body text-foreground",
  "transition outline-none placeholder:text-faint",
  "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
  "aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive",
  "disabled:cursor-not-allowed disabled:border-dashed disabled:text-muted-foreground",
);

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClass, className)} {...props} />;
}

export { Input };
