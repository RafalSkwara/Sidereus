/*
 * The one vocabulary of progress icons (ui-progress-rewards), like `fact-icons.ts`: an icon here means one concept and
 * a concept has one icon. The object families of the checklists (`OBJECT_FAMILIES`) use lucide's `Galaxy` and five
 * icons drawn on lucide's 24-unit grid (stroke 2, round caps and joins, the owner-reviewed drafts of P7 B), built with
 * `createLucideIcon` so they behave like any lucide icon. None reuses an icon that already means something else in the
 * app: `Sparkles` (not seen yet), `Sparkle` (meteor shower), `Cloud` (cloud cover), `CircleDot` (opposition), `Orbit`
 * (elongation), `Ellipse` (rings) or `Award` (Progress). The milestone badges are illustrations, not icons
 * (`badge-art/`). Server-rendered (Astro) only: no island imports this module (`island-imports.test.ts`).
 */
import { createLucideIcon, Galaxy, type LucideIcon, type LucideIconNode } from "lucide-react";

import type { ObjectFamily } from "@/lib/progress/object-family";

/** `count` dots of radius `dot` on a circle of radius `radius` around the grid's centre, from angle `offset`. */
function ring(count: number, radius: number, offset: number, dot: number, key: string): LucideIconNode[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = offset + (i * 2 * Math.PI) / count;
    const cx = Math.round((12 + radius * Math.cos(angle)) * 100) / 100;
    const cy = Math.round((12 + radius * Math.sin(angle)) * 100) / 100;
    return ["circle", { cx, cy, r: dot, key: `${key}${i}` }];
  });
}

/** A globular cluster: a bright centre, a ring of six stars and a wider ring of eight smaller ones. */
export const Globular: LucideIcon = createLucideIcon("globular", [
  ["circle", { cx: 12, cy: 12, r: 2.5, key: "core" }],
  ...ring(6, 6.5, 0, 0.6, "inner"),
  ...ring(8, 10, Math.PI / 8, 0.4, "outer"),
]);

/** An open cluster: a loose scatter of stars of three sizes. */
export const OpenCluster: LucideIcon = createLucideIcon("open-cluster", [
  ["circle", { cx: 6, cy: 7, r: 1.6, key: "a" }],
  ["circle", { cx: 15, cy: 4.5, r: 0.8, key: "b" }],
  ["circle", { cx: 19, cy: 11, r: 1.8, key: "c" }],
  ["circle", { cx: 10.5, cy: 13, r: 0.8, key: "d" }],
  ["circle", { cx: 5, cy: 18.5, r: 0.8, key: "e" }],
  ["circle", { cx: 14.5, cy: 18.5, r: 1.4, key: "f" }],
]);

/** A nebula: a cloud whose lower edge fades (dashed), two stars inside. */
export const Nebula: LucideIcon = createLucideIcon("nebula", [
  ["path", { d: "M3 13c0-3 3-5 5-4 1-3 5-4 7-2 2.5-1 6 1 5.5 4", key: "top" }],
  ["path", { d: "M21 15c-1 2.5-4 3.5-6 2.5-2 2-6 2-7.5 0C5 18 3 16.5 3 13", strokeDasharray: "2 2.5", key: "edge" }],
  ["circle", { cx: 10, cy: 12.5, r: 0.8, key: "star-a" }],
  ["circle", { cx: 14.5, cy: 11.5, r: 0.5, key: "star-b" }],
]);

/** A planetary nebula: a ring around its central star, inside a dotted halo. */
export const Planetary: LucideIcon = createLucideIcon("planetary", [
  ["circle", { cx: 12, cy: 12, r: 6, key: "ring" }],
  ["circle", { cx: 12, cy: 12, r: 1, key: "star" }],
  ["circle", { cx: 12, cy: 12, r: 10, strokeDasharray: "1 3", key: "halo" }],
]);

/** Stars and asterisms: three stars joined as a figure. */
export const StarGroup: LucideIcon = createLucideIcon("star-group", [
  ["path", { d: "m5 17 7-10 7 6", key: "figure" }],
  ["circle", { cx: 5, cy: 17, r: 1.5, key: "a" }],
  ["circle", { cx: 12, cy: 7, r: 1.5, key: "b" }],
  ["circle", { cx: 19, cy: 13, r: 1.5, key: "c" }],
]);

/** One icon per object family (owner P7 B): the legend, the tiles (through `ObjectTypeSprite`) and `/design`. */
export const OBJECT_FAMILY_ICONS: Readonly<Record<ObjectFamily, LucideIcon>> = {
  galaxy: Galaxy,
  globular: Globular,
  "open-cluster": OpenCluster,
  nebula: Nebula,
  planetary: Planetary,
  stars: StarGroup,
};
