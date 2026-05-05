-- Curated macro event database for macroscope (M2).
-- 30 events spanning 2008-2024 covering all scenario tags in seed/scenario-tags.md.
-- Each event is identified by a stable string id used as a citation key.
-- Severity scale: 1 = notable, 2 = significant, 3 = major, 4 = crisis-level.
-- Idempotent: ON CONFLICT DO NOTHING — safe to re-run.

INSERT INTO historical_events (id, event_date, title, description, tags, severity, source_urls)
VALUES

-- 2008
('lehman_2008', '2008-09-15',
 'Lehman Brothers files for bankruptcy',
 'Lehman Brothers filed Chapter 11 protection — the largest bankruptcy in US history at the time. Triggered acute risk-off, banking stress, and global equity rout.',
 '["risk_off","banking_stress"]'::jsonb, 4,
 '["https://en.wikipedia.org/wiki/Bankruptcy_of_Lehman_Brothers"]'::jsonb),

('coordinated_cut_2008', '2008-10-08',
 'Coordinated emergency rate cuts by major central banks',
 'Fed, ECB, BoE and others coordinated 50bps emergency cuts to stem post-Lehman panic.',
 '["rate_shock_dovish","monetary_emergency","banking_stress"]'::jsonb, 3,
 '["https://www.federalreserve.gov/newsevents/pressreleases/monetary20081008a.htm"]'::jsonb),

-- 2010
('flash_crash_2010', '2010-05-06',
 'May 6 2010 flash crash',
 'Dow plunged ~9% intraday driven by HFT-related liquidity dislocation; partial recovery by close.',
 '["flash_crash","risk_off","vol_event"]'::jsonb, 2,
 '["https://en.wikipedia.org/wiki/2010_flash_crash"]'::jsonb),

('greece_bailout_2010', '2010-05-09',
 'EU + IMF announce €750B European Stabilization Mechanism',
 'In response to escalating Greek sovereign debt fears, EU + IMF announced a €750B backstop. Triggered a sharp risk-on relief move at first, sustained sovereign debt pricing into 2011.',
 '["geopolitical_europe","sovereign_debt","monetary_emergency"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/European_Financial_Stability_Facility"]'::jsonb),

-- 2011
('sp_us_downgrade_2011', '2011-08-05',
 'S&P downgrades US sovereign credit rating from AAA to AA+',
 'First-ever US sovereign downgrade. Equities fell sharply the following Monday; paradoxically Treasury yields fell.',
 '["sovereign_debt","us_fiscal_crisis","risk_off"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/United_States_federal_government_credit-rating_downgrades"]'::jsonb),

('fed_rates_2013_pledge', '2011-08-09',
 'Fed pledges to keep rates near zero through mid-2013',
 'FOMC adopted explicit calendar-based forward guidance — a major dovish surprise.',
 '["rate_shock_dovish","monetary_emergency"]'::jsonb, 2,
 '["https://www.federalreserve.gov/newsevents/pressreleases/monetary20110809a.htm"]'::jsonb),

-- 2013
('taper_tantrum_2013', '2013-05-22',
 'Bernanke signals possible QE tapering',
 'In Congressional testimony Bernanke suggested the Fed could begin tapering asset purchases. Triggered a sharp rise in 10Y yields and EM equity selloff.',
 '["rate_shock_hawkish","em_stress","risk_off"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/Taper_tantrum"]'::jsonb),

-- 2014
('opec_no_cut_2014', '2014-11-27',
 'OPEC declines to cut production despite oil glut',
 'Saudi-led decision not to defend prices accelerated a 50%+ oil price collapse. Energy and EM hit hard; consumer discretionary benefited.',
 '["oil_demand_shock","commodity_collapse","em_stress"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/2010s_oil_glut"]'::jsonb),

-- 2015
('china_devaluation_2015', '2015-08-11',
 'China devalues yuan ~2% — largest one-day move in 20 years',
 'PBoC reset the daily fixing mechanism, triggering a global growth scare and risk-off move that intensified into the August 24 selloff.',
 '["geopolitical_asia","currency_crisis","em_stress","risk_off"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/2015_Chinese_stock_market_turbulence"]'::jsonb),

