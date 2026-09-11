CREATE TABLE "contract_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"based_on" text,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"use_when" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_templates_owner_idx" ON "contract_templates" USING btree ("owner_id");