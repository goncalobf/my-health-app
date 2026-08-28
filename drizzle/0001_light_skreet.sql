CREATE TABLE IF NOT EXISTS "expenditure_logs" (
	"day" date PRIMARY KEY NOT NULL,
	"total_calories" real NOT NULL,
	"active_calories" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meal_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"items_json" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "measurement_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"waist_cm" real,
	"chest_cm" real,
	"arms_cm" real,
	"thighs_cm" real,
	"body_fat_pct" real,
	"notes" text,
	"photo_data_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_foods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"barcode" text,
	"serving_name" text,
	"serving_grams" real DEFAULT 100 NOT NULL,
	"calories_per_100" real DEFAULT 0 NOT NULL,
	"protein_per_100" real DEFAULT 0 NOT NULL,
	"carbs_per_100" real DEFAULT 0 NOT NULL,
	"fat_per_100" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workout_schedule" (
	"day_of_week" integer PRIMARY KEY NOT NULL,
	"routine_id" integer
);
--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD COLUMN "min_reps" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD COLUMN "max_reps" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD COLUMN "weight_increment_kg" real DEFAULT 2.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "goal" text DEFAULT 'recomposition' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "target_weekly_change_pct" real DEFAULT -0.25 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "adaptive_targets" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workout_schedule" ADD CONSTRAINT "workout_schedule_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
