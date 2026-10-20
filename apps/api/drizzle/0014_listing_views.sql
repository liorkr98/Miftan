CREATE TABLE "listing_views" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"viewer_key" text NOT NULL,
	"day" date NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listing_views" ADD CONSTRAINT "listing_views_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_views_property_viewer_day_key" ON "listing_views" USING btree ("property_id","viewer_key","day");--> statement-breakpoint
CREATE INDEX "listing_views_property_idx" ON "listing_views" USING btree ("property_id");
