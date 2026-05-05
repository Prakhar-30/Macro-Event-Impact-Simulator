/**
 * classify_scenario(text) -> { tags, confidence, rationale }
 *
 * Two implementations:
 *   - classifyScenarioRulebased — pure, deterministic, no LLM. Used in tests
 *     and as a fallback when no API key is set. Hand-written keyword rules.
 *   - classifyScenarioLLM       — wraps Anthropic Messages API with a tight
 *     system prompt + the canonical tag list. Uses Opus 4.7 per project policy.
 *
 * The agent loop (M4) uses the LLM path. The eval baseline (M3 done-criterion)
 * uses the rule-based path so the full pipeline can be tested without any LLM.
 */
import type { ScenarioTag, ClassificationResult } from "./types.js";

const RULES: Array<{ tag: ScenarioTag; patterns: RegExp[] }> = [
  // Monetary
  { tag: "rate_shock_dovish", patterns: [/\b(rate cut|cuts? rates|emergency cut|dovish|easing|pivot)\b/i, /\bcuts? \d+\s*bps?\b/i, /\b\d+\s*bps?\s*cut\b/i] },
  { tag: "rate_shock_hawkish", patterns: [/\b(rate hike|hikes? rates|hawkish|tightening|taper|raises? rates)\b/i, /\bhikes? \d+\s*bps?\b/i] },
  { tag: "monetary_emergency", patterns: [/\b(QE|quantitative easing|liquidity facility|lender of last resort|emergency liquidity)\b/i] },
  { tag: "inflation_shock_up", patterns: [/\b(inflation surprise|hot CPI|wage spiral|inflation jumps|reflation)\b/i] },
  { tag: "inflation_shock_down", patterns: [/\b(disinflation|deflation|cooling inflation)\b/i] },

  // Risk regime
  { tag: "risk_off", patterns: [/\b(risk[- ]off|sell[- ]off|crash|panic|flight to (quality|safety))\b/i] },
  { tag: "risk_on_relief", patterns: [/\b(rally|relief rally|risk[- ]on|FOMO|melt[- ]up)\b/i] },
  { tag: "growth_scare", patterns: [/\b(growth scare|recession (fears?|risk)|hard landing)\b/i] },
  { tag: "recovery_optimism", patterns: [/\b(soft landing|recovery|reopening)\b/i] },

  // Commodity / energy
  { tag: "oil_supply_shock", patterns: [/\b(oil (spikes?|surges?)|OPEC cut|supply shock|refinery|pipeline attack|strait of hormuz)\b/i, /\boil.*\$\d+\/?b/i] },
  { tag: "oil_demand_shock", patterns: [/\b(oil (collapses?|crashes?|plunges?)|demand collapse)\b/i] },
  { tag: "commodity_spike", patterns: [/\b(commodity (spike|rally)|metals rally|wheat surges)\b/i] },
  { tag: "commodity_collapse", patterns: [/\b(commodity (collapse|crash)|metals plunge)\b/i] },

  // Geopolitical
  { tag: "geopolitical_europe", patterns: [/\b(europe|EU|euro[- ]?zone|Russia|Ukraine|Brexit|UK)\b/i] },
  { tag: "geopolitical_asia", patterns: [/\b(China|Taiwan|North Korea|South China Sea|Asia[- ]Pacific)\b/i] },
  { tag: "geopolitical_middle_east", patterns: [/\b(Iran|Israel|Hamas|Saudi|Yemen|middle east|Gulf)\b/i] },
  { tag: "geopolitical_americas", patterns: [/\b(Mexico|Brazil|Venezuela|Argentina)\b/i] },

  // Trade
  { tag: "trade_war", patterns: [/\b(tariff|trade war|export controls|sanctions package|decoupling)\b/i] },
  { tag: "trade_deescalation", patterns: [/\b(trade deal|deescalation|tariff removed|truce)\b/i] },

  // Financial system
  { tag: "banking_stress", patterns: [/\b(bank (run|failure|collapse)|regional bank|SVB|Credit Suisse|deposit flight|banking crisis)\b/i] },
  { tag: "sovereign_debt", patterns: [/\b(sovereign downgrade|debt ceiling|gilt crisis|default|credit downgrade)\b/i] },
  { tag: "currency_crisis", patterns: [/\b(devaluation|peg breaks|FX (crisis|crash)|sterling collapse|yen unwind)\b/i] },
  { tag: "em_stress", patterns: [/\b(emerging markets? (stress|sell[- ]off|outflow)|EM crisis)\b/i] },

  // Structural
  { tag: "flash_crash", patterns: [/\b(flash crash|liquidity (vacuum|breakdown))\b/i] },
  { tag: "vol_event", patterns: [/\b(vol (spike|event|regime)|VIX (spike|surge)|short[- ]?vol unwind)\b/i] },
  { tag: "tech_correction", patterns: [/\b(tech (selloff|correction|rout)|growth (selloff|correction))\b/i] },
  { tag: "ai_capex_shock", patterns: [/\b(AI capex|hyperscaler (spending|capex)|datacenter capex|AI bubble)\b/i, /\bAI.*(slows?|crashes?|bubble)\b/i] },

  // Health / disaster
  { tag: "pandemic", patterns: [/\b(pandemic|COVID|virus outbreak|epidemic|WHO emergency)\b/i] },
  { tag: "natural_disaster", patterns: [/\b(earthquake|hurricane|tsunami|natural disaster|flooding)\b/i] },

  // Political
  { tag: "us_election_surprise", patterns: [/\b(US election (surprise|upset)|surprise (Republican|Democrat) (win|sweep))\b/i] },
  { tag: "us_fiscal_crisis", patterns: [/\b(US debt ceiling|government shutdown|US fiscal (crisis|cliff))\b/i] },
];

export function classifyScenarioRulebased(text: string): ClassificationResult {
  const matched: ScenarioTag[] = [];
  const reasons: string[] = [];
  for (const rule of RULES) {
    for (const re of rule.patterns) {
      if (re.test(text)) {
        if (!matched.includes(rule.tag)) {
          matched.push(rule.tag);
          reasons.push(`${rule.tag} <- ${re.source}`);
        }
        break;
      }
    }
  }

  // Co-occurrence boosts: certain tag pairs imply additional tags.
  const has = (t: ScenarioTag) => matched.includes(t);

  if (has("oil_supply_shock") && !has("commodity_spike")) {
    matched.push("commodity_spike");
    reasons.push("commodity_spike <- co-occurrence with oil_supply_shock");
  }
  if (has("rate_shock_dovish") && !has("monetary_emergency") && /unlimited|emergency/i.test(text)) {
    matched.push("monetary_emergency");
    reasons.push("monetary_emergency <- emergency-language with dovish");
  }
  if (has("ai_capex_shock") && !has("tech_correction")) {
    matched.push("tech_correction");
    reasons.push("tech_correction <- co-occurrence with ai_capex_shock");
  }

  // Confidence: scaled by how many rules fired (capped). Pure heuristic;
  // primarily used to gate tool retries in M4 if the LLM declines a call.
  const confidence = matched.length === 0 ? 0 : Math.min(1, 0.4 + 0.15 * matched.length);

  return {
    tags: matched,
    confidence,
    rationale:
      matched.length === 0
        ? "No rule-based tag matched. Pass to LLM classifier or ask the user to rephrase."
        : `Rule-based match: ${reasons.join("; ")}`,
  };
}
