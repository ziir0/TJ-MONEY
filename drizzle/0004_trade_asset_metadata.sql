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
  ADD COLUMN IF NOT EXISTS "assetType" "trade_asset_type" NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS "quantityUnit" "trade_quantity_unit" NOT NULL DEFAULT 'units',
  ADD COLUMN IF NOT EXISTS "contractSize" varchar(32),
  ADD COLUMN IF NOT EXISTS "pnlSource" "trade_pnl_source" NOT NULL DEFAULT 'calculated';

-- Existing imports created from the broker statement should retain their official P&L semantics.
UPDATE "trades"
SET "assetType" = 'forex', "quantityUnit" = 'lots', "pnlSource" = 'broker'
WHERE "notes" ILIKE '%imported from statement%';

-- Down migration:
-- ALTER TABLE "trades" DROP COLUMN IF EXISTS "assetType", DROP COLUMN IF EXISTS "quantityUnit", DROP COLUMN IF EXISTS "contractSize", DROP COLUMN IF EXISTS "pnlSource";
-- DROP TYPE IF EXISTS "trade_asset_type", "trade_quantity_unit", "trade_pnl_source";
