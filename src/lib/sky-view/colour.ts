/**
 * The interactive sky's colour by the Sun (interactive-sky). The band's middle and horizon stops mix the night
 * tokens with the `--dusk-*` tokens by these shares (CSS `color-mix(in oklab, …)`, the `dusk-band` utility in
 * global.css); the top stop stays `--zenith`, so no seam opens under the Topbar.
 *
 * - Sun at or above 0°: full sunset glow.
 * - 0° to −6° (civil twilight): glow fading into twilight.
 * - −6° to −18°: twilight fading into night.
 * - At or below −18°: night (the tokens of the static sky).
 *
 * Pure and island-safe.
 */

export interface SkyMix {
  /** Share of the glow colour, 0–100. */
  glow: number;
  /** Share of the twilight colour, 0–100; `glow + twilight` ≤ 100, the rest is night. */
  twilight: number;
}

const CIVIL_DEG = -6;
const NIGHT_DEG = -18;

export function skyMix(sunAltitudeDeg: number): SkyMix {
  if (sunAltitudeDeg >= 0) {
    return { glow: 100, twilight: 0 };
  }
  if (sunAltitudeDeg > CIVIL_DEG) {
    const glow = (1 - sunAltitudeDeg / CIVIL_DEG) * 100;
    return { glow, twilight: 100 - glow };
  }
  if (sunAltitudeDeg > NIGHT_DEG) {
    return { glow: 0, twilight: ((sunAltitudeDeg - NIGHT_DEG) / (CIVIL_DEG - NIGHT_DEG)) * 100 };
  }
  return { glow: 0, twilight: 0 };
}

/**
 * The two percentages the nested `color-mix` needs: glow over (twilight over night). The inner share is the
 * twilight's part of what the glow leaves, so the three colours come out in `mix`'s proportions.
 */
export function mixPercentages(mix: SkyMix): { outer: string; inner: string } {
  const rest = 100 - mix.glow;
  const inner = rest <= 0 ? 100 : (mix.twilight / rest) * 100;
  return { outer: `${mix.glow.toFixed(1)}%`, inner: `${Math.min(100, inner).toFixed(1)}%` };
}
