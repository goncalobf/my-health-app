CREATE TABLE "friendships" (
	"id" serial PRIMARY KEY NOT NULL,
	"requester_id" integer NOT NULL,
	"recipient_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_app_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_recipient_id_app_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_requester_recipient_unique" ON "friendships" USING btree ("requester_id","recipient_id");--> statement-breakpoint
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_username_unique" UNIQUE("username");