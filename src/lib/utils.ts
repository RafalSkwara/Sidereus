import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * The Nightfall type roles (`text-display`, `text-title`, `text-label`, `text-body`, global.css `@theme inline`)
 * are font sizes. Without this, tailwind-merge reads them as text colours and drops one of `text-label text-heading`.
 */
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["display", "title", "label", "body"] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
