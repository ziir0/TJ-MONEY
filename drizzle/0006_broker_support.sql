DO $$ BEGIN
  CREATE TYPE "trade_asset_type" AS ENUM ('forex', 'crypto', 'stocks', 'indices', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "trade_quantity_unit" AS ENUM ('lots', 'units', 'coins', 'shares', 'contracts');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "trade_pnl_source" AS ENUM ('calculated', 'broker');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "trades"
  ADD COLUMN IF NOT EXISTS "broker" varchar(64) NOT NULL DEFAULT 'Pepperstone',
  ADD COLUMN IF NOT EXISTS "assetType" "trade_asset_type" NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS "quantityUnit" "trade_quantity_unit" NOT NULL DEFAULT 'units',
  ADD COLUMN IF NOT EXISTS "contractSize" varchar(32),
  ADD COLUMN IF NOT EXISTS "pnlSource" "trade_pnl_source" NOT NULL DEFAULT 'calculated',
  ADD COLUMN IF NOT EXISTS "isInvoluntary" boolean NOT NULL DEFAULT false;

UPDATE "trades"
SET "broker" = CASE
  WHEN "tradeDate" >= timestamp '2026-10-01 00:00:00' THEN 'Bybit'
  ELSE 'Pepperstone'
END;

ALTER TABLE "trades" ALTER COLUMN "broker" SET DEFAULT 'Bybit';

ALTER TABLE "journal"
  ADD COLUMN IF NOT EXISTS "broker" varchar(64) NOT NULL DEFAULT 'Bybit';

UPDATE "journal"
SET "broker" = CASE
  WHEN "journalDate" >= timestamp '2026-10-01 00:00:00' THEN 'Bybit'
  ELSE 'Pepperstone'
END;

ALTER TABLE "account_settings"
  ADD COLUMN IF NOT EXISTS "broker" varchar(64) NOT NULL DEFAULT 'Bybit';

CREATE TABLE IF NOT EXISTS "broker_cash_movements" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL REFERENCES "users"("id"),
  "broker" varchar(64) NOT NULL DEFAULT 'Bybit',
  "kind" varchar(16) NOT NULL,
  "amount" varchar(32) NOT NULL DEFAULT '0',
  "date" timestamp NOT NULL DEFAULT now(),
  "note" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

INSERT INTO "broker_cash_movements" ("userId", "broker", "kind", "amount", "date", "note")
SELECT u."id", 'Bybit', 'deposit', '8', timestamp '2026-10-01 00:00:00', 'Initial Bybit balance'
FROM "users" u
WHERE EXISTS (
  SELECT 1 FROM "trades" t
  WHERE t."userId" = u."id" AND t."tradeDate" >= timestamp '2026-10-01 00:00:00'
)
AND NOT EXISTS (
  SELECT 1 FROM "broker_cash_movements" m
  WHERE m."userId" = u."id" AND m."broker" = 'Bybit' AND m."note" = 'Initial Bybit balance'
);