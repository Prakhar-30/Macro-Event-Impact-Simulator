# Scenario tag taxonomy

Both `historical_events.tags` and the output of `classify_scenario` use the same vocabulary.
Keep this list small and stable — every new tag means re-tagging the event database.

## Macro / monetary

- `rate_shock_dovish` — surprise easing, emergency cut, dovish pivot
- `rate_shock_hawkish` — surprise hike, hawkish pivot, taper
- `monetary_emergency` — QE, lender of last resort, unlimited liquidity
- `inflation_shock_up` — surprise CPI upside, wage spiral signal
- `inflation_shock_down` — surprise disinflation, deflation scare

## Risk regime

- `risk_off` — broad equity decline, vol spike, flight to quality
- `risk_on_relief` — broad rally, vol crush, FOMU rally
- `growth_scare` — recession fears intensifying without crisis trigger
- `recovery_optimism` — recovery / soft landing rally

## Commodity / energy

- `oil_supply_shock` — OPEC cut, Middle East disruption, refining outage
- `oil_demand_shock` — demand collapse (often pandemic / recession driven)
- `commodity_spike` — broad commodities up (food, metals)
- `commodity_collapse` — broad commodities down

## Geopolitical

- `geopolitical_europe`
- `geopolitical_asia`
- `geopolitical_middle_east`
- `geopolitical_americas`

## Trade

- `trade_war` — tariffs, export controls, escalation
- `trade_deescalation`

## Financial system

- `banking_stress` — bank runs, contagion fears, systemic banks under stress
- `sovereign_debt` — debt ceiling, downgrades, sovereign solvency fears
- `currency_crisis` — devaluations, unpegs, FX dislocations
- `em_stress` — emerging-market specific drawdown / outflows

## Structural / market microstructure

- `flash_crash` — liquidity-driven dislocation
- `vol_event` — vol regime break
- `tech_correction` — tech / growth specific drawdown
- `ai_capex_shock` — hyperscaler capex repricing (relevant for 2024+)

## Health / disaster

- `pandemic`
- `natural_disaster`

## Political (US-specific, narrow use)

- `us_election_surprise`
- `us_fiscal_crisis`
