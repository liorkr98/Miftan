CREATE TYPE "public"."viewing_status" AS ENUM('open', 'booked', 'attended', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TABLE "viewing_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 15 NOT NULL,
	"status" "viewing_status" DEFAULT 'open' NOT NULL,
	"lead_id" text,
	"booked_at" timestamp with time zone,
	"invited_by_owner" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "viewing_slots" ADD CONSTRAINT "viewing_slots_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewing_slots" ADD CONSTRAINT "viewing_slots_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewing_slots" ADD CONSTRAINT "viewing_slots_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "viewing_slots_property_starts_idx" ON "viewing_slots" USING btree ("property_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "viewing_slots_lead_key" ON "viewing_slots" USING btree ("property_id","lead_id");