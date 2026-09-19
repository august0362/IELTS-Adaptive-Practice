/**
 * Formula 3 v2 — Band Prediction. See PROJECT_CONTEXT.md section 5.4.
 *
 * Per skill, independently:
 *   cambridgeEwma   = EWMA(Cambridge <skill>Band history, chronological, cambridgeEwmaAlpha)
 *   accuracyEwma    = EWMA(practice-accuracy % history, chronological, accuracyEwmaAlpha)
 *                     — Reading/Listening only; null for Writing/Speaking (no objective
 *                     right/wrong signal exists for those) and null until the user has
 *                     logged at least one accuracy entry.
 *   frequencyDelta  = clamp(±frequencyCap, (practiceCount30d - avgPracticeCount30d) * factor)
 *
 * Reading & Listening (accuracy tracking applies):
 *   weightedBase    = 0.65 * cambridgeEwma + 0.30 * (accuracyEwma-as-band, or cambridgeEwma
 *                     as the best guess when no accuracy data has been logged yet)
 *   frequencyCap    = 0.05 * 9
 * Writing & Speaking (no accuracy signal possible):
 *   weightedBase    = 0.65 * cambridgeEwma
 *   frequencyCap    = 0.35 * 9   (the weight that would've gone to accuracy folds into frequency)
 *
 *   rawPredictedBand = clamp(0, 9, weightedBase + frequencyDelta)
 *   predictedBand     = rawPredictedBand rounded to nearest 0.5, for display
 *
 * Overall (only when all 4 skills have a prediction):
 *   overallPredicted  = ieltsRound(mean(the 4 skills' values))
 *
 * `overallRoundingMode` picks which per-skill values feed that mean — see
 * the two modes below and PROJECT_CONTEXT.md section 5.4 for the tradeoff
 * (user-configurable; no single "correct" answer).
 */
import { ieltsRound } from "./ieltsRounding";
import { computeEwma } from "./ewma";

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
  cambridgeEwmaAlpha: number;
  accuracyEwmaAlpha: number;
  frequencyAdjustmentFactor: number;
  overallRoundingMode: OverallRoundingMode;
}

export const DEFAULT_BAND_PREDICTION_CONFIG: BandPredictionConfig = {
  cambridgeEwmaAlpha: 0.5,
  accuracyEwmaAlpha: 0.5,
  frequencyAdjustmentFactor: 0.05,
  overallRoundingMode: "per_skill_rounded",
};

const BAND_MAX = 9;

// Reading & Listening: real test score (EWMA) is still the main signal, but a
// meaningful chunk now comes from how accurately the user actually answers
// while practicing, not just how often.
const WEIGHTS_WITH_ACCURACY = { cambridge: 0.65, accuracy: 0.3, frequency: 0.05 };
// Writing & Speaking have no objective per-session right/wrong count, so the
// weight that would've gone to accuracy folds into the frequency nudge instead.
const WEIGHTS_WITHOUT_ACCURACY = { cambridge: 0.65, frequency: 0.35 };

export interface SkillPredictionInput {
  /** Cambridge <skill>Band values, OLDEST first (caller limits to the most recent N, e.g. 30). */
  cambridgeBandsChronological: number[];
  /** true for Reading/Listening (accuracy tracking applies); false for Writing/Speaking. */
  hasAccuracyComponent: boolean;
  /** Practice accuracy (0-100), OLDEST first. Ignored when hasAccuracyComponent is false. */
  accuracyPercentagesChronological: number[];
  /** Number of times this skill was practiced (rolled or manually logged) in the last 30 days. */
  practiceCount30d: number;
}

export interface SkillPredictionResult {
  /** null means "not enough data" (zero logged Cambridge tests for this skill) — never fabricate a number. */
  predictedBand: number | null;
  /** Same value clamped to [0,9] but NOT rounded to nearest 0.5 — used by the "raw_average" overall mode. */
  rawPredictedBand: number | null;
  cambridgeEwma: number | null;
  /** null when this skill has no accuracy component, or none has been logged yet. */
  accuracyEwma: number | null;
  frequencyDelta: number;
  sampleSize: number;
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
  const cambridgeEwma = computeEwma(input.cambridgeBandsChronological, config.cambridgeEwmaAlpha);

  if (cambridgeEwma === null) {
    return {
      predictedBand: null,
      rawPredictedBand: null,
      cambridgeEwma: null,
      accuracyEwma: null,
      frequencyDelta: 0,
      sampleSize: 0,
    };
  }

  const rawDelta = (input.practiceCount30d - avgPracticeCount30dAcrossSkills) * config.frequencyAdjustmentFactor;

  let weightedBase: number;
  let accuracyEwmaBand: number | null;
  let frequencyDelta: number;

  if (input.hasAccuracyComponent) {
    const accuracyEwmaPercent = computeEwma(input.accuracyPercentagesChronological, config.accuracyEwmaAlpha);
    accuracyEwmaBand = accuracyEwmaPercent === null ? null : (accuracyEwmaPercent / 100) * BAND_MAX;
    // No accuracy logged yet: best guess is that practice performance matches
    // the Cambridge-measured level, rather than losing the weight or
    // fabricating a number — mathematically equivalent to folding that
    // weight into `cambridge` until real accuracy data exists.
    const effectiveAccuracyBand = accuracyEwmaBand ?? cambridgeEwma;
    weightedBase = WEIGHTS_WITH_ACCURACY.cambridge * cambridgeEwma + WEIGHTS_WITH_ACCURACY.accuracy * effectiveAccuracyBand;
    const frequencyCap = WEIGHTS_WITH_ACCURACY.frequency * BAND_MAX;
    frequencyDelta = clamp(rawDelta, -frequencyCap, frequencyCap);
  } else {
    accuracyEwmaBand = null;
    weightedBase = WEIGHTS_WITHOUT_ACCURACY.cambridge * cambridgeEwma;
    const frequencyCap = WEIGHTS_WITHOUT_ACCURACY.frequency * BAND_MAX;
    frequencyDelta = clamp(rawDelta, -frequencyCap, frequencyCap);
  }

  const rawPredictedBand = clamp(weightedBase + frequencyDelta, 0, BAND_MAX);
  const predictedBand = roundToHalf(rawPredictedBand);

  return {
    predictedBand,
    rawPredictedBand,
    cambridgeEwma,
    accuracyEwma: accuracyEwmaBand,
    frequencyDelta,
    sampleSize: input.cambridgeBandsChronological.length,
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

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
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
