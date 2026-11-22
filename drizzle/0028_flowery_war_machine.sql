ALTER TABLE "workout_day_choices" DROP CONSTRAINT "workout_day_choices_routine_id_routines_id_fk";
--> statement-breakpoint
ALTER TABLE "activity_sessions" ADD COLUMN "effort" text;--> statement-breakpoint
ALTER TABLE "workout_day_choices" ADD COLUMN "jiu_jitsu" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_day_choices" ADD CONSTRAINT "workout_day_choices_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE set null ON UPDATE no action;