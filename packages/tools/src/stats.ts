// Distribution helpers used by compute_position_impact.
// Pure, deterministic, fully unit-testable.

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  if (sorted.length % 2 === 1) return sorted[Math.floor(mid)] as number;
  const lo = sorted[mid - 1] as number;
  const hi = sorted[mid] as number;
  return (lo + hi) / 2;
}

/**
 * Linear-interpolated quantile, R-7 / Excel-style.
 * q in [0,1]. NaN on empty input.
 */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  if (q <= 0) return Math.min(...values);
  if (q >= 1) return Math.max(...values);
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo] as number;
  const frac = pos - lo;
  const a = sorted[lo] as number;
  const b = sorted[hi] as number;
  return a + (b - a) * frac;
}
