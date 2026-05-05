/**
 * Eval runner — executes every scenario in scenarios.ts through the agent
 * loop and produces a Markdown + JSON report card.
 *
 * Usage:
 *   pnpm --filter @macroscope/evals run
 *   pnpm --filter @macroscope/evals run -- --only fed_dovish_surprise
 *   pnpm --filter @macroscope/evals run -- --baseline    # use the deterministic
 *     pipeline (no LLM) — useful as a regression baseline + when API key absent
 *
 * Outputs:
 *   evals/runs/<timestamp>.md    — human-readable report card
 *   evals/runs/<timestamp>.json  — full machine-readable trace
 *
 * Honesty checks (no-LLM-judge):
 *   - flags forecasting language ("will fall", "expect to drop", "predict")
 *   - flags absence of "not a prediction" framing
 *
 * The optional LLM-judge in judge.ts runs separately to score adherence
 * more rigorously; this runner stays cheap + deterministic.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { schema } from "@macroscope/db";
import {
  classifyScenarioRulebased,
  computePositionImpact,
  findHistoricalAnalogs,
  getAnalogReactions,
  type AnalogEvent,
  type ClassificationResult,
  type PortfolioImpactSummary,
  type ScenarioTag,
} from "@macroscope/tools";
import { runAgent, type AgentEvent } from "@macroscope/agent";
import { SCENARIOS, type EvalScenario } from "./scenarios.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = join(__dirname, "runs");
mkdirSync(RUNS_DIR, { recursive: true });

const FORECASTING_PHRASES = [
  /\bwill (fall|drop|rise|rally|crash|surge)\b/i,
  /\bexpect(?:s|ed|ing)? to (fall|drop|rise|rally|crash|surge)\b/i,
  /\bpredict(?:s|ed|ing)?\b/i,
  /\bwe forecast\b/i,
  /\bour forecast\b/i,
];

interface CheckOutcome {
  name: string;
  pass: boolean;
  note?: string;
}

interface ScenarioResult {
  id: string;
  description: string;
  scenario: string;
  classification: ClassificationResult;
  analogs: AnalogEvent[];
  impact: PortfolioImpactSummary;
  finalText: string;
  toolEvents: AgentEvent[];
  checks: CheckOutcome[];
  passed: boolean;
  durationMs: number;
  usage?: { inputTokens: number; outputTokens: number; iterations: number };
}

function checkClassification(s: EvalScenario, c: ClassificationResult): CheckOutcome[] {
  const out: CheckOutcome[] = [];
  if (s.mustClassifyTags) {
    for (const t of s.mustClassifyTags) {
      out.push({
        name: `classifies as ${t}`,
        pass: c.tags.includes(t),
        note: c.tags.length === 0 ? "no tags returned" : `got: ${c.tags.join(", ")}`,
      });
    }
  }
  if (s.mustNotClassifyTags) {
    for (const t of s.mustNotClassifyTags) {
      out.push({
        name: `does NOT classify as ${t}`,
        pass: !c.tags.includes(t),
        note: c.tags.includes(t) ? `incorrectly tagged ${t}` : undefined,
      });
    }
  }
  return out;
}

function checkAnalogs(s: EvalScenario, analogs: AnalogEvent[]): CheckOutcome[] {
  const out: CheckOutcome[] = [];
  if (s.mustUseAnalogs !== undefined) {
    out.push({
      name: "called find_historical_analogs",
      pass: !s.mustUseAnalogs || analogs.length > 0,
    });
  }
  if (s.mustReferenceAnalog) {
    const ids = new Set(analogs.map((a) => a.id));
    const overlap = s.mustReferenceAnalog.filter((id) => ids.has(id));
    out.push({
      name: `references at least one of [${s.mustReferenceAnalog.join(", ")}]`,
      pass: overlap.length > 0,
      note: overlap.length > 0 ? `matched: ${overlap.join(", ")}` : `none of the expected analogs returned`,
    });
  }
  return out;
}

function checkImpact(s: EvalScenario, impact: PortfolioImpactSummary): CheckOutcome[] {
  const out: CheckOutcome[] = [];
  if (s.topContributorsInclude) {
    const top3 = impact.positionImpacts.slice(0, 3).map((p) => p.ticker);
    const overlap = s.topContributorsInclude.filter((t) => top3.includes(t));
    out.push({
      name: `top 3 contributors include ${s.topContributorsInclude.join(" or ")}`,
      pass: overlap.length > 0,
      note: `top3=[${top3.join(", ")}]`,
    });
  }
  if (s.portfolioMedianSign && s.portfolioMedianSign !== "any") {
    const sign = impact.portfolioMedian > 0 ? "+" : impact.portfolioMedian < 0 ? "-" : "0";
    out.push({
      name: `portfolio median sign is ${s.portfolioMedianSign}`,
      pass: sign === s.portfolioMedianSign,
      note: `portfolio median = ${impact.portfolioMedian.toFixed(4)}`,
    });
  }
  return out;
}

function checkHonesty(s: EvalScenario, finalText: string): CheckOutcome[] {
  if (s.honestyMustHold !== true || finalText.length === 0) return [];
  const out: CheckOutcome[] = [];
  for (const re of FORECASTING_PHRASES) {
    out.push({
      name: `no forecasting phrase matching ${re.source}`,
      pass: !re.test(finalText),
      note: re.test(finalText) ? `matched: ${(finalText.match(re) ?? [])[0]}` : undefined,
    });
  }
  out.push({
    name: "explicitly disclaims prediction",
    pass: /not a prediction|historical[- ]analog|analog estimate/i.test(finalText),
    note: undefined,
  });
  return out;
}

async function runOneBaseline(
  s: EvalScenario,
  db: ReturnType<typeof drizzle<typeof schema>>
): Promise<ScenarioResult> {
  const start = Date.now();

  // Load curated portfolio into a synthetic id; we don't write to DB —
  // instead we replicate get_portfolio_exposures on the fly.
  void db;

  const classification = classifyScenarioRulebased(s.scenario);
  const analogs = await findHistoricalAnalogs(classification.tags as ScenarioTag[], 8);
  const reactions = await getAnalogReactions(
    analogs.map((a) => a.id),
    s.portfolio.positions.map((p) => p.ticker),
    s.horizon
  );
  const impact = computePositionImpact(s.portfolio.positions, reactions, s.horizon);

  const checks: CheckOutcome[] = [
    ...checkClassification(s, classification),
    ...checkAnalogs(s, analogs),
    ...checkImpact(s, impact),
  ];
  const passed = checks.every((c) => c.pass);

  return {
    id: s.id,
    description: s.description,
    scenario: s.scenario,
    classification,
    analogs,
    impact,
    finalText: "[baseline mode — no LLM final text]",
    toolEvents: [],
    checks,
    passed,
    durationMs: Date.now() - start,
  };
}

async function runOneAgent(
  s: EvalScenario,
  db: ReturnType<typeof drizzle<typeof schema>>
): Promise<ScenarioResult> {
  const start = Date.now();

  // Persist a temporary portfolio in DB so the tool dispatcher can query it.
  const tempUser = await db
    .insert(schema.users)
    .values({ email: `eval+${s.id}@macroscope.local`, name: "eval" })
    .onConflictDoNothing()
    .returning();
  const userId =
    tempUser[0]?.id ??
    (await db.query.users.findFirst({ where: eq(schema.users.email, `eval+${s.id}@macroscope.local`) }))!.id;

  const [pf] = await db
    .insert(schema.portfolios)
    .values({ userId, name: `eval ${s.id}` })
    .returning();
  if (!pf) throw new Error("portfolio insert failed");

  await db.insert(schema.positions).values(
    s.portfolio.positions.map((p) => ({
      portfolioId: pf.id,
      ticker: p.ticker,
      weight: p.weight.toString(),
    }))
  );

  const events: AgentEvent[] = [];
  let agentClassification: ClassificationResult = { tags: [], confidence: 0, rationale: "n/a" };
  let agentAnalogs: AnalogEvent[] = [];
  let agentImpact: PortfolioImpactSummary | null = null;

  const result = await runAgent({
    scenario: s.scenario,
    portfolioId: pf.id,
    portfolioContext: { tickersWithWeights: s.portfolio.positions },
    onEvent: async (e) => {
      events.push(e);
      if (e.kind === "tool_result" && e.ok) {
        // Extract by associating tool_use id with name from prior event.
        const tu = events
          .slice()
          .reverse()
          .find((x): x is Extract<AgentEvent, { kind: "tool_use" }> =>
            x.kind === "tool_use" && x.toolUseId === e.toolUseId
          );
        if (!tu) return;
        if (tu.name === "classify_scenario" && e.output) agentClassification = e.output as ClassificationResult;
        if (tu.name === "find_historical_analogs" && e.output) agentAnalogs = e.output as AnalogEvent[];
        if (tu.name === "compute_position_impact" && e.output) agentImpact = e.output as PortfolioImpactSummary;
      }
    },
    maxIterations: 10,
  });

  // Cleanup the temp portfolio (cascade also removes positions + jobs).
  await db.delete(schema.portfolios).where(eq(schema.portfolios.id, pf.id));

  const finalText = result.finalText;
  const impact = agentImpact ?? {
    horizon: s.horizon,
    analogEventIds: [],
    positionImpacts: [],
    portfolioMedian: NaN,
    portfolioP25: NaN,
    portfolioP75: NaN,
    positionsWithoutCoverage: [],
  };

  const checks: CheckOutcome[] = [
    ...checkClassification(s, agentClassification),
    ...checkAnalogs(s, agentAnalogs),
    ...checkImpact(s, impact),
    ...checkHonesty(s, finalText),
  ];
  const passed = checks.every((c) => c.pass);

  return {
    id: s.id,
    description: s.description,
    scenario: s.scenario,
    classification: agentClassification,
    analogs: agentAnalogs,
    impact,
    finalText,
    toolEvents: events,
    checks,
    passed,
    durationMs: Date.now() - start,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      iterations: result.usage.iterations,
    },
  };
}

function renderMarkdown(results: ScenarioResult[], mode: "baseline" | "agent"): string {
  const passed = results.filter((r) => r.passed).length;
  const lines: string[] = [];
  lines.push(`# macroscope eval run — ${new Date().toISOString()}`);
  lines.push(`Mode: ${mode}. Pass: ${passed}/${results.length}`);
  lines.push("");
  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    lines.push(`## [${status}] ${r.id} (${r.durationMs}ms)`);
    lines.push(`> ${r.scenario}`);
    lines.push("");
    lines.push(`Classification: \`${r.classification.tags.join(", ") || "(none)"}\` (conf ${r.classification.confidence.toFixed(2)})`);
    lines.push(`Analogs: ${r.analogs.map((a) => a.id).join(", ") || "(none)"}`);
    if (Number.isFinite(r.impact.portfolioMedian)) {
      lines.push(
        `Impact (${r.impact.horizon}): median ${(r.impact.portfolioMedian * 100).toFixed(2)}%, p25 ${(r.impact.portfolioP25 * 100).toFixed(2)}%, p75 ${(r.impact.portfolioP75 * 100).toFixed(2)}%`
      );
    }
    if (r.usage) {
      lines.push(`Tokens: ${r.usage.inputTokens.toLocaleString()} in / ${r.usage.outputTokens.toLocaleString()} out (${r.usage.iterations} iter)`);
    }
    lines.push("");
    lines.push(`| check | result | note |`);
    lines.push(`|---|---|---|`);
    for (const c of r.checks) {
      lines.push(`| ${c.name} | ${c.pass ? "✓" : "✗"} | ${c.note ?? ""} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function parseArgs(argv: string[]) {
  const args: { only?: string; baseline: boolean } = { baseline: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") args.only = argv[++i];
    if (argv[i] === "--baseline") args.baseline = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const subset = args.only ? SCENARIOS.filter((s) => s.id === args.only) : SCENARIOS;
  if (subset.length === 0) {
    console.error(`No scenarios match --only=${args.only}`);
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sql = postgres(url, { max: 2 });
  const db = drizzle(sql, { schema });

  const mode: "baseline" | "agent" = args.baseline ? "baseline" : "agent";
  if (mode === "agent" && !process.env.ANTHROPIC_API_KEY) {
    console.warn("[evals] ANTHROPIC_API_KEY not set — falling back to --baseline mode");
  }
  const useBaseline = args.baseline || !process.env.ANTHROPIC_API_KEY;

  console.log(`[evals] running ${subset.length} scenarios in ${useBaseline ? "baseline" : "agent"} mode`);
  const results: ScenarioResult[] = [];
  for (const s of subset) {
    process.stdout.write(`  · ${s.id} … `);
    try {
      const r = useBaseline ? await runOneBaseline(s, db) : await runOneAgent(s, db);
      results.push(r);
      console.log(r.passed ? "PASS" : `FAIL (${r.checks.filter((c) => !c.pass).length})`);
    } catch (e) {
      console.log(`ERROR: ${(e as Error).message}`);
      results.push({
        id: s.id,
        description: s.description,
        scenario: s.scenario,
        classification: { tags: [], confidence: 0, rationale: (e as Error).message },
        analogs: [],
        impact: {
          horizon: s.horizon,
          analogEventIds: [],
          positionImpacts: [],
          portfolioMedian: NaN,
          portfolioP25: NaN,
          portfolioP75: NaN,
          positionsWithoutCoverage: [],
        },
        finalText: "",
        toolEvents: [],
        checks: [{ name: "scenario ran without throwing", pass: false, note: (e as Error).message }],
        passed: false,
        durationMs: 0,
      });
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const md = renderMarkdown(results, useBaseline ? "baseline" : "agent");
  writeFileSync(join(RUNS_DIR, `${ts}.md`), md);
  writeFileSync(join(RUNS_DIR, `${ts}.json`), JSON.stringify(results, null, 2));
  console.log(`\n[evals] report: evals/runs/${ts}.md`);
  const passCount = results.filter((r) => r.passed).length;
  console.log(`[evals] pass ${passCount}/${results.length}`);
  await sql.end();
  process.exit(passCount === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
