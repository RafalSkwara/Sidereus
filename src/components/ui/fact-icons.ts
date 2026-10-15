/*
 * The one vocabulary of decorative fact icons (ui-fact-rhythm), keyed by concept, never by place: a concept has one
 * icon everywhere and an icon means one concept. The icons are `aria-hidden`; the label and the value carry the meaning.
 * `Fact` and `StatCard` read `FACT_ICONS`; `SkyEventList` reads the event-kind and visibility-mark icons. `factIcon`
 * is the one resolver: a fact kind reads `FACT_ICONS`, a sky-event kind reads `EVENT_KIND_ICONS`. An event's fact uses
 * its kind's icon, the verdict line and the dashboard's Events tile included (owner decisions D4: the solar eclipse
 * keeps its own `Eclipse` icon, no amber icon; D5: the Events tile's line leads with the next event's kind icon).
 * Server-rendered (Astro) only: no island imports this module.
 */
import {
  CircleCheck,
  CircleDot,
  CircleSlash,
  Clock,
  Cloud,
  Compass,
  Contrast,
  Eclipse,
  Ellipse,
  Eye,
  Info,
  Lightbulb,
  Link,
  Moon,
  MoveHorizontal,
  Orbit,
  Ruler,
  Sparkle,
  SunDim,
  Telescope,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import type { SkyEventKind } from "@/lib/engine";

/** Every fact concept, in the order /design shows them. */
export const FACT_KINDS = [
  "when",
  "best",
  "see",
  "eyepiece",
  "why",
  "magnitude",
  "size",
  "phase",
  "rings",
  "moon",
  "cloud",
  "measure",
  "tip",
  "safety",
] as const;

export type FactKind = (typeof FACT_KINDS)[number];

export const FACT_ICONS: Readonly<Record<FactKind, LucideIcon>> = {
  /** The window, the Moon's up/sets span. */
  when: Clock,
  /** Best, an event's best time. */
  best: Compass,
  /** What you'll see: the expect line, a planet's or the Moon's note. The Eye means only this. */
  see: Eye,
  /** The eyepieces. */
  eyepiece: Telescope,
  /** Why: the targets' reason, a planet's and the Moon's reason, a night's verdict reason, an event's not-visible reason. */
  why: Info,
  /** A planet's brightness. */
  magnitude: SunDim,
  /**
   * A planet's apparent size: a horizontal span, never a struck circle, which would read as the not-visible
   * `CircleSlash`.
   */
  size: MoveHorizontal,
  /** A planet's phase. */
  phase: Contrast,
  /** Saturn's rings. */
  rings: Ellipse,
  /** The Moon, everywhere: the Moon-tonight lines, the Nights moon line (and the lunar-eclipse kind below). */
  moon: Moon,
  /** An outlook night's cloud line. */
  cloud: Cloud,
  /** An event's details (a phase's times, a separation). */
  measure: Ruler,
  /** An event's notes. */
  tip: Lightbulb,
  /** The solar eclipse's eye-safety line. */
  safety: TriangleAlert,
};

/** One icon per sky-event kind (sky-events), beside the event's name. The lunar eclipse is the one Moon. */
export const EVENT_KIND_ICONS = {
  "lunar-eclipse": FACT_ICONS.moon,
  "solar-eclipse": Eclipse,
  elongation: Orbit,
  opposition: CircleDot,
  pairing: Link,
  "meteor-shower": Sparkle,
} satisfies Record<SkyEventKind, LucideIcon>;

/** The event row's visible / not-visible mark (not the Eye, which means only "what you'll see"). */
export const VISIBILITY_MARK_ICONS = {
  visible: CircleCheck,
  notVisible: CircleSlash,
} satisfies Record<"visible" | "notVisible", LucideIcon>;

/** What a fact's icon can name: a fact concept or a sky-event kind. The two key sets are disjoint. */
export type FactSubject = FactKind | SkyEventKind;

function isFactKind(subject: FactSubject): subject is FactKind {
  return Object.hasOwn(FACT_ICONS, subject);
}

/** The one icon for a fact: `FACT_ICONS` for a fact kind, else `EVENT_KIND_ICONS` for an event kind. */
export function factIcon(subject: FactSubject): LucideIcon {
  return isFactKind(subject) ? FACT_ICONS[subject] : EVENT_KIND_ICONS[subject];
}
