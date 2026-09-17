/**
 * Safeguard for Formula 1 (PROJECT_CONTEXT.md section 5.2.1): occurrence
 * counts grow forever over the app's lifetime, which would otherwise make
 * `(count + 1) ^ k` shrink a heavily-used item's weight towards an
 * unreasonably tiny tail relative to a never-picked item. When the pool's
 * max count crosses `threshold`, halve every count in the pool (integer
 * division) to keep numbers bounded while preserving relative ordering.
 *
 * This never touches history tables (RollResult, CambridgeTestResult) —
 * only the live occurrenceCount counters used for weighting.
 */

export interface CountedItem {
  id: string;
  occurrenceCount: number;
}

export interface SoftResetResult<T extends CountedItem> {
  didReset: boolean;
  /** New array with rescaled counts if a reset was triggered, otherwise the original array. */
  items: T[];
}

export function applyCountSoftReset<T extends CountedItem>(items: T[], threshold: number): SoftResetResult<T> {
  const maxCount = items.reduce((max, item) => Math.max(max, item.occurrenceCount), 0);

  if (maxCount < threshold) {
    return { didReset: false, items };
  }

  const rescaled = items.map((item) => ({
    ...item,
    occurrenceCount: Math.floor(item.occurrenceCount / 2),
  }));

  return { didReset: true, items: rescaled };
}
