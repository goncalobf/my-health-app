CREATE TABLE "coach_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"notes" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coach_memory_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "coach_memory" ADD CONSTRAINT "coach_memory_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;