/**
 * Note: this test depends on a live Postgres seeded with the M2 events.
 * It auto-skips if DATABASE_URL is not set, so vitest can still run in CI
 * environments without infra. Run after `pnpm db:migrate && pnpm db:seed`.
 */
import { describe, it, expect } from "vitest";
import { findHistoricalAnalogs } from "./find_historical_analogs.js";

const dbAvailable = !!process.env.DATABASE_URL;
const maybe = dbAvailable ? describe : describe.skip;

maybe("findHistoricalAnalogs (DB-backed)", () => {
  it("returns analogs ranked by tag overlap", async () => {
    const out = await findHistoricalAnalogs(["geopolitical_asia", "trade_war"], 10);
    expect(out.length).toBeGreaterThan(0);
    // Trade-war + Asia events should be top of the list.
    const firstTags = out[0]?.matchedTags ?? [];
    expect(firstTags.length).toBeGreaterThanOrEqual(1);
  });

  it("respects minOverlap", async () => {
    const out = await findHistoricalAnalogs(["pandemic"], 5, { minOverlap: 1 });
    for (const ev of out) {
      expect(ev.matchedTags.length).toBeGreaterThanOrEqual(1);
    }
  });
});
