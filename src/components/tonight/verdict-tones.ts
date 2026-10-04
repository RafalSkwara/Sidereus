import type { VerdictLevel } from "@/lib/engine";

/** Token classes for each verdict, shared by the Tonight verdict card and the landing page's verdict chips. */
export const VERDICT_TONES: Record<VerdictLevel, { dot: string }> = {
  go: { dot: "bg-go" },
  marginal: { dot: "bg-marginal" },
  "no-go": { dot: "bg-no-go" },
};
