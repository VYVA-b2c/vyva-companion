ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number" text;

ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_number_unique"
  ON "users" ("phone_number")
  WHERE "phone_number" IS NOT NULL;
