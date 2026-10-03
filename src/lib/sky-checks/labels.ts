import type { Messages } from "@/i18n";
import type { VerdictLevel } from "@/lib/engine";
import type { RecordedHeadline, SkyAnswer } from "./claim";

/**
 * Words and tones the sky check shares between Tonight's card and the sky checks page (verdict-check), so the two
 * can never drift apart.
 */

/** The answers are the headline's own words, so they read the same as the verdict card. */
export function answerLabel(m: Messages, answer: SkyAnswer): string {
  const labels: Record<SkyAnswer, string> = {
    clear: m.verdict.level.go,
    partly: m.verdict.level.marginal,
    cloudy: m.verdict.level["no-go"],
  };
  return labels[answer];
}

/** The tone of the verdict a headline came from: the capped headlines were marginal verdicts, as on Tonight. */
export function headlineLevel(headline: RecordedHeadline): VerdictLevel {
  const levels: Record<RecordedHeadline, VerdictLevel> = {
    go: "go",
    marginal: "marginal",
    humidityCap: "marginal",
    fallbackCap: "marginal",
    noForecast: "marginal",
    "no-go": "no-go",
  };
  return levels[headline];
}
