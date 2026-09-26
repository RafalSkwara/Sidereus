import type { VerdictLevel } from "@/lib/engine";

/** Token classes for each verdict, shared by the Tonight verdict card and the landing page's verdict chips. */
export const VERDICT_TONES: Record<VerdictLevel, { dot: string; card: string }> = {
  go: { dot: "bg-go", card: "border-go-border bg-go-surface" },
  marginal: { dot: "bg-marginal", card: "border-marginal-border bg-marginal-surface" },
  "no-go": { dot: "bg-no-go", card: "border-no-go-border bg-no-go-surface" },
};
