import * as React from "react";
import { cn } from "@/lib/utils";
import * as LabelPrimitive from "@radix-ui/react-label";

/** The one field label (Nightfall `text-label` role). */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "text-label text-heading flex items-center gap-2 font-semibold select-none",
        "peer-disabled:text-muted-foreground peer-disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
