CREATE TABLE "workout_day_choices" (
	"user_id" integer NOT NULL,
	"day" date NOT NULL,
	"routine_id" integer,
	CONSTRAINT "workout_day_choices_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
ALTER TABLE "workout_day_choices" ADD CONSTRAINT "workout_day_choices_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_day_choices" ADD CONSTRAINT "workout_day_choices_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE cascade ON UPDATE no action;