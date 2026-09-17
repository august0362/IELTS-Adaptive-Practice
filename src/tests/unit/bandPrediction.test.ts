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
