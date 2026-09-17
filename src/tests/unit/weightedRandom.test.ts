import { describe, expect, it } from "vitest";
import {
  computeProbabilities,
  computeWeight,
  pickWeighted,
  pickWeightedWithoutReplacement,
  type WeightedItem,
} from "../../lib/engine/weightedRandom";

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
});
