/* ── Enums ─────────────────────────────────────────────── */

export type Persona = 'owner' | 'tenant' | 'seeker';

export type UnitStatus = 'occupied' | 'vacant' | 'vacating' | 'renovating';

export type TicketStatus =
  | 'new'
  | 'approved'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_receipt'
  | 'closed';

export type LeadStage =
  | 'new'
  | 'screening'
  | 'viewing_scheduled'
  | 'viewed'
  | 'offer'
  | 'signed'
  | 'rejected';

export type TicketCategory =
  | 'ac'
  | 'plumbing'
  | 'electrical'
  | 'leak'
  | 'boiler'
  | 'appliance'
  | 'lock'
  | 'paint'
  | 'other';

export type Severity = 'low' | 'medium' | 'urgent';

export type Trade =
  | 'plumber'
  | 'electrician'
  | 'ac_tech'
  | 'locksmith'
  | 'painter'
  | 'pest'
  | 'handyman';

export type Amenity =
  | 'elevator'
  | 'parking'
  | 'balcony'
  | 'mamad'
  | 'furnished'
  | 'ac'
  | 'pets_allowed'
  | 'storage'
  | 'accessible'
  | 'renovated';

export type AvailabilityConfidence = 'confirmed' | 'likely' | 'unknown';

export type PaymentMethod = 'bank_transfer' | 'standing_order' | 'post_dated_checks';

/** 'too_early' is a real answer, not a non-answer: it means "ask me again
 *  closer to the date", and the app publishes it as such. */
export type RenewalIntent = 'extend' | 'leave' | 'undecided' | 'too_early';

export type ExpenseKind = 'maintenance' | 'improvement';

export type Role = 'owner' | 'tenant' | 'vendor' | 'lead';

/* ── Core entities ─────────────────────────────────────── */

export interface Address {
  street: string;
  number: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
}

export interface Property {
  id: string;
  owner_id: string;
  address: Address;
  rooms: number;
  sqm: number;
  floor: number;
  total_floors: number;
  amenities: Amenity[];
  photos: string[];
  monthly_rent: number;
  arnona_bimonthly: number;
  vaad_monthly: number;
  status: UnitStatus;
  current_lease_id?: string;
  /** ISO date — drives the map, the departures board and the queue */
  available_from?: string;
  availability_confidence: AvailabilityConfidence;
  /** Owner has published this unit to the seeker-facing search */
  listed: boolean;
  notes?: string;
}

export interface Guarantor {
  name: string;
  phone: string;
}

export interface Lease {
  id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit: number;
  payment_method: PaymentMethod;
  guarantors: Guarantor[];
  has_extension_option: boolean;
  extension_months?: number;
  notice_period_days: number;
  renewal_intent?: RenewalIntent;
  renewal_asked_at?: string;
  /** Terms the owner has proposed for renewal, if any */
  proposed_renewal?: {
    monthly_rent: number;
    start_date: string;
    months: number;
    sent_at: string;
  };
}

export interface TicketMessage {
  author_role: Role;
  author_name: string;
  body: string;
  at: string;
  photos?: string[];
}

export interface Receipt {
  amount: number;
  file: string;
  uploaded_at: string;
  uploaded_by: 'tenant' | 'vendor';
  vendor_name?: string;
}

export interface Ticket {
  id: string;
  property_id: string;
  tenant_id: string;
  category: TicketCategory;
  severity: Severity;
  status: TicketStatus;
  title: string;
  description: string;
  photos: string[];
  created_at: string;
  vendor_id?: string;
  scheduled_at?: string;
  /** Windows the tenant said they can be home, as ISO datetimes */
  tenant_availability: string[];
  tenant_confirmed_slot?: boolean;
  receipt?: Receipt;
  messages: TicketMessage[];
  expense_id?: string;
}

export interface Vendor {
  id: string;
  name: string;
  trade: Trade;
  phone: string;
  areas: string[];
  rating: number;
  jobs_done: number;
  avg_response_hours: number;
  callout_fee: number;
  /** Disclosed commercial relationship — surfaced as such in the UI */
  is_network_partner: boolean;
  note?: string;
}

export interface ScreeningProfile {
  income_to_rent_ratio: number;
  employment: string;
  has_guarantors: boolean;
  occupants: number;
  pets: boolean;
  smoker: boolean;
  lease_length_months: number;
  prior_landlord_reference: boolean;
}

export interface ScreeningFlag {
  criterion: ScreeningCriterionId;
  passed: boolean;
  note: string;
}

export interface Lead {
  id: string;
  property_id: string;
  seeker_id: string;
  stage: LeadStage;
  created_at: string;
  desired_move_in: string;
  queue_position: number;
  screening: ScreeningProfile;
  screening_flags: ScreeningFlag[];
  /** Seeker asked to be notified rather than formally queueing */
  watch_only?: boolean;
}

