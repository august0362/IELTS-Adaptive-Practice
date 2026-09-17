import { describe, expect, it } from "vitest";
import {
  predictAllSkillBands,
  predictSkillBand,
  type FourSkillPredictionInput,
} from "../../lib/engine/bandPrediction";

describe("predictSkillBand", () => {
  it("returns null (not enough data) when there are zero Cambridge results", () => {
    const result = predictSkillBand({ recentCambridgeBands: [], practiceCount30d: 5 }, 5);
    expect(result.predictedBand).toBeNull();
    expect(result.rawPredictedBand).toBeNull();
    expect(result.cambridgeAvg).toBeNull();
  });

  it("predicts the plain Cambridge average when practice frequency matches the group average", () => {
    const result = predictSkillBand({ recentCambridgeBands: [6, 6.5, 7], practiceCount30d: 5 }, 5);
    expect(result.cambridgeAvg).toBeCloseTo(6.5, 10);
    expect(result.frequencyDelta).toBe(0);
    expect(result.predictedBand).toBe(6.5);
  });

  it("nudges the prediction up when this skill is practiced more than the group average", () => {
    const result = predictSkillBand({ recentCambridgeBands: [6], practiceCount30d: 10 }, 5);
    // (10 - 5) * 0.05 = 0.25
    expect(result.frequencyDelta).toBeCloseTo(0.25, 10);
    expect(result.predictedBand).toBe(6.5); // 6 + 0.25 = 6.25, rounded to nearest 0.5
  });

  it("caps the frequency nudge at the configured ceiling instead of scaling unbounded", () => {
    const result = predictSkillBand({ recentCambridgeBands: [6], practiceCount30d: 1000 }, 5);
    expect(result.frequencyDelta).toBe(0.5);
  });

  it("never predicts a band above 9 even if Cambridge average + nudge would exceed it", () => {
    const result = predictSkillBand({ recentCambridgeBands: [9, 9, 9], practiceCount30d: 1000 }, 5);
    expect(result.predictedBand).toBe(9);
  });

  it("never predicts a band below 0", () => {
    const result = predictSkillBand({ recentCambridgeBands: [0], practiceCount30d: 0 }, 5);
    expect(result.predictedBand).toBe(0);
  });

  it("reports sampleSize 1 for a skill with exactly one logged Cambridge result", () => {
    const result = predictSkillBand({ recentCambridgeBands: [7], practiceCount30d: 5 }, 5);
    expect(result.sampleSize).toBe(1);
    expect(result.cambridgeAvg).toBe(7);
  });
});

describe("predictAllSkillBands", () => {
  it("computes an overall predicted band when all 4 skills have data", () => {
    const input: FourSkillPredictionInput = {
      reading: { recentCambridgeBands: [6.5], practiceCount30d: 5 },
      listening: { recentCambridgeBands: [7], practiceCount30d: 5 },
      writing: { recentCambridgeBands: [6], practiceCount30d: 5 },
      speaking: { recentCambridgeBands: [6.5], practiceCount30d: 5 },
    };
    const result = predictAllSkillBands(input);
    // mean(6.5, 7, 6, 6.5) = 6.5 exactly -> ieltsRound(6.5) = 6.5
    expect(result.overallPredicted).toBe(6.5);
  });

  // Resolved by the user: overallRoundingMode is a user-configurable setting (Config table
  // key `overall_prediction_rounding_mode`), not a fixed design choice. Both modes are
  // implemented in predictAllSkillBands; these two tests pin down each one with the same
  // worked example so a future session sees exactly how they diverge.
  it("'per_skill_rounded' (default) averages each skill's already-half-rounded band", () => {
    // Raw (pre-round) predicted values would be ~6.2501, 6.2501, 6.2501, 6.0 (all clamps at cambridgeAvg
    // since practiceCount30d equals the group average, so frequencyDelta = 0 for every skill).
    const input: FourSkillPredictionInput = {
      reading: { recentCambridgeBands: [6.2501], practiceCount30d: 5 },
      listening: { recentCambridgeBands: [6.2501], practiceCount30d: 5 },
      writing: { recentCambridgeBands: [6.2501], practiceCount30d: 5 },
      speaking: { recentCambridgeBands: [6.0], practiceCount30d: 5 },
    };
    const result = predictAllSkillBands(input); // default config: overallRoundingMode: "per_skill_rounded"
    // Each 6.2501 individually rounds to 6.5 (nearest half); 6.0 stays 6.0.
    expect(result.reading.predictedBand).toBe(6.5);
    expect(result.speaking.predictedBand).toBe(6.0);
    // mean(6.5, 6.5, 6.5, 6.0) = 6.375 -> ieltsRound = 6.5.
    expect(result.overallPredicted).toBe(6.5);
  });

  it("'raw_average' averages each skill's full-precision clamped value before rounding once", () => {
    const input: FourSkillPredictionInput = {
      reading: { recentCambridgeBands: [6.2501], practiceCount30d: 5 },
      listening: { recentCambridgeBands: [6.2501], practiceCount30d: 5 },
      writing: { recentCambridgeBands: [6.2501], practiceCount30d: 5 },
      speaking: { recentCambridgeBands: [6.0], practiceCount30d: 5 },
    };
    const result = predictAllSkillBands(input, {
      frequencyAdjustmentFactor: 0.05,
      frequencyAdjustmentCap: 0.5,
      overallRoundingMode: "raw_average",
    });
    // Per-skill rawPredictedBand values are unaffected by the mode.
    expect(result.reading.rawPredictedBand).toBeCloseTo(6.2501, 10);
    // mean(6.2501, 6.2501, 6.2501, 6.0) = 6.187575 -> ieltsRound = 6.0 (frac < 0.25).
    expect(result.overallPredicted).toBe(6.0);
  });

  it("leaves overallPredicted null when any single skill has zero Cambridge data", () => {
    const input: FourSkillPredictionInput = {
      reading: { recentCambridgeBands: [6.5], practiceCount30d: 5 },
      listening: { recentCambridgeBands: [], practiceCount30d: 5 }, // no data yet
      writing: { recentCambridgeBands: [6], practiceCount30d: 5 },
      speaking: { recentCambridgeBands: [6.5], practiceCount30d: 5 },
    };
    const result = predictAllSkillBands(input);
    expect(result.listening.predictedBand).toBeNull();
    expect(result.overallPredicted).toBeNull();
  });
});
