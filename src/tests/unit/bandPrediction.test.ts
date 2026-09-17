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

  // DESIGN AMBIGUITY (flagged, not resolved by this test — see Supervisor review report):
  // PROJECT_CONTEXT.md's Formula 3 comment reads
  //   predictedBand_skill = clamp(0, 9, cambridgeAvg + delta)   // rounded to nearest 0.5 for display
  // which could mean rounding is purely a UI concern (overallPredicted should average the
  // full-precision clamped values, then ieltsRound once), or that a "band" is by definition
  // always a half-increment value (matching how real Cambridge/IELTS skill scores work) and
  // so the half-rounded predictedBand is correctly what feeds the overall mean too. The
  // current implementation does the latter (rounds each skill to the nearest 0.5 *before*
  // averaging for overallPredicted). This test pins that behavior down and demonstrates a
  // case where it produces a different overallPredicted than the alternative reading would.
  it("computes overallPredicted from the already-half-rounded per-skill bands, not the raw clamped values (documents current behavior)", () => {
    // Raw (pre-round) predicted values would be ~6.2501, 6.2501, 6.2501, 6.0 (all clamps at cambridgeAvg
    // since practiceCount30d equals the group average, so frequencyDelta = 0 for every skill).
    const input: FourSkillPredictionInput = {
      reading: { recentCambridgeBands: [6.2501], practiceCount30d: 5 },
      listening: { recentCambridgeBands: [6.2501], practiceCount30d: 5 },
      writing: { recentCambridgeBands: [6.2501], practiceCount30d: 5 },
      speaking: { recentCambridgeBands: [6.0], practiceCount30d: 5 },
    };
    const result = predictAllSkillBands(input);
    // Each 6.2501 individually rounds to 6.5 (nearest half); 6.0 stays 6.0.
    expect(result.reading.predictedBand).toBe(6.5);
    expect(result.speaking.predictedBand).toBe(6.0);
    // mean(6.5, 6.5, 6.5, 6.0) = 6.375 -> ieltsRound = 6.5.
    // (The raw-average reading would instead be mean(6.2501 x3, 6.0) = 6.1876 -> ieltsRound = 6.0.)
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
