ALTER TABLE "exercises" ADD COLUMN "equipment" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_source_external_id_unique" ON "exercises" USING btree ("source","external_id");