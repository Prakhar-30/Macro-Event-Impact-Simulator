import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  numeric,
  jsonb,
  uuid,
  primaryKey,
  date,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";

const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value) {
      return `[${value.join(",")}]`;
    },
    fromDriver(value) {
      return JSON.parse(value);
    },
  })(name);

// NOTE: column TS-field names match what @auth/drizzle-adapter expects
// (camelCase for users; snake_case for the OAuth-provider response columns
// on accounts). DB column names are unaffected by the TS field name change.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  name: text("name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 64 }),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: varchar("session_token", { length: 255 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 320 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  })
);

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("portfolios_user_idx").on(t.userId),
  })
);

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    ticker: varchar("ticker", { length: 16 }).notNull(),
    weight: numeric("weight", { precision: 8, scale: 6 }).notNull(),
    shares: numeric("shares", { precision: 18, scale: 6 }),
    notes: text("notes"),
  },
  (t) => ({
    portfolioIdx: index("positions_portfolio_idx").on(t.portfolioId),
    portfolioTickerUniq: uniqueIndex("positions_portfolio_ticker_uniq").on(t.portfolioId, t.ticker),
  })
);

export const tickers = pgTable(
  "tickers",
  {
    symbol: varchar("symbol", { length: 16 }).primaryKey(),
    name: text("name"),
    gicsSector: varchar("gics_sector", { length: 64 }),
    gicsIndustry: varchar("gics_industry", { length: 128 }),
    countryHq: varchar("country_hq", { length: 4 }),
    isEtf: integer("is_etf").notNull().default(0),
    thematicTags: jsonb("thematic_tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    countryRevenue: jsonb("country_revenue").$type<Record<string, number>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sectorIdx: index("tickers_sector_idx").on(t.gicsSector),
  })
);

export const historicalEvents = pgTable(
  "historical_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    eventDate: date("event_date").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull(),
    severity: integer("severity").notNull().default(2),
    sourceUrls: jsonb("source_urls").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  },
  (t) => ({
    dateIdx: index("events_date_idx").on(t.eventDate),
  })
);

export const eventReactions = pgTable(
  "event_reactions",
  {
    eventId: varchar("event_id", { length: 64 })
      .notNull()
      .references(() => historicalEvents.id, { onDelete: "cascade" }),
    ticker: varchar("ticker", { length: 16 }).notNull(),
    horizon: varchar("horizon", { length: 8 }).notNull(),
    pctReturn: numeric("pct_return", { precision: 10, scale: 6 }).notNull(),
    priceStart: numeric("price_start", { precision: 18, scale: 6 }),
    priceEnd: numeric("price_end", { precision: 18, scale: 6 }),
    pulledAt: timestamp("pulled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.eventId, t.ticker, t.horizon] }),
    eventIdx: index("reactions_event_idx").on(t.eventId),
    tickerIdx: index("reactions_ticker_idx").on(t.ticker),
  })
);

export const newsChunks = pgTable(
  "news_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: varchar("event_id", { length: 64 }).references(() => historicalEvents.id, {
      onDelete: "set null",
    }),
    publishedAt: date("published_at"),
    source: varchar("source", { length: 64 }),
    headline: text("headline").notNull(),
    body: text("body").notNull(),
    embedding: vector("embedding", 1024),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    eventIdx: index("news_event_idx").on(t.eventId),
  })
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    portfolioId: uuid("portfolio_id").references(() => portfolios.id, { onDelete: "set null" }),
    scenarioText: text("scenario_text").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("queued"),
    result: jsonb("result"),
    errorMessage: text("error_message"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("jobs_user_idx").on(t.userId),
    statusIdx: index("jobs_status_idx").on(t.status),
  })
);

export const jobEvents = pgTable(
  "job_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    kind: varchar("kind", { length: 32 }).notNull(),
    payload: jsonb("payload").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobSeqUniq: uniqueIndex("job_events_seq_uniq").on(t.jobId, t.seq),
  })
);

export type User = typeof users.$inferSelect;
export type Portfolio = typeof portfolios.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type Ticker = typeof tickers.$inferSelect;
export type HistoricalEvent = typeof historicalEvents.$inferSelect;
export type EventReaction = typeof eventReactions.$inferSelect;
export type NewsChunk = typeof newsChunks.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobEvent = typeof jobEvents.$inferSelect;
