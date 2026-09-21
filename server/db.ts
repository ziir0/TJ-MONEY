import { and, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { AccountSettings, InsertJournal, InsertTrade, InsertUser, accountSettings, journal, trades, users } from "../drizzle/schema.js";
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
export async function getJournalByDate(userId: number, date: Date) {
  const db = await getDb();
  if (!db) return null;
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const result = await db
    .select()
    .from(journal)
    .where(
      and(
        eq(journal.userId, userId),
        gte(journal.journalDate, startOfDay),
        lte(journal.journalDate, endOfDay)
      )
    )
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

export async function upsertJournal(userId: number, date: Date, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getJournalByDate(userId, date);
  
  if (existing) {
    return db.update(journal).set({ content }).where(eq(journal.id, existing.id));
  } else {
    return db.insert(journal).values({
      userId,
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

  const values = tradeRows.map((trade) => ({
    ...trade,
    userId,
  }));

  await db.insert(trades).values(values);
  return { importedCount: values.length };
}

export async function getAccountSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(accountSettings).where(eq(accountSettings.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function upsertAccountSettings(userId: number, values: Pick<AccountSettings, "startingBalance" | "startingBalanceDate">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getAccountSettings(userId);
  if (existing) {
    return db.update(accountSettings).set(values).where(and(eq(accountSettings.id, existing.id), eq(accountSettings.userId, userId)));
  }
  return db.insert(accountSettings).values({ userId, ...values });
}