/* ── People ────────────────────────────────────────────── */

export interface Owner {
  id: string;
  name: string;
  phone: string;
  email: string;
  company?: string;
}

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string;
  lease_id?: string;
}

export interface Seeker {
  id: string;
  name: string;
  phone: string;
  email: string;
  profile: ScreeningProfile;
  /** Free-text note the seeker attaches to applications */
  about?: string;
  profile_complete: boolean;
}

/* ── Money & messaging ─────────────────────────────────── */

export interface Expense {
  id: string;
  property_id: string;
  kind: ExpenseKind;
  category: TicketCategory | 'arnona' | 'vaad' | 'insurance' | 'legal' | 'other';
  amount: number;
  vendor_id?: string;
  vendor_name?: string;
  date: string;
  ticket_id?: string;
  receipt_file?: string;
  /** חשבונית מס / קבלה */
  document_type: 'tax_invoice' | 'receipt' | 'none';
  note?: string;
}

export interface RentPayment {
  id: string;
  property_id: string;
  lease_id: string;
  /** yyyy-MM */
  month: string;
  due: number;
  paid: number;
  paid_at?: string;
  method: PaymentMethod;
}

export interface ThreadMessage {
  id: string;
  author_role: Role;
  author_name: string;
  body: string;
  at: string;
  read: boolean;
}

export interface MessageThread {
  id: string;
  subject: string;
  counterparty_role: Role;
  counterparty_id: string;
  counterparty_name: string;
  property_id?: string;
  ticket_id?: string;
  lead_id?: string;
  messages: ThreadMessage[];
  updated_at: string;
}

/* ── Screening (anti-discrimination-safe by construction) ──
   Every criterion here is objective and apartment-related.
   Protected characteristics are not representable in this type. */

export type ScreeningCriterionId =
  | 'income_to_rent'
  | 'employment'
  | 'guarantors'
  | 'move_in_date'
  | 'lease_length'
  | 'smoking'
  | 'pets'
  | 'occupancy'
  | 'reference';

export interface ScreeningCriterion {
  id: ScreeningCriterionId;
  enabled: boolean;
  /** Weight in the soft ranking. Never a hard filter. */
  weight: 1 | 2 | 3;
  /** Threshold shape depends on the criterion */
  value?: number | boolean;
}

export interface ScreeningPreset {
  id: string;
  name: string;
  criteria: ScreeningCriterion[];
  created_at: string;
  is_active: boolean;
}

export interface AuditEntry {
  id: string;
  at: string;
  lead_id: string;
  lead_name: string;
  property_id: string;
  preset_name: string;
  action: 'ranked' | 'stage_changed' | 'preset_applied' | 'exported';
  detail: string;
  flags: ScreeningFlag[];
}

/* ── Derived view models ───────────────────────────────── */

/** One row on the departures board — the signature component's unit of work */
export interface TrackRow {
  id: string;
  property_id: string;
  label: string;
  sublabel?: string;
  /** ISO — when the bar starts. Defaults to today. */
  from: string;
  /** ISO — the departure date. Undefined = no known date. */
  until?: string;
  tone: 'signal' | 'live' | 'open' | 'alert' | 'muted';
  confidence: AvailabilityConfidence;
  meta?: string;
  /** Extra marks on the track: notice windows, decision deadlines, queue ticks */
  marks?: TrackMark[];
}

export interface TrackMark {
  at: string;
  kind: 'decision' | 'notice_start' | 'queue' | 'today';
  label: string;
}

/* ── Availability inquiries ────────────────────────────
   A seeker asking about an apartment whose tenant hasn't decided yet.
   The chain is seeker → owner → tenant → owner → seeker. The seeker and the
   tenant never touch: identity never crosses, only a date signal does. */

export type InquiryStatus =
  | 'new'          // seeker asked, owner hasn't acted
  | 'asked_tenant' // owner forwarded the question to the tenant
  | 'answered'     // tenant answered, owner can now reply
  | 'replied'      // owner replied to the seeker
  | 'declined';    // owner chose not to pursue it

export interface AvailabilityInquiry {
  id: string;
  property_id: string;
  seeker_id: string;
  /** Free text from the seeker. Never shown to the tenant. */
  message: string;
  /** When the seeker would want to move in */
  desired_move_in: string;
  created_at: string;
  status: InquiryStatus;
  asked_tenant_at?: string;
  /** The tenant's answer, which is the whole point of the round trip */
  tenant_answer?: RenewalIntent;
  tenant_answer_note?: string;
  tenant_answered_at?: string;
  /** What the owner sent back to the seeker */
  owner_reply?: string;
  owner_replied_at?: string;
  /** Set when the answer produced a publishable date */
  resulting_available_from?: string;
}

