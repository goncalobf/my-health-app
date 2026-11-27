CREATE TABLE "coach_revisions" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"chat_revision" integer DEFAULT 0 NOT NULL,
	"memory_revision" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garmin_connections" ADD COLUMN "last_activities_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "coach_revisions" ADD CONSTRAINT "coach_revisions_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;