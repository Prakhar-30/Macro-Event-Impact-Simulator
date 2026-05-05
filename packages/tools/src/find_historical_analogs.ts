/**
 * find_historical_analogs(tags, limit) -> AnalogEvent[]
 *
 * Scores curated events against the input scenario tag set:
 *   matchScore = (#shared tags) + 0.25 * severity_bonus + 0.05 * recency_bonus
 * where severity_bonus = (severity - 1)/3 in [0,1] and recency_bonus is a
 * year-decayed weight giving recent events a small edge for relevance.
 *
 * Pure SQL would be cleaner with a tags GIN index, but the curated event
 * count is small (~30) so we read all rows and score in JS — keeps the
 * tool fully deterministic and testable.
 */
import { getDb, schema } from "@macroscope/db";
import type { AnalogEvent, ScenarioTag } from "./types.js";

const NOW_YEAR = new Date().getUTCFullYear();

export async function findHistoricalAnalogs(
  tags: ScenarioTag[],
  limit = 8,
  opts: { minOverlap?: number } = {}
): Promise<AnalogEvent[]> {
  const minOverlap = opts.minOverlap ?? 1;
  if (tags.length === 0) return [];

  const db = getDb();
  const events = await db.select().from(schema.historicalEvents);

  const tagSet = new Set<string>(tags);
  const scored: AnalogEvent[] = [];

  for (const ev of events) {
    const eventTags = (ev.tags ?? []) as string[];
    const matched = eventTags.filter((t) => tagSet.has(t));
    if (matched.length < minOverlap) continue;

    const severityBonus = ((ev.severity ?? 1) - 1) / 3;
    const yr = Number((ev.eventDate ?? "1900-01-01").slice(0, 4));
    const yearsAgo = Math.max(0, NOW_YEAR - yr);
    const recencyBonus = Math.exp(-yearsAgo / 12); // 12-year half-life
    const score = matched.length + 0.25 * severityBonus + 0.05 * recencyBonus;

    scored.push({
      id: ev.id,
      eventDate: ev.eventDate,
      title: ev.title,
      description: ev.description,
      tags: eventTags,
      severity: ev.severity ?? 1,
      matchedTags: matched,
      matchScore: Number(score.toFixed(4)),
      sourceUrls: (ev.sourceUrls ?? []) as string[],
    });
  }

  scored.sort((a, b) => b.matchScore - a.matchScore || a.eventDate.localeCompare(b.eventDate));
  return scored.slice(0, limit);
}
