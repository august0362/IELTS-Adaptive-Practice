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

/** Fisher-Yates shuffle with an injectable RNG (same convention as weightedRandom.ts). */
function shuffle<T>(items: T[], random: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function partitionByWeeklyOverdue<T extends SkillForConstraint>(
  items: T[],
  now: Date,
  weeklyThresholdDays: number,
  slotsNeeded: number,
  random: () => number = Math.random
): WeeklyPartition<T> {
  const thresholdMs = weeklyThresholdDays * 24 * 60 * 60 * 1000;

  // Shuffle before sorting: items tied on daysSinceMs (most commonly several
  // skills that have never appeared, all Infinity — every fresh app start)
  // must not always resolve to the same skills in DB/seed order. Array.sort
  // is stable, and a tied comparison returns 0 below, so ties keep whatever
  // order the shuffle gave them instead of falling back to insertion order —
  // this was a real bug: `Infinity - Infinity` is NaN, which a stable sort
  // treats as "don't reorder," so the first 2 skills in seed order (Reading,
  // Listening) were force-picked on every fresh roll, never randomly.
  const overdue = shuffle(items, random)
    .filter((item) => daysSinceMs(item.lastAppearedAt, now) >= thresholdMs)
    .sort((a, b) => {
      const diff = daysSinceMs(b.lastAppearedAt, now) - daysSinceMs(a.lastAppearedAt, now);
      return Number.isNaN(diff) ? 0 : diff;
    });

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
  const { forced, remaining } = partitionByWeeklyOverdue(
    items,
    now,
    weeklyThresholdDays,
    slotCount,
    options.random ?? Math.random
  );

  if (forced.length >= slotCount) {
    return forced.slice(0, slotCount);
  }

  const slotsLeft = slotCount - forced.length;
  const drawn = pickWeightedWithoutReplacement(remaining, slotsLeft, options);
  return [...forced, ...drawn];
}
