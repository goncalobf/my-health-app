ALTER TABLE "settings" ADD COLUMN "current_weight_kg" real;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "height_cm" real;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "age_years" integer;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "biological_sex" text DEFAULT 'unspecified' NOT NULL;--> statement-breakpoint
UPDATE "settings"
SET "current_weight_kg" = (
	SELECT "weight_kg" FROM "bodyweight_logs"
	ORDER BY "day" DESC, "id" DESC
	LIMIT 1
)
WHERE "current_weight_kg" IS NULL;
