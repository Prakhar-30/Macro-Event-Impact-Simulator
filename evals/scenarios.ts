/**
 * Hand-curated eval scenarios. Each one defines a portfolio, a scenario text,
 * and *behavioral expectations* — not exact outputs. The runner asserts that
 * the agent's tool-call trace and final briefing satisfy those expectations.
 *
 * Behaviors we check:
 *   - mustClassifyTags: classification must include each of these tags
 *   - mustNotClassifyTags: classification must NOT include any of these
 *   - mustUseAnalogs: must call find_historical_analogs at least once
 *   - mustReferenceAnalog: at least one of these event ids must appear in
 *       the analog set OR be cited in the final text
 *   - topContributorsInclude: at least one of these tickers must appear
 *       among the top 3 weighted contributors in compute_position_impact output
 *   - portfolioMedianSign: sign of the portfolio-median impact ('+' / '-' / 'any')
 *   - honestyMustHold: final text must NOT contain forecasting language
 */
import type { ScenarioTag } from "@macroscope/tools";

export type SignExpect = "+" | "-" | "any";

export interface EvalPortfolio {
  name: string;
  positions: { ticker: string; weight: number }[];
}

export interface EvalScenario {
  id: string;
  description: string;
  portfolio: EvalPortfolio;
  scenario: string;
  horizon: "1d" | "5d" | "30d";
  mustClassifyTags?: ScenarioTag[];
  mustNotClassifyTags?: ScenarioTag[];
  mustUseAnalogs?: boolean;
  mustReferenceAnalog?: string[];
  topContributorsInclude?: string[];
  portfolioMedianSign?: SignExpect;
  honestyMustHold?: boolean;
}

const PF_TECH: EvalPortfolio = {
  name: "Tech Heavy",
  positions: [
    { ticker: "NVDA", weight: 0.2 },
    { ticker: "MSFT", weight: 0.15 },
    { ticker: "AAPL", weight: 0.1 },
    { ticker: "GOOGL", weight: 0.1 },
    { ticker: "META", weight: 0.1 },
    { ticker: "AVGO", weight: 0.08 },
    { ticker: "AMD", weight: 0.07 },
    { ticker: "ASML", weight: 0.05 },
    { ticker: "TSM", weight: 0.05 },
    { ticker: "AMZN", weight: 0.1 },
  ],
};

const PF_BALANCED: EvalPortfolio = {
  name: "Balanced",
  positions: [
    { ticker: "SPY", weight: 0.5 },
    { ticker: "TLT", weight: 0.2 },
    { ticker: "GLD", weight: 0.1 },
    { ticker: "XLE", weight: 0.1 },
    { ticker: "EFA", weight: 0.1 },
  ],
};

const PF_DIVIDEND: EvalPortfolio = {
  name: "Dividend",
  positions: [
    { ticker: "JNJ", weight: 0.12 },
    { ticker: "PG", weight: 0.12 },
    { ticker: "KO", weight: 0.1 },
    { ticker: "PEP", weight: 0.1 },
    { ticker: "VZ", weight: 0.08 },
    { ticker: "T", weight: 0.08 },
    { ticker: "XOM", weight: 0.1 },
    { ticker: "CVX", weight: 0.1 },
    { ticker: "MCD", weight: 0.1 },
    { ticker: "WMT", weight: 0.1 },
  ],
};

const PF_BANKS: EvalPortfolio = {
  name: "Banks",
  positions: [
    { ticker: "JPM", weight: 0.2 },
    { ticker: "BAC", weight: 0.15 },
    { ticker: "WFC", weight: 0.15 },
    { ticker: "C", weight: 0.1 },
    { ticker: "USB", weight: 0.1 },
    { ticker: "PNC", weight: 0.1 },
    { ticker: "TFC", weight: 0.1 },
    { ticker: "KRE", weight: 0.1 },
  ],
};

