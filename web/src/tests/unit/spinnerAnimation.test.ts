import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCycleAnimation, sleep } from "../../lib/spinnerAnimation";

describe("runCycleAnimation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lands on the requested index as the final step", async () => {
    const steps: number[] = [];
    const promise = runCycleAnimation(4, 2, (i) => steps.push(i), { minSteps: 12, baseDelayMs: 10 });
    await vi.runAllTimersAsync();
    await promise;
    expect(steps[steps.length - 1]).toBe(2);
  });

  it("takes at least minSteps steps", async () => {
    const steps: number[] = [];
    const promise = runCycleAnimation(3, 0, (i) => steps.push(i), { minSteps: 12, baseDelayMs: 5 });
    await vi.runAllTimersAsync();
    await promise;
    expect(steps.length).toBeGreaterThanOrEqual(13); // minSteps + the initial call at current=0
  });

  it("resolves immediately for a zero-length pool without calling onStep", async () => {
    const onStep = vi.fn();
    await runCycleAnimation(0, 0, onStep);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("throws if landOnIndex is out of range", () => {
    expect(() => runCycleAnimation(3, 3, () => {})).toThrow();
    expect(() => runCycleAnimation(3, -1, () => {})).toThrow();
  });

  it("calls onStep with every visited index, cycling modulo length", async () => {
    const steps: number[] = [];
    const promise = runCycleAnimation(3, 1, (i) => steps.push(i), { minSteps: 6, baseDelayMs: 5 });
    await vi.runAllTimersAsync();
    await promise;
    for (const step of steps) {
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThan(3);
    }
    expect(steps[steps.length - 1]).toBe(1);
  });
});

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after the given delay", async () => {
    let resolved = false;
    const promise = sleep(100).then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    await promise;
    expect(resolved).toBe(true);
  });
});
