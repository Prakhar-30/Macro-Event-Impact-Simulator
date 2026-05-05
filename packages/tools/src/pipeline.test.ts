/**
 * The M3 done-criterion test: full end-to-end scenario → classification →
 * analogs → reactions → portfolio impact, with NO LLM in the loop.
 *
 * Skipped automatically if DATABASE_URL is not set. Requires a seeded DB
 * + reactions populated by `pnpm db:reactions`.
 */
import { describe, it, expect } from "vitest";
import { runDeterministicPipeline } from "./index.js";

const dbAvailable = !!process.env.DATABASE_URL;
const maybe = dbAvailable ? describe : describe.skip;

maybe("runDeterministicPipeline (DB-backed)", () => {
  it("produces a coherent end-to-end output for a classic scenario", async () => {
    const out = await runDeterministicPipeline({
      scenario: "Oil spikes to $150/bbl after a Middle East conflict",
      positions: [
        { ticker: "XOM", weight: 0.25 },
        { ticker: "CVX", weight: 0.25 },
        { ticker: "AAPL", weight: 0.25 },
        { ticker: "JPM", weight: 0.25 },
      ],
      horizon: "5d",
    });

    expect(out.classification.tags).toContain("oil_supply_shock");
    expect(out.classification.tags).toContain("geopolitical_middle_east");
    expect(out.analogs.length).toBeGreaterThan(0);
    // We expect XOM/CVX to have positive median in oil-shock analogs.
    const energy = out.impact.positionImpacts.find((p) => p.ticker === "XOM");
    expect(energy?.analogCount ?? 0).toBeGreaterThan(0);
  });
});
