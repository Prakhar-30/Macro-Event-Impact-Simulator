"use client";

import { useState } from "react";
import { cn, formatPercent } from "@/lib/utils";

interface ToolUseRow {
  toolUseId: string;
  name: string;
  input: unknown;
  result?: { ok: boolean; output?: unknown; error?: string };
  startedAt: number;
  finishedAt?: number;
}

const TOOL_LABELS: Record<string, string> = {
  classify_scenario: "Classify scenario",
  get_portfolio_exposures: "Get portfolio exposures",
  find_historical_analogs: "Find historical analogs",
  get_analog_reactions: "Get analog reactions",
  compute_position_impact: "Compute position impact",
  search_news_archive: "Search news archive",
};

export function ToolCallCard({ call }: { call: ToolUseRow }) {
  const [open, setOpen] = useState(false);
  const isPending = !call.result;
  const failed = call.result && !call.result.ok;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors",
        failed && "border-destructive/40"
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <p className="text-sm font-medium">
            {TOOL_LABELS[call.name] ?? call.name}
            <span
              className={cn(
                "ml-2 text-xs font-normal",
                isPending ? "text-amber-500" : failed ? "text-red-500" : "text-emerald-500"
              )}
            >
              {isPending ? "running…" : failed ? "failed" : "done"}
            </span>
          </p>
          <SummaryLine name={call.name} input={call.input} output={call.result?.output} />
        </div>
        <span className="text-xs text-muted-foreground">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">input</p>
            <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 font-mono text-xs">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          {call.result && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {call.result.ok ? "output" : "error"}
              </p>
              <pre className="mt-1 max-h-72 overflow-auto rounded bg-muted p-2 font-mono text-xs">
                {call.result.ok
                  ? JSON.stringify(call.result.output, null, 2)
                  : call.result.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryLine({
  name,
  input,
  output,
}: {
  name: string;
  input: unknown;
  output: unknown;
}) {
  if (!output) {
    return (
      <p className="mt-0.5 text-xs text-muted-foreground">
        {summarizeInput(name, input)}
      </p>
    );
  }
  return (
    <p className="mt-0.5 text-xs text-muted-foreground">
      {summarizeOutput(name, output)}
    </p>
  );
}

function summarizeInput(name: string, input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const i = input as Record<string, unknown>;
  switch (name) {
    case "classify_scenario":
      return `"${String(i.text ?? "").slice(0, 80)}…"`;
    case "find_historical_analogs":
      return `tags: ${(i.tags as string[] | undefined)?.join(", ") ?? "—"}`;
    case "get_analog_reactions":
      return `${(i.event_ids as string[] | undefined)?.length ?? 0} events × ${(i.tickers as string[] | undefined)?.length ?? 0} tickers @ ${i.horizon}`;
    case "compute_position_impact":
      return `${(i.positions as unknown[] | undefined)?.length ?? 0} positions @ ${i.horizon}`;
    default:
      return "";
  }
}

function summarizeOutput(name: string, output: unknown): string {
  if (output == null || typeof output !== "object") return "";
  const o = output as Record<string, unknown>;
  switch (name) {
    case "classify_scenario": {
      const tags = (o.tags as string[] | undefined) ?? [];
      const conf = Number(o.confidence ?? 0);
      return `${tags.length} tag${tags.length === 1 ? "" : "s"}: ${tags.slice(0, 4).join(", ")}${tags.length > 4 ? "…" : ""} (conf ${conf.toFixed(2)})`;
    }
    case "get_portfolio_exposures": {
      const sectors = Object.keys((o.bySector as object) ?? {}).length;
      const themes = Object.keys((o.byThematic as object) ?? {}).length;
      return `${o.positionCount ?? 0} positions, ${sectors} sectors, ${themes} thematic tags`;
    }
    case "find_historical_analogs": {
      const arr = (output as unknown[]) ?? [];
      return `${arr.length} analog${arr.length === 1 ? "" : "s"}`;
    }
    case "get_analog_reactions": {
      const arr = (output as unknown[]) ?? [];
      return `${arr.length} reaction row${arr.length === 1 ? "" : "s"}`;
    }
    case "compute_position_impact": {
      const median = Number(o.portfolioMedian ?? NaN);
      const ids = (o.analogEventIds as string[] | undefined)?.length ?? 0;
      return Number.isFinite(median)
        ? `portfolio median ${formatPercent(median, 2)} over ${ids} analog events`
        : `no coverage`;
    }
    case "search_news_archive": {
      const arr = (output as unknown[]) ?? [];
      return `${arr.length} headline${arr.length === 1 ? "" : "s"}`;
    }
    default:
      return "";
  }
}
