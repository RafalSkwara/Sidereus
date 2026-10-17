import { CALDWELL, MESSIER } from "@/lib/catalogue";
import { MILESTONES, type MilestoneState } from "@/lib/progress/milestones";
import { FAMILY_OF, OBJECT_FAMILIES } from "@/lib/progress/object-family";
import { observingProgress } from "@/lib/progress/progress";

/**
 * Progress specimens for /design (ui-progress-rewards, dev only), from fixed data: no clock, no store.
 *
 * - `progressMany`: the art round's log (37 Messier objects, 6 Caldwell, 4 planets and the Moon), one entry a night from
 *   1 June 2026, so the Milestones band shows reached badges, "37 / 50" with its arc, and seen tiles of every family.
 * - `BADGE_REACHED` / `BADGE_AHEAD`: every badge in each state, ahead at the art round's progress ("Not yet", 4 / 7,
 *   7 / 10, 18 / 25, 37 / 50, 37 / 110, 5 / 61).
 */

/** `YYYY-MM-DD`, `days` after 1 June 2026. */
function night(days: number): string {
  const date = new Date(Date.UTC(2026, 5, 1 + days));
  return date.toISOString().slice(0, 10);
}

const MANY_TARGETS = [
  "moon",
  "jupiter",
  "saturn",
  "mars",
  "venus",
  ...MESSIER.slice(0, 37).map((object) => object.id),
  ...[...CALDWELL]
    .sort((a, b) => a.caldwell - b.caldwell)
    .slice(0, 6)
    .map((object) => object.id),
];

export const progressMany = observingProgress(
  MANY_TARGETS.map((target, index) => ({ target, night: night(index), rating: 4 })),
);

const AHEAD_PROGRESS: Partial<Record<MilestoneState["key"], { seen: number; total: number }>> = {
  "all-planets": { seen: 4, total: 7 },
  "messier-10": { seen: 7, total: 10 },
  "messier-25": { seen: 18, total: 25 },
  "messier-50": { seen: 37, total: 50 },
  "messier-110": { seen: 37, total: 110 },
  "caldwell-all": { seen: 5, total: 61 },
};

export const BADGE_REACHED: readonly MilestoneState[] = MILESTONES.map(({ key }, index) => ({
  key,
  reachedNight: night(index * 9),
}));

export const BADGE_AHEAD: readonly MilestoneState[] = MILESTONES.map(({ key }) => ({
  key,
  reachedNight: null,
  progress: AHEAD_PROGRESS[key],
}));

/**
 * One seen and one not-seen tile per object family, from the 37-object log's Messier list (in catalogue order), so the
 * tile specimens cover every icon in both states.
 */
export const FAMILY_TILES = OBJECT_FAMILIES.flatMap((family) =>
  [true, false].flatMap((seen) => {
    const item = progressMany.messier.items.find(
      (candidate) => FAMILY_OF[candidate.type] === family && (candidate.seen !== null) === seen,
    );
    return item ? [item] : [];
  }),
);
