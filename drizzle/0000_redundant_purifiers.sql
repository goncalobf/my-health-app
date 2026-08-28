CREATE TABLE IF NOT EXISTS "bodyweight_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"weight_kg" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"muscle_group" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nutrition_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"meal" text DEFAULT 'snack' NOT NULL,
	"name" text NOT NULL,
	"barcode" text,
	"quantity_g" real DEFAULT 100 NOT NULL,
	"calories" real DEFAULT 0 NOT NULL,
	"protein_g" real DEFAULT 0 NOT NULL,
	"carbs_g" real DEFAULT 0 NOT NULL,
	"fat_g" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routine_exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"routine_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"target_sets" integer DEFAULT 3 NOT NULL,
	"target_reps" integer DEFAULT 10 NOT NULL,
	"target_weight_kg" real,
	"rest_seconds" integer DEFAULT 120 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "routines" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"notes" text,
	"archived" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"set_number" integer NOT NULL,
	"weight_kg" real DEFAULT 0 NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"is_warmup" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"routine_id" integer,
	"name" text NOT NULL,
	"notes" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"target_calories" real DEFAULT 2200 NOT NULL,
	"target_protein_g" real DEFAULT 160 NOT NULL,
	"target_carbs_g" real DEFAULT 220 NOT NULL,
	"target_fat_g" real DEFAULT 70 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "routine_exercises" ADD CONSTRAINT "routine_exercises_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_sets" ADD CONSTRAINT "session_sets_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_sets" ADD CONSTRAINT "session_sets_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
