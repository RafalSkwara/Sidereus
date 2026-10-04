/**
 * The notice Tonight shows under its sky (tonight-nightfall). The page shell reads `?logged`, `?skyChecked` and
 * `?error` (the server island's own Astro.url carries no page query), resolves them to catalogue text and passes
 * the result to the island as plain strings: never a raw query value.
 */
export interface TonightNotice {
  /** `success` renders a status Notice; `error` a ServerError. */
  tone: "success" | "error";
  text: string;
}

/** One notice at a time: an error first, then a saved observation, then a saved sky check. */
export function pickTonightNotice(texts: {
  error: string | null;
  logged: string | null;
  skyChecked: string | null;
}): TonightNotice | null {
  if (texts.error) return { tone: "error", text: texts.error };
  if (texts.logged) return { tone: "success", text: texts.logged };
  if (texts.skyChecked) return { tone: "success", text: texts.skyChecked };
  return null;
}
