-- Add enabledBrokers column to users table with default JSON array containing 'Bybit' and 'Pepperstone'
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "enabledBrokers" text DEFAULT '["Bybit","Pepperstone"]';
UPDATE "users" SET "enabledBrokers" = '["Bybit","Pepperstone"]' WHERE "enabledBrokers" IS NULL;
