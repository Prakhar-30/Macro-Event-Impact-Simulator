import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// packages/db/src -> repo root -> seed/
const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "seed");

const KNOWN_TAGS = new Set([
  "rate_shock_dovish",
  "rate_shock_hawkish",
  "monetary_emergency",
  "inflation_shock_up",
  "inflation_shock_down",
  "risk_off",
  "risk_on_relief",
  "growth_scare",
  "recovery_optimism",
  "oil_supply_shock",
  "oil_demand_shock",
  "commodity_spike",
  "commodity_collapse",
  "geopolitical_europe",
  "geopolitical_asia",
  "geopolitical_middle_east",
  "geopolitical_americas",
  "trade_war",
  "trade_deescalation",
  "banking_stress",
  "sovereign_debt",
  "currency_crisis",
  "em_stress",
  "flash_crash",
  "vol_event",
  "tech_correction",
  "ai_capex_shock",
  "pandemic",
  "natural_disaster",
  "us_election_surprise",
  "us_fiscal_crisis",
]);

const KNOWN_THEMATIC_TAGS = new Set([
  "ai_infrastructure",
  "ai_demand",
  "tech_hyperscaler",
  "tech_software",
  "semis_designer",
  "semis_foundry_eq",
  "defense_contractor",
  "energy_oil",
  "energy_pipeline",
  "energy_renewable",
  "auto_ev",
  "auto_legacy",
  "bank_large",
  "bank_regional",
  "reit",
  "homebuilder",
  "commodities_metals",
  "commodities_gold",
  "staples_defensive",
  "luxury",
  "china_revenue_heavy",
  "europe_revenue_heavy",
  "em_revenue_heavy",
  "etf_broad",
  "etf_sector",
  "etf_thematic",
  "etf_bond",
  "dividend_yielder",
]);

describe("events.sql", () => {
  const sql = readFileSync(join(SEED_DIR, "events.sql"), "utf8");

  it("parses every event id from the INSERT VALUES", () => {
    const rows = [...sql.matchAll(/\('([a-z0-9_]+)',\s*'(\d{4}-\d{2}-\d{2})'/g)];
    expect(rows.length).toBeGreaterThanOrEqual(30);
  });

  it("uses only known scenario tags", () => {
    const tagArrays = [...sql.matchAll(/'\[([^\]]+)\]'::jsonb,\s*\d+,/g)];
    expect(tagArrays.length).toBeGreaterThan(0);
    for (const m of tagArrays) {
      const tagsRaw = m[1] ?? "";
      const tags = [...tagsRaw.matchAll(/"([a-z_]+)"/g)].map((mm) => mm[1] as string);
      for (const t of tags) {
        expect(KNOWN_TAGS.has(t), `unknown scenario tag: ${t}`).toBe(true);
      }
    }
  });

  it("has reasonable severity range", () => {
    const sevs = [...sql.matchAll(/'\[[^\]]+\]'::jsonb,\s*(\d+),/g)].map((m) => Number(m[1]));
    for (const s of sevs) {
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(4);
    }
  });
});

describe("exposures.json", () => {
  const json = JSON.parse(readFileSync(join(SEED_DIR, "exposures.json"), "utf8")) as {
    tickers: Array<{ symbol: string; gics_sector: string; thematic_tags: string[] }>;
  };

  it("parses with ≥150 tickers", () => {
    expect(json.tickers.length).toBeGreaterThanOrEqual(150);
  });

  it("has unique symbols", () => {
    const set = new Set<string>();
    for (const t of json.tickers) {
      expect(set.has(t.symbol), `dup ticker ${t.symbol}`).toBe(false);
      set.add(t.symbol);
    }
  });

  it("uses only known thematic tags", () => {
    for (const t of json.tickers) {
      for (const tag of t.thematic_tags) {
        expect(KNOWN_THEMATIC_TAGS.has(tag), `unknown thematic tag ${tag} on ${t.symbol}`).toBe(
          true
        );
      }
    }
  });
});

describe("news.json", () => {
  const json = JSON.parse(readFileSync(join(SEED_DIR, "news.json"), "utf8")) as {
    items: Array<{ event_id: string; date: string; source: string; headline: string }>;
  };

  it("parses and has at least one headline per event", () => {
    expect(json.items.length).toBeGreaterThanOrEqual(30);
  });

  it("references only known event ids from events.sql", () => {
    const eventsSql = readFileSync(join(SEED_DIR, "events.sql"), "utf8");
    const eventIds = new Set(
      [...eventsSql.matchAll(/\('([a-z0-9_]+)',\s*'\d{4}-\d{2}-\d{2}'/g)].map((m) => m[1] as string)
    );
    for (const item of json.items) {
      expect(eventIds.has(item.event_id), `unknown event_id ${item.event_id} in news.json`).toBe(
        true
      );
    }
  });

  it("has well-formed dates and non-empty headlines", () => {
    for (const item of json.items) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(item.date)).toBe(true);
      expect(item.headline.length).toBeGreaterThan(0);
      expect(item.source.length).toBeGreaterThan(0);
    }
  });
});
