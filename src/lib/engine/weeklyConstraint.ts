/**
 * Formula 2 — Weekly-minimum override for the 4-skill pool only.
 * See PROJECT_CONTEXT.md section 5.3.
 *
 * A hard rule layered on top of Formula 1: any skill that hasn't appeared in
 * >= weeklyThresholdDays is force-selected (most overdue first) before the
 * remaining slots are filled by the normal weighted draw.
 */
import { pickWeightedWithoutReplacement, type WeightedItem, type WeightedPickOptions } from "./weightedRandom";

export interface SkillForConstraint extends WeightedItem {
  lastAppearedAt: Date | null;
}

export interface WeeklyPartition<T> {
  /** Most-overdue-first, capped at slotsNeeded. */
  forced: T[];
  /** Items not force-selected; the pool to draw the remaining slots from. */
  remaining: T[];
}

function daysSinceMs(lastAppearedAt: Date | null, now: Date): number {
  if (lastAppearedAt === null) return Infinity;
  return now.getTime() - lastAppearedAt.getTime();
}

export function partitionByWeeklyOverdue<T extends SkillForConstraint>(
  items: T[],
  now: Date,
  weeklyThresholdDays: number,
  slotsNeeded: number
): WeeklyPartition<T> {
  const thresholdMs = weeklyThresholdDays * 24 * 60 * 60 * 1000;

  const overdue = items
    .filter((item) => daysSinceMs(item.lastAppearedAt, now) >= thresholdMs)
    .sort((a, b) => daysSinceMs(b.lastAppearedAt, now) - daysSinceMs(a.lastAppearedAt, now));

  const forced = overdue.slice(0, slotsNeeded);
  const forcedIds = new Set(forced.map((item) => item.id));
  const remaining = items.filter((item) => !forcedIds.has(item.id));

  return { forced, remaining };
}

/**
 * Picks `slotCount` distinct skills: overdue skills first (most overdue
 * wins ties for the limited slots), then fills any remaining slots via the
 * normal Formula 1 weighted draw among non-forced skills.
 */
export function pickSkillsWithWeeklyConstraint<T extends SkillForConstraint>(
  items: T[],
  now: Date,
  weeklyThresholdDays: number,
  slotCount: number,
  options: WeightedPickOptions = {}
): T[] {
  const { forced, remaining } = partitionByWeeklyOverdue(items, now, weeklyThresholdDays, slotCount);

  if (forced.length >= slotCount) {
    return forced.slice(0, slotCount);
  }

  const slotsLeft = slotCount - forced.length;
  const drawn = pickWeightedWithoutReplacement(remaining, slotsLeft, options);
  return [...forced, ...drawn];
}
