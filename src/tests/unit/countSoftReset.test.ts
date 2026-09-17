import { describe, expect, it } from "vitest";
import { applyCountSoftReset, type CountedItem } from "../../lib/engine/countSoftReset";

describe("applyCountSoftReset", () => {
  it("does nothing when max count is below the threshold", () => {
    const items: CountedItem[] = [
      { id: "a", occurrenceCount: 10 },
      { id: "b", occurrenceCount: 49 },
    ];
    const result = applyCountSoftReset(items, 50);
    expect(result.didReset).toBe(false);
    expect(result.items).toBe(items); // same reference, untouched
  });

  it("halves every count (integer division) once max count reaches the threshold", () => {
    const items: CountedItem[] = [
      { id: "a", occurrenceCount: 50 },
      { id: "b", occurrenceCount: 7 },
      { id: "c", occurrenceCount: 0 },
    ];
    const result = applyCountSoftReset(items, 50);
    expect(result.didReset).toBe(true);
    expect(result.items).toEqual([
      { id: "a", occurrenceCount: 25 },
      { id: "b", occurrenceCount: 3 },
      { id: "c", occurrenceCount: 0 },
    ]);
  });

  it("preserves relative ordering of counts after a reset", () => {
    const items: CountedItem[] = [
      { id: "a", occurrenceCount: 60 },
      { id: "b", occurrenceCount: 30 },
    ];
    const { items: rescaled } = applyCountSoftReset(items, 50);
    expect(rescaled[0].occurrenceCount).toBeGreaterThan(rescaled[1].occurrenceCount);
  });
});
