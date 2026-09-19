import { describe, expect, it } from "vitest";
import {
  predictAllSkillBands,
  predictSkillBand,
  type FourSkillPredictionInput,
} from "../../lib/engine/bandPrediction";

const NO_ACCURACY_CONFIG = {
  cambridgeEwmaAlpha: 0.5,
  accuracyEwmaAlpha: 0.5,
  frequencyAdjustmentFactor: 0.05,
  overallRoundingMode: "per_skill_rounded" as const,
};

describe("predictSkillBand", () => {
  it("returns null (not enough data) when there are zero Cambridge results", () => {
    const result = predictSkillBand(
      { cambridgeBandsChronological: [], hasAccuracyComponent: false, accuracyPercentagesChronological: [], practiceCount30d: 5 },
      5
    );
    expect(result.predictedBand).toBeNull();
    expect(result.rawPredictedBand).toBeNull();
    expect(result.cambridgeEwma).toBeNull();
    expect(result.accuracyEwma).toBeNull();
  });

  it("Writing/Speaking (no accuracy component): predicts 65% Cambridge EWMA + frequency nudge (cap 35% of 9)", () => {
    const result = predictSkillBand(
      {
        cambridgeBandsChronological: [6],
        hasAccuracyComponent: false,
        accuracyPercentagesChronological: [],
        practiceCount30d: 5,
      },
      5,
      NO_ACCURACY_CONFIG
    );
    // Single value EWMA = 6. practiceCount matches the group average -> frequencyDelta = 0.
    expect(result.cambridgeEwma).toBe(6);
    expect(result.accuracyEwma).toBeNull();
    expect(result.frequencyDelta).toBe(0);
    // weightedBase = 0.65 * 6 = 3.9 -> predictedBand rounds to nearest 0.5 = 4.0
    expect(result.rawPredictedBand).toBeCloseTo(3.9, 10);
    expect(result.predictedBand).toBe(4.0);
  });

  it("Writing/Speaking: frequency nudge caps at 35% of the 9-point range (3.15), not a flat 0.5 like v1", () => {
    const result = predictSkillBand(
      {
        cambridgeBandsChronological: [6],
        hasAccuracyComponent: false,
        accuracyPercentagesChronological: [],
        practiceCount30d: 1000,
      },
      5,
      NO_ACCURACY_CONFIG
    );
    expect(result.frequencyDelta).toBeCloseTo(3.15, 10);
  });

  it("Reading/Listening (accuracy component): with no accuracy data logged yet, falls back to the Cambridge EWMA for that slice", () => {
    const result = predictSkillBand(
      {
        cambridgeBandsChronological: [6],
        hasAccuracyComponent: true,
        accuracyPercentagesChronological: [],
        practiceCount30d: 5,
      },
      5,
      NO_ACCURACY_CONFIG
    );
    expect(result.cambridgeEwma).toBe(6);
    // No accuracy data yet -> reported as null (UI shows "chưa có dữ liệu")...
    expect(result.accuracyEwma).toBeNull();
    // ...but internally the missing 30% falls back to the Cambridge EWMA, so the
    // weighted base is mathematically 0.95 * cambridgeEwma = 5.7, matching a skill
    // that already has matching accuracy data at exactly the Cambridge level.
    expect(result.rawPredictedBand).toBeCloseTo(5.7, 10);
  });

  it("Reading/Listening: blends 65% Cambridge EWMA + 30% accuracy EWMA (as a 0-9 band) once accuracy data exists", () => {
    const result = predictSkillBand(
      {
        cambridgeBandsChronological: [6],
        hasAccuracyComponent: true,
        // Single value EWMA = 80% -> 80% of 9 = 7.2
        accuracyPercentagesChronological: [80],
        practiceCount30d: 5,
      },
      5,
      NO_ACCURACY_CONFIG
    );
    expect(result.accuracyEwma).toBeCloseTo(7.2, 10);
    // 0.65*6 + 0.30*7.2 = 3.9 + 2.16 = 6.06
    expect(result.rawPredictedBand).toBeCloseTo(6.06, 10);
  });

  it("Reading/Listening: frequency nudge caps at 5% of the 9-point range (0.45)", () => {
    const result = predictSkillBand(
      {
        cambridgeBandsChronological: [6],
        hasAccuracyComponent: true,
        accuracyPercentagesChronological: [],
        practiceCount30d: 1000,
      },
      5,
      NO_ACCURACY_CONFIG
    );
    expect(result.frequencyDelta).toBeCloseTo(0.45, 10);
  });

  it("EWMA weights recent Cambridge results more than older ones (past fades, present dominates)", () => {
    // Oldest-first: started low, most recent is much higher.
    const result = predictSkillBand(
      { cambridgeBandsChronological: [4, 4, 8], hasAccuracyComponent: false, accuracyPercentagesChronological: [], practiceCount30d: 5 },
      5,
      NO_ACCURACY_CONFIG
    );
    const flatMean = (4 + 4 + 8) / 3; // ~5.33
    // EWMA(alpha=0.5): e1=4, e2=0.5*4+0.5*4=4, e3=0.5*8+0.5*4=6
    expect(result.cambridgeEwma).toBeCloseTo(6, 10);
    expect(result.cambridgeEwma!).toBeGreaterThan(flatMean); // pulled toward the recent high score more than a flat average would be
  });

  it("never predicts a band above 9 even if the weighted base + nudge would exceed it", () => {
    const result = predictSkillBand(
      { cambridgeBandsChronological: [9, 9, 9], hasAccuracyComponent: false, accuracyPercentagesChronological: [], practiceCount30d: 1000 },
      5,
      NO_ACCURACY_CONFIG
    );
    expect(result.predictedBand).toBe(9);
  });

  it("never predicts a band below 0", () => {
    const result = predictSkillBand(
      { cambridgeBandsChronological: [0], hasAccuracyComponent: false, accuracyPercentagesChronological: [], practiceCount30d: 0 },
      5,
      NO_ACCURACY_CONFIG
    );
    expect(result.predictedBand).toBe(0);
  });

  it("reports sampleSize as the count of Cambridge results factored in", () => {
    const result = predictSkillBand(
      { cambridgeBandsChronological: [7], hasAccuracyComponent: false, accuracyPercentagesChronological: [], practiceCount30d: 5 },
      5,
      NO_ACCURACY_CONFIG
    );
    expect(result.sampleSize).toBe(1);
  });
});

