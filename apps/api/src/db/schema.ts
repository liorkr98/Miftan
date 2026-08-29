import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Miftach schema.
 *
 * Three rules run through all of it:
 *
 * 1. **Money is integer agorot.** Never a float, never a numeric shekel. A
 *    column named `_agorot` holds 720000 for ₪7,200. Rounding errors in rent
 *    and deposits are the kind of bug you find out about in a lawsuit.
 *
 * 2. **IDs are prefixed text.** `prop_x7k2…` beats a bare UUID the moment you
 *    are reading a log or a failing test at 01:00.
 *
 * 3. **Roles are relationships, not a column on the user.** One person can own
 *    one flat, rent another and be queueing for a third. `properties.owner_id`,
 *    `leases.tenant_id` and `leads.seeker_id` are what make someone an owner,
 *    a tenant or a seeker — and only for that row.
 *
 * Deliberately *not* here: protocol item templates, seasonal task templates,
 * revenue streams and affiliate offers. Those are configuration, they ship with
 * the code in `@miftach/shared`, and putting them in Postgres would only mean
 * migrating them every time we edit a sentence.
 */

/* ── Enums ─────────────────────────────────────────────── */

export const unitStatus = pgEnum('unit_status', ['occupied', 'vacant', 'vacating', 'renovating']);
export const availabilityConfidence = pgEnum('availability_confidence', ['confirmed', 'likely', 'unknown']);
export const paymentMethod = pgEnum('payment_method', ['bank_transfer', 'standing_order', 'post_dated_checks']);
export const renewalIntent = pgEnum('renewal_intent', ['extend', 'leave', 'undecided', 'too_early']);
export const ticketStatus = pgEnum('ticket_status', ['new', 'approved', 'assigned', 'in_progress', 'awaiting_receipt', 'closed']);
export const ticketCategory = pgEnum('ticket_category', ['ac', 'plumbing', 'electrical', 'leak', 'boiler', 'appliance', 'lock', 'paint', 'other']);
export const severity = pgEnum('severity', ['low', 'medium', 'urgent']);
export const trade = pgEnum('trade', ['plumber', 'electrician', 'ac_tech', 'locksmith', 'painter', 'pest', 'handyman']);
export const leadStage = pgEnum('lead_stage', ['new', 'screening', 'viewing_scheduled', 'viewed', 'offer', 'signed', 'rejected']);
export const actorRole = pgEnum('actor_role', ['owner', 'tenant', 'vendor', 'lead']);
export const expenseKind = pgEnum('expense_kind', ['maintenance', 'improvement']);
export const documentType = pgEnum('document_type', ['tax_invoice', 'receipt', 'none']);
export const inquiryStatus = pgEnum('inquiry_status', ['new', 'asked_tenant', 'answered', 'replied', 'declined']);
export const protocolKind = pgEnum('protocol_kind', ['move_in', 'move_out']);
export const seasonalTaskStatus = pgEnum('seasonal_task_status', ['due', 'scheduled', 'done', 'skipped']);
export const contractScanStatus = pgEnum('contract_scan_status', ['uploading', 'scanning', 'review', 'committed', 'failed']);
export const auditAction = pgEnum('audit_action', ['ranked', 'stage_changed', 'preset_applied', 'exported']);

/* ── Shared column shapes ──────────────────────────────── */

const createdAt = timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
/** Soft delete. Nothing a landlord or tenant can see is ever hard-deleted. */
const deletedAt = timestamp('deleted_at', { withTimezone: true });

/* ── People ────────────────────────────────────────────── */

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    phone: text('phone'),
    name: text('name').notNull(),
    /** argon2. Null while an account is invite-pending and has no password yet. */
    passwordHash: text('password_hash'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [uniqueIndex('users_email_key').on(t.email)],
);

/**
 * The seeker's reusable renter profile — filled once, reused across every
 * application. Deliberately has no field for family status, parenthood, age,
 * gender, nationality, religion or sexual orientation: if the column does not
 * exist, no screening preset can ever be built on it.
 */
export const renterProfiles = pgTable('renter_profiles', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  incomeToRentRatio: numeric('income_to_rent_ratio', { precision: 4, scale: 2 }).notNull(),
  employment: text('employment').notNull(),
  hasGuarantors: boolean('has_guarantors').notNull().default(false),
  occupants: integer('occupants').notNull().default(1),
  pets: boolean('pets').notNull().default(false),
  smoker: boolean('smoker').notNull().default(false),
  leaseLengthMonths: integer('lease_length_months').notNull().default(12),
  priorLandlordReference: boolean('prior_landlord_reference').notNull().default(false),
  about: text('about'),
  complete: boolean('complete').notNull().default(false),
  updatedAt,
});

