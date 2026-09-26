import type { Messages } from "@/i18n";
import { en } from "./en";

/**
 * The Polish catalogue. It must match `en` key for key (`satisfies Messages`); until the Polish
 * translation lands (F-03 phase 4) it mirrors the English text.
 */
export const pl = {
  ...en,
} satisfies Messages;
