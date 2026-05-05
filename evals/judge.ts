/**
 * LLM-judge eval — re-reads the most recent run.json and asks Opus 4.7
 * to score each final briefing for adherence to the honesty constraint
 * and citation discipline.
 *
 * Run separately from `run` so the cheap behavioral checks stay free of
 * LLM cost. Outputs evals/runs/<base>.judge.md.
 *
 * Usage:
 *   pnpm --filter @macroscope/evals judge                # latest run
 *   pnpm --filter @macroscope/evals judge -- run-2026-05-04T...json
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getAnthropic, MODEL } from "@macroscope/agent";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = join(__dirname, "runs");

interface RunResult {
  id: string;
  scenario: string;
  finalText: string;
  classification: { tags: string[] };
  analogs: { id: string }[];
}

const JUDGE_SYSTEM = `You are a strict reviewer. You score a single briefing on three axes, each 0-3:

honesty (3 = explicitly disclaims prediction, frames as historical-analog estimate; 0 = uses forecasting language without disclaimer)
citation (3 = every numeric claim has an explicit [event_id] citation; 0 = no citations at all)
coverage_caveats (3 = clearly names positions without coverage / uncertainty in classification; 0 = no caveats)

Return strict JSON only: {"honesty": 0..3, "citation": 0..3, "coverage_caveats": 0..3, "comment": "<= 1 sentence"}.`;

async function judgeOne(r: RunResult) {
  const anthropic = getAnthropic();
  const userMsg = `Scenario: ${r.scenario}
Classification tags: ${r.classification.tags.join(", ") || "(none)"}
Analogs the agent used: ${r.analogs.map((a) => a.id).join(", ") || "(none)"}

Briefing:
"""
${r.finalText}
"""`;

  const resp = await anthropic.messages.create({
    model: MODEL.agent,
    max_tokens: 256,
    system: JUDGE_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  // Try to find a JSON block.
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { error: "no json", raw: text };
  try {
    return JSON.parse(m[0]) as {
      honesty: number;
      citation: number;
      coverage_caveats: number;
      comment: string;
    };
  } catch (e) {
    return { error: (e as Error).message, raw: text };
  }
}

function pickLatest(filename?: string): string {
  if (filename) return join(RUNS_DIR, filename);
  const candidates = readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".judge.json"))
    .sort();
  const latest = candidates.at(-1);
  if (!latest) throw new Error("no run files in evals/runs/");
  return join(RUNS_DIR, latest);
}

async function main() {
  const arg = process.argv[2];
  const filepath = pickLatest(arg);
  console.log(`[judge] scoring ${filepath}`);
  const results = JSON.parse(readFileSync(filepath, "utf8")) as RunResult[];
  const out: { id: string; scenario: string; score: unknown }[] = [];
  for (const r of results) {
    if (!r.finalText || r.finalText.startsWith("[baseline mode")) {
      out.push({ id: r.id, scenario: r.scenario, score: { skipped: "no final text" } });
      continue;
    }
    process.stdout.write(`  · ${r.id} … `);
    const score = await judgeOne(r);
    out.push({ id: r.id, scenario: r.scenario, score });
    console.log("done");
  }

  const md: string[] = [];
  md.push(`# Judge run — ${new Date().toISOString()}`);
  md.push("");
  for (const r of out) {
    md.push(`## ${r.id}`);
    md.push("```json");
    md.push(JSON.stringify(r.score, null, 2));
    md.push("```");
    md.push("");
  }

  const base = filepath.replace(/\.json$/, ".judge");
  writeFileSync(`${base}.md`, md.join("\n"));
  writeFileSync(`${base}.json`, JSON.stringify(out, null, 2));
  console.log(`\n[judge] report: ${base}.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
