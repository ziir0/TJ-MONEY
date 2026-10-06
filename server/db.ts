import { and, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { AccountSettings, InsertJournal, InsertTrade, InsertUser, accountSettings, brokerCashMovements, journal, trades, users } from "../drizzle/schema.js";
import { DEFAULT_ENABLED_BROKERS, sanitizeEnabledBrokers } from "../shared/brokers.js";
import { ENV } from './_core/env.js';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      console.info("[TJ DB] Creating PostgreSQL client", {
        urlConfigured: true,
        poolMax: 1,
        prepare: false,
      });
      const client = postgres(process.env.DATABASE_URL, {
        max: 1,
        prepare: false,
        ssl: "require",
      });
      _db = drizzle(client);
      console.info("[TJ DB] Drizzle client initialized");
    } catch (error) {
      console.error("[TJ DB] Failed to initialize", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Get all trades for a user
 */
export async function getUserTrades(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trades).where(eq(trades.userId, userId)).orderBy(desc(trades.tradeDate));
}

export type TradeFilterOptions = {
  broker?: string;
  symbol?: string;
  direction?: "long" | "short";
  outcome?: "win" | "loss" | "breakeven";
  assetType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
};

export async function getUserTradesFiltered(userId: number, filters: TradeFilterOptions = {}) {
  const db = await getDb();
  if (!db) return { trades: [], totalCount: 0 };

  const conditions = [eq(trades.userId, userId)];

  if (filters.broker && filters.broker !== "All Brokers") {
    conditions.push(eq(trades.broker, filters.broker));
  }

  if (filters.symbol && filters.symbol.trim()) {
    conditions.push(eq(trades.symbol, filters.symbol.trim().toUpperCase()));
  }

  if (filters.direction) {
    conditions.push(eq(trades.direction, filters.direction));
  }

  if (filters.assetType && filters.assetType !== "all") {
    conditions.push(eq(trades.assetType, filters.assetType as any));
  }

  if (filters.startDate) {
    conditions.push(gte(trades.tradeDate, filters.startDate));
  }

  if (filters.endDate) {
    conditions.push(lte(trades.tradeDate, filters.endDate));
  }

  const query = db
    .select()
    .from(trades)
    .where(and(...conditions))
    .orderBy(desc(trades.tradeDate));

  const allFiltered = await query;

  let outcomeFiltered = allFiltered;
  if (filters.outcome) {
    outcomeFiltered = allFiltered.filter((trade) => {
      const pnlNum = Number(trade.pnl || 0);
      if (filters.outcome === "win") return pnlNum > 0;
      if (filters.outcome === "loss") return pnlNum < 0;
      return pnlNum === 0;
    });
  }

  const totalCount = outcomeFiltered.length;
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 50;
  const paginatedTrades = outcomeFiltered.slice(offset, offset + limit);

  return {
    trades: paginatedTrades,
    totalCount,
  };
}

/**
 * Get trades for a specific date
 */
export async function getTradesByDate(userId: number, date: Date) {
  const db = await getDb();
  if (!db) return [];
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        gte(trades.tradeDate, startOfDay),
        lte(trades.tradeDate, endOfDay)
      )
    )
    .orderBy(trades.tradeDate);
}

/**
 * Get trades within a date range
 */
export async function getTradesByDateRange(userId: number, startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.userId, userId),
        gte(trades.tradeDate, startDate),
        lte(trades.tradeDate, endDate)
      )
    )
    .orderBy(desc(trades.tradeDate));
}

/**
 * Create a new trade
 */
export async function createTrade(trade: InsertTrade) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(trades).values(trade);
  return result;
}

/**
 * Update a trade
 */
export async function updateTrade(userId: number, id: number, updates: Partial<InsertTrade>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(trades).set(updates).where(and(eq(trades.id, id), eq(trades.userId, userId)));
}

/**
 * Delete a trade
 */
export async function deleteTrade(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(trades).where(and(eq(trades.id, id), eq(trades.userId, userId)));
}

/**
 * Get journal entry for a date
 */
