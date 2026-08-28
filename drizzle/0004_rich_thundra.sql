CREATE TABLE IF NOT EXISTS "coach_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"source_key" text,
	"payload_json" text NOT NULL,
	"model" text NOT NULL,
	"dismissed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coach_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
