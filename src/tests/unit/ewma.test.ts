import { describe, expect, it } from "vitest";
import { computeEwma } from "../../lib/engine/ewma";

describe("computeEwma", () => {
  it("returns null for an empty array", () => {
    expect(computeEwma([], 0.5)).toBeNull();
  });

  it("returns the single value unchanged for a 1-element array, regardless of alpha", () => {
    expect(computeEwma([7], 0.1)).toBe(7);
    expect(computeEwma([7], 0.9)).toBe(7);
  });

  it("weights the newest value by alpha and the smoothed history by (1 - alpha)", () => {
    // e1=4, e2=0.5*4+0.5*4=4, e3=0.5*8+0.5*4=6
    expect(computeEwma([4, 4, 8], 0.5)).toBeCloseTo(6, 10);
  });

  it("alpha close to 1 makes the result track the newest value almost exactly", () => {
    expect(computeEwma([0, 0, 0, 9], 0.999)).toBeCloseTo(9, 1);
  });

  it("alpha close to 0 makes the result barely move away from the first value", () => {
    expect(computeEwma([0, 9, 9, 9], 0.001)).toBeCloseTo(0, 1);
  });

  it("a constant sequence returns that constant regardless of alpha", () => {
    expect(computeEwma([5, 5, 5, 5], 0.3)).toBeCloseTo(5, 10);
    expect(computeEwma([5, 5, 5, 5], 0.7)).toBeCloseTo(5, 10);
  });
});
