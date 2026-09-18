import { config as configTable } from "./schema";
import type { OverallRoundingMode } from "@/lib/engine/bandPrediction";

export interface EngineConfig {
  decayExponent: number;
  weeklyThresholdDays: number;
  frequencyAdjustmentFactor: number;
  overallRoundingMode: OverallRoundingMode;
  countSoftResetThreshold: number;
  cambridgeEwmaAlpha: number;
  accuracyEwmaAlpha: number;
}

export const ENGINE_CONFIG_DEFAULTS: EngineConfig = {
  decayExponent: 1.0,
  weeklyThresholdDays: 7,
  frequencyAdjustmentFactor: 0.05,
  overallRoundingMode: "per_skill_rounded",
  countSoftResetThreshold: 50,
  cambridgeEwmaAlpha: 0.5,
  accuracyEwmaAlpha: 0.5,
};

/**
 * Reads and parses every Config row into a typed object, falling back to
 * ENGINE_CONFIG_DEFAULTS for any key that's missing. Synchronous (`.all()`)
 * so it can be called from inside a `db.transaction()` callback, which
 * better-sqlite3 requires to be fully synchronous, as well as from plain
 * `await`-style route handlers (a sync return value is still awaitable).
 */
export function loadEngineConfig(database: { select: typeof import("./client").db.select }): EngineConfig {
  const rows = database.select().from(configTable).all();
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const num = (key: string, fallback: number) => {
    const raw = map.get(key);
    return raw === undefined ? fallback : Number(raw);
  };

  return {
    decayExponent: num("decay_exponent", ENGINE_CONFIG_DEFAULTS.decayExponent),
    weeklyThresholdDays: num("weekly_threshold_days", ENGINE_CONFIG_DEFAULTS.weeklyThresholdDays),
    frequencyAdjustmentFactor: num("frequency_adjustment_factor", ENGINE_CONFIG_DEFAULTS.frequencyAdjustmentFactor),
    overallRoundingMode:
      (map.get("overall_prediction_rounding_mode") as OverallRoundingMode | undefined) ??
      ENGINE_CONFIG_DEFAULTS.overallRoundingMode,
    countSoftResetThreshold: num("count_soft_reset_threshold", ENGINE_CONFIG_DEFAULTS.countSoftResetThreshold),
    cambridgeEwmaAlpha: num("cambridge_ewma_alpha", ENGINE_CONFIG_DEFAULTS.cambridgeEwmaAlpha),
    accuracyEwmaAlpha: num("accuracy_ewma_alpha", ENGINE_CONFIG_DEFAULTS.accuracyEwmaAlpha),
  };
}
