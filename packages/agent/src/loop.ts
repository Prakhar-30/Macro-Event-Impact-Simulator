/**
 * The agent tool-use loop.
 *
 * One scenario run = one call to runAgent(). It performs a multi-turn
 * tool_use conversation with Claude (Opus 4.7) and emits a stream of
 * events to a callback so the worker can push them to Redis pub/sub for
 * the SSE-streamed UI.
 *
 * Token usage and cache stats are tallied per phase so M6 evals + M7
 * COSTS.md can plot drift over time.
 *
 * Prompt caching:
 *   - The system prompt is wrapped in a single cache_control breakpoint.
 *   - The portfolio context block is its own breakpoint (changes per
 *     portfolio, but stable within a session).
 *   - Tool results are NOT cached — they're new every call.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic } from "./client.js";
import { MODEL, TOKEN_BUDGET } from "./model.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { TOOL_DEFINITIONS } from "./tool-schemas.js";
import { dispatchTool } from "./tool-dispatch.js";

export type AgentEvent =
  | { kind: "agent_start"; scenario: string; portfolioId: string }
  | { kind: "model_text_delta"; text: string }
  | { kind: "tool_use"; name: string; input: unknown; toolUseId: string }
  | { kind: "tool_result"; toolUseId: string; ok: boolean; output?: unknown; error?: string }
  | { kind: "iteration_complete"; iteration: number; stopReason: string | null }
  | { kind: "agent_finish"; finalText: string; usage: AgentUsage }
  | { kind: "agent_error"; message: string };

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  iterations: number;
}

export interface RunAgentInput {
  scenario: string;
  portfolioId: string;
  /** Pre-fetched portfolio context to avoid a tool call (and to enable caching). */
  portfolioContext?: { tickersWithWeights: { ticker: string; weight: number }[] };
  onEvent?: (e: AgentEvent) => void | Promise<void>;
  /** Defaults to TOKEN_BUDGET.maxToolIterations. */
  maxIterations?: number;
}

export async function runAgent(input: RunAgentInput): Promise<{
  finalText: string;
  usage: AgentUsage;
}> {
  const emit = async (e: AgentEvent) => {
    try {
      await input.onEvent?.(e);
    } catch (err) {
      console.warn("[agent] onEvent threw:", (err as Error).message);
    }
  };

  await emit({ kind: "agent_start", scenario: input.scenario, portfolioId: input.portfolioId });

  const anthropic = getAnthropic();
  const max = input.maxIterations ?? TOKEN_BUDGET.maxToolIterations;

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text:
            input.portfolioContext
              ? `Portfolio (id=${input.portfolioId}):\n${input.portfolioContext.tickersWithWeights
                  .map((p) => `  ${p.ticker}: ${(p.weight * 100).toFixed(2)}%`)
                  .join("\n")}\n\nScenario: ${input.scenario}`
              : `Portfolio id: ${input.portfolioId}\n\nScenario: ${input.scenario}`,
          cache_control: { type: "ephemeral" },
        },
      ],
    },
  ];

  let finalText = "";
  const usage: AgentUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    iterations: 0,
  };

  for (let i = 0; i < max; i++) {
    usage.iterations = i + 1;

    const resp: Anthropic.Messages.Message = await anthropic.messages.create({
      model: MODEL.agent,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: TOOL_DEFINITIONS,
      messages,
    });

    usage.inputTokens += resp.usage.input_tokens ?? 0;
    usage.outputTokens += resp.usage.output_tokens ?? 0;
    type UsageWithCache = Anthropic.Messages.Message["usage"] & {
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    const u = resp.usage as UsageWithCache;
    usage.cacheWriteTokens += u.cache_creation_input_tokens ?? 0;
    usage.cacheReadTokens += u.cache_read_input_tokens ?? 0;

    // Echo any text blocks emitted this turn (model often narrates
    // before / between tool calls).
    for (const block of resp.content) {
      if (block.type === "text" && block.text) {
        await emit({ kind: "model_text_delta", text: block.text });
      }
    }

    // Append assistant turn to history.
    messages.push({ role: "assistant", content: resp.content });

    if (resp.stop_reason === "tool_use") {
      const toolUses = resp.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );
      const toolResultBlocks: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const tu of toolUses) {
        await emit({ kind: "tool_use", name: tu.name, input: tu.input, toolUseId: tu.id });
        const result = await dispatchTool({
          name: tu.name,
          input: tu.input as Record<string, unknown>,
        });
        await emit({
          kind: "tool_result",
          toolUseId: tu.id,
          ok: result.ok,
          output: result.output,
          error: result.error,
        });
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result.ok
            ? JSON.stringify(result.output).slice(0, 32_000)
            : `ERROR: ${result.error ?? "unknown"}`,
          is_error: !result.ok,
        });
      }

      messages.push({ role: "user", content: toolResultBlocks });
      await emit({ kind: "iteration_complete", iteration: i + 1, stopReason: resp.stop_reason });
      continue;
    }

    // end_turn or other stop: collect final text and break.
    for (const block of resp.content) {
      if (block.type === "text") finalText += block.text;
    }
    await emit({ kind: "iteration_complete", iteration: i + 1, stopReason: resp.stop_reason });
    break;
  }

  await emit({ kind: "agent_finish", finalText, usage });
  return { finalText, usage };
}