/* ── Portfolio ─────────────────────────────────────────── */

export const properties = pgTable(
  'properties',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull().references(() => users.id),

    street: text('street').notNull(),
    houseNumber: text('house_number').notNull(),
    city: text('city').notNull(),
    neighborhood: text('neighborhood').notNull(),
    lat: numeric('lat', { precision: 9, scale: 6 }).notNull(),
    lng: numeric('lng', { precision: 9, scale: 6 }).notNull(),

    rooms: numeric('rooms', { precision: 3, scale: 1 }).notNull(),
    sqm: integer('sqm').notNull(),
    floor: integer('floor').notNull(),
    totalFloors: integer('total_floors').notNull(),
    amenities: text('amenities').array().notNull().default([]),
    photos: text('photos').array().notNull().default([]),

    monthlyRentAgorot: integer('monthly_rent_agorot').notNull(),
    arnonaBimonthlyAgorot: integer('arnona_bimonthly_agorot').notNull().default(0),
    vaadMonthlyAgorot: integer('vaad_monthly_agorot').notNull().default(0),

    status: unitStatus('status').notNull(),
    /* No current_lease_id: the active lease is derived from leases.end_date.
       A denormalised pointer here is a guaranteed source of drift. */
    availableFrom: date('available_from'),
    availabilityConfidence: availabilityConfidence('availability_confidence').notNull().default('unknown'),
    /** Published to the seeker-facing search */
    listed: boolean('listed').notNull().default(false),
    notes: text('notes'),

    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [index('properties_owner_idx').on(t.ownerId), index('properties_listed_idx').on(t.listed)],
);