/* ── Move-in / move-out protocol ───────────────────────
   פרוטוקול כניסה / יציאה — the checklist that decides whether a deposit
   dispute is a conversation or a court case. */

export type ProtocolKind = 'move_in' | 'move_out';

export type ProtocolSection = 'meters' | 'keys' | 'condition' | 'appliances' | 'admin';

export interface ProtocolItem {
  id: string;
  section: ProtocolSection;
  label: string;
  /** Some items capture a number (meter reading, key count) */
  input?: 'number' | 'text';
  unit?: string;
  required: boolean;
  /** A photo materially strengthens this item in a dispute */
  wants_photo?: boolean;
}

export interface ProtocolEntry {
  item_id: string;
  done: boolean;
  value?: string;
  photos: string[];
  note?: string;
}

export interface ProtocolRun {
  id: string;
  property_id: string;
  lease_id?: string;
  tenant_id?: string;
  kind: ProtocolKind;
  started_at: string;
  completed_at?: string;
  entries: ProtocolEntry[];
  /** Signed off by both sides in a real build; mocked here */
  signed: boolean;
}

/* ── Contract intake ───────────────────────────────────
   Upload a signed lease, extract the terms, review, commit. The extraction
   is mocked; the review-before-commit step is the real design. */

export type ContractScanStatus = 'idle' | 'uploading' | 'scanning' | 'review' | 'committed' | 'failed';

export interface ExtractedField<T = string> {
  key: string;
  label: string;
  value: T;
  /** 0–1. Anything under 0.8 is surfaced for the human to check. */
  confidence: number;
  /** Where in the document it came from, so the owner can verify */
  source_hint: string;
}

export interface ContractScan {
  id: string;
  property_id: string;
  file_name: string;
  uploaded_at: string;
  status: ContractScanStatus;
  fields: ExtractedField[];
  /** Fields the model could not find at all */
  missing: string[];
}

/* ── Seasonal preventive maintenance ───────────────────
   The cheapest ticket is the one that never opens. */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonalTaskTemplate {
  id: string;
  /** The month the work should happen in (1–12) */
  due_month: number;
  season: Season;
  category: TicketCategory | 'gutters' | 'gas' | 'inspection';
  title: string;
  why: string;
  /** Which units it applies to; empty = all */
  requires_amenity?: Amenity;
  typical_cost: number;
  /** Cost of the failure this prevents — the argument for doing it */
  avoided_cost: number;
  /** Share of skipped tasks that actually end in that failure. Without this
   *  the "saving" silently assumes every skipped task breaks, which is not a
   *  number anyone should put in front of an investor. */
  failure_rate: number;
  trade: Trade;
}

export type SeasonalTaskStatus = 'due' | 'scheduled' | 'done' | 'skipped';

export interface SeasonalTask {
  id: string;
  template_id: string;
  property_id: string;
  /** yyyy-MM-dd */
  due_date: string;
  status: SeasonalTaskStatus;
  ticket_id?: string;
  completed_at?: string;
  year: number;
}

/* ── Monetisation ──────────────────────────────────────
   Every place the product earns, modelled as data so the demo can show it
   rather than assert it. */

export type RevenueKind =
  | 'vendor_commission'
  | 'insurance_affiliate'
  | 'service_affiliate'
  | 'subscription'
  | 'per_document'
  | 'verification_fee';

/** Who is looking at the offer when it appears */
export type OfferAudience = 'owner' | 'tenant' | 'seeker';

export interface RevenueStream {
  id: string;
  kind: RevenueKind;
  name: string;
  /** Where in the product this fires */
  surface: string;
  route: string;
  /** Human description of the commercial arrangement */
  basis: string;
  /** Revenue to the platform per event, in ₪ */
  unit_revenue: number;
  /** Expected events per unit per year, for the projection */
  events_per_unit_year: number;
  audience: OfferAudience;
  /** false = modelled but deliberately not built; see `excluded_because` */
  active: boolean;
  excluded_because?: string;
}

export interface AffiliateOffer {
  id: string;
  stream_id: string;
  audience: OfferAudience;
  title: string;
  provider: string;
  pitch: string;
  /** What the user pays */
  price_from: number;
  price_unit: string;
  /** What the platform earns on a conversion */
  platform_revenue: number;
  /** Where this offer surfaces */
  placement: 'vendors' | 'protocol_move_in' | 'protocol_move_out' | 'tenant_home' | 'seasonal' | 'lease' | 'queue';
  cta: string;
  disclosure: string;
}
