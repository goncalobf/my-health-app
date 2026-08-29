CREATE TABLE "app_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"auth_user_id" text,
	"email" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"joined_at" timestamp,
	CONSTRAINT "app_users_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "app_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
INSERT INTO "app_users" ("id", "email", "name", "role", "status")
VALUES (1, 'barrosferreira2000@gmail.com', 'Gonçalo', 'owner', 'invited');
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('app_users', 'id'), 1, true);
--> statement-breakpoint
ALTER TABLE "bodyweight_logs" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "coach_insights" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "coach_messages" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "owner_user_id" integer;
--> statement-breakpoint
ALTER TABLE "expenditure_logs" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "meal_templates" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "measurement_logs" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "nutrition_logs" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "routines" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "saved_foods" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "training_checkins" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "training_plan_state" ADD COLUMN "user_id" integer;
--> statement-breakpoint
ALTER TABLE "workout_schedule" ADD COLUMN "user_id" integer;
--> statement-breakpoint
UPDATE "bodyweight_logs" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "coach_insights" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "coach_messages" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "expenditure_logs" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "meal_templates" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "measurement_logs" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "nutrition_logs" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "routines" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "saved_foods" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "sessions" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "settings" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "training_checkins" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "training_plan_state" SET "user_id" = 1;
--> statement-breakpoint
UPDATE "workout_schedule" SET "user_id" = 1;
--> statement-breakpoint
ALTER TABLE "bodyweight_logs" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "coach_insights" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "coach_messages" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenditure_logs" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "meal_templates" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "measurement_logs" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "nutrition_logs" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "routines" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "saved_foods" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "training_checkins" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "training_plan_state" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "workout_schedule" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "expenditure_logs" DROP CONSTRAINT "expenditure_logs_pkey";
--> statement-breakpoint
ALTER TABLE "workout_schedule" DROP CONSTRAINT "workout_schedule_pkey";
--> statement-breakpoint
DROP INDEX "training_checkins_day_unique";
--> statement-breakpoint
ALTER TABLE "expenditure_logs" ADD CONSTRAINT "expenditure_logs_user_id_day_pk" PRIMARY KEY("user_id", "day");
--> statement-breakpoint
ALTER TABLE "workout_schedule" ADD CONSTRAINT "workout_schedule_user_id_day_of_week_pk" PRIMARY KEY("user_id", "day_of_week");
--> statement-breakpoint
CREATE SEQUENCE "settings_id_seq" OWNED BY "settings"."id";
--> statement-breakpoint
SELECT setval('settings_id_seq', coalesce((SELECT max("id") FROM "settings"), 1), true);
--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "id" SET DEFAULT nextval('settings_id_seq');
--> statement-breakpoint
CREATE SEQUENCE "training_plan_state_id_seq" OWNED BY "training_plan_state"."id";
--> statement-breakpoint
SELECT setval('training_plan_state_id_seq', coalesce((SELECT max("id") FROM "training_plan_state"), 1), true);
--> statement-breakpoint
ALTER TABLE "training_plan_state" ALTER COLUMN "id" SET DEFAULT nextval('training_plan_state_id_seq');
--> statement-breakpoint
ALTER TABLE "bodyweight_logs" ADD CONSTRAINT "bodyweight_logs_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "coach_insights" ADD CONSTRAINT "coach_insights_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_owner_user_id_app_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "expenditure_logs" ADD CONSTRAINT "expenditure_logs_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "measurement_logs" ADD CONSTRAINT "measurement_logs_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "nutrition_logs" ADD CONSTRAINT "nutrition_logs_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "saved_foods" ADD CONSTRAINT "saved_foods_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "training_checkins" ADD CONSTRAINT "training_checkins_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "training_plan_state" ADD CONSTRAINT "training_plan_state_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "workout_schedule" ADD CONSTRAINT "workout_schedule_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE UNIQUE INDEX "training_checkins_user_day_unique" ON "training_checkins" ("user_id", "day");
--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_unique" UNIQUE("user_id");
--> statement-breakpoint
ALTER TABLE "training_plan_state" ADD CONSTRAINT "training_plan_state_user_id_unique" UNIQUE("user_id");
