import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// packages/db/src -> repo root -> seed/
const SEED_DIR = join(__dirname, "../../../seed");

interface ExposureRecord {
  symbol: string;
  name: string;
  gics_sector: string;
  gics_industry: string;
  country_hq: string;
  is_etf?: number;
  thematic_tags: string[];
  country_revenue?: Record<string, number>;
}

async function loadEvents(client: postgres.Sql) {
  const eventsSqlPath = join(SEED_DIR, "events.sql");
  const eventsSql = readFileSync(eventsSqlPath, "utf8");
  console.log(`[seed] loading events from ${eventsSqlPath}`);
  await client.unsafe(eventsSql);
  const rows = await client<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM historical_events
  `;
  console.log(`[seed] historical_events rows: ${rows[0]?.count ?? "0"}`);
}

interface NewsRecord {
  event_id: string;
  date: string;
  source: string;
  headline: string;
}

async function loadNews(client: postgres.Sql, db: ReturnType<typeof drizzle<typeof schema>>) {
  const newsJsonPath = join(SEED_DIR, "news.json");
  const json = JSON.parse(readFileSync(newsJsonPath, "utf8")) as { items: NewsRecord[] };
  console.log(`[seed] loading ${json.items.length} news items from ${newsJsonPath}`);

  // Clear existing curated rows first so re-runs are idempotent without
  // creating duplicates. We only clear items we own (source != 'live').
  await client`DELETE FROM news_chunks WHERE source IN ('public-record', 'federalreserve.gov', 'curated')`;

  for (const n of json.items) {
    await db.insert(schema.newsChunks).values({
      eventId: n.event_id,
      publishedAt: n.date,
      source: n.source,
      headline: n.headline,
      body: n.headline, // brief curated summaries — body == headline
      embedding: null,
    });
  }

  const rows = await client<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM news_chunks
  `;
  console.log(`[seed] news_chunks rows: ${rows[0]?.count ?? "0"}`);
}

async function loadExposures(client: postgres.Sql, db: ReturnType<typeof drizzle<typeof schema>>) {
  const exposuresJsonPath = join(SEED_DIR, "exposures.json");
  const json = JSON.parse(readFileSync(exposuresJsonPath, "utf8")) as {
    tickers: ExposureRecord[];
  };
  console.log(`[seed] loading ${json.tickers.length} ticker exposures from ${exposuresJsonPath}`);

  for (const t of json.tickers) {
    await db
      .insert(schema.tickers)
      .values({
        symbol: t.symbol,
        name: t.name,
        gicsSector: t.gics_sector,
        gicsIndustry: t.gics_industry,
        countryHq: t.country_hq,
        isEtf: t.is_etf ?? 0,
        thematicTags: t.thematic_tags ?? [],
        countryRevenue: t.country_revenue ?? null,
      })
      .onConflictDoUpdate({
        target: schema.tickers.symbol,
        set: {
          name: t.name,
          gicsSector: t.gics_sector,
          gicsIndustry: t.gics_industry,
          countryHq: t.country_hq,
          isEtf: t.is_etf ?? 0,
          thematicTags: t.thematic_tags ?? [],
          countryRevenue: t.country_revenue ?? null,
          updatedAt: new Date(),
        },
      });
  }

  const rows = await client<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM tickers
  `;
  console.log(`[seed] tickers rows: ${rows[0]?.count ?? "0"}`);
  void sql; // type-only import keeper
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  try {
    await loadEvents(client);
    await loadExposures(client, db);
    await loadNews(client, db);
    console.log("[seed] done");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
