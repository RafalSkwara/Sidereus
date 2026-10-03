import type { MessageKey } from "@/i18n";
import type { SkyCheckReturn } from "./schemas";

/** The sky checks page (verdict-check). */
export const SKY_CHECKS_PAGE = "/log/sky";

const RETURN_PATHS: Record<SkyCheckReturn, string> = { tonight: "/tonight", sky: SKY_CHECKS_PAGE };

/** The query flag both pages read to say the answer was saved. A fixed value, never the answer itself. */
export const SKY_CHECKED_PARAM = "skyChecked";

/** Where an answered or skipped night goes: back to the page it was asked on, with the saved notice. */
export function skyCheckedRedirect(from: SkyCheckReturn): string {
  return `${RETURN_PATHS[from]}?${new URLSearchParams({ [SKY_CHECKED_PARAM]: "1" }).toString()}`;
}

/** Where a failed answer goes: back to the page it was asked on, with a fixed message key and nothing else. */
export function skyCheckErrorRedirect(from: SkyCheckReturn, error: MessageKey): string {
  return `${RETURN_PATHS[from]}?${new URLSearchParams({ error }).toString()}`;
}

/** Whether a page's query carries the saved notice. */
export function hasSkyCheckedNotice(params: URLSearchParams): boolean {
  return params.get(SKY_CHECKED_PARAM) === "1";
}
