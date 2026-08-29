CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "food_catalog_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"country_code" text NOT NULL,
	"category" text,
	"basis_quantity" real DEFAULT 100 NOT NULL,
	"basis_unit" text DEFAULT 'g' NOT NULL,
	"calories_kcal" real,
	"protein_g" real,
	"carbs_g" real,
	"fat_g" real,
	"fiber_g" real,
	"sugar_g" real,
	"saturated_fat_g" real,
	"salt_g" real,
	"sodium_mg" real,
	"source_version" text NOT NULL,
	"source_url" text NOT NULL,
	"attribution" text NOT NULL,
	"imported_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_catalog_names" (
	"id" serial PRIMARY KEY NOT NULL,
	"food_id" integer NOT NULL,
	"language" text NOT NULL,
	"name" text NOT NULL,
	"synonyms" text,
	"search_text" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "food_region" text DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "food_language" text DEFAULT 'pt' NOT NULL;--> statement-breakpoint
ALTER TABLE "food_catalog_names" ADD CONSTRAINT "food_catalog_names_food_id_food_catalog_items_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food_catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "food_catalog_provider_id_unique" ON "food_catalog_items" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE INDEX "food_catalog_country_provider_idx" ON "food_catalog_items" USING btree ("country_code","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "food_catalog_name_language_unique" ON "food_catalog_names" USING btree ("food_id","language");--> statement-breakpoint
CREATE INDEX "food_catalog_names_search_idx" ON "food_catalog_names" USING gin ("search_text" gin_trgm_ops);
