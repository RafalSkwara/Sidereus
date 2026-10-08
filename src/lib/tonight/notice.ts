/**
 * The notice Tonight shows under its sky (tonight-nightfall). The page shell reads `?logged`, `?skyChecked` and
 * `?error` (the server island's own Astro.url carries no page query), resolves them to catalogue text and passes
 * the result to the island as plain strings: never a raw query value. A success notice also names the param it came
 * from (`logged` or `skyChecked`, a fixed name), which the toast clears from the URL once shown.
 */
export type TonightNotice =
  /** A saved observation or sky check: a toast, which clears its own URL `param` once shown. */
  | { tone: "success"; text: string; param: "logged" | "skyChecked" }
  /** `error` renders a ServerError next to the content and stays. */
  | { tone: "error"; text: string };

/** One notice at a time: an error first, then a saved observation, then a saved sky check. */
export function pickTonightNotice(texts: {
  error: string | null;
  logged: string | null;
  skyChecked: string | null;
}): TonightNotice | null {
  if (texts.error) return { tone: "error", text: texts.error };
  if (texts.logged) return { tone: "success", text: texts.logged, param: "logged" };
  if (texts.skyChecked) return { tone: "success", text: texts.skyChecked, param: "skyChecked" };
  return null;
}
