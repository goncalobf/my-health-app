UPDATE "app_users" SET "status" = 'active' WHERE "status" = 'invited';--> statement-breakpoint
ALTER TABLE "app_users" ALTER COLUMN "status" SET DEFAULT 'active';