-- 2016
('oil_low_2016', '2016-01-20',
 'Oil hits multi-year low ~$26',
 'WTI bottomed near $26 amid global growth fears; capitulation low for the 2014-2016 oil bear market.',
 '["commodity_collapse","oil_demand_shock","em_stress","risk_off"]'::jsonb, 2,
 '["https://en.wikipedia.org/wiki/2010s_oil_glut"]'::jsonb),

('brexit_referendum_2016', '2016-06-23',
 'UK votes to leave the European Union',
 'Surprise Leave outcome triggered ~10% GBP drop, FTSE/EU bank rout, broad risk-off.',
 '["geopolitical_europe","currency_crisis","risk_off"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/2016_United_Kingdom_European_Union_membership_referendum"]'::jsonb),

('trump_election_2016', '2016-11-08',
 'Donald Trump wins US presidential election',
 'Surprise outcome — overnight risk-off reversed sharply into risk-on by US open. Banks, defense, infrastructure rallied; bonds and EM sold off.',
 '["us_election_surprise","rate_shock_hawkish"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/2016_United_States_presidential_election"]'::jsonb),

-- 2018
('volmageddon_2018', '2018-02-05',
 'Volmageddon — XIV implosion and 4% S&P drop',
 'Vol-of-vol products imploded; structural unwind drove a sharp drawdown despite no new fundamental news.',
 '["vol_event","risk_off","flash_crash"]'::jsonb, 2,
 '["https://en.wikipedia.org/wiki/2018_cryptocurrency_crash"]'::jsonb),

('us_china_tariffs_2018', '2018-03-22',
 'Trump signs memorandum imposing tariffs on China imports',
 'Initiation of the 2018-2019 US-China trade war. Cyclicals, semis, and industrials hit; trade-war hedges (utilities, staples) outperformed.',
 '["trade_war","geopolitical_asia"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/China%E2%80%93United_States_trade_war"]'::jsonb),

('powell_q4_2018', '2018-12-19',
 'Hawkish Powell — December FOMC raises rates and signals more',
 'Despite weakening data, the Fed raised rates and signaled two more 2019 hikes — triggering a sharp Q4 selloff.',
 '["rate_shock_hawkish","risk_off"]'::jsonb, 3,
 '["https://www.federalreserve.gov/monetarypolicy/fomcminutes20181219.htm"]'::jsonb),

-- 2019
('trump_tariffs_aug_2019', '2019-08-01',
 'Trump escalates tariffs to 10% on remaining $300B Chinese goods',
 'Surprise escalation announced via tweet; yield curve inverted further, semis and exporters hit.',
 '["trade_war","geopolitical_asia","risk_off"]'::jsonb, 2,
 '["https://en.wikipedia.org/wiki/China%E2%80%93United_States_trade_war"]'::jsonb),

-- 2020
('covid_crash_start_2020', '2020-02-24',
 'COVID-19 spreads outside China — global selloff begins',
 'Italian outbreak news triggered the start of the COVID equity crash; S&P fell ~34% in 33 days.',
 '["pandemic","risk_off","oil_demand_shock"]'::jsonb, 4,
 '["https://en.wikipedia.org/wiki/2020_stock_market_crash"]'::jsonb),

('fed_emergency_zero_2020', '2020-03-15',
 'Fed cuts to zero in emergency Sunday-night action',
 '100bps cut to 0-0.25% plus $700B QE restart. Markets initially fell anyway; ultimate launch of unlimited QE on 3/23.',
 '["rate_shock_dovish","monetary_emergency","pandemic"]'::jsonb, 4,
 '["https://www.federalreserve.gov/newsevents/pressreleases/monetary20200315a.htm"]'::jsonb),

('fed_unlimited_qe_2020', '2020-03-23',
 'Fed announces unlimited QE and credit facilities',
 'Open-ended QE plus primary/secondary corporate credit facilities — equity bottom day for the COVID crash.',
 '["monetary_emergency","rate_shock_dovish","risk_on_relief"]'::jsonb, 4,
 '["https://www.federalreserve.gov/newsevents/pressreleases/monetary20200323b.htm"]'::jsonb),

-- 2021
('gamestop_squeeze_2021', '2021-01-27',
 'GameStop short squeeze peak / Robinhood restrictions',
 'Retail-driven short squeeze in GME and other heavily shorted names; broker restrictions caused a brief dislocation. Mostly idiosyncratic but vol regime briefly broke.',
 '["vol_event","flash_crash"]'::jsonb, 1,
 '["https://en.wikipedia.org/wiki/GameStop_short_squeeze"]'::jsonb),

