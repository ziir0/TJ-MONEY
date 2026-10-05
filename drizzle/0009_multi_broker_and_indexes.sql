-- Drop old unique constraint on account_settings userId if exists
ALTER TABLE "account_settings" DROP CONSTRAINT IF EXISTS "account_settings_userId_unique";

-- Create unique index on (userId, broker) for account_settings
CREATE UNIQUE INDEX IF NOT EXISTS "account_settings_user_broker_idx" ON "account_settings" ("userId", "broker");

-- Create performance indexes for trades
CREATE INDEX IF NOT EXISTS "trades_user_date_idx" ON "trades" ("userId", "tradeDate");
CREATE INDEX IF NOT EXISTS "trades_user_broker_idx" ON "trades" ("userId", "broker");
CREATE INDEX IF NOT EXISTS "trades_user_symbol_idx" ON "trades" ("userId", "symbol");

-- Create performance index for journal
CREATE INDEX IF NOT EXISTS "journal_user_date_idx" ON "journal" ("userId", "journalDate");

-- Create performance index for broker cash movements
CREATE INDEX IF NOT EXISTS "movements_user_broker_idx" ON "broker_cash_movements" ("userId", "broker");
