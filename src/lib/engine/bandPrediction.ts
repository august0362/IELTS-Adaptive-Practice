/**
 * Formula 3 — Band Prediction. See PROJECT_CONTEXT.md section 5.4.
 *
 * Per skill, independently:
 *   cambridgeAvg      = mean(last N CambridgeTestResult.<skill>Band)
 *   frequencyDelta    = clamp(-cap, +cap, (practiceCount30d - avgPracticeCount30d) * factor)
 *   rawPredictedBand  = clamp(0, 9, cambridgeAvg + frequencyDelta)
 *   predictedBand     = rawPredictedBand rounded to nearest 0.5, for display
 * Overall (only when all 4 skills have a prediction):
 *   overallPredicted  = ieltsRound(mean(the 4 skills' values))
 *
 * `overallRoundingMode` picks which per-skill values feed that mean — see
 * the two modes below and PROJECT_CONTEXT.md section 5.4 for the tradeoff
 * (user-configurable; no single "correct" answer).
 *
 * The frequency term is intentionally a small bounded nudge, not a full
 * parallel score — see PROJECT_CONTEXT.md section 5.4 for why.
 */
import { ieltsRound } from "./ieltsRounding";

/**
 * - "per_skill_rounded" (default): average the 4 skills' *rounded* (nearest-0.5)
 *   predicted bands. Matches how real IELTS certificates work — Reading/Listening
 *   scores come from a raw-to-band lookup table and Writing/Speaking scores are
 *   averaged-and-rounded from criteria, so a real skill band is always already a
 *   discrete 0.5-increment value before the overall is computed from it.
 * - "raw_average": average the 4 skills' full-precision clamped values (before
 *   per-skill rounding) and round only once, at the end. Avoids compounding two
 *   rounding steps, at the cost of no longer mirroring real IELTS's own per-skill
 *   discreteness.
 */
export type OverallRoundingMode = "per_skill_rounded" | "raw_average";

export interface BandPredictionConfig {
  frequencyAdjustmentFactor: number;
  frequencyAdjustmentCap: number;
  overallRoundingMode: OverallRoundingMode;
}

export const DEFAULT_BAND_PREDICTION_CONFIG: BandPredictionConfig = {
  frequencyAdjustmentFactor: 0.05,
  frequencyAdjustmentCap: 0.5,
  overallRoundingMode: "per_skill_rounded",
};

export interface SkillPredictionInput {
  /** Bands from the most recent Cambridge tests for this skill (caller has already limited to the last N, e.g. 30). */
  recentCambridgeBands: number[];
  /** Number of times this skill was practiced (rolled) in the last 30 days. */
  practiceCount30d: number;
}

export interface SkillPredictionResult {
  /** null means "not enough data" (zero logged Cambridge tests for this skill) — never fabricate a number. */
  predictedBand: number | null;
  /** Same value clamped to [0,9] but NOT rounded to nearest 0.5 — used by the "raw_average" overall mode. */
  rawPredictedBand: number | null;
  cambridgeAvg: number | null;
  frequencyDelta: number;
  sampleSize: number;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

export function predictSkillBand(
  input: SkillPredictionInput,
  avgPracticeCount30dAcrossSkills: number,
  config: BandPredictionConfig = DEFAULT_BAND_PREDICTION_CONFIG
): SkillPredictionResult {
  const cambridgeAvg = mean(input.recentCambridgeBands);

  if (cambridgeAvg === null) {
    return { predictedBand: null, rawPredictedBand: null, cambridgeAvg: null, frequencyDelta: 0, sampleSize: 0 };
  }

  const rawDelta = (input.practiceCount30d - avgPracticeCount30dAcrossSkills) * config.frequencyAdjustmentFactor;
  const frequencyDelta = clamp(rawDelta, -config.frequencyAdjustmentCap, config.frequencyAdjustmentCap);
  const rawPredictedBand = clamp(cambridgeAvg + frequencyDelta, 0, 9);
  const predictedBand = roundToHalf(rawPredictedBand);

  return {
    predictedBand,
    rawPredictedBand,
    cambridgeAvg,
    frequencyDelta,
    sampleSize: input.recentCambridgeBands.length,
  };
}

export interface FourSkillPredictionInput {
  reading: SkillPredictionInput;
  listening: SkillPredictionInput;
  writing: SkillPredictionInput;
  speaking: SkillPredictionInput;
}

export interface FourSkillPredictionResult {
  reading: SkillPredictionResult;
  listening: SkillPredictionResult;
  writing: SkillPredictionResult;
  speaking: SkillPredictionResult;
  /** null unless all 4 skills have a non-null prediction. */
  overallPredicted: number | null;
}

export function predictAllSkillBands(
  input: FourSkillPredictionInput,
  config: BandPredictionConfig = DEFAULT_BAND_PREDICTION_CONFIG
): FourSkillPredictionResult {
  const inputs = [input.reading, input.listening, input.writing, input.speaking];
  const avgPracticeCount30d = mean(inputs.map((s) => s.practiceCount30d)) ?? 0;

  const reading = predictSkillBand(input.reading, avgPracticeCount30d, config);
  const listening = predictSkillBand(input.listening, avgPracticeCount30d, config);
  const writing = predictSkillBand(input.writing, avgPracticeCount30d, config);
  const speaking = predictSkillBand(input.speaking, avgPracticeCount30d, config);

  const results = [reading, listening, writing, speaking];
  const valuesForOverall =
    config.overallRoundingMode === "raw_average"
      ? results.map((r) => r.rawPredictedBand)
      : results.map((r) => r.predictedBand);

  const overallPredicted = valuesForOverall.every((v): v is number => v !== null)
    ? ieltsRound(mean(valuesForOverall as number[])!)
    : null;

  return { reading, listening, writing, speaking, overallPredicted };
}
