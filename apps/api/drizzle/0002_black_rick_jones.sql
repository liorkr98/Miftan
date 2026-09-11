CREATE TABLE "budget_policies" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"per_ticket_ceiling_agorot" integer DEFAULT 50000 NOT NULL,
	"monthly_cap_agorot" integer DEFAULT 200000 NOT NULL,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"include_urgent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "estimate_agorot" integer;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "auto_approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "auto_approval_reason" text;--> statement-breakpoint
ALTER TABLE "budget_policies" ADD CONSTRAINT "budget_policies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;