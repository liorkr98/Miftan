CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`payload` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_tokens_hash_key` ON `auth_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_tokens_user_idx` ON `auth_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `availability_inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`seeker_id` text NOT NULL,
	`message` text NOT NULL,
	`desired_move_in` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`asked_tenant_at` integer,
	`tenant_answer` text,
	`tenant_answer_note` text,
	`tenant_answered_at` integer,
	`owner_reply` text,
	`owner_replied_at` integer,
	`resulting_available_from` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seeker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inquiries_property_idx` ON `availability_inquiries` (`property_id`);--> statement-breakpoint
CREATE INDEX `inquiries_status_idx` ON `availability_inquiries` (`status`);--> statement-breakpoint
CREATE TABLE `budget_policies` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`per_ticket_ceiling_agorot` integer DEFAULT 50000 NOT NULL,
	`monthly_cap_agorot` integer DEFAULT 200000 NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL,
	`include_urgent` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contract_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`property_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_url` text,
	`status` text DEFAULT 'uploading' NOT NULL,
	`fields` text DEFAULT '[]' NOT NULL,
	`missing` text DEFAULT '[]' NOT NULL,
	`uploaded_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`committed_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contract_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`based_on` text,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`use_when` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`variables` text DEFAULT '[]' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contract_templates_owner_idx` ON `contract_templates` (`owner_id`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`kind` text NOT NULL,
	`category` text NOT NULL,
	`amount_agorot` integer NOT NULL,
	`vendor_id` text,
	`vendor_name` text,
	`date` text NOT NULL,
	`ticket_id` text,
	`receipt_file` text,
	`document_type` text DEFAULT 'none' NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `expenses_property_idx` ON `expenses` (`property_id`);--> statement-breakpoint
CREATE INDEX `expenses_date_idx` ON `expenses` (`date`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`seeker_id` text NOT NULL,
	`stage` text DEFAULT 'new' NOT NULL,
	`desired_move_in` text NOT NULL,
	`queue_position` integer NOT NULL,
	`watch_only` integer DEFAULT false NOT NULL,
	`income_to_rent_ratio` numeric NOT NULL,
	`employment` text NOT NULL,
	`has_guarantors` integer DEFAULT false NOT NULL,
	`occupants` integer DEFAULT 1 NOT NULL,
	`pets` integer DEFAULT false NOT NULL,
	`smoker` integer DEFAULT false NOT NULL,
	`lease_length_months` integer DEFAULT 12 NOT NULL,
	`prior_landlord_reference` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seeker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `leads_property_idx` ON `leads` (`property_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `leads_property_seeker_key` ON `leads` (`property_id`,`seeker_id`);--> statement-breakpoint
