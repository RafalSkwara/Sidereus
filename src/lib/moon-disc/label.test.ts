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

  it.each(LOCALES)("matches the server's phase text in %s for every band and fraction", (locale) => {
    const m = getMessages(locale).tonight.moon;
    const format = createFormatter(locale);
    for (const { band } of MOON_PHASE_BANDS) {
      for (const illuminatedFraction of fractions) {
        expect(moonPhaseLine(m, { band, illuminatedFraction })).toBe(format.moonPhaseText(band, illuminatedFraction));
      }
    }
  });

  it("words a state as the phase and the whole percent lit", () => {
    const m = getMessages("en").tonight.moon;
    expect(moonPhaseLine(m, { band: "waxing-gibbous", illuminatedFraction: 0.63 })).toBe("Waxing gibbous · 63% lit");
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