export async function getJournalByDate(userId: number, date: Date, broker?: string) {
  const db = await getDb();
  if (!db) return null;
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const conditions = [
    eq(journal.userId, userId),
    gte(journal.journalDate, startOfDay),
    lte(journal.journalDate, endOfDay),
  ];

  if (broker && broker !== "All Brokers") {
    conditions.push(eq(journal.broker, broker));
  }
  
  const result = await db
    .select()
    .from(journal)
    .where(and(...conditions))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Upsert journal entry
 */
export async function deleteJournal(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(journal).where(and(eq(journal.id, id), eq(journal.userId, userId)));
}

export async function upsertJournal(userId: number, date: Date, content: string, broker = "Bybit") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getJournalByDate(userId, date, broker);
  
  if (existing) {
    return db.update(journal).set({ content, broker }).where(eq(journal.id, existing.id));
  } else {
    return db.insert(journal).values({
      userId,
      broker,
      journalDate: date,
      content,
    });
  }
}

/**
 * Calculate trading statistics for a user
 */
export async function calculateStats(userId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return null;
  
  let conditions: any = eq(trades.userId, userId);
  
  if (startDate && endDate) {
    conditions = and(
      eq(trades.userId, userId),
      gte(trades.tradeDate, startDate),
      lte(trades.tradeDate, endDate)
    );
  }
  
  const allTrades = await db.select().from(trades).where(conditions);
  
  if (allTrades.length === 0) {
    return {
      totalPnL: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
    };
  }
  
  let totalPnL = 0;
  let winCount = 0;
  let lossCount = 0;
  let totalWins = 0;
  let totalLosses = 0;
  
  for (const trade of allTrades) {
    const pnl = parseFloat(trade.pnl);
    totalPnL += pnl;
    
    if (pnl > 0) {
      winCount++;
      totalWins += pnl;
    } else if (pnl < 0) {
      lossCount++;
      totalLosses += Math.abs(pnl);
    }
  }
  
  const winRate = allTrades.length > 0 ? (winCount / allTrades.length) * 100 : 0;
  const averageWin = winCount > 0 ? totalWins / winCount : 0;
  const averageLoss = lossCount > 0 ? totalLosses / lossCount : 0;
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
  
  return {
    totalPnL,
    winRate,
    averageWin,
    averageLoss,
    profitFactor,
    tradeCount: allTrades.length,
    winCount,
    lossCount,
  };
}

/**
 * Bulk create validated trades for one user.
 */
