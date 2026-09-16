CREATE TABLE IF NOT EXISTS "account_settings" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL UNIQUE,
  "startingBalance" varchar(32) DEFAULT '0' NOT NULL,
  "startingBalanceDate" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "account_settings_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action
);

-- Down migration: DROP TABLE IF EXISTS "account_settings";