export const SCENARIOS: EvalScenario[] = [
  {
    id: "fed_dovish_surprise",
    description: "Surprise dovish pivot — should match dovish events; longs in growth/REITs benefit, banks ambiguous.",
    portfolio: PF_TECH,
    scenario: "The Fed cuts rates 50bps unexpectedly at the next meeting and signals more easing.",
    horizon: "5d",
    mustClassifyTags: ["rate_shock_dovish"],
    mustReferenceAnalog: ["fed_emergency_zero_2020", "coordinated_cut_2008"],
    mustUseAnalogs: true,
    honestyMustHold: true,
  },
  {
    id: "oil_supply_shock",
    description: "Oil supply shock — energy positions outperform; airlines/cyclicals underperform.",
    portfolio: PF_DIVIDEND,
    scenario: "Oil spikes to $150/bbl due to a Middle East refinery attack and supply disruption.",
    horizon: "5d",
    mustClassifyTags: ["oil_supply_shock", "geopolitical_middle_east"],
    mustReferenceAnalog: ["russia_invades_ukraine_2022", "hamas_attack_2023"],
    topContributorsInclude: ["XOM", "CVX"],
    mustUseAnalogs: true,
    honestyMustHold: true,
  },
  {
    id: "ai_capex_slowdown",
    description: "AI capex repricing — semis/AI infra hit hardest; software relatively resilient.",
    portfolio: PF_TECH,
    scenario: "Hyperscaler AI capex slows sharply as cheap reasoning models commoditize compute. NVDA and semis sell off.",
    horizon: "5d",
    mustClassifyTags: ["ai_capex_shock"],
    mustReferenceAnalog: ["deepseek_jan_2025"],
    topContributorsInclude: ["NVDA", "AVGO", "AMD"],
    portfolioMedianSign: "-",
    honestyMustHold: true,
  },
  {
    id: "taiwan_blockade",
    description: "Taiwan tensions escalate — geopolitical_asia + risk_off; semis with Taiwan exposure (TSM, AVGO) hit.",
    portfolio: PF_TECH,
    scenario: "China escalates Taiwan tensions to a naval blockade, halting commercial shipping.",
    horizon: "5d",
    mustClassifyTags: ["geopolitical_asia", "risk_off"],
    mustUseAnalogs: true,
    portfolioMedianSign: "-",
    honestyMustHold: true,
  },
  {
    id: "regional_bank_run",
    description: "Banking stress like SVB — regional banks hammered, large banks less so.",
    portfolio: PF_BANKS,
    scenario: "A regional bank with $200B in assets fails on a deposit run; contagion fears across mid-cap banks.",
    horizon: "5d",
    mustClassifyTags: ["banking_stress"],
    mustReferenceAnalog: ["svb_collapse_2023"],
    topContributorsInclude: ["KRE", "USB", "PNC", "TFC"],
    portfolioMedianSign: "-",
    honestyMustHold: true,
  },
  {
    id: "hawkish_powell",
    description: "Hawkish Fed surprise — duration-sensitive names hit, banks mixed.",
    portfolio: PF_BALANCED,
    scenario: "Powell delivers a hawkish surprise: 50bps hike with no signal of pause.",
    horizon: "5d",
    mustClassifyTags: ["rate_shock_hawkish"],
    mustReferenceAnalog: ["taper_tantrum_2013", "powell_q4_2018"],
    portfolioMedianSign: "-",
    honestyMustHold: true,
  },
  {
    id: "uk_gilt_crisis_2",
    description: "UK fiscal credibility crack — GBP/gilts sell off; broader Europe under pressure.",
    portfolio: PF_BALANCED,
    scenario: "The UK announces an unfunded fiscal package; gilts sell off violently and sterling drops 8%.",
    horizon: "5d",
    mustClassifyTags: ["sovereign_debt", "geopolitical_europe", "currency_crisis"],
    mustReferenceAnalog: ["uk_gilt_crisis_2022"],
    honestyMustHold: true,
  },
  {
    id: "covid_redux",
    description: "Pandemic-style demand shock — defensives outperform, cyclicals fall.",
    portfolio: PF_DIVIDEND,
    scenario: "A new respiratory virus shows airborne transmission; WHO declares an emergency. Travel and discretionary names sell off.",
    horizon: "5d",
    mustClassifyTags: ["pandemic", "risk_off"],
    mustReferenceAnalog: ["covid_crash_start_2020", "omicron_emerges_2021"],
    honestyMustHold: true,
  },
  {
    id: "trade_war_escalation",
    description: "Tariff escalation against China — China-revenue tickers hit, defensives stable.",
    portfolio: PF_TECH,
    scenario: "The US announces 60% tariffs on Chinese goods; China retaliates with export controls on rare earths.",
    horizon: "5d",
    mustClassifyTags: ["trade_war", "geopolitical_asia"],
    mustReferenceAnalog: ["us_china_tariffs_2018", "trump_tariffs_aug_2019"],
    honestyMustHold: true,
  },
  {
    id: "yen_carry_redux",
    description: "Yen carry unwind — broad vol spike, EM/risk-off.",
    portfolio: PF_BALANCED,
    scenario: "BoJ surprise hike + weak US payrolls trigger violent yen rally; Nikkei down 12%, US futures gap down.",
    horizon: "1d",
    mustClassifyTags: ["vol_event", "currency_crisis", "risk_off"],
    mustReferenceAnalog: ["yen_carry_unwind_2024"],
    portfolioMedianSign: "-",
    honestyMustHold: true,
  },
  {
    id: "us_debt_ceiling_breach",
    description: "Sovereign debt scare — duration sells off, gold and defensives bid.",
    portfolio: PF_BALANCED,
    scenario: "US debt ceiling breaches with no resolution; sovereign downgrade follows.",
    horizon: "5d",
    mustClassifyTags: ["sovereign_debt", "us_fiscal_crisis"],
    mustReferenceAnalog: ["sp_us_downgrade_2011", "fitch_us_downgrade_2023"],
    honestyMustHold: true,
  },
  {
    id: "soft_landing_relief",
    description: "Recovery rally — risk-on; banks and cyclicals lead, defensives lag.",
    portfolio: PF_DIVIDEND,
    scenario: "Strong jobs + soft inflation print — markets price in a soft landing and rally.",
    horizon: "5d",
    mustClassifyTags: ["recovery_optimism"],
    mustNotClassifyTags: ["risk_off", "banking_stress", "pandemic"],
    honestyMustHold: true,
  },
  {
    id: "flash_crash",
    description: "Liquidity-driven flash crash — broad equities hit briefly, recovery within day.",
    portfolio: PF_TECH,
    scenario: "A liquidity-driven flash crash hits at 2:30pm; major indices fall 7% intraday before partial recovery.",
    horizon: "1d",
    mustClassifyTags: ["flash_crash", "vol_event"],
    mustReferenceAnalog: ["flash_crash_2010", "volmageddon_2018"],
    portfolioMedianSign: "-",
    honestyMustHold: true,
  },
  {
    id: "europe_stagflation",
    description: "Europe stagflation framing — should prefer European-revenue events; should NOT match pandemic.",
    portfolio: PF_BALANCED,
    scenario: "Energy prices spike in Europe again; ECB acknowledges stagflation; bunds sell off.",
    horizon: "5d",
    mustClassifyTags: ["geopolitical_europe", "inflation_shock_up"],
    mustNotClassifyTags: ["pandemic"],
    honestyMustHold: true,
  },
  {
    id: "oil_price_collapse",
    description: "Demand-driven oil collapse — energy names hit; consumer benefits.",
    portfolio: PF_DIVIDEND,
    scenario: "Oil collapses to $40 on a global demand recession.",
    horizon: "30d",
    mustClassifyTags: ["oil_demand_shock", "commodity_collapse"],
    mustReferenceAnalog: ["opec_no_cut_2014", "oil_low_2016"],
    honestyMustHold: true,
  },
  {
    id: "irrelevant_text",
    description: "Edge case: scenario text is irrelevant — agent must say it can't classify rather than invent tags.",
    portfolio: PF_BALANCED,
    scenario: "I'm thinking about going on vacation to Hawaii next summer.",
    horizon: "5d",
    mustNotClassifyTags: [
      "rate_shock_dovish",
      "rate_shock_hawkish",
      "oil_supply_shock",
      "banking_stress",
      "pandemic",
    ],
    honestyMustHold: true,
  },
];
