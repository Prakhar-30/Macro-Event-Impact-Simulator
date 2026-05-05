"use client";

import { useMemo } from "react";

interface ToolUseRow {
  name: string;
  input: unknown;
  result?: { ok: boolean; output?: unknown };
}

/**
 * Renders the agent's final briefing text with two enhancements:
 *   1. [event_id] citation chips become hoverable, linking back to the
 *      analog event the model used.
 *   2. Heuristic markdown: paragraphs, bullet lists, **bold**, headings.
 *
 * Deliberately small (no heavy markdown lib) — the system prompt asks
 * for terse markdown and our renderer covers that. If we ever need
 * tables / code blocks / etc. we can swap in `react-markdown`.
 */
export function FinalBriefing({
  text,
  isStreaming,
  positions,
  toolCalls,
}: {
  text: string;
  isStreaming: boolean;
  positions: { ticker: string; weight: number }[];
  toolCalls: ToolUseRow[];
}) {
  const eventLookup = useMemo(() => collectAnalogEvents(toolCalls), [toolCalls]);
  void positions;

  return (
    <div className="rounded-lg border bg-card p-6 leading-relaxed">
      <article className="prose prose-sm max-w-none text-sm dark:prose-invert">
        {renderText(text, eventLookup)}
        {isStreaming && <span className="ml-1 inline-block h-3 w-2 animate-pulse bg-foreground/70" />}
      </article>
    </div>
  );
}

interface AnalogMeta {
  id: string;
  title: string;
  date: string;
  description: string;
}

function collectAnalogEvents(toolCalls: ToolUseRow[]): Map<string, AnalogMeta> {
  const map = new Map<string, AnalogMeta>();
  for (const c of toolCalls) {
    if (c.name !== "find_historical_analogs" || !c.result?.ok) continue;
    const arr = (c.result.output as unknown[]) ?? [];
    for (const item of arr) {
      const ev = item as { id?: string; title?: string; eventDate?: string; description?: string };
      if (!ev.id) continue;
      map.set(ev.id, {
        id: ev.id,
        title: ev.title ?? ev.id,
        date: ev.eventDate ?? "",
        description: ev.description ?? "",
      });
    }
  }
  return map;
}

function renderText(text: string, lookup: Map<string, AnalogMeta>) {
  if (!text) return null;
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuf: string[] = [];

  const flushList = () => {
    if (listBuf.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc space-y-1 pl-5">
        {listBuf.map((it, i) => (
          <li key={i}>{renderInline(it, lookup)}</li>
        ))}
      </ul>
    );
    listBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuf.push(line.slice(2));
      continue;
    }
    flushList();
    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={blocks.length} className="mt-4 text-sm font-semibold">
          {renderInline(line.slice(4), lookup)}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={blocks.length} className="mt-5 text-base font-semibold">
          {renderInline(line.slice(3), lookup)}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={blocks.length} className="mt-5 text-lg font-semibold">
          {renderInline(line.slice(2), lookup)}
        </h2>
      );
    } else if (line.length === 0) {
      blocks.push(<div key={blocks.length} className="h-2" />);
    } else {
      blocks.push(
        <p key={blocks.length} className="mt-2">
          {renderInline(line, lookup)}
        </p>
      );
    }
  }
  flushList();
  return blocks;
}

function renderInline(s: string, lookup: Map<string, AnalogMeta>): React.ReactNode {
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < s.length) {
    // [event_id] citation
    if (s[i] === "[") {
      const close = s.indexOf("]", i + 1);
      if (close > i + 1) {
        const inner = s.slice(i + 1, close);
        if (/^[a-z0-9_]+$/i.test(inner)) {
          const meta = lookup.get(inner);
          out.push(<CitationChip key={key++} id={inner} meta={meta} />);
          i = close + 1;
          continue;
        }
      }
    }
    // **bold**
    if (s.slice(i, i + 2) === "**") {
      const end = s.indexOf("**", i + 2);
      if (end > i + 2) {
        out.push(<strong key={key++}>{s.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }
    // simple text run until next special char
    const next = s.slice(i).search(/(\[|\*\*)/);
    if (next === -1) {
      out.push(<span key={key++}>{s.slice(i)}</span>);
      break;
    }
    out.push(<span key={key++}>{s.slice(i, i + next)}</span>);
    i += next;
  }
  return out;
}

function CitationChip({ id, meta }: { id: string; meta?: AnalogMeta }) {
  const title = meta ? `${meta.title} (${meta.date})` : id;
  return (
    <span
      title={title}
      className="mx-0.5 inline-flex items-baseline gap-1 rounded border bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground hover:border-primary/40 hover:text-foreground"
    >
      {id}
    </span>
  );
}
