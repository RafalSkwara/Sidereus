import { describe, expect, it } from "vitest";

import { getMessages } from "@/i18n";
import { MOON_PHASE_BANDS } from "@/lib/engine/parameters";
import { LOCALES } from "@/lib/preferences";
import { createFormatter } from "@/lib/tonight/format";

import { moonDiscLabel, moonPhaseLine } from "./label";

/**
 * The time slider rewords the phase line in the browser; it must read exactly as the server's `moonPhaseText` for the
 * same state, so the card never changes its words on hydration.
 */
describe("moonPhaseLine", () => {
  const fractions = [0, 0.01, 0.07, 0.5, 0.63, 0.99, 1];

  it("matches the server's phase text in every locale for every band and fraction", () => {
    let compared = 0;
    for (const locale of LOCALES) {
      const m = getMessages(locale).tonight.moon;
      const format = createFormatter(locale);
      for (const { band } of MOON_PHASE_BANDS) {
        for (const illuminatedFraction of fractions) {
          expect(
            moonPhaseLine(m, { band, illuminatedFraction }),
            `${locale} ${band} ${String(illuminatedFraction)}`,
          ).toBe(format.moonPhaseText(band, illuminatedFraction));
          compared += 1;
        }
      }
    }
    expect(compared).toBe(LOCALES.length * MOON_PHASE_BANDS.length * fractions.length);
    expect(compared).toBeGreaterThan(50);
  });
});

describe("moonDiscLabel", () => {
  it("names the moment shown, then the phase and % lit", () => {
    const state = { band: "waning-crescent", illuminatedFraction: 0.07 } as const;
    expect(moonDiscLabel(getMessages("en").tonight.moon, state, "23:40")).toBe(
      "Moon at 23:40: Waning crescent, 7% lit",
    );
    expect(moonDiscLabel(getMessages("pl").tonight.moon, state, "23:40")).toBe(
      `Księżyc o 23:40: ${getMessages("pl").tonight.moon.phase["waning-crescent"]}, oświetlony w 7%`,
    );
  });
});
