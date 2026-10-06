-- Drop old unique constraint on account_settings userId (both possible constraint names)
ALTER TABLE "account_settings" DROP CONSTRAINT IF EXISTS "account_settings_userId_key";
ALTER TABLE "account_settings" DROP CONSTRAINT IF EXISTS "account_settings_userId_unique";

-- Ensure multi-broker unique index on (userId, broker) exists
CREATE UNIQUE INDEX IF NOT EXISTS "account_settings_user_broker_idx" ON "account_settings" ("userId", "broker");

-- Add activeBroker column to users table with default 'Bybit'
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activeBroker" varchar(64) DEFAULT 'Bybit' NOT NULL;