export const leases = pgTable(
  'leases',
  {
    id: text('id').primaryKey(),
    propertyId: text('property_id').notNull().references(() => properties.id),
    tenantId: text('tenant_id').notNull().references(() => users.id),

    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    monthlyRentAgorot: integer('monthly_rent_agorot').notNull(),
    depositAgorot: integer('deposit_agorot').notNull().default(0),
    paymentMethod: paymentMethod('payment_method').notNull(),

    hasExtensionOption: boolean('has_extension_option').notNull().default(false),
    extensionMonths: integer('extension_months'),
    noticePeriodDays: integer('notice_period_days').notNull().default(60),

    /* The tenant's answer. Never leaves owner/tenant scope — the seeker side
       only ever sees a date derived from it. */
    renewalIntent: renewalIntent('renewal_intent'),
    renewalAskedAt: timestamp('renewal_asked_at', { withTimezone: true }),

    proposedRentAgorot: integer('proposed_rent_agorot'),
    proposedStartDate: date('proposed_start_date'),
    proposedMonths: integer('proposed_months'),
    proposedSentAt: timestamp('proposed_sent_at', { withTimezone: true }),

    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [index('leases_property_idx').on(t.propertyId), index('leases_tenant_idx').on(t.tenantId)],
);

export const leaseGuarantors = pgTable('lease_guarantors', {
  id: text('id').primaryKey(),
  leaseId: text('lease_id').notNull().references(() => leases.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
});

/* ── Maintenance ───────────────────────────────────────── */

export const vendors = pgTable('vendors', {
  id: text('id').primaryKey(),
  /** Null for network vendors that every owner can see */
  ownerId: text('owner_id').references(() => users.id),
  name: text('name').notNull(),
  trade: trade('trade').notNull(),
  phone: text('phone').notNull(),
  areas: text('areas').array().notNull().default([]),
  rating: numeric('rating', { precision: 2, scale: 1 }).notNull().default('0'),
  jobsDone: integer('jobs_done').notNull().default(0),
  avgResponseHours: integer('avg_response_hours').notNull().default(24),
  calloutFeeAgorot: integer('callout_fee_agorot').notNull().default(0),
  /** Disclosed commercial relationship. Never affects ordering. */
  isNetworkPartner: boolean('is_network_partner').notNull().default(false),
  note: text('note'),
  createdAt,
  updatedAt,
  deletedAt,
});

export const tickets = pgTable(
  'tickets',
  {
    id: text('id').primaryKey(),
    propertyId: text('property_id').notNull().references(() => properties.id),
    tenantId: text('tenant_id').references(() => users.id),

    category: ticketCategory('category').notNull(),
    severity: severity('severity').notNull(),
    status: ticketStatus('status').notNull().default('new'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    photos: text('photos').array().notNull().default([]),

    vendorId: text('vendor_id').references(() => vendors.id),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    /** Windows the tenant said they can be home */
    tenantAvailability: timestamp('tenant_availability', { withTimezone: true }).array().notNull().default([]),
    tenantConfirmedSlot: boolean('tenant_confirmed_slot').notNull().default(false),

    receiptAmountAgorot: integer('receipt_amount_agorot'),
    receiptFile: text('receipt_file'),
    receiptUploadedAt: timestamp('receipt_uploaded_at', { withTimezone: true }),
    receiptUploadedBy: actorRole('receipt_uploaded_by'),

    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [index('tickets_property_idx').on(t.propertyId), index('tickets_status_idx').on(t.status)],
);

export const ticketMessages = pgTable(
  'ticket_messages',
  {
    id: text('id').primaryKey(),
    ticketId: text('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
    authorRole: actorRole('author_role').notNull(),
    /** Null for vendors, who are not users of the product */
    authorUserId: text('author_user_id').references(() => users.id),
    authorName: text('author_name').notNull(),
    body: text('body').notNull(),
    photos: text('photos').array().notNull().default([]),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ticket_messages_ticket_idx').on(t.ticketId)],
);

/* ── Money ─────────────────────────────────────────────── */

export const expenses = pgTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    propertyId: text('property_id').notNull().references(() => properties.id),
    kind: expenseKind('kind').notNull(),
    /** Ticket categories plus fixed costs (arnona, vaad, insurance, legal) */
    category: text('category').notNull(),
    amountAgorot: integer('amount_agorot').notNull(),
    vendorId: text('vendor_id').references(() => vendors.id),
    vendorName: text('vendor_name'),
    date: date('date').notNull(),
    /** Set when the expense was created automatically by closing a ticket */
    ticketId: text('ticket_id').references(() => tickets.id),
    receiptFile: text('receipt_file'),
    documentType: documentType('document_type').notNull().default('none'),
    note: text('note'),
    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [index('expenses_property_idx').on(t.propertyId), index('expenses_date_idx').on(t.date)],
);

export const rentPayments = pgTable(
  'rent_payments',
  {
    id: text('id').primaryKey(),
    propertyId: text('property_id').notNull().references(() => properties.id),
    leaseId: text('lease_id').notNull().references(() => leases.id),
    /** yyyy-MM */
    month: text('month').notNull(),
    dueAgorot: integer('due_agorot').notNull(),
    paidAgorot: integer('paid_agorot').notNull().default(0),
    paidAt: date('paid_at'),
    method: paymentMethod('method').notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [uniqueIndex('rent_payments_lease_month_key').on(t.leaseId, t.month)],
);

/* ── Demand side ───────────────────────────────────────── */

export const leads = pgTable(
  'leads',
  {
    id: text('id').primaryKey(),
    propertyId: text('property_id').notNull().references(() => properties.id),
    seekerId: text('seeker_id').notNull().references(() => users.id),
    stage: leadStage('stage').notNull().default('new'),
    desiredMoveIn: date('desired_move_in').notNull(),
    queuePosition: integer('queue_position').notNull(),
    /** Watching for a date rather than formally applying */
    watchOnly: boolean('watch_only').notNull().default(false),

    /* A snapshot of the renter profile as it was when they applied. The
       profile can change afterwards; what the owner screened against must not. */
    incomeToRentRatio: numeric('income_to_rent_ratio', { precision: 4, scale: 2 }).notNull(),
    employment: text('employment').notNull(),
    hasGuarantors: boolean('has_guarantors').notNull().default(false),
    occupants: integer('occupants').notNull().default(1),
    pets: boolean('pets').notNull().default(false),
    smoker: boolean('smoker').notNull().default(false),
    leaseLengthMonths: integer('lease_length_months').notNull().default(12),
    priorLandlordReference: boolean('prior_landlord_reference').notNull().default(false),
    /* screening_flags are deliberately absent: they are derived from the
       active preset at read time, so a stored copy would go stale the moment
       the owner changes a criterion. */

    createdAt,
    updatedAt,
    deletedAt,
  },
  (t) => [
    index('leads_property_idx').on(t.propertyId),
    uniqueIndex('leads_property_seeker_key').on(t.propertyId, t.seekerId),
  ],
);

/**
 * A seeker asking about a unit whose tenant has not decided.
 *
 * The chain is seeker → owner → tenant → owner → seeker, and the two ends never
 * meet: `tenant_answer` and `tenant_answer_note` are owner-visible only, and
 * what reaches the seeker is `owner_reply` plus a derived date.
 */
export const availabilityInquiries = pgTable(
  'availability_inquiries',
  {
    id: text('id').primaryKey(),
    propertyId: text('property_id').notNull().references(() => properties.id),
    seekerId: text('seeker_id').notNull().references(() => users.id),
    message: text('message').notNull(),
    desiredMoveIn: date('desired_move_in').notNull(),
    status: inquiryStatus('status').notNull().default('new'),

    askedTenantAt: timestamp('asked_tenant_at', { withTimezone: true }),
    tenantAnswer: renewalIntent('tenant_answer'),
    tenantAnswerNote: text('tenant_answer_note'),
    tenantAnsweredAt: timestamp('tenant_answered_at', { withTimezone: true }),

    ownerReply: text('owner_reply'),
    ownerRepliedAt: timestamp('owner_replied_at', { withTimezone: true }),
    resultingAvailableFrom: date('resulting_available_from'),

    createdAt,
    updatedAt,
  },
  (t) => [index('inquiries_property_idx').on(t.propertyId), index('inquiries_status_idx').on(t.status)],
);

/* ── Messaging ─────────────────────────────────────────── */

export const messageThreads = pgTable('message_threads', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  subject: text('subject').notNull(),
  counterpartyRole: actorRole('counterparty_role').notNull(),
  counterpartyUserId: text('counterparty_user_id').references(() => users.id),
  counterpartyName: text('counterparty_name').notNull(),
  propertyId: text('property_id').references(() => properties.id),
  ticketId: text('ticket_id').references(() => tickets.id),
  leadId: text('lead_id').references(() => leads.id),
  updatedAt,
  createdAt,
});

export const threadMessages = pgTable(
  'thread_messages',
  {
    id: text('id').primaryKey(),
    threadId: text('thread_id').notNull().references(() => messageThreads.id, { onDelete: 'cascade' }),
    authorRole: actorRole('author_role').notNull(),
    authorName: text('author_name').notNull(),
    body: text('body').notNull(),
    read: boolean('read').notNull().default(false),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('thread_messages_thread_idx').on(t.threadId)],
);

/* ── Protocol, screening, contracts ────────────────────── */

export const protocolRuns = pgTable('protocol_runs', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').notNull().references(() => properties.id),
  leaseId: text('lease_id').references(() => leases.id),
  tenantId: text('tenant_id').references(() => users.id),
  kind: protocolKind('kind').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  signed: boolean('signed').notNull().default(false),
});

export const protocolEntries = pgTable(
  'protocol_entries',
  {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull().references(() => protocolRuns.id, { onDelete: 'cascade' }),
    /** References a template id in @miftach/shared, not a table */
    itemId: text('item_id').notNull(),
    done: boolean('done').notNull().default(false),
    value: text('value'),
    photos: text('photos').array().notNull().default([]),
    note: text('note'),
  },
  (t) => [uniqueIndex('protocol_entries_run_item_key').on(t.runId, t.itemId)],
);

export const seasonalTasks = pgTable(
  'seasonal_tasks',
  {
    id: text('id').primaryKey(),
    /** References a template id in @miftach/shared, not a table */
    templateId: text('template_id').notNull(),
    propertyId: text('property_id').notNull().references(() => properties.id),
    dueDate: date('due_date').notNull(),
    status: seasonalTaskStatus('status').notNull().default('due'),
    ticketId: text('ticket_id').references(() => tickets.id),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    year: integer('year').notNull(),
  },
  (t) => [uniqueIndex('seasonal_tasks_template_property_year_key').on(t.templateId, t.propertyId, t.year)],
);

export const screeningPresets = pgTable('screening_presets', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  /** ScreeningCriterion[] — a config blob with a known shape */
  criteria: jsonb('criteria').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  createdAt,
  updatedAt,
});

/**
 * Append-only. Every screening decision writes a line with its reason, which is
 * what a landlord shows if they are ever challenged. Nothing updates or deletes
 * from this table.
 */
export const screeningAuditLog = pgTable(
  'screening_audit_log',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull().references(() => users.id),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    leadId: text('lead_id'),
    leadName: text('lead_name').notNull(),
    propertyId: text('property_id'),
    presetName: text('preset_name').notNull(),
    action: auditAction('action').notNull(),
    detail: text('detail').notNull(),
    /** ScreeningFlag[] as evaluated at that moment */
    flags: jsonb('flags').notNull().default([]),
  },
  (t) => [index('audit_owner_at_idx').on(t.ownerId, t.at)],
);

export const contractScans = pgTable('contract_scans', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  propertyId: text('property_id').notNull().references(() => properties.id),
  fileName: text('file_name').notNull(),
  fileUrl: text('file_url'),
  status: contractScanStatus('status').notNull().default('uploading'),
  /** ExtractedField[] with confidence scores and source hints */
  fields: jsonb('fields').notNull().default([]),
  missing: text('missing').array().notNull().default([]),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  committedAt: timestamp('committed_at', { withTimezone: true }),
});
