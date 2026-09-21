import { boolean, integer, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const tradeDirection = pgEnum("trade_direction", ["long", "short"]);
export const tradeAssetType = pgEnum("trade_asset_type", ["forex", "crypto", "stocks", "indices", "other"]);
export const tradeQuantityUnit = pgEnum("trade_quantity_unit", ["lots", "units", "coins", "shares", "contracts"]);
export const tradePnlSource = pgEnum("trade_pnl_source", ["calculated", "broker"]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Trades table - stores individual trade records
 */
export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  assetType: tradeAssetType("assetType").default("other").notNull(),
  quantityUnit: tradeQuantityUnit("quantityUnit").default("units").notNull(),
  contractSize: varchar("contractSize", { length: 32 }),
  pnlSource: tradePnlSource("pnlSource").default("calculated").notNull(),
  isInvoluntary: boolean("isInvoluntary").default(false).notNull(),
  direction: tradeDirection("direction").notNull(),
  entryPrice: varchar("entryPrice", { length: 32 }).notNull(),
  exitPrice: varchar("exitPrice", { length: 32 }).notNull(),
  quantity: varchar("quantity", { length: 32 }).notNull(),
  fees: varchar("fees", { length: 32 }).default("0").notNull(),
  pnl: varchar("pnl", { length: 32 }).notNull(),
  tradeDate: timestamp("tradeDate").notNull(),
  exitDate: timestamp("exitDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = typeof trades.$inferInsert;

/**
 * Journal table - stores daily trading journal entries
 */
export const journal = pgTable("journal", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  journalDate: timestamp("journalDate").notNull(),
  content: text("content"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type Journal = typeof journal.$inferSelect;
export type InsertJournal = typeof journal.$inferInsert;

/**
 * Per-user account settings used by the equity curve.
 */
export const accountSettings = pgTable("account_settings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique().references(() => users.id),
  startingBalance: varchar("startingBalance", { length: 32 }).default("0").notNull(),
  startingBalanceDate: timestamp("startingBalanceDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdateFn(() => new Date()).notNull(),
});

export type AccountSettings = typeof accountSettings.$inferSelect;
export type InsertAccountSettings = typeof accountSettings.$inferInsert;