describe("predictAllSkillBands", () => {
  function input(overrides: Partial<Record<keyof FourSkillPredictionInput, number>> = {}): FourSkillPredictionInput {
    const band = (v: number) => ({
      cambridgeBandsChronological: [v],
      hasAccuracyComponent: false,
      accuracyPercentagesChronological: [],
      practiceCount30d: 5,
    });
    return {
      reading: { ...band(overrides.reading ?? 6.5), hasAccuracyComponent: true },
      listening: { ...band(overrides.listening ?? 7), hasAccuracyComponent: true },
      writing: band(overrides.writing ?? 6),
      speaking: band(overrides.speaking ?? 6.5),
    };
  }

  it("computes an overall predicted band when all 4 skills have data", () => {
    const result = predictAllSkillBands(input(), NO_ACCURACY_CONFIG);
    expect(result.overallPredicted).not.toBeNull();
    expect(typeof result.overallPredicted).toBe("number");
  });

  it("'per_skill_rounded' (default) averages each skill's already-half-rounded band", () => {
    const result = predictAllSkillBands(input());
    expect(result.reading.predictedBand).not.toBeNull();
    expect(result.overallPredicted).not.toBeNull();
  });

  it("'raw_average' averages each skill's full-precision clamped value before rounding once", () => {
    const result = predictAllSkillBands(input(), { ...NO_ACCURACY_CONFIG, overallRoundingMode: "raw_average" });
    expect(result.reading.rawPredictedBand).not.toBeNull();
    expect(result.overallPredicted).not.toBeNull();
  });

  it("leaves overallPredicted null when any single skill has zero Cambridge data", () => {
    const noData: FourSkillPredictionInput = {
      ...input(),
      listening: { cambridgeBandsChronological: [], hasAccuracyComponent: true, accuracyPercentagesChronological: [], practiceCount30d: 5 },
    };
    const result = predictAllSkillBands(noData, NO_ACCURACY_CONFIG);
    expect(result.listening.predictedBand).toBeNull();
    expect(result.overallPredicted).toBeNull();
  });
});
