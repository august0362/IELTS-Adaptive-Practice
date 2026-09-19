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

  // PROJECT_CONTEXT.md section 5.5's pseudocode has no clamping step, and both real
  // call sites (CambridgeTestResult.overallBand from 4 user-entered 0-9 skill bands,
  // and Formula 3's overallPredicted from 4 already-clamped-to-[0,9] predictions)
  // guarantee an in-range input before calling this function. So out-of-range
  // clamping is intentionally the caller's responsibility, not ieltsRound's. These
  // tests pin that behavior down so it isn't silently "fixed" into a clamp later.
  it("does not clamp a mean above 9 (caller's responsibility to keep inputs in range)", () => {
    expect(ieltsRound(9.25)).toBe(9.5);
    expect(ieltsRound(9.75)).toBe(10);
  });

  it("does not clamp a negative mean (caller's responsibility to keep inputs in range)", () => {
    expect(ieltsRound(-0.5)).toBe(-0.5);
  });
});
