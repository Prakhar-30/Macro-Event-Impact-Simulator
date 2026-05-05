import { describe, it, expect } from "vitest";
import { classifyScenarioRulebased } from "./classify_scenario.js";

describe("classifyScenarioRulebased", () => {
  it("hawkish surprise → rate_shock_hawkish", () => {
    const r = classifyScenarioRulebased("The Fed surprises with a hawkish 50bps hike");
    expect(r.tags).toContain("rate_shock_hawkish");
  });

  it("dovish surprise → rate_shock_dovish + auto monetary_emergency", () => {
    const r = classifyScenarioRulebased("Fed announces an emergency 100bps cut and unlimited QE");
    expect(r.tags).toContain("rate_shock_dovish");
    expect(r.tags).toContain("monetary_emergency");
  });

  it("oil shock + Middle East", () => {
    const r = classifyScenarioRulebased(
      "Oil spikes to $150/bbl after a Middle East refinery attack"
    );
    expect(r.tags).toContain("oil_supply_shock");
    expect(r.tags).toContain("geopolitical_middle_east");
    expect(r.tags).toContain("commodity_spike");
  });

  it("AI capex slowdown → ai_capex_shock + tech_correction", () => {
    const r = classifyScenarioRulebased(
      "Hyperscaler capex slows sharply; AI selloff in tech names"
    );
    expect(r.tags).toContain("ai_capex_shock");
    expect(r.tags).toContain("tech_correction");
  });

  it("Taiwan blockade → geopolitical_asia + risk_off", () => {
    const r = classifyScenarioRulebased(
      "China escalates Taiwan tensions to a naval blockade — broad sell-off"
    );
    expect(r.tags).toContain("geopolitical_asia");
    expect(r.tags).toContain("risk_off");
  });

  it("banking stress", () => {
    const r = classifyScenarioRulebased("A regional bank collapse triggers deposit flight");
    expect(r.tags).toContain("banking_stress");
  });

  it("returns empty + low confidence on irrelevant text", () => {
    const r = classifyScenarioRulebased("the weather is nice today");
    expect(r.tags).toHaveLength(0);
    expect(r.confidence).toBe(0);
  });
});
