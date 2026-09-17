/**
 * Formula 3 — Band Prediction. See PROJECT_CONTEXT.md section 5.4.
 *
 * Per skill, independently:
 *   cambridgeAvg      = mean(last N CambridgeTestResult.<skill>Band)
 *   frequencyDelta    = clamp(-cap, +cap, (practiceCount30d - avgPracticeCount30d) * factor)
 *   predictedBand     = clamp(0, 9, cambridgeAvg + frequencyDelta), rounded to nearest 0.5
 * Overall (only when all 4 skills have a predictedBand):
 *   overallPredicted  = ieltsRound(mean(the 4 predictedBand values))
 *
 * The frequency term is intentionally a small bounded nudge, not a full
 * parallel score — see PROJECT_CONTEXT.md section 5.4 for why.
 */
import { ieltsRound } from "./ieltsRounding";

export interface BandPredictionConfig {
  frequencyAdjustmentFactor: number;
  frequencyAdjustmentCap: number;
}

export const DEFAULT_BAND_PREDICTION_CONFIG: BandPredictionConfig = {
  frequencyAdjustmentFactor: 0.05,
  frequencyAdjustmentCap: 0.5,
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
    return { predictedBand: null, cambridgeAvg: null, frequencyDelta: 0, sampleSize: 0 };
  }

  const rawDelta = (input.practiceCount30d - avgPracticeCount30dAcrossSkills) * config.frequencyAdjustmentFactor;
  const frequencyDelta = clamp(rawDelta, -config.frequencyAdjustmentCap, config.frequencyAdjustmentCap);
  const predictedBand = roundToHalf(clamp(cambridgeAvg + frequencyDelta, 0, 9));

  return {
    predictedBand,
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
  /** null unless all 4 skills have a non-null predictedBand. */
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

  const allBands = [reading.predictedBand, listening.predictedBand, writing.predictedBand, speaking.predictedBand];
  const overallPredicted = allBands.every((band): band is number => band !== null)
    ? ieltsRound(mean(allBands as number[])!)
    : null;

  return { reading, listening, writing, speaking, overallPredicted };
}