CREATE TABLE `lease_guarantors` (
	`id` text PRIMARY KEY NOT NULL,
	`lease_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	FOREIGN KEY (`lease_id`) REFERENCES `leases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `leases` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`tenant_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`monthly_rent_agorot` integer NOT NULL,
	`deposit_agorot` integer DEFAULT 0 NOT NULL,
	`payment_method` text NOT NULL,
	`has_extension_option` integer DEFAULT false NOT NULL,
	`extension_months` integer,
	`notice_period_days` integer DEFAULT 60 NOT NULL,
	`renewal_intent` text,
	`renewal_asked_at` integer,
	`proposed_rent_agorot` integer,
	`proposed_start_date` text,
	`proposed_months` integer,
	`proposed_sent_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `leases_property_idx` ON `leases` (`property_id`);--> statement-breakpoint
CREATE INDEX `leases_tenant_idx` ON `leases` (`tenant_id`);--> statement-breakpoint
CREATE TABLE `listing_views` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`viewer_key` text NOT NULL,
	`day` text NOT NULL,
	`at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listing_views_property_viewer_day_key` ON `listing_views` (`property_id`,`viewer_key`,`day`);--> statement-breakpoint
CREATE INDEX `listing_views_property_idx` ON `listing_views` (`property_id`);--> statement-breakpoint
CREATE TABLE `message_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`subject` text NOT NULL,
	`counterparty_role` text NOT NULL,
	`counterparty_user_id` text,
	`counterparty_name` text NOT NULL,
	`property_id` text,
	`ticket_id` text,
	`lead_id` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`counterparty_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`street` text NOT NULL,
	`house_number` text NOT NULL,
	`city` text NOT NULL,
	`neighborhood` text NOT NULL,
	`lat` numeric NOT NULL,
	`lng` numeric NOT NULL,
	`rooms` numeric NOT NULL,
	`sqm` integer NOT NULL,
	`floor` integer NOT NULL,
	`total_floors` integer NOT NULL,
	`amenities` text DEFAULT '[]' NOT NULL,
	`photos` text DEFAULT '[]' NOT NULL,
	`monthly_rent_agorot` integer NOT NULL,
	`arnona_bimonthly_agorot` integer DEFAULT 0 NOT NULL,
	`vaad_monthly_agorot` integer DEFAULT 0 NOT NULL,
	`district` text,
	`status` text NOT NULL,
	`available_from` text,
	`availability_confidence` text DEFAULT 'unknown' NOT NULL,
	`listed` integer DEFAULT false NOT NULL,
	`show_exact_address` integer DEFAULT false NOT NULL,
	`notes` text,
	`smoking_allowed` integer,
	`max_occupants` integer,
	`min_lease_months` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `properties_owner_idx` ON `properties` (`owner_id`);--> statement-breakpoint
CREATE INDEX `properties_listed_idx` ON `properties` (`listed`);--> statement-breakpoint
CREATE TABLE `protocol_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`item_id` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`value` text,
	`photos` text DEFAULT '[]' NOT NULL,
	`note` text,
	FOREIGN KEY (`run_id`) REFERENCES `protocol_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `protocol_entries_run_item_key` ON `protocol_entries` (`run_id`,`item_id`);--> statement-breakpoint
CREATE TABLE `protocol_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`lease_id` text,
	`tenant_id` text,
	`kind` text NOT NULL,
	`started_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`completed_at` integer,
	`signed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lease_id`) REFERENCES `leases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `renewal_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`lease_id` text NOT NULL,
	`property_id` text NOT NULL,
	`stage` text DEFAULT 'awaiting_tenant' NOT NULL,
	`opened_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`questions` text DEFAULT '[]' NOT NULL,
	`questions_at` integer,
	`answers` text DEFAULT '[]' NOT NULL,
	`answers_at` integer,
	`decision_deadline` integer,
	`decision` text,
	`decided_at` integer,
	`move_out_date` text,
	`requirements_confirmed_at` integer,
	`watchers_invited_at` integer,
	`renewed_at` integer,
	`new_end_date` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`lease_id`) REFERENCES `leases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `renewal_cycles_lease_key` ON `renewal_cycles` (`lease_id`);--> statement-breakpoint
CREATE INDEX `renewal_cycles_property_idx` ON `renewal_cycles` (`property_id`);--> statement-breakpoint
CREATE TABLE `renewal_meeting_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`duration_minutes` integer DEFAULT 30 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`booked_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`cycle_id`) REFERENCES `renewal_cycles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `renewal_meeting_slots_cycle_starts_key` ON `renewal_meeting_slots` (`cycle_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `rent_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`lease_id` text NOT NULL,
	`month` text NOT NULL,
	`due_agorot` integer NOT NULL,
	`paid_agorot` integer DEFAULT 0 NOT NULL,
	`paid_at` text,
	`method` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lease_id`) REFERENCES `leases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rent_payments_lease_month_key` ON `rent_payments` (`lease_id`,`month`);--> statement-breakpoint
CREATE TABLE `renter_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`income_to_rent_ratio` numeric NOT NULL,
	`employment` text NOT NULL,
	`has_guarantors` integer DEFAULT false NOT NULL,
	`occupants` integer DEFAULT 1 NOT NULL,
	`pets` integer DEFAULT false NOT NULL,
	`smoker` integer DEFAULT false NOT NULL,
	`lease_length_months` integer DEFAULT 12 NOT NULL,
	`prior_landlord_reference` integer DEFAULT false NOT NULL,
	`about` text,
	`complete` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`lease_id` text NOT NULL,
	`author_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`author_role` text NOT NULL,
	`rating` integer NOT NULL,
	`communication` integer,
	`reliability` integer,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`lease_id`) REFERENCES `leases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_lease_author_key` ON `reviews` (`lease_id`,`author_role`);--> statement-breakpoint
