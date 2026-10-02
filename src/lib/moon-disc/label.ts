import type { Messages } from "@/i18n";

import type { MoonDiscState } from "./state";

/**
 * The Moon disc's words for one state (moonlight-and-the-verdict): the phase line and the disc's accessible name, the
 * same in the Moon card's time slider (in the browser) as on the server. Browser-safe and pure: the caller passes the
 * catalogue's `tonight.moon` messages, so this module imports no catalogue itself.
 */

type MoonMessages = Messages["tonight"]["moon"];

/**
 * "63% lit" for a state. `illuminatedFraction` is in 0.01 steps, so the whole percent (0-100) needs no locale
 * formatting: it reads the same as the server's locale-formatted number in every supported locale.
 */
function litText(m: MoonMessages, state: Pick<MoonDiscState, "illuminatedFraction">): string {
  return m.lit({ percent: String(Math.round(state.illuminatedFraction * 100)) });
}

/** "Waxing gibbous · 63% lit": the Moon card's phase line for a state. */
export function moonPhaseLine(m: MoonMessages, state: Pick<MoonDiscState, "band" | "illuminatedFraction">): string {
  return m.phaseLine({ phase: m.phase[state.band], lit: litText(m, state) });
}

/** "Moon at 23:40: Waxing gibbous, 63% lit": the disc's accessible name; `time` is the state's pre-formatted time. */
export function moonDiscLabel(
  m: MoonMessages,
  state: Pick<MoonDiscState, "band" | "illuminatedFraction">,
  time: string,
): string {
  return m.card.discLabel({ time, phase: m.phase[state.band], lit: litText(m, state) });
}
