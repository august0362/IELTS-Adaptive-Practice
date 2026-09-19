/**
 * Exponentially-weighted moving average — the "past fades gradually, present
 * dominates" building block used by Formula 3 v2 (PROJECT_CONTEXT.md 5.4).
 *
 *   EWMA_1 = x_1
 *   EWMA_t = alpha * x_t + (1 - alpha) * EWMA_(t-1)
 *
 * Higher alpha weights the newest point more heavily; no data point is ever
 * fully excluded (contrast with "just take the last N and drop the rest").
 * Pure function: no DB/framework imports, trivial to unit test.
 */
export function computeEwma(valuesOldestFirst: number[], alpha: number): number | null {
  if (valuesOldestFirst.length === 0) return null;

  let ewma = valuesOldestFirst[0];
  for (let i = 1; i < valuesOldestFirst.length; i++) {
    ewma = alpha * valuesOldestFirst[i] + (1 - alpha) * ewma;
  }
  return ewma;
}
