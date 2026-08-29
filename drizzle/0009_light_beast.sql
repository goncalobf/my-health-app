CREATE TABLE "training_checkins" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"sleep_poor" boolean DEFAULT false NOT NULL,
	"appetite_low" boolean DEFAULT false NOT NULL,
	"joint_pain" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_plan_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"plan_name" text DEFAULT 'PPL 6-day A/B' NOT NULL,
	"block_started_on" date NOT NULL,
	"is_deload" boolean DEFAULT false NOT NULL,
	"deload_started_on" date,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD COLUMN "target_rir_min" integer;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD COLUMN "target_rir_max" integer;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD COLUMN "avoid_failure" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD COLUMN "instruction" text;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD COLUMN "superset_group" text;--> statement-breakpoint
ALTER TABLE "routine_exercises" ADD COLUMN "is_anchor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "session_sets" ADD COLUMN "rir" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "training_checkins_day_unique" ON "training_checkins" USING btree ("day");