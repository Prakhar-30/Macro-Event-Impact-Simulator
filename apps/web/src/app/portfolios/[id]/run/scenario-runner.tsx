"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToolCallCard } from "@/components/tool-call-card";
import { FinalBriefing } from "@/components/final-briefing";

interface AgentEventBase {
  seq: number;
  kind: string;
}

interface ToolUseRow {
  toolUseId: string;
  name: string;
  input: unknown;
  result?: { ok: boolean; output?: unknown; error?: string };
  startedAt: number;
  finishedAt?: number;
}

const SAMPLE_SCENARIOS = [
  "The Fed cuts rates 50bps unexpectedly at the next meeting",
  "Oil spikes to $150/bbl after a Middle East refinery attack",
  "China escalates Taiwan tensions to a naval blockade",
  "AI capex slows sharply; hyperscaler spending drops 30%",
  "A regional bank collapse triggers contagion fears like SVB",
  "UK fiscal credibility cracks — gilts sell off, sterling tumbles",
];

export function ScenarioRunner({
  portfolio,
  positions,
}: {
  portfolio: { id: string; name: string };
  positions: { ticker: string; weight: number }[];
}) {
  const [scenario, setScenario] = useState(SAMPLE_SCENARIOS[0] ?? "");
  const [jobId, setJobId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<Map<string, ToolUseRow>>(new Map());
  const [streamingText, setStreamingText] = useState("");
  const [finalText, setFinalText] = useState("");
  const [finishedReason, setFinishedReason] = useState<"finished" | "error" | null>(null);
  const [usage, setUsage] = useState<{
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    iterations: number;
  } | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  async function start() {
    setError(null);
    setToolCalls(new Map());
    setStreamingText("");
    setFinalText("");
    setUsage(null);
    setFinishedReason(null);
    setRunning(true);

    const res = await fetch("/api/scenarios", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ portfolioId: portfolio.id, scenario }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `request failed (${res.status})`);
      setRunning(false);
      return;
    }
    const json = (await res.json()) as { jobId: string };
    setJobId(json.jobId);

    const es = new EventSource(`/api/scenarios/${json.jobId}/stream`);
    esRef.current = es;

    function update(map: Map<string, ToolUseRow>, key: string, patch: Partial<ToolUseRow>) {
      const next = new Map(map);
      const cur = next.get(key);
      if (!cur) return next;
      next.set(key, { ...cur, ...patch });
      return next;
    }

    es.addEventListener("agent_start", () => { /* noop */ });

    es.addEventListener("tool_use", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as AgentEventBase & {
        toolUseId: string;
        name: string;
        input: unknown;
      };
      setToolCalls((prev) => {
        const next = new Map(prev);
        next.set(data.toolUseId, {
          toolUseId: data.toolUseId,
          name: data.name,
          input: data.input,
          startedAt: Date.now(),
        });
        return next;
      });
    });

    es.addEventListener("tool_result", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as AgentEventBase & {
        toolUseId: string;
        ok: boolean;
        output?: unknown;
        error?: string;
      };
      setToolCalls((prev) =>
        update(prev, data.toolUseId, {
          result: { ok: data.ok, output: data.output, error: data.error },
          finishedAt: Date.now(),
        })
      );
    });

    es.addEventListener("model_text_delta", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as AgentEventBase & { text: string };
      setStreamingText((s) => s + data.text);
    });

    es.addEventListener("agent_finish", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as AgentEventBase & {
        finalText: string;
        usage: {
          inputTokens: number;
          outputTokens: number;
          cacheReadTokens: number;
          cacheWriteTokens: number;
          iterations: number;
        };
      };
      setFinalText(data.finalText);
      setUsage(data.usage);
      setFinishedReason("finished");
      setRunning(false);
      es.close();
    });

    es.addEventListener("agent_error", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as AgentEventBase & { message: string };
      setError(data.message);
      setFinishedReason("error");
      setRunning(false);
      es.close();
    });

    es.onerror = () => {
      // EventSource can flap on reconnects — only show error if we never finished.
      if (!finishedReason) {
        // Don't tear down here; the SSE proxy may resume.
      }
    };
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Scenario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="scenario">Describe a macro scenario</Label>
            <Input
              id="scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              disabled={running}
              placeholder="The Fed cuts rates 50bps unexpectedly..."
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground">try:</span>
            {SAMPLE_SCENARIOS.map((s) => (
              <button
                key={s}
                disabled={running}
                onClick={() => setScenario(s)}
                className="rounded-full border px-2 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={start} disabled={running || scenario.length < 8}>
              {running ? "Running…" : "Run scenario"}
            </Button>
            {jobId && (
              <span className="text-xs text-muted-foreground">job {jobId.slice(0, 8)}</span>
            )}
          </div>
          {error && (
            <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Agent reasoning ({toolCalls.size} tool call{toolCalls.size === 1 ? "" : "s"})
        </h2>
        {toolCalls.size === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tool calls will stream here as the agent works.
          </p>
        ) : (
          <ul className="space-y-3">
            {Array.from(toolCalls.values()).map((c) => (
              <li key={c.toolUseId}>
                <ToolCallCard call={c} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {(streamingText || finalText) && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Briefing
          </h2>
          <FinalBriefing
            text={finalText || streamingText}
            isStreaming={running}
            positions={positions}
            toolCalls={Array.from(toolCalls.values())}
          />
          {usage && (
            <p className="text-xs text-muted-foreground">
              {usage.iterations} iteration{usage.iterations === 1 ? "" : "s"} ·{" "}
              {usage.inputTokens.toLocaleString()} in /{" "}
              {usage.outputTokens.toLocaleString()} out tokens · cache:{" "}
              {usage.cacheReadTokens.toLocaleString()} read /{" "}
              {usage.cacheWriteTokens.toLocaleString()} written
            </p>
          )}
        </section>
      )}
    </div>
  );
}
