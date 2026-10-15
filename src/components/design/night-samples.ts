import type { DarkWindow, Verdict } from "@/lib/engine";
import type { Locale } from "@/lib/preferences";
import type { TonightNight } from "@/lib/tonight/build";
import { createFormatter } from "@/lib/tonight/format";

/**
 * Sample nights for the /design `NightStrip` specimen (ui-fact-rhythm Phase 4; dev only), from fixed data: no clock, no
 * network, no forecast. Worded through the same formatter as `buildTonight`, so the lines follow the page's language:
 * two verdict nights (a go night with its reason, a no-darkness night without one, as a high-latitude summer night
 * reads) and two outlook nights (one with a cloud range, one with a single cloud figure).
 */

/** The specimen's zone, as the strip's "Times in" line names it. */
export const SAMPLE_NIGHTS_ZONE = "Europe/Warsaw";

const THRESHOLD_DEG = -18;

/** A dark window in UTC; Warsaw is on CEST (UTC+2) on these October nights, so 17:42Z reads 19:42. */
function darkWindow(start: string, end: string): DarkWindow {
  return {
    kind: "window",
    thresholdDeg: THRESHOLD_DEG,
    start: new Date(start),
    end: new Date(end),
    clampedToNightStart: false,
    clampedToNightEnd: false,
  };
}

const NO_DARKNESS: DarkWindow = {
  kind: "none",
  thresholdDeg: THRESHOLD_DEG,
  minSunAltitudeDeg: -15.2,
  at: new Date("2026-10-11T22:58:00Z"),
};

const GO_VERDICT = { level: "go", reason: { kind: "clear-run", runHours: 7, cloudPct: 8 } } satisfies Verdict;
const NO_DARKNESS_VERDICT = { level: "no-go", reason: { kind: "no-darkness" } } satisfies Verdict;

export function nightSamples(locale: Locale): TonightNight[] {
  const fmt = createFormatter(locale);
  const night = (
    date: string,
    window: DarkWindow,
    moon: { illuminatedFraction: number; moonFreeMinutes: number | null },
  ) => ({
    date,
    label: fmt.formatShortNightDate(date),
    darkText: fmt.darkSpanText(window, SAMPLE_NIGHTS_ZONE),
    moonText: fmt.moonLine(moon, window),
  });

  const goWindow = darkWindow("2026-10-10T17:42:00Z", "2026-10-11T03:18:00Z");
  const rangeWindow = darkWindow("2026-10-12T17:38:00Z", "2026-10-13T03:22:00Z");
  const singleWindow = darkWindow("2026-10-13T17:36:00Z", "2026-10-14T03:24:00Z");

  return [
    {
      ...night("2026-10-10", goWindow, { illuminatedFraction: 0.63, moonFreeMinutes: 190 }),
      clearPct: 92,
      kind: "verdict",
      level: GO_VERDICT.level,
      headline: fmt.skyHeadline(GO_VERDICT),
      reasonText: fmt.verdictReasonText(GO_VERDICT),
    },
    {
      // No darkness: the headline and the dark column say so, so the row has no reason line (as `buildTonight`).
      ...night("2026-10-11", NO_DARKNESS, { illuminatedFraction: 0.72, moonFreeMinutes: null }),
      clearPct: null,
      kind: "verdict",
      level: NO_DARKNESS_VERDICT.level,
      headline: fmt.skyHeadline(NO_DARKNESS_VERDICT),
      reasonText: null,
    },
    {
      ...night("2026-10-12", rangeWindow, { illuminatedFraction: 0.81, moonFreeMinutes: 0 }),
      clearPct: 52,
      kind: "outlook",
      cloudText: fmt.cloudOutlookText({ meanCloudPct: 48, minCloudPct: 4 }),
    },
    {
      ...night("2026-10-13", singleWindow, { illuminatedFraction: 0.88, moonFreeMinutes: 600 }),
      clearPct: 78,
      kind: "outlook",
      cloudText: fmt.cloudOutlookText({ meanCloudPct: 22, minCloudPct: 18 }),
    },
  ];
}