export async function bulkCreateTrades(userId: number, tradeRows: Omit<InsertTrade, "userId">[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db.select({
    symbol: trades.symbol,
    direction: trades.direction,
    entryPrice: trades.entryPrice,
    exitPrice: trades.exitPrice,
    quantity: trades.quantity,
    pnl: trades.pnl,
    tradeDate: trades.tradeDate,
    exitDate: trades.exitDate,
  }).from(trades).where(eq(trades.userId, userId));

  const keyFor = (trade: Pick<InsertTrade, "symbol" | "direction" | "entryPrice" | "exitPrice" | "quantity" | "pnl" | "tradeDate" | "exitDate">) => [
    trade.symbol,
    trade.direction,
    trade.entryPrice,
    trade.exitPrice,
    trade.quantity,
    trade.pnl,
    new Date(trade.tradeDate).getTime(),
    trade.exitDate ? new Date(trade.exitDate).getTime() : "",
  ].join("|");

  const seen = new Set(existing.map(keyFor));
  const newTrades = tradeRows.filter((trade) => {
    const key = keyFor(trade);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const values = newTrades.map((trade) => ({
    ...trade,
    userId,
  }));

  if (values.length > 0) await db.insert(trades).values(values);
  return { importedCount: values.length, skippedCount: tradeRows.length - values.length };
}

export async function getAccountSettings(userId: number, broker?: string) {
  const db = await getDb();
  if (!db) return null;

  if (broker && broker !== "All Brokers") {
    const result = await db
      .select()
      .from(accountSettings)
      .where(and(eq(accountSettings.userId, userId), eq(accountSettings.broker, broker)))
      .orderBy(desc(accountSettings.updatedAt), desc(accountSettings.id))
      .limit(1);

    if (result.length > 0) return result[0];

    // No fallback to another broker's capital! Return specific empty settings for this broker.
    return {
      id: 0,
      userId,
      broker,
      startingBalance: "0",
      startingBalanceDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // All Brokers or unspecified: aggregate starting balance across all configured brokers
  const rows = await db
    .select()
    .from(accountSettings)
    .where(eq(accountSettings.userId, userId))
    .orderBy(desc(accountSettings.updatedAt), desc(accountSettings.id));

  if (rows.length === 0) {
    return {
      id: 0,
      userId,
      broker: "All Brokers",
      startingBalance: "0",
      startingBalanceDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const totalStartingBalance = rows.reduce(
    (acc, row) => acc + (Number(row.startingBalance) || 0),
    0
  );
  const earliestDate =
    rows
      .map((r) => r.startingBalanceDate)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] ?? null;

  return {
    id: 0,
    userId,
    broker: "All Brokers",
    startingBalance: String(totalStartingBalance),
    startingBalanceDate: earliestDate,
    createdAt: rows[0].createdAt,
    updatedAt: rows[0].updatedAt,
  };
}

export async function getAllAccountSettings(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(accountSettings)
    .where(eq(accountSettings.userId, userId))
    .orderBy(desc(accountSettings.updatedAt), desc(accountSettings.id));
}

export async function getActiveBroker(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "Bybit";

  const result = await db
    .select({ activeBroker: users.activeBroker })
    .from(users)
    .where(eq(users.id, userId))
    .orderBy(desc(users.updatedAt), desc(users.id))
    .limit(1);

  return result[0]?.activeBroker ?? "Bybit";
}

export async function setActiveBroker(userId: number, broker: string): Promise<string> {
  const db = await getDb();
  if (!db) return broker;

  await db
    .update(users)
    .set({
      activeBroker: broker,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return broker;
}

export async function getEnabledBrokers(userId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [...DEFAULT_ENABLED_BROKERS];

  const result = await db
    .select({ enabledBrokers: users.enabledBrokers })
    .from(users)
    .where(eq(users.id, userId))
    .orderBy(desc(users.updatedAt), desc(users.id))
    .limit(1);

  const raw = result[0]?.enabledBrokers;
  if (!raw) return [...DEFAULT_ENABLED_BROKERS];
  try {
    const parsed = JSON.parse(raw);
    return sanitizeEnabledBrokers(parsed);
  } catch {
    return [...DEFAULT_ENABLED_BROKERS];
  }
}

export async function setEnabledBrokers(userId: number, brokers: string[]): Promise<string[]> {
  const db = await getDb();
  const sanitized = sanitizeEnabledBrokers(brokers);
  if (!db) return sanitized;

  const currentActive = await getActiveBroker(userId);
  const nextActive = sanitized.includes(currentActive) || currentActive === "All Brokers"
    ? currentActive
    : (sanitized[0] ?? "All Brokers");

  await db
    .update(users)
    .set({
      enabledBrokers: JSON.stringify(sanitized),
      activeBroker: nextActive,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return sanitized;
}

export async function upsertAccountSettings(
  userId: number,
  values: Pick<AccountSettings, "broker" | "startingBalance" | "startingBalanceDate">,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const broker = values.broker ?? "Bybit";
  const existing = await db
    .select()
    .from(accountSettings)
    .where(and(eq(accountSettings.userId, userId), eq(accountSettings.broker, broker)))
    .orderBy(desc(accountSettings.updatedAt), desc(accountSettings.id))
    .limit(1);

  if (existing.length > 0) {
    return db
      .update(accountSettings)
      .set({
        broker,
        startingBalance: values.startingBalance,
        startingBalanceDate: values.startingBalanceDate,
        updatedAt: new Date(),
      })
      .where(and(eq(accountSettings.id, existing[0].id), eq(accountSettings.userId, userId)));
  }

  return db.insert(accountSettings).values({
    userId,
    broker,
    startingBalance: values.startingBalance,
    startingBalanceDate: values.startingBalanceDate,
    updatedAt: new Date(),
  });
}

export async function getBrokerMovements(userId: number, broker?: string) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(brokerCashMovements.userId, userId)];
  if (broker && broker !== "All Brokers") {
    conditions.push(eq(brokerCashMovements.broker, broker));
  }

  return db
    .select()
    .from(brokerCashMovements)
    .where(and(...conditions))
    .orderBy(desc(brokerCashMovements.date));
}

export async function addBrokerMovement(
  userId: number,
  values: {
    broker: string;
    kind: "deposit" | "withdrawal";
    amount: number | string;
    date?: Date | string;
    note?: string | null;
  },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.insert(brokerCashMovements).values({
    userId,
    broker: values.broker,
    kind: values.kind,
    amount: String(values.amount),
    date: values.date ? new Date(values.date) : new Date(),
    note: values.note ?? null,
  });
}

export async function deleteBrokerMovement(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(brokerCashMovements).where(and(eq(brokerCashMovements.id, id), eq(brokerCashMovements.userId, userId)));
}
