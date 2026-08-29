ALTER TABLE "settings" ADD COLUMN "onboarded_at" timestamp;--> statement-breakpoint
-- Accounts that already exist are set up; never send them through onboarding.
UPDATE "settings" SET "onboarded_at" = now() WHERE "onboarded_at" IS NULL;
