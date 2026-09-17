/**
 * Official IELTS overall-band rounding rule: a .25 fraction rounds up to the
 * next half band, a .75 fraction rounds up to the next whole band.
 * See PROJECT_CONTEXT.md section 5.5.
 */
export function ieltsRound(mean: number): number {
  // Guard against float imprecision (e.g. 6.7499999999999) before bucketing.
  const rounded = Math.round(mean * 10000) / 10000;
  const whole = Math.floor(rounded);
  const frac = rounded - whole;

  if (frac < 0.25) return whole;
  if (frac < 0.75) return whole + 0.5;
  return whole + 1;
}
