CREATE TABLE "garmin_daily_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"resting_hr_bpm" integer,
	"hrv_score" integer,
	"hrv_balance_score" integer,
	"sleep_duration_seconds" integer,
	"sleep_score_value" integer,
	"calories_active" integer,
	"calories_total" integer,
	"steps" integer,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garmin_daily_metrics" ADD CONSTRAINT "garmin_daily_metrics_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "garmin_daily_metrics_user_date_unique" ON "garmin_daily_metrics" USING btree ("user_id","date");