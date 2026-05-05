import { describe, it, expect } from "vitest";
import { median, quantile } from "./stats.js";

describe("median", () => {
  it("returns NaN on empty", () => {
    expect(Number.isNaN(median([]))).toBe(true);
  });
  it("odd length", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("even length", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("with negatives", () => {
    expect(median([-2, -1, 0, 1, 2])).toBe(0);
  });
});

describe("quantile", () => {
  it("p25 / p75 of 1..5", () => {
    const v = [1, 2, 3, 4, 5];
    expect(quantile(v, 0.25)).toBe(2);
    expect(quantile(v, 0.75)).toBe(4);
  });
  it("p25 of 1..4 (interpolated)", () => {
    const v = [1, 2, 3, 4];
    expect(quantile(v, 0.25)).toBeCloseTo(1.75, 6);
    expect(quantile(v, 0.75)).toBeCloseTo(3.25, 6);
  });
  it("clamps q out of [0,1]", () => {
    expect(quantile([1, 2, 3], -0.1)).toBe(1);
    expect(quantile([1, 2, 3], 1.1)).toBe(3);
  });
});
