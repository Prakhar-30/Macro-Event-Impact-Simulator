# Thematic exposure tags

These live in `tickers.thematic_tags` (jsonb array). Used by `get_portfolio_exposures`
to map a portfolio's holdings into exposure axes that the scenario classifier
also outputs against.

Keep this list short. New tags require re-tagging the curated universe in
`seed/exposures.json`.

## Tech / AI

- `ai_infrastructure` — semis + hyperscalers building or supplying the AI stack
- `ai_demand` — companies whose forward revenue is dependent on others' AI capex
- `tech_hyperscaler` — big-cloud trio (and adjacent)
- `tech_software` — SaaS / enterprise software
- `semis_designer` — fabless designers
- `semis_foundry_eq` — foundries + semicap

## Cyclicals / sectoral

- `defense_contractor`
- `energy_oil` — upstream + integrated
- `energy_pipeline`
- `energy_renewable`
- `auto_ev`
- `auto_legacy`
- `bank_large` — money-center / G-SIB banks
- `bank_regional`
- `reit` — rate-sensitive
- `homebuilder` — rate-sensitive
- `commodities_metals`
- `commodities_gold`
- `staples_defensive`
- `luxury`

## Geographic exposure

- `china_revenue_heavy` — >25% revenue from China/Greater China
- `europe_revenue_heavy` — >25% revenue from Europe
- `em_revenue_heavy` — >25% from EM ex-China

## Other

- `etf_broad` — broad index ETF
- `etf_sector` — single-sector ETF
- `etf_thematic` — thematic ETF
- `etf_bond` — bond ETF (used for rate sensitivity benchmarking)
- `dividend_yielder` — high yielder, defensive bond-proxy behavior
