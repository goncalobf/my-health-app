CREATE TABLE "garmin_operation_state" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"sync_lease" uuid,
	"sync_expires_at" timestamp,
	"auth_rate" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garmin_request_nonces" (
	"nonce" uuid PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "garmin_auth_sessions" ADD COLUMN "purpose" text DEFAULT 'unclassified' NOT NULL;--> statement-breakpoint
ALTER TABLE "garmin_auth_sessions" ADD COLUMN "attempt_id" uuid;--> statement-breakpoint
ALTER TABLE "garmin_auth_sessions" ADD COLUMN "challenge_digest" text;--> statement-breakpoint
ALTER TABLE "garmin_operation_state" ADD CONSTRAINT "garmin_operation_state_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "garmin_request_nonces_expires_idx" ON "garmin_request_nonces" USING btree ("expires_at");