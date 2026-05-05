/**
 * search_news_archive(query, topK) -> NewsHit[]
 *
 * pgvector-backed semantic search over the news_chunks table.
 * Used for the "historical context" section of the briefing only —
 * never for impact calculation.
 *
 * Embeddings are produced by the agent worker (M4) at write-time.
 * The query embedding is provided by the caller; this tool is purely
 * a vector lookup so it remains deterministic and testable.
 *
 * In M2/M3 we don't yet have the news ingestion pipeline; the table
 * may be empty and this tool just returns []. M7 polish: add a CLI
 * for ingesting headlines from public sources (GDELT, Wikipedia event
 * pages, Fed/Treasury press releases — see DATA.md).
 */
import { sql } from "drizzle-orm";
import { getDb, schema } from "@macroscope/db";
import type { NewsHit } from "./types.js";

export interface NewsSearchInput {
  queryEmbedding?: number[];
  eventId?: string;
  topK?: number;
}

export async function searchNewsArchive(input: NewsSearchInput): Promise<NewsHit[]> {
  const db = getDb();
  const k = input.topK ?? 5;

  // Eventless or no embedding: return latest by event_id, no similarity.
  if (!input.queryEmbedding || input.queryEmbedding.length === 0) {
    const where = input.eventId
      ? sql`event_id = ${input.eventId}`
      : sql`1=1`;
    const rows = await db.execute(sql`
      SELECT id::text AS id, event_id AS event_id, published_at::text AS published_at,
             source, headline
      FROM ${schema.newsChunks}
      WHERE ${where}
      ORDER BY published_at DESC NULLS LAST
      LIMIT ${k}
    `);
    return (rows as unknown as Array<{
      id: string;
      event_id: string | null;
      published_at: string | null;
      source: string | null;
      headline: string;
    }>).map((r) => ({
      id: r.id,
      eventId: r.event_id,
      publishedAt: r.published_at,
      source: r.source,
      headline: r.headline,
      similarity: 0,
    }));
  }

  // pgvector cosine distance: 1 - cosine_similarity. Smaller = better.
  const vec = `[${input.queryEmbedding.join(",")}]`;
  const where = input.eventId ? sql`event_id = ${input.eventId}` : sql`1=1`;
  const rows = await db.execute(sql`
    SELECT id::text AS id, event_id AS event_id, published_at::text AS published_at,
           source, headline,
           1 - (embedding <=> ${vec}::vector) AS similarity
    FROM ${schema.newsChunks}
    WHERE embedding IS NOT NULL AND ${where}
    ORDER BY embedding <=> ${vec}::vector ASC
    LIMIT ${k}
  `);
  return (rows as unknown as Array<{
    id: string;
    event_id: string | null;
    published_at: string | null;
    source: string | null;
    headline: string;
    similarity: number;
  }>).map((r) => ({
    id: r.id,
    eventId: r.event_id,
    publishedAt: r.published_at,
    source: r.source,
    headline: r.headline,
    similarity: Number(r.similarity),
  }));
}
