CREATE TYPE "public"."actor_role" AS ENUM('owner', 'tenant', 'vendor', 'lead');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('ranked', 'stage_changed', 'preset_applied', 'exported');--> statement-breakpoint
CREATE TYPE "public"."availability_confidence" AS ENUM('confirmed', 'likely', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."contract_scan_status" AS ENUM('uploading', 'scanning', 'review', 'committed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('tax_invoice', 'receipt', 'none');--> statement-breakpoint
CREATE TYPE "public"."expense_kind" AS ENUM('maintenance', 'improvement');--> statement-breakpoint
CREATE TYPE "public"."inquiry_status" AS ENUM('new', 'asked_tenant', 'answered', 'replied', 'declined');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'screening', 'viewing_scheduled', 'viewed', 'offer', 'signed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'standing_order', 'post_dated_checks');--> statement-breakpoint
CREATE TYPE "public"."protocol_kind" AS ENUM('move_in', 'move_out');--> statement-breakpoint
CREATE TYPE "public"."renewal_intent" AS ENUM('extend', 'leave', 'undecided', 'too_early');--> statement-breakpoint
CREATE TYPE "public"."seasonal_task_status" AS ENUM('due', 'scheduled', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'medium', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('ac', 'plumbing', 'electrical', 'leak', 'boiler', 'appliance', 'lock', 'paint', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('new', 'approved', 'assigned', 'in_progress', 'awaiting_receipt', 'closed');--> statement-breakpoint
CREATE TYPE "public"."trade" AS ENUM('plumber', 'electrician', 'ac_tech', 'locksmith', 'painter', 'pest', 'handyman');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('occupied', 'vacant', 'vacating', 'renovating');--> statement-breakpoint
CREATE TABLE "availability_inquiries" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"seeker_id" text NOT NULL,
	"message" text NOT NULL,
	"desired_move_in" date NOT NULL,
	"status" "inquiry_status" DEFAULT 'new' NOT NULL,
	"asked_tenant_at" timestamp with time zone,
	"tenant_answer" "renewal_intent",
	"tenant_answer_note" text,
	"tenant_answered_at" timestamp with time zone,
	"owner_reply" text,
	"owner_replied_at" timestamp with time zone,
	"resulting_available_from" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_scans" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"property_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text,
	"status" "contract_scan_status" DEFAULT 'uploading' NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing" text[] DEFAULT '{}' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"kind" "expense_kind" NOT NULL,
	"category" text NOT NULL,
	"amount_agorot" integer NOT NULL,
	"vendor_id" text,
	"vendor_name" text,
	"date" date NOT NULL,
	"ticket_id" text,
	"receipt_file" text,
	"document_type" "document_type" DEFAULT 'none' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"seeker_id" text NOT NULL,
	"stage" "lead_stage" DEFAULT 'new' NOT NULL,
	"desired_move_in" date NOT NULL,
	"queue_position" integer NOT NULL,
	"watch_only" boolean DEFAULT false NOT NULL,
	"income_to_rent_ratio" numeric(4, 2) NOT NULL,
	"employment" text NOT NULL,
	"has_guarantors" boolean DEFAULT false NOT NULL,
	"occupants" integer DEFAULT 1 NOT NULL,
	"pets" boolean DEFAULT false NOT NULL,
	"smoker" boolean DEFAULT false NOT NULL,
	"lease_length_months" integer DEFAULT 12 NOT NULL,
	"prior_landlord_reference" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lease_guarantors" (
	"id" text PRIMARY KEY NOT NULL,
	"lease_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"monthly_rent_agorot" integer NOT NULL,
	"deposit_agorot" integer DEFAULT 0 NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"has_extension_option" boolean DEFAULT false NOT NULL,
	"extension_months" integer,
	"notice_period_days" integer DEFAULT 60 NOT NULL,
	"renewal_intent" "renewal_intent",
	"renewal_asked_at" timestamp with time zone,
	"proposed_rent_agorot" integer,
	"proposed_start_date" date,
	"proposed_months" integer,
	"proposed_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"subject" text NOT NULL,
	"counterparty_role" "actor_role" NOT NULL,
	"counterparty_user_id" text,
	"counterparty_name" text NOT NULL,
	"property_id" text,
	"ticket_id" text,
	"lead_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"street" text NOT NULL,
	"house_number" text NOT NULL,
	"city" text NOT NULL,
	"neighborhood" text NOT NULL,
	"lat" numeric(9, 6) NOT NULL,
	"lng" numeric(9, 6) NOT NULL,
	"rooms" numeric(3, 1) NOT NULL,
	"sqm" integer NOT NULL,
	"floor" integer NOT NULL,
	"total_floors" integer NOT NULL,
	"amenities" text[] DEFAULT '{}' NOT NULL,
	"photos" text[] DEFAULT '{}' NOT NULL,
	"monthly_rent_agorot" integer NOT NULL,
	"arnona_bimonthly_agorot" integer DEFAULT 0 NOT NULL,
	"vaad_monthly_agorot" integer DEFAULT 0 NOT NULL,
	"status" "unit_status" NOT NULL,
	"available_from" date,
	"availability_confidence" "availability_confidence" DEFAULT 'unknown' NOT NULL,
	"listed" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "protocol_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"item_id" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"value" text,
	"photos" text[] DEFAULT '{}' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "protocol_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"lease_id" text,
	"tenant_id" text,
	"kind" "protocol_kind" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"signed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rent_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"lease_id" text NOT NULL,
	"month" text NOT NULL,
	"due_agorot" integer NOT NULL,
	"paid_agorot" integer DEFAULT 0 NOT NULL,
	"paid_at" date,
	"method" "payment_method" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "renter_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"income_to_rent_ratio" numeric(4, 2) NOT NULL,
	"employment" text NOT NULL,
	"has_guarantors" boolean DEFAULT false NOT NULL,
	"occupants" integer DEFAULT 1 NOT NULL,
	"pets" boolean DEFAULT false NOT NULL,
	"smoker" boolean DEFAULT false NOT NULL,
	"lease_length_months" integer DEFAULT 12 NOT NULL,
	"prior_landlord_reference" boolean DEFAULT false NOT NULL,
	"about" text,
	"complete" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screening_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"lead_id" text,
	"lead_name" text NOT NULL,
	"property_id" text,
	"preset_name" text NOT NULL,
	"action" "audit_action" NOT NULL,
	"detail" text NOT NULL,
	"flags" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screening_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasonal_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"property_id" text NOT NULL,
	"due_date" date NOT NULL,
	"status" "seasonal_task_status" DEFAULT 'due' NOT NULL,
	"ticket_id" text,
	"completed_at" timestamp with time zone,
	"year" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"author_role" "actor_role" NOT NULL,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"author_role" "actor_role" NOT NULL,
	"author_user_id" text,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"photos" text[] DEFAULT '{}' NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"tenant_id" text,
	"category" "ticket_category" NOT NULL,
	"severity" "severity" NOT NULL,
	"status" "ticket_status" DEFAULT 'new' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"photos" text[] DEFAULT '{}' NOT NULL,
	"vendor_id" text,
	"scheduled_at" timestamp with time zone,
	"tenant_availability" timestamp with time zone[] DEFAULT '{}' NOT NULL,
	"tenant_confirmed_slot" boolean DEFAULT false NOT NULL,
	"receipt_amount_agorot" integer,
	"receipt_file" text,
	"receipt_uploaded_at" timestamp with time zone,
	"receipt_uploaded_by" "actor_role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"name" text NOT NULL,
	"password_hash" text,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"name" text NOT NULL,
	"trade" "trade" NOT NULL,
	"phone" text NOT NULL,
	"areas" text[] DEFAULT '{}' NOT NULL,
	"rating" numeric(2, 1) DEFAULT '0' NOT NULL,
	"jobs_done" integer DEFAULT 0 NOT NULL,
	"avg_response_hours" integer DEFAULT 24 NOT NULL,
	"callout_fee_agorot" integer DEFAULT 0 NOT NULL,
	"is_network_partner" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "availability_inquiries" ADD CONSTRAINT "availability_inquiries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_inquiries" ADD CONSTRAINT "availability_inquiries_seeker_id_users_id_fk" FOREIGN KEY ("seeker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_scans" ADD CONSTRAINT "contract_scans_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_scans" ADD CONSTRAINT "contract_scans_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_seeker_id_users_id_fk" FOREIGN KEY ("seeker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_guarantors" ADD CONSTRAINT "lease_guarantors_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_counterparty_user_id_users_id_fk" FOREIGN KEY ("counterparty_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_entries" ADD CONSTRAINT "protocol_entries_run_id_protocol_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."protocol_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_runs" ADD CONSTRAINT "protocol_runs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_runs" ADD CONSTRAINT "protocol_runs_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_runs" ADD CONSTRAINT "protocol_runs_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renter_profiles" ADD CONSTRAINT "renter_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_audit_log" ADD CONSTRAINT "screening_audit_log_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_presets" ADD CONSTRAINT "screening_presets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasonal_tasks" ADD CONSTRAINT "seasonal_tasks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasonal_tasks" ADD CONSTRAINT "seasonal_tasks_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_users_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiries_property_idx" ON "availability_inquiries" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "inquiries_status_idx" ON "availability_inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "expenses_property_idx" ON "expenses" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "leads_property_idx" ON "leads" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_property_seeker_key" ON "leads" USING btree ("property_id","seeker_id");--> statement-breakpoint
CREATE INDEX "leases_property_idx" ON "leases" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "leases_tenant_idx" ON "leases" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "properties_owner_idx" ON "properties" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "properties_listed_idx" ON "properties" USING btree ("listed");--> statement-breakpoint
CREATE UNIQUE INDEX "protocol_entries_run_item_key" ON "protocol_entries" USING btree ("run_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rent_payments_lease_month_key" ON "rent_payments" USING btree ("lease_id","month");--> statement-breakpoint
CREATE INDEX "audit_owner_at_idx" ON "screening_audit_log" USING btree ("owner_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "seasonal_tasks_template_property_year_key" ON "seasonal_tasks" USING btree ("template_id","property_id","year");--> statement-breakpoint
CREATE INDEX "thread_messages_thread_idx" ON "thread_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_idx" ON "ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_property_idx" ON "tickets" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "tickets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");