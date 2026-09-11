CREATE TABLE "search_events" (
	"id" text PRIMARY KEY NOT NULL,
	"seeker_id" text,
	"filters" jsonb NOT NULL,
	"district" text,
	"city" text,
	"min_rooms" numeric(3, 1),
	"max_rooms" numeric(3, 1),
	"max_price_agorot" integer,
	"result_count" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "district" text;--> statement-breakpoint
ALTER TABLE "search_events" ADD CONSTRAINT "search_events_seeker_id_users_id_fk" FOREIGN KEY ("seeker_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_events_city_at_idx" ON "search_events" USING btree ("city","at");--> statement-breakpoint
CREATE INDEX "search_events_district_at_idx" ON "search_events" USING btree ("district","at");