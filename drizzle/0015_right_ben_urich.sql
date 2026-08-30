CREATE TABLE "activity_intervals" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_session_id" integer NOT NULL,
	"interval_number" integer NOT NULL,
	"target_distance_m" real,
	"actual_distance_m" real,
	"duration_seconds" integer,
	"avg_heart_rate" integer
);
--> statement-breakpoint
CREATE TABLE "activity_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"duration_seconds" integer,
	"avg_heart_rate" integer,
	"max_heart_rate" integer,
	"calories" integer,
	"notes" text,
	"distance_m" real,
	"elevation_m" real,
	"avg_speed_kmh" real,
	"avg_power_w" integer,
	"avg_cadence" integer,
	"division" text,
	"location" text,
	"rox_zone_seconds" integer,
	"garmin_activity_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garmin_connections" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"encrypted_data" text NOT NULL,
	"last_synced_at" timestamp,
	"connected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garmin_pending_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"garmin_activity_id" text NOT NULL,
	"garmin_activity_type" text NOT NULL,
	"garmin_data_json" text NOT NULL,
	"labeled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hyrox_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"activity_session_id" integer NOT NULL,
	"segment_number" integer NOT NULL,
	"segment_type" text NOT NULL,
	"station_name" text,
	"duration_seconds" integer,
	"avg_heart_rate" integer,
	"weight_kg" real,
	"reps_or_distance_m" real
);
--> statement-breakpoint
ALTER TABLE "activity_intervals" ADD CONSTRAINT "activity_intervals_activity_session_id_activity_sessions_id_fk" FOREIGN KEY ("activity_session_id") REFERENCES "public"."activity_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_sessions" ADD CONSTRAINT "activity_sessions_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garmin_connections" ADD CONSTRAINT "garmin_connections_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garmin_pending_imports" ADD CONSTRAINT "garmin_pending_imports_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hyrox_segments" ADD CONSTRAINT "hyrox_segments_activity_session_id_activity_sessions_id_fk" FOREIGN KEY ("activity_session_id") REFERENCES "public"."activity_sessions"("id") ON DELETE cascade ON UPDATE no action;