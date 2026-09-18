import { describe, expect, it } from "vitest";
import {
  computeProbabilities,
  computeWeight,
  pickWeighted,
  pickWeightedIndependent,
  pickWeightedWithoutReplacement,
  type WeightedItem,
} from "../../lib/engine/weightedRandom";

/** Deterministic seeded PRNG (returns [0, 1)) so statistical tests are reproducible, not flaky. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("computeProbabilities", () => {
  it("gives equal probability to items with equal counts and no baseRatio", () => {
    const items: WeightedItem[] = [
      { id: "a", occurrenceCount: 0 },
      { id: "b", occurrenceCount: 0 },
      { id: "c", occurrenceCount: 0 },
      { id: "d", occurrenceCount: 0 },
    ];
    const probs = computeProbabilities(items, 1.0);
    for (const p of probs.values()) {
      expect(p).toBeCloseTo(0.25, 10);
    }
  });

  it("never drives a heavily-picked item's probability to exactly 0", () => {
    const items: WeightedItem[] = [
      { id: "a", occurrenceCount: 1000 },
      { id: "b", occurrenceCount: 0 },
    ];
    const probs = computeProbabilities(items, 1.0);
    expect(probs.get("a")!).toBeGreaterThan(0);
    expect(probs.get("a")!).toBeLessThan(probs.get("b")!);
  });

  it("respects baseRatio as a prior (e.g. 60/40 Speaking Block A/B with equal counts)", () => {
    const items: WeightedItem[] = [
      { id: "blockA", occurrenceCount: 0, baseRatio: 0.6 },
      { id: "blockB", occurrenceCount: 0, baseRatio: 0.4 },
    ];
    const probs = computeProbabilities(items, 1.0);
    expect(probs.get("blockA")!).toBeCloseTo(0.6, 10);
    expect(probs.get("blockB")!).toBeCloseTo(0.4, 10);
  });

  it("k = 0 disables adaptivity entirely (probabilities follow baseRatio only, regardless of counts)", () => {
    const items: WeightedItem[] = [
      { id: "a", occurrenceCount: 0, baseRatio: 0.6 },
      { id: "b", occurrenceCount: 999, baseRatio: 0.4 },
    ];
    const probs = computeProbabilities(items, 0);
    expect(probs.get("a")!).toBeCloseTo(0.6, 10);
    expect(probs.get("b")!).toBeCloseTo(0.4, 10);
  });

  it("returns an empty map for an empty pool", () => {
    expect(computeProbabilities([], 1.0).size).toBe(0);
  });

  it("still sums to ~1 across many items (floating-point accumulation check)", () => {
    const items: WeightedItem[] = Array.from({ length: 10000 }, (_, i) => ({
      id: `item-${i}`,
      occurrenceCount: i % 37, // varied counts, not all identical
      baseRatio: 0.3 + (i % 5) * 0.1,
    }));
    const probs = computeProbabilities(items, 1.0);
    let total = 0;
    for (const p of probs.values()) total += p;
    expect(total).toBeCloseTo(1, 9);
  });

  it("handles a negative decayExponent (weight increases with count instead of decaying)", () => {
    const items: WeightedItem[] = [
      { id: "a", occurrenceCount: 0 },
      { id: "b", occurrenceCount: 9 },
    ];
    const probs = computeProbabilities(items, -1.0);
    // w_a = 1 * (1/1)^-1 = 1 ; w_b = 1 * (1/10)^-1 = 10 -> b should now be favored.
    expect(probs.get("b")!).toBeGreaterThan(probs.get("a")!);
    expect(probs.get("a")! + probs.get("b")!).toBeCloseTo(1, 10);
  });

  it("handles a fractional decayExponent without error", () => {
    const items: WeightedItem[] = [
      { id: "a", occurrenceCount: 0 },
      { id: "b", occurrenceCount: 3 },
    ];
    const probs = computeProbabilities(items, 0.5);
    // Still favors the less-picked item, just less aggressively than k=1.
    expect(probs.get("a")!).toBeGreaterThan(probs.get("b")!);
    expect(probs.get("a")! + probs.get("b")!).toBeCloseTo(1, 10);
  });
});

describe("computeWeight", () => {
  it("defaults baseRatio to 1 when omitted", () => {
    expect(computeWeight({ id: "a", occurrenceCount: 0 }, 1.0)).toBe(1);
  });
});

describe("pickWeighted", () => {
  it("is deterministic given an injected RNG", () => {
    const items: WeightedItem[] = [
      { id: "a", occurrenceCount: 0 },
      { id: "b", occurrenceCount: 0 },
    ];
    // With equal weights (1 each, total 2), random() = 0.99 * 2 = 1.98 lands past "a"'s
    // cumulative weight of 1, so it must resolve to "b".
    const picked = pickWeighted(items, { random: () => 0.99 });
    expect(picked.id).toBe("b");
  });

  it("throws on an empty pool", () => {
    expect(() => pickWeighted([])).toThrow();
  });

  it("statistically distributes ~uniformly across many all-zero-count items (not just a single deterministic call)", () => {
    const items: WeightedItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: `item-${i}`,
      occurrenceCount: 0,
    }));
    const random = mulberry32(42);
    const counts = new Map<string, number>(items.map((it) => [it.id, 0]));
    const trials = 20000;
    for (let i = 0; i < trials; i++) {
      const picked = pickWeighted(items, { random });
      counts.set(picked.id, counts.get(picked.id)! + 1);
    }
    // Equal weights -> each item should land close to 1/5 of draws (allow generous tolerance
    // to keep this non-flaky while still catching a badly skewed/broken draw).
    for (const c of counts.values()) {
      expect(c / trials).toBeGreaterThan(0.15);
      expect(c / trials).toBeLessThan(0.25);
    }
  });
});

describe("pickWeightedIndependent", () => {
  it("returns exactly `count` items, even when count exceeds pool size (repeats are allowed, unlike without-replacement)", () => {
    const items: WeightedItem[] = [{ id: "a", occurrenceCount: 0 }];
    const picked = pickWeightedIndependent(items, 5);
    expect(picked).toHaveLength(5);
    expect(picked.every((p) => p.id === "a")).toBe(true);
  });

  it("draws from the same fixed pool each time — a later draw is not affected by an earlier one", () => {
    // Reading Block A bundles 2 passages: each gets its own independent question-type
    // draw (PROJECT_CONTEXT.md 5.7), so a fixed random() sequence must land on the same
    // index both times, proving each draw re-reads the original, unshrunk pool.
    const items: WeightedItem[] = [
      { id: "a", occurrenceCount: 0 },
      { id: "b", occurrenceCount: 0 },
      { id: "c", occurrenceCount: 0 },
    ];
    let call = 0;
    const random = () => {
      call++;
      return 0.99; // always lands on the last item
    };
    const picked = pickWeightedIndependent(items, 2, { random });
    expect(picked.map((p) => p.id)).toEqual(["c", "c"]);
    expect(call).toBe(2);
  });

  it("can draw the same item twice — no de-duplication, unlike pickWeightedWithoutReplacement", () => {
    const items: WeightedItem[] = [
      { id: "only", occurrenceCount: 0 },
      { id: "never-picked", occurrenceCount: 1_000_000 },
    ];
    // Low decayExponent-driven weight makes "only" overwhelmingly likely at every draw,
    // independent of how many times it's already been drawn in this same call.
    const picked = pickWeightedIndependent(items, 3, { random: () => 0.01, decayExponent: 5 });
    expect(picked.every((p) => p.id === "only")).toBe(true);
  });

  it("returns an empty array for count = 0", () => {
    const items: WeightedItem[] = [{ id: "a", occurrenceCount: 0 }];
    expect(pickWeightedIndependent(items, 0)).toEqual([]);
  });

  it("statistically distributes ~uniformly across many all-zero-count items, same as a single pickWeighted draw", () => {
    const items: WeightedItem[] = Array.from({ length: 4 }, (_, i) => ({
      id: `item-${i}`,
      occurrenceCount: 0,
    }));
    const random = mulberry32(99);
    const counts = new Map<string, number>(items.map((it) => [it.id, 0]));
    const trials = 20000;
    for (let i = 0; i < trials; i++) {
      const [picked] = pickWeightedIndependent(items, 1, { random });
      counts.set(picked.id, counts.get(picked.id)! + 1);
    }
    for (const c of counts.values()) {
      expect(c / trials).toBeGreaterThan(0.2);
      expect(c / trials).toBeLessThan(0.3);
    }
  });
});

describe("pickWeightedWithoutReplacement", () => {
  it("returns the requested count of distinct items", () => {
    const items: WeightedItem[] = [
      { id: "a", occurrenceCount: 0 },
      { id: "b", occurrenceCount: 0 },
      { id: "c", occurrenceCount: 0 },
      { id: "d", occurrenceCount: 0 },
    ];
    const picked = pickWeightedWithoutReplacement(items, 2, { random: () => 0.5 });
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((p) => p.id)).size).toBe(2);
  });

  it("throws when count exceeds the pool size", () => {
    const items: WeightedItem[] = [{ id: "a", occurrenceCount: 0 }];
    expect(() => pickWeightedWithoutReplacement(items, 2)).toThrow();
  });

  it("statistically favors a heavily-skewed low-count item over many trials without ever excluding the others", () => {
    const items: WeightedItem[] = [
      { id: "rare", occurrenceCount: 0 },
      { id: "common-1", occurrenceCount: 100 },
      { id: "common-2", occurrenceCount: 100 },
      { id: "common-3", occurrenceCount: 100 },
    ];
    const random = mulberry32(7);
    const firstPickCounts = new Map<string, number>(items.map((it) => [it.id, 0]));
    const trials = 5000;
    for (let i = 0; i < trials; i++) {
      const [first] = pickWeightedWithoutReplacement(items, 2, { random });
      firstPickCounts.set(first.id, firstPickCounts.get(first.id)! + 1);
    }
    // "rare" (count 0) should be drawn first far more often than any single common item.
    expect(firstPickCounts.get("rare")!).toBeGreaterThan(firstPickCounts.get("common-1")! * 5);
    // But the heavily-picked items must still have nonzero probability (never exactly excluded).
    expect(firstPickCounts.get("common-1")!).toBeGreaterThan(0);
    expect(firstPickCounts.get("common-2")!).toBeGreaterThan(0);
    expect(firstPickCounts.get("common-3")!).toBeGreaterThan(0);
  });

  it("removes the exact drawn instance (by reference) rather than the first id-match, if ids were ever duplicated", () => {
    // Defensive case: real callers get ids from DB primary keys so this shouldn't occur,
    // but the pool-shrinking logic should key off the drawn object identity, not `id`,
    // so a duplicate id can't cause the wrong entry to be removed.
    const first = { id: "dup", occurrenceCount: 0, label: "first" };
    const second = { id: "dup", occurrenceCount: 0, label: "second" };
    const pool = [first, second];
    // random() = 0.9 lands in the second half of the (equal-weight) wheel -> picks `second`.
    const picked = pickWeightedWithoutReplacement(pool, 2, { random: () => 0.9 });
    expect(picked.map((p) => (p as unknown as { label: string }).label)).toEqual(["second", "first"]);
  });
});
