import type { DeepSkyType } from "@/lib/catalogue";
import { MOON_TARGET_KEY, PLANET_TARGET_KEYS } from "@/lib/targets";

import type { ChecklistItem, ObservingProgress } from "./progress";

/**
 * The observing milestones (roadmap M-3 S-06, PRD FR-041, US-06): a fixed, named set, derived from the one model
 * of the log S-05 left (`ObservingProgress`), so the progress page, the stored record and the celebration share
 * one rule. Pure: progress in, plain data out, no I/O.
 *
 * Island-safe: it imports the progress and catalogue modules as types only (erased at build), never their data,
 * so a browser island may import `isMilestoneKey` and `MILESTONES`. `targets` is island-safe by its own rule.
 *
 * Reached night, from the `firstNight`s the checklists and firsts already carry:
 * - first of a kind: the earliest `firstNight` in the group;
 * - the N-th object: the N-th earliest `firstNight` in the list;
 * - all of a set: the latest `firstNight`, once every member is seen.
 */

/** The shapes a milestone can take; the key names the group. */
export type MilestoneKind = "first" | "count" | "all";

export const MILESTONES = [
  { key: "first-moon", kind: "first" },
  { key: "first-planet", kind: "first" },
  { key: "all-planets", kind: "all" },
  { key: "first-galaxy", kind: "first" },
  { key: "first-globular", kind: "first" },
  { key: "first-nebula", kind: "first" },
  { key: "messier-10", kind: "count" },
  { key: "messier-25", kind: "count" },
  { key: "messier-50", kind: "count" },
  { key: "messier-110", kind: "all" },
  { key: "caldwell-all", kind: "all" },
] as const satisfies readonly { key: string; kind: MilestoneKind }[];

export type MilestoneKey = (typeof MILESTONES)[number]["key"];

/** The deep-sky types that count as a nebula for "first nebula" (owner decision 1). */
export const NEBULA_TYPES = [
  "nebula",
  "emission-nebula",
  "reflection-nebula",
  "planetary-nebula",
  "supernova-remnant",
  "cluster-with-nebula",
] as const satisfies readonly DeepSkyType[];

/** Where a milestone stands for one log. */
export interface MilestoneState {
  key: MilestoneKey;
  /** The night the milestone was reached, `YYYY-MM-DD`, or `null` while it is not reached. */
  reachedNight: string | null;
  /** How far along it is; only for the count and all-of-a-set milestones. */
  progress?: { seen: number; total: number };
}

const MILESTONE_KEYS: readonly string[] = MILESTONES.map((milestone) => milestone.key);

/** Whether `value` is one of the milestone keys; the readers of a `milestone` URL param and of a stored key use it. */
export function isMilestoneKey(value: unknown): value is MilestoneKey {
  return typeof value === "string" && MILESTONE_KEYS.includes(value);
}

/** The Messier counts' N, from the key. */
const MESSIER_COUNTS = { "messier-10": 10, "messier-25": 25, "messier-50": 50 } as const;

/** The first nights of a group, as `YYYY-MM-DD` strings (ISO dates sort as strings). */
function nightsOf(items: readonly { firstNight: string | null }[]): string[] {
  return items.flatMap((item) => (item.firstNight === null ? [] : [item.firstNight])).sort();
}

function firstNightsOfItems(items: readonly ChecklistItem[]): { firstNight: string | null }[] {
  return items.map((item) => ({ firstNight: item.seen?.firstNight ?? null }));
}

/** First of a kind: the earliest night, or `null` for an empty group. */
function earliest(nights: readonly string[]): string | null {
  return nights[0] ?? null;
}

/** The N-th earliest night, or `null` while fewer than N are seen. */
function nth(nights: readonly string[], n: number): string | null {
  return nights[n - 1] ?? null;
}

/** All of a set: the latest night once `seen` reaches `total`. */
function allOf(nights: readonly string[], total: number): { seen: number; total: number; night: string | null } {
  return { seen: nights.length, total, night: nights.length >= total ? (nights[nights.length - 1] ?? null) : null };
}

/**
 * Every milestone's state for a progress model, in `MILESTONES` order. Reached nights follow the log: they move
 * with an earlier entry and vanish with the last entry that reached them (keeping a milestone once reached is the
 * stored record's job, not this rule's).
 */
export function milestonesOf(progress: ObservingProgress): MilestoneState[] {
  const checklistItems = [...progress.messier.items, ...progress.caldwell.items];
  const planetKeys: readonly string[] = PLANET_TARGET_KEYS;
  const planetNights = nightsOf(progress.firsts.filter((first) => planetKeys.includes(first.key)));
  const moonNights = nightsOf(progress.firsts.filter((first) => first.key === MOON_TARGET_KEY));
  const messierNights = nightsOf(firstNightsOfItems(progress.messier.items));
  const caldwellNights = nightsOf(firstNightsOfItems(progress.caldwell.items));
  const nightsOfType = (types: readonly DeepSkyType[]) =>
    nightsOf(firstNightsOfItems(checklistItems.filter((item) => types.includes(item.type))));

  const states: Record<MilestoneKey, () => Omit<MilestoneState, "key">> = {
    "first-moon": () => ({ reachedNight: earliest(moonNights) }),
    "first-planet": () => ({ reachedNight: earliest(planetNights) }),
    "all-planets": () => {
      const { night, ...counted } = allOf(planetNights, PLANET_TARGET_KEYS.length);
      return { reachedNight: night, progress: counted };
    },
    "first-galaxy": () => ({ reachedNight: earliest(nightsOfType(["galaxy"])) }),
    "first-globular": () => ({ reachedNight: earliest(nightsOfType(["globular-cluster"])) }),
    "first-nebula": () => ({ reachedNight: earliest(nightsOfType(NEBULA_TYPES)) }),
    "messier-10": () => countState(messierNights, MESSIER_COUNTS["messier-10"]),
    "messier-25": () => countState(messierNights, MESSIER_COUNTS["messier-25"]),
    "messier-50": () => countState(messierNights, MESSIER_COUNTS["messier-50"]),
    "messier-110": () => {
      const { night, ...counted } = allOf(messierNights, progress.messier.total);
      return { reachedNight: night, progress: counted };
    },
    "caldwell-all": () => {
      const { night, ...counted } = allOf(caldwellNights, progress.caldwell.total);
      return { reachedNight: night, progress: counted };
    },
  };

  return MILESTONES.map(({ key }) => ({ key, ...states[key]() }));
}

/** A count milestone: reached on the N-th earliest night, with the seen count capped at N so a page reads "10 / 10". */
function countState(nights: readonly string[], n: number): Omit<MilestoneState, "key"> {
  return { reachedNight: nth(nights, n), progress: { seen: Math.min(nights.length, n), total: n } };
}

/**
 * The keys reached in `after` but not in `before`, in `MILESTONES` order. Only the two states are compared, so a
 * milestone that was lost from `before` and is back in `after` counts again; whether it was celebrated already is
 * the stored record's job.
 */
export function newlyReached(before: readonly MilestoneState[], after: readonly MilestoneState[]): MilestoneKey[] {
  const reachedBefore = new Set(before.filter((state) => state.reachedNight !== null).map((state) => state.key));
  const reachedAfter = new Set(after.filter((state) => state.reachedNight !== null).map((state) => state.key));
  return MILESTONES.map(({ key }) => key).filter((key) => reachedAfter.has(key) && !reachedBefore.has(key));
}
