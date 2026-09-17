/**
 * "Slot machine" style cycling reveal: calls `onStep` with an index into
 * [0, length) repeatedly, slowing down each step, guaranteed to land exactly
 * on `landOnIndex` on the final call. Used by the Spinner UI to visually
 * cycle through skill/part cards before landing on the server-chosen result
 * (the server, not this animation, decides the outcome — this is purely
 * presentational).
 */
export function runCycleAnimation(
  length: number,
  landOnIndex: number,
  onStep: (index: number) => void,
  options: { minSteps?: number; baseDelayMs?: number; delayGrowth?: number } = {}
): Promise<void> {
  const { minSteps = 12, baseDelayMs = 60, delayGrowth = 1.15 } = options;

  if (length <= 0) return Promise.resolve();
  if (landOnIndex < 0 || landOnIndex >= length) {
    throw new Error("runCycleAnimation: landOnIndex out of range");
  }

  // Find the smallest step count >= minSteps whose final index lands on landOnIndex.
  let totalSteps = minSteps;
  while (totalSteps % length !== landOnIndex) totalSteps++;

  return new Promise((resolve) => {
    let current = 0;
    let delay = baseDelayMs;

    function tick() {
      onStep(current % length);
      if (current === totalSteps) {
        resolve();
        return;
      }
      current++;
      delay *= delayGrowth;
      setTimeout(tick, delay);
    }

    tick();
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