CREATE INDEX `reviews_subject_idx` ON `reviews` (`subject_id`);--> statement-breakpoint
CREATE TABLE `screening_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`lead_id` text,
	`lead_name` text NOT NULL,
	`property_id` text,
	`preset_name` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL,
	`flags` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_owner_at_idx` ON `screening_audit_log` (`owner_id`,`at`);--> statement-breakpoint
CREATE TABLE `screening_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`criteria` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `search_events` (
	`id` text PRIMARY KEY NOT NULL,
	`seeker_id` text,
	`filters` text NOT NULL,
	`district` text,
	`city` text,
	`min_rooms` numeric,
	`max_rooms` numeric,
	`max_price_agorot` integer,
	`result_count` integer NOT NULL,
	`at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`seeker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `search_events_city_at_idx` ON `search_events` (`city`,`at`);--> statement-breakpoint
CREATE INDEX `search_events_district_at_idx` ON `search_events` (`district`,`at`);--> statement-breakpoint
CREATE TABLE `seasonal_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`property_id` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'due' NOT NULL,
	`ticket_id` text,
	`completed_at` integer,
	`year` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seasonal_tasks_template_property_year_key` ON `seasonal_tasks` (`template_id`,`property_id`,`year`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`user_agent` text,
	`ip` text,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`replaced_by_session_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_key` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `tenant_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`created_by` text NOT NULL,
	`token_hash` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`monthly_rent_agorot` integer NOT NULL,
	`deposit_agorot` integer DEFAULT 0 NOT NULL,
	`payment_method` text NOT NULL,
	`tenant_name` text,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`accepted_by` text,
	`lease_id` text,
	`revoked_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`accepted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lease_id`) REFERENCES `leases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenant_invites_token_hash_key` ON `tenant_invites` (`token_hash`);--> statement-breakpoint
CREATE INDEX `tenant_invites_property_idx` ON `tenant_invites` (`property_id`);--> statement-breakpoint
CREATE TABLE `thread_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`author_role` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `message_threads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `thread_messages_thread_idx` ON `thread_messages` (`thread_id`);--> statement-breakpoint
CREATE TABLE `ticket_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`author_role` text NOT NULL,
	`author_user_id` text,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`photos` text DEFAULT '[]' NOT NULL,
	`at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `ticket_messages_ticket_idx` ON `ticket_messages` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`tenant_id` text,
	`category` text NOT NULL,
	`severity` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`photos` text DEFAULT '[]' NOT NULL,
	`vendor_id` text,
	`scheduled_at` integer,
	`tenant_availability` text DEFAULT '[]' NOT NULL,
	`tenant_confirmed_slot` integer DEFAULT false NOT NULL,
	`estimate_agorot` integer,
	`auto_approved_at` integer,
	`auto_approval_reason` text,
	`receipt_amount_agorot` integer,
	`receipt_file` text,
	`receipt_uploaded_at` integer,
	`receipt_uploaded_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tenant_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tickets_property_idx` ON `tickets` (`property_id`);--> statement-breakpoint
CREATE INDEX `tickets_status_idx` ON `tickets` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`name` text NOT NULL,
	`password_hash` text,
	`supabase_user_id` text,
	`email_verified_at` integer,
	`plan` text DEFAULT 'free' NOT NULL,
	`notifications_seen_at` integer,
	`onboarding_dismissed` text DEFAULT '[]' NOT NULL,
	`terms_accepted_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_supabase_user_id_unique` ON `users` (`supabase_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_key` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`name` text NOT NULL,
	`trade` text NOT NULL,
	`phone` text NOT NULL,
	`areas` text DEFAULT '[]' NOT NULL,
	`rating` numeric DEFAULT '0' NOT NULL,
	`jobs_done` integer DEFAULT 0 NOT NULL,
	`avg_response_hours` integer DEFAULT 24 NOT NULL,
	`callout_fee_agorot` integer DEFAULT 0 NOT NULL,
	`is_network_partner` integer DEFAULT false NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `viewing_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`duration_minutes` integer DEFAULT 15 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`lead_id` text,
	`booked_at` integer,
	`invited_by_owner` integer DEFAULT false NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `viewing_slots_property_starts_idx` ON `viewing_slots` (`property_id`,`starts_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `viewing_slots_lead_key` ON `viewing_slots` (`property_id`,`lead_id`);