import { describe, expect, it } from "vitest";
import { ieltsRound } from "../../lib/engine/ieltsRounding";

describe("ieltsRound", () => {
  it("keeps an already-whole mean unchanged", () => {
    expect(ieltsRound(6.0)).toBe(6.0);
  });

  it("keeps an already-half mean unchanged", () => {
    expect(ieltsRound(6.5)).toBe(6.5);
  });

  it("rounds .25 up to the next half band", () => {
    expect(ieltsRound(6.25)).toBe(6.5);
  });

  it("rounds .75 up to the next whole band", () => {
    expect(ieltsRound(6.75)).toBe(7.0);
  });

  it("rounds a mid value below .25 down to the whole band", () => {
    expect(ieltsRound(6.1)).toBe(6.0);
  });

  it("rounds a mid value between .25 and .75 to the half band", () => {
    expect(ieltsRound(6.6)).toBe(6.5);
  });

  it("is not thrown off by floating-point imprecision near a boundary", () => {
    expect(ieltsRound(6.249999999999)).toBe(6.5);
    expect(ieltsRound(6.750000000001)).toBe(7.0);
  });
});
