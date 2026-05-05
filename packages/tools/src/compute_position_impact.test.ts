import { describe, it, expect } from "vitest";
import { computePositionImpact } from "./compute_position_impact.js";
import type { AnalogReaction } from "./types.js";

describe("computePositionImpact", () => {
  const positions = [
    { ticker: "AAPL", weight: 0.5 },
    { ticker: "XOM", weight: 0.5 },
  ];

  it("computes median and quantiles per position", () => {
    const reactions: AnalogReaction[] = [
      { eventId: "e1", ticker: "AAPL", horizon: "5d", pctReturn: -0.05 },
      { eventId: "e2", ticker: "AAPL", horizon: "5d", pctReturn: -0.02 },
      { eventId: "e3", ticker: "AAPL", horizon: "5d", pctReturn: 0.01 },
      { eventId: "e1", ticker: "XOM", horizon: "5d", pctReturn: 0.04 },
      { eventId: "e2", ticker: "XOM", horizon: "5d", pctReturn: 0.07 },
      { eventId: "e3", ticker: "XOM", horizon: "5d", pctReturn: 0.12 },
    ];
    const out = computePositionImpact(positions, reactions, "5d");

    const aapl = out.positionImpacts.find((p) => p.ticker === "AAPL")!;
    expect(aapl.median).toBeCloseTo(-0.02, 6);
    expect(aapl.analogCount).toBe(3);

    const xom = out.positionImpacts.find((p) => p.ticker === "XOM")!;
    expect(xom.median).toBeCloseTo(0.07, 6);

    expect(out.portfolioMedian).toBeCloseTo(0.5 * -0.02 + 0.5 * 0.07, 6);
    expect(out.analogEventIds.sort()).toEqual(["e1", "e2", "e3"]);
  });

  it("sorts impacts by absolute weighted contribution", () => {
    const reactions: AnalogReaction[] = [
      { eventId: "e1", ticker: "AAPL", horizon: "5d", pctReturn: -0.01 },
      { eventId: "e1", ticker: "XOM", horizon: "5d", pctReturn: 0.2 },
    ];
    const out = computePositionImpact(positions, reactions, "5d");
    expect(out.positionImpacts[0]?.ticker).toBe("XOM");
  });

  it("flags positions with no coverage", () => {
    const reactions: AnalogReaction[] = [
      { eventId: "e1", ticker: "AAPL", horizon: "5d", pctReturn: 0.01 },
    ];
    const out = computePositionImpact(positions, reactions, "5d");
    expect(out.positionsWithoutCoverage).toEqual(["XOM"]);
    expect(out.positionImpacts.length).toBe(1);
  });

  it("ignores reactions for the wrong horizon", () => {
    const reactions: AnalogReaction[] = [
      { eventId: "e1", ticker: "AAPL", horizon: "1d", pctReturn: -0.5 },
      { eventId: "e1", ticker: "AAPL", horizon: "5d", pctReturn: -0.02 },
    ];
    const out = computePositionImpact([{ ticker: "AAPL", weight: 1 }], reactions, "5d");
    expect(out.positionImpacts[0]?.median).toBeCloseTo(-0.02, 6);
  });

  it("returns NaN portfolio median when no coverage at all", () => {
    const out = computePositionImpact(positions, [], "5d");
    expect(Number.isNaN(out.portfolioMedian)).toBe(true);
    expect(out.positionsWithoutCoverage.sort()).toEqual(["AAPL", "XOM"]);
  });
});
