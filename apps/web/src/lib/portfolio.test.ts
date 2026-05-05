import { describe, it, expect } from "vitest";
import { parsePortfolioCsv, PortfolioInputSchema } from "./portfolio";

describe("parsePortfolioCsv", () => {
  it("parses a simple header+rows csv with weights", () => {
    const csv = `ticker,weight
AAPL,0.4
MSFT,0.3
NVDA,0.3
`;
    const out = parsePortfolioCsv(csv);
    expect(out.errors).toHaveLength(0);
    expect(out.rows).toHaveLength(3);
    expect(out.rows[0]).toMatchObject({ ticker: "AAPL", weight: 0.4 });
  });

  it("normalizes weights that don't sum to 1", () => {
    const csv = `ticker,weight
AAPL,40
MSFT,30
NVDA,30
`;
    const out = parsePortfolioCsv(csv);
    expect(out.errors).toHaveLength(0);
    const sum = out.rows.reduce((a, r) => a + r.weight, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(out.warnings.some((w) => w.includes("normalized"))).toBe(true);
  });

  it("derives weights from shares when weight column missing", () => {
    const csv = `ticker,shares
AAPL,100
MSFT,50
`;
    const out = parsePortfolioCsv(csv);
    expect(out.errors).toHaveLength(0);
    expect(out.rows.find((r) => r.ticker === "AAPL")?.weight).toBeCloseTo(2 / 3, 6);
    expect(out.rows.find((r) => r.ticker === "MSFT")?.weight).toBeCloseTo(1 / 3, 6);
  });

  it("rejects rows with invalid tickers but keeps the rest", () => {
    const csv = `ticker,weight
AAPL,0.5
123BAD,0.3
MSFT,0.5
`;
    const out = parsePortfolioCsv(csv);
    expect(out.rows.map((r) => r.ticker)).toEqual(["AAPL", "MSFT"]);
    expect(out.warnings.some((w) => w.includes("123BAD"))).toBe(true);
  });

  it("errors on missing ticker column", () => {
    const csv = `symbol,weight
AAPL,0.5
`;
    const out = parsePortfolioCsv(csv);
    expect(out.errors.some((e) => e.includes("ticker"))).toBe(true);
  });
});

describe("PortfolioInputSchema", () => {
  it("accepts a normal portfolio", () => {
    const r = PortfolioInputSchema.safeParse({
      name: "Tech",
      positions: [
        { ticker: "AAPL", weight: 0.5 },
        { ticker: "MSFT", weight: 0.5 },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty positions", () => {
    const r = PortfolioInputSchema.safeParse({ name: "Empty", positions: [] });
    expect(r.success).toBe(false);
  });
});
