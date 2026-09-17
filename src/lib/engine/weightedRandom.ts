/**
 * Formula 1 — Weighted Random Engine. See PROJECT_CONTEXT.md section 5.2.
 *
 *   w_i = baseRatio_i * (1 / (count_i + 1)) ^ k
 *   p_i = w_i / sum(w_j)
 *
 * Pure functions: no DB or framework imports, so these are trivial to unit test.
 */

export interface WeightedItem {
  id: string;
  occurrenceCount: number;
  /** Prior weight within its pool. Defaults to 1 (equal prior) when omitted. */
  baseRatio?: number;
}

export interface WeightedPickOptions {
  /** k in the formula above. Default 1.0. */
  decayExponent?: number;
  /** Injectable RNG (returns [0, 1)) so callers can make picks deterministic in tests. */
  random?: () => number;
}

const DEFAULT_DECAY_EXPONENT = 1.0;

export function computeWeight(item: WeightedItem, decayExponent: number = DEFAULT_DECAY_EXPONENT): number {
  const baseRatio = item.baseRatio ?? 1;
  return baseRatio * Math.pow(1 / (item.occurrenceCount + 1), decayExponent);
}

/** Returns a Map from item.id to its normalized probability (sums to 1 across items). */
export function computeProbabilities<T extends WeightedItem>(
  items: T[],
  decayExponent: number = DEFAULT_DECAY_EXPONENT
): Map<string, number> {
  if (items.length === 0) return new Map();
  const weights = items.map((item) => computeWeight(item, decayExponent));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const probabilities = new Map<string, number>();
  items.forEach((item, i) => probabilities.set(item.id, weights[i] / total));
  return probabilities;
}

/** Roulette-wheel draw over the pool's current weights. */
export function pickWeighted<T extends WeightedItem>(items: T[], options: WeightedPickOptions = {}): T {
  if (items.length === 0) throw new Error("pickWeighted: cannot pick from an empty list");

  const decayExponent = options.decayExponent ?? DEFAULT_DECAY_EXPONENT;
  const random = options.random ?? Math.random;

  const weights = items.map((item) => computeWeight(item, decayExponent));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const target = random() * total;

  let cumulative = 0;
  for (let i = 0; i < items.length; i++) {
    cumulative += weights[i];
    if (target <= cumulative) return items[i];
  }
  // Floating-point fallback: target landed exactly on (or past) the total due to rounding.
  return items[items.length - 1];
}

/**
 * Draws `count` distinct items from the pool without replacement. Weights are
 * recomputed over the shrinking pool after each draw using the *original*
 * occurrenceCount values passed in — counts are not incremented mid-draw.
 */
export function pickWeightedWithoutReplacement<T extends WeightedItem>(
  items: T[],
  count: number,
  options: WeightedPickOptions = {}
): T[] {
  if (count > items.length) {
    throw new Error("pickWeightedWithoutReplacement: count exceeds pool size");
  }

  const pool = [...items];
  const picked: T[] = [];

  for (let i = 0; i < count; i++) {
    const chosen = pickWeighted(pool, options);
    picked.push(chosen);
    // Remove by object reference (indexOf), not by `id` (findIndex + id-equality).
    // `chosen` is literally the array element pickWeighted returned from `pool`, so
    // indexOf always finds the exact drawn instance. Real callers get ids from DB
    // primary keys, so duplicates can't happen — but if two pool entries ever did
    // share an id, id-based lookup would risk splicing out the wrong (earlier)
    // entry and leaving the actually-drawn one eligible for a repeat draw.
    pool.splice(pool.indexOf(chosen), 1);
  }

  return picked;
}
