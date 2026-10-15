import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * The Nightfall type roles (`text-display`, `text-title`, `text-label`, `text-body`, `text-caption`, `text-overline`,
 * global.css `@theme inline`) are font sizes. Without this, tailwind-merge reads them as text colours and drops one of
 * `text-label text-heading` (or `text-overline text-muted-foreground`). The rhythm roles (`line`, `group`, `item`) are
 * spacing keys, so `cn("mt-line", "mt-group")` keeps only the last, as for numeric steps.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "title", "label", "body", "caption", "overline"],
      spacing: ["line", "group", "item"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
