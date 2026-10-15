/*
 * The one vocabulary of decorative fact icons (ui-fact-rhythm), keyed by concept, never by place: a concept has one
 * icon everywhere and an icon means one concept. The icons are `aria-hidden`; the label and the value carry the meaning.
 * `Fact` and `StatCard` read `FACT_ICONS`; `SkyEventList` reads the event-kind and visibility-mark icons. Server-rendered
 * (Astro) only: no island imports this module.
 */
import {
  CircleCheck,
  CircleDot,
  CircleSlash,
  Clock,
  Cloud,
  Compass,
  Contrast,
  Diameter,
  Eclipse,
  Ellipse,
  Eye,
  Info,
  Lightbulb,
  Link,
  Moon,
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
  /** A planet's apparent size. */
  size: Diameter,
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
