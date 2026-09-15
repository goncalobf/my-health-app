ALTER TABLE "routine_exercises" ADD COLUMN "equipment_profile" jsonb;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD COLUMN "muscle_profile" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "prescription_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "performance_context" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "skipped_sets" jsonb DEFAULT '[]'::jsonb NOT NULL;