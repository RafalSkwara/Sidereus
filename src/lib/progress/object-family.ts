import type { DeepSkyType } from "@/lib/catalogue";

import type { ChecklistItem } from "./progress";

/**
 * The progress page's display grouping of deep-sky types (ui-progress-rewards): OpenNGC's twelve types folded into six
 * families, each with one icon (`OBJECT_FAMILY_ICONS`) and one name (`progress.types`), in the order the checklist
 * legends list them. A display mapping only: "First nebula" follows `NEBULA_TYPES` in `milestones.ts`, which counts a
 * planetary nebula as a nebula, while here a planetary is its own family. Both rules are right for what they name.
 *
 * Island-safe like `milestones.ts`: the catalogue and progress modules are imported as types only.
 */
export const OBJECT_FAMILIES = ["galaxy", "globular", "open-cluster", "nebula", "planetary", "stars"] as const;

export type ObjectFamily = (typeof OBJECT_FAMILIES)[number];

/** Every OpenNGC type the catalogues use, mapped to its family; a new type fails `astro check` until it has one. */
export const FAMILY_OF: Readonly<Record<DeepSkyType, ObjectFamily>> = {
  galaxy: "galaxy",
  "globular-cluster": "globular",
  "open-cluster": "open-cluster",
  "planetary-nebula": "planetary",
  nebula: "nebula",
  "emission-nebula": "nebula",
  "reflection-nebula": "nebula",
  "supernova-remnant": "nebula",
  "cluster-with-nebula": "nebula",
  asterism: "stars",
  "double-star": "stars",
  other: "stars",
};

/** One legend row: a family and how many of the list's objects of that family are seen. */
export interface FamilyCount {
  family: ObjectFamily;
  seen: number;
  total: number;
}

/** A checklist's seen / total per family, in `OBJECT_FAMILIES` order; a family the list does not hold is left out. */
export function familyCounts(items: readonly ChecklistItem[]): FamilyCount[] {
  const counts = new Map<ObjectFamily, FamilyCount>(
    OBJECT_FAMILIES.map((family) => [family, { family, seen: 0, total: 0 }]),
  );
  for (const item of items) {
    const count = counts.get(FAMILY_OF[item.type]);
    if (!count) continue;
    count.total += 1;
    if (item.seen !== null) count.seen += 1;
  }
  return [...counts.values()].filter((count) => count.total > 0);
}