('omicron_emerges_2021', '2021-11-26',
 'Omicron variant identified — Black Friday selloff',
 'New COVID variant news triggered ~2.3% S&P drop on a half-day session; oil down sharply, defensives up.',
 '["pandemic","risk_off","oil_demand_shock"]'::jsonb, 2,
 '["https://en.wikipedia.org/wiki/SARS-CoV-2_Omicron_variant"]'::jsonb),

-- 2022
('russia_invades_ukraine_2022', '2022-02-24',
 'Russia invades Ukraine',
 'Full-scale invasion triggered commodity spike (oil, wheat, gas), risk-off, EU bank rout, defense rally.',
 '["geopolitical_europe","oil_supply_shock","commodity_spike","risk_off"]'::jsonb, 4,
 '["https://en.wikipedia.org/wiki/Russian_invasion_of_Ukraine"]'::jsonb),

('fed_first_hike_2022', '2022-03-16',
 'Fed begins 2022-2023 hiking cycle (+25bps)',
 'First hike of the cycle. Forward guidance for "ongoing increases" started repricing duration.',
 '["rate_shock_hawkish","inflation_shock_up"]'::jsonb, 2,
 '["https://www.federalreserve.gov/newsevents/pressreleases/monetary20220316a.htm"]'::jsonb),

('uk_gilt_crisis_2022', '2022-09-23',
 'Truss/Kwarteng mini-budget triggers UK gilt crisis',
 'Unfunded tax cuts caused a self-reinforcing pension-fund LDI selloff; BoE intervention required. Sterling and gilts in disarray; broader EU spillover.',
 '["sovereign_debt","geopolitical_europe","currency_crisis","vol_event"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/2022_United_Kingdom_mini-budget"]'::jsonb),

-- 2023
('svb_collapse_2023', '2023-03-10',
 'Silicon Valley Bank fails',
 'Largest US bank failure since 2008. Regional bank rout, KRE down sharply; eventually reversed by Fed BTFP and emergency liquidity.',
 '["banking_stress","risk_off"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/Collapse_of_Silicon_Valley_Bank"]'::jsonb),

('credit_suisse_2023', '2023-03-19',
 'UBS forced acquisition of Credit Suisse',
 'Swiss authorities orchestrated a weekend takeover after CS share price collapsed; AT1 wipeout shocked credit markets.',
 '["banking_stress","geopolitical_europe","risk_off"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/Credit_Suisse#Acquisition_by_UBS"]'::jsonb),

('fitch_us_downgrade_2023', '2023-08-01',
 'Fitch downgrades US sovereign rating to AA+',
 'Second major-agency US downgrade. Triggered a modest rate-driven equity drawdown over August.',
 '["sovereign_debt","us_fiscal_crisis","rate_shock_hawkish"]'::jsonb, 2,
 '["https://en.wikipedia.org/wiki/United_States_federal_government_credit-rating_downgrades"]'::jsonb),

('hamas_attack_2023', '2023-10-07',
 'Hamas attacks Israel — Middle East war begins',
 'Triggered oil spike, defense rally, broader Middle East risk pricing.',
 '["geopolitical_middle_east","oil_supply_shock","risk_off"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/2023_Hamas-led_attack_on_Israel"]'::jsonb),

-- 2024
('yen_carry_unwind_2024', '2024-08-05',
 'Yen carry unwind — global vol spike',
 'BoJ hike + weak US payrolls triggered a violent yen rally, JPX down 12% in a day, US futures gapped down. VIX hit 65 intraday.',
 '["vol_event","currency_crisis","risk_off","em_stress"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/August_2024_global_market_decline"]'::jsonb),

('deepseek_jan_2025', '2025-01-27',
 'DeepSeek R1 release triggers AI capex repricing',
 'DeepSeek released a competitive reasoning model claimed to be trained at a fraction of US frontier-lab cost. NVDA fell ~17% in one day; broader semis and AI-capex names sold off; software relatively stable.',
 '["ai_capex_shock","tech_correction"]'::jsonb, 3,
 '["https://en.wikipedia.org/wiki/DeepSeek"]'::jsonb)

ON CONFLICT (id) DO NOTHING;
