// Maps the tool_use names emitted by Claude to the deterministic tool
// implementations in @macroscope/tools. The agent loop calls dispatchTool
// for every tool_use block and feeds the JSON result back as a tool_result.

import {
  classifyScenarioRulebased,
  computePositionImpact,
  findHistoricalAnalogs,
  getAnalogReactions,
  getPortfolioExposures,
  searchNewsArchive,
} from "@macroscope/tools";
import type { Horizon, ScenarioTag } from "@macroscope/tools";

export interface DispatchInput {
  name: string;
  input: Record<string, unknown>;
}

export interface DispatchResult {
  ok: boolean;
  output?: unknown;
  error?: string;
}

export async function dispatchTool(req: DispatchInput): Promise<DispatchResult> {
  try {
    switch (req.name) {
      case "classify_scenario": {
        const text = String(req.input["text"] ?? "");
        // M4: rule-based classifier is the actual implementation.
        // The orchestrator chose Opus 4.7 for the agent loop; using a
        // separate LLM classifier would mean a second cold call. Instead
        // we wire the deterministic classifier and let the agent loop
        // refine via re-prompting if confidence is low.
        return { ok: true, output: classifyScenarioRulebased(text) };
      }
      case "get_portfolio_exposures": {
        const portfolioId = String(req.input["portfolio_id"] ?? "");
        if (!portfolioId) return { ok: false, error: "portfolio_id required" };
        const out = await getPortfolioExposures(portfolioId);
        return { ok: true, output: out };
      }
      case "find_historical_analogs": {
        const tags = (req.input["tags"] as ScenarioTag[]) ?? [];
        const limit = Number(req.input["limit"] ?? 8);
        const out = await findHistoricalAnalogs(tags, limit);
        return { ok: true, output: out };
      }
      case "get_analog_reactions": {
        const eventIds = (req.input["event_ids"] as string[]) ?? [];
        const tickers = (req.input["tickers"] as string[]) ?? [];
        const horizon = (req.input["horizon"] as Horizon) ?? "5d";
        const out = await getAnalogReactions(eventIds, tickers, horizon);
        return { ok: true, output: out };
      }
      case "compute_position_impact": {
        const positions = (req.input["positions"] as { ticker: string; weight: number }[]) ?? [];
        const horizon = (req.input["horizon"] as Horizon) ?? "5d";
        const eventIds = (req.input["event_ids"] as string[]) ?? [];
        const reactions = await getAnalogReactions(
          eventIds,
          positions.map((p) => p.ticker),
          horizon
        );
        const out = computePositionImpact(positions, reactions, horizon);
        return { ok: true, output: out };
      }
      case "search_news_archive": {
        const eventId = req.input["event_id"] ? String(req.input["event_id"]) : undefined;
        const topK = Number(req.input["top_k"] ?? 5);
        // No embeddings yet — searchNewsArchive falls back to event_id
        // filter + recency ordering when queryEmbedding is omitted.
        const out = await searchNewsArchive({ eventId, topK });
        return { ok: true, output: out };
      }
      default:
        return { ok: false, error: `unknown tool: ${req.name}` };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
