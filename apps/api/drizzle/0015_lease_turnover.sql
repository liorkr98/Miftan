CREATE TYPE "public"."meeting_slot_status" AS ENUM('open', 'booked', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."renewal_decision" AS ENUM('stay', 'leave');--> statement-breakpoint
CREATE TYPE "public"."renewal_stage" AS ENUM('awaiting_tenant', 'questions', 'answered', 'staying', 'leaving', 'renewed', 'closed');--> statement-breakpoint
CREATE TABLE "renewal_cycles" (
	"id" text PRIMARY KEY NOT NULL,
	"lease_id" text NOT NULL,
	"property_id" text NOT NULL,
	"stage" "renewal_stage" DEFAULT 'awaiting_tenant' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"questions_at" timestamp with time zone,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answers_at" timestamp with time zone,
	"decision_deadline" timestamp with time zone,
	"decision" "renewal_decision",
	"decided_at" timestamp with time zone,
	"move_out_date" date,
	"requirements_confirmed_at" timestamp with time zone,
	"watchers_invited_at" timestamp with time zone,
	"renewed_at" timestamp with time zone,
	"new_end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renewal_meeting_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"cycle_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"status" "meeting_slot_status" DEFAULT 'open' NOT NULL,
	"booked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "smoking_allowed" boolean;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "max_occupants" integer;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "min_lease_months" integer;--> statement-breakpoint
ALTER TABLE "renewal_cycles" ADD CONSTRAINT "renewal_cycles_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_cycles" ADD CONSTRAINT "renewal_cycles_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_meeting_slots" ADD CONSTRAINT "renewal_meeting_slots_cycle_id_renewal_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."renewal_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "renewal_cycles_lease_key" ON "renewal_cycles" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "renewal_cycles_property_idx" ON "renewal_cycles" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "renewal_meeting_slots_cycle_starts_key" ON "renewal_meeting_slots" USING btree ("cycle_id","starts_at");