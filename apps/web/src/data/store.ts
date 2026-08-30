import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { evaluateLead, t, type AffiliateOffer, type AuditEntry, type AvailabilityInquiry, type ContractScan, type ExtractedField, type ProtocolItem, type ProtocolKind, type ProtocolRun, type RevenueStream, type SeasonalTask, type SeasonalTaskTemplate, type Expense, type Lead, type LeadStage, type Lease, type MessageThread, type Persona, type Property, type RentPayment, type ScreeningCriterion, type ScreeningPreset, type ScreeningProfile, type Seeker, type Severity, type Tenant, type Ticket, type TicketCategory, type Vendor, type RenewalIntent } from '@miftan/shared';
import { addMonths } from 'date-fns';
import { buildSeed } from './reset';

export interface Toast {
  id: string;
  message: string;
  tone: 'neutral' | 'success' | 'alert';
}

interface Entities {
  owner: ReturnType<typeof buildSeed>['owner'];
  properties: Property[];
  leases: Lease[];
  tenants: Tenant[];
  seekers: Seeker[];
  tickets: Ticket[];
  vendors: Vendor[];
  leads: Lead[];
  expenses: Expense[];
  rentPayments: RentPayment[];
  threads: MessageThread[];
  screeningPresets: ScreeningPreset[];
  auditLog: AuditEntry[];
  inquiries: AvailabilityInquiry[];
  protocolItems: ProtocolItem[];
  protocolRuns: ProtocolRun[];
  seasonalTemplates: SeasonalTaskTemplate[];
  seasonalTasks: SeasonalTask[];
  revenueStreams: RevenueStream[];
  affiliateOffers: AffiliateOffer[];
  offerRequests: string[];
  contractScans: ContractScan[];
}

interface Session {
  persona: Persona;
  currentTenantId: string;
  currentSeekerId: string;
  /** Demo affordance: highlights every monetisation point in the running app */
  revenueLens: boolean;
}

interface Actions {
  setPersona: (p: Persona) => void;
  resetDemo: () => void;

  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;

  /* Tickets */
  createTicket: (input: {
    category: TicketCategory;
    severity: Severity;
    title: string;
    description: string;
    photos: string[];
    availability: string[];
  }) => string;
  approveTicket: (id: string) => void;
  rejectTicket: (id: string, reason: string) => void;
  assignVendor: (ticketId: string, vendorId: string, slot: string) => void;
  confirmSlot: (ticketId: string) => void;
  startWork: (ticketId: string) => void;
  requestReceipt: (ticketId: string) => void;
  uploadReceipt: (ticketId: string, amount: number, by: 'tenant' | 'vendor') => void;
  closeTicket: (ticketId: string) => void;
  reopenTicket: (ticketId: string) => void;
  addTicketMessage: (ticketId: string, role: 'owner' | 'tenant' | 'vendor', body: string) => void;

  /* Portfolio */
  setListed: (propertyIds: string[], listed: boolean) => void;
  adjustRent: (propertyId: string, newRent: number, effective: string) => void;
  bulkAdjustRent: (propertyIds: string[], percent: number) => void;

  /* Leases & renewal */
  askRenewal: (leaseId: string) => void;
  setRenewalIntent: (leaseId: string, intent: RenewalIntent) => void;
  sendRenewalProposal: (leaseId: string, rent: number, months: number, start: string) => void;
  acceptRenewalProposal: (leaseId: string) => void;

  /* CRM & screening */
  setLeadStage: (leadId: string, stage: LeadStage) => void;
  setActivePreset: (presetId: string) => void;
  updatePresetCriteria: (presetId: string, criteria: ScreeningCriterion[]) => void;
  exportAudit: () => void;

  /* Seeker */
  reserveQueue: (propertyId: string) => void;
  leaveQueue: (leadId: string) => void;
  toggleWatch: (propertyId: string) => void;
  updateSeekerProfile: (patch: Partial<ScreeningProfile> & { name?: string; phone?: string; email?: string; about?: string }) => void;

  /* Messages */
  markThreadRead: (threadId: string) => void;
  sendThreadMessage: (threadId: string, body: string, role?: 'owner' | 'tenant' | 'lead') => void;

  /* Finance */
  exportExpenses: () => void;

  /* Availability inquiries */
  askAvailability: (propertyId: string, message: string, desiredMoveIn: string) => void;
  askTenantAboutRenewal: (inquiryId: string) => void;
  answerInquiryAsTenant: (inquiryId: string, answer: RenewalIntent, note?: string) => void;
  replyToInquiry: (inquiryId: string, text: string) => void;
  declineInquiry: (inquiryId: string) => void;

  /* Move-in / move-out protocol */
  startProtocol: (propertyId: string, kind: ProtocolKind) => string;
  setProtocolEntry: (
    runId: string,
    itemId: string,
    patch: { done?: boolean; value?: string; note?: string },
  ) => void;
  addProtocolPhoto: (runId: string, itemId: string) => void;
  completeProtocol: (runId: string) => void;

  /* Contract intake */
  startContractScan: (propertyId: string, fileName: string) => string;
  advanceContractScan: (scanId: string) => void;
  setScanField: (scanId: string, key: string, value: string) => void;
  commitContractScan: (scanId: string) => void;
  generateContract: (propertyId: string, leadId?: string) => void;

  /* Seasonal preventive maintenance */
  scheduleSeasonalTask: (taskId: string) => void;
  scheduleSeasonalTemplate: (templateId: string) => void;
  completeSeasonalTask: (taskId: string) => void;
  skipSeasonalTask: (taskId: string) => void;

  /* Monetisation */
  toggleRevenueLens: () => void;
  requestOffer: (offerId: string) => void;
}

export type Store = Entities & Session & { toasts: Toast[] } & Actions;

let idSeq = 1000;
const nextId = (prefix: string) => `${prefix}-${++idSeq}`;
const nowIso = () => new Date().toISOString();

/** Recompute every lead's flags against the active preset. Called at boot
 *  and whenever the preset changes, so ranking and audit never drift. */
function rescore(leads: Lead[], properties: Property[], presets: ScreeningPreset[]): Lead[] {
  const active = presets.find((p) => p.is_active) ?? presets[0];
  const byId = new Map(properties.map((p) => [p.id, p]));
  return leads.map((lead) => {
    const property = byId.get(lead.property_id);
    if (!property) return lead;
    return { ...lead, screening_flags: evaluateLead(lead, property, active.criteria) };
  });
}

/**
 * Seasonal tasks are derived, not seeded: one per (template × eligible unit)
 * for the current cycle. A template that needs an amenity only lands on units
 * that have it, so a unit with no balcony never gets a gutters task.
 */
function buildSeasonalTasks(
  templates: SeasonalTaskTemplate[],
  properties: Property[],
): SeasonalTask[] {
  const today = new Date();
  const out: SeasonalTask[] = [];

  for (const template of templates) {
    for (const property of properties) {
      if (template.requires_amenity && !property.amenities.includes(template.requires_amenity)) {
        continue;
      }
      /* Next occurrence of the template's month, this year or next. */
      let due = new Date(today.getFullYear(), template.due_month - 1, 15);
      if (due < today) due = new Date(today.getFullYear() + 1, template.due_month - 1, 15);

      out.push({
        id: `sk-${template.id}-${property.id}`,
        template_id: template.id,
        property_id: property.id,
        due_date: due.toISOString().slice(0, 10),
        status: 'due',
        year: due.getFullYear(),
      });
    }
  }

  return out.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

function hydrate(): Entities {
  const seed = buildSeed();
  return {
    ...seed,
    contractScans: [],
    leads: rescore(seed.leads, seed.properties, seed.screeningPresets),
    seasonalTasks: buildSeasonalTasks(seed.seasonalTemplates, seed.properties),
  };
}

export const useStore = create<Store>((set, get) => ({
  ...hydrate(),
  persona: 'owner',
  currentTenantId: 't11',
  currentSeekerId: 's01',
  revenueLens: false,
  toasts: [],

  setPersona: (persona) => set({ persona }),

  resetDemo: () => {
    idSeq = 1000;
    set({ ...hydrate(), toasts: [], revenueLens: false });
  },

  pushToast: (message, tone = 'neutral') => {
    const id = nextId('toast');
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => get().dismissToast(id), 4200);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

  /* ── Tickets ───────────────────────────────────────── */

  createTicket: (input) => {
    const { currentTenantId, leases, tenants } = get();
    const tenant = tenants.find((x) => x.id === currentTenantId);
    const lease = leases.find((l) => l.tenant_id === currentTenantId);
    const id = nextId('tk');
    const ticket: Ticket = {
      id,
      property_id: lease?.property_id ?? '',
      tenant_id: currentTenantId,
      category: input.category,
      severity: input.severity,
      status: 'new',
      title: input.title,
      description: input.description,
      photos: input.photos,
      created_at: nowIso(),
      tenant_availability: input.availability,
      messages: [
        {
          author_role: 'tenant',
          author_name: tenant?.name ?? '',
          body: input.description || input.title,
          at: nowIso(),
          photos: input.photos.length ? input.photos : undefined,
        },
      ],
    };
    set((s) => ({ tickets: [ticket, ...s.tickets] }));
    return id;
  },

  approveTicket: (id) =>
    set((s) => ({
      tickets: s.tickets.map((tk) =>
        tk.id === id
          ? {
              ...tk,
              status: 'approved',
              messages: [
                ...tk.messages,
                { author_role: 'owner' as const, author_name: s.owner.name, body: t.tickets.actions.approve, at: nowIso() },
              ],
            }
          : tk,
      ),
    })),

  rejectTicket: (id, reason) =>
    set((s) => ({
      tickets: s.tickets.map((tk) =>
        tk.id === id
          ? {
              ...tk,
              status: 'closed',
              messages: [
                ...tk.messages,
                { author_role: 'owner' as const, author_name: s.owner.name, body: reason, at: nowIso() },
              ],
            }
          : tk,
      ),
    })),

  assignVendor: (ticketId, vendorId, slot) =>
    set((s) => {
      const vendor = s.vendors.find((v) => v.id === vendorId);
      return {
        tickets: s.tickets.map((tk) =>
          tk.id === ticketId
            ? {
                ...tk,
                status: 'assigned',
                vendor_id: vendorId,
                scheduled_at: slot,
                tenant_confirmed_slot: false,
                messages: [
                  ...tk.messages,
                  {
                    author_role: 'owner' as const,
                    author_name: s.owner.name,
                    body: `${t.tickets.assign.done} — ${vendor?.name ?? ''}`,
                    at: nowIso(),
                  },
                ],
              }
            : tk,
        ),
      };
    }),

  confirmSlot: (ticketId) =>
    set((s) => {
      const tenant = s.tenants.find((x) => x.id === s.currentTenantId);
      return {
        tickets: s.tickets.map((tk) =>
          tk.id === ticketId
            ? {
                ...tk,
                tenant_confirmed_slot: true,
                messages: [
                  ...tk.messages,
                  { author_role: 'tenant' as const, author_name: tenant?.name ?? '', body: t.tenant.tickets.confirmSlot, at: nowIso() },
                ],
              }
            : tk,
        ),
      };
    }),

  startWork: (ticketId) =>
    set((s) => ({
      tickets: s.tickets.map((tk) => (tk.id === ticketId ? { ...tk, status: 'in_progress' } : tk)),
    })),

  requestReceipt: (ticketId) =>
    set((s) => ({
      tickets: s.tickets.map((tk) =>
        tk.id === ticketId
          ? {
              ...tk,
              status: 'awaiting_receipt',
              messages: [
                ...tk.messages,
                { author_role: 'owner' as const, author_name: s.owner.name, body: t.tickets.actions.requestReceipt, at: nowIso() },
              ],
            }
          : tk,
      ),
    })),

  /** The hinge of the demo: a receipt closes the ticket AND books the expense. */
  uploadReceipt: (ticketId, amount, by) =>
    set((s) => {
      const ticket = s.tickets.find((tk) => tk.id === ticketId);
      if (!ticket) return {};
      const vendor = s.vendors.find((v) => v.id === ticket.vendor_id);
      const author =
        by === 'tenant'
          ? s.tenants.find((x) => x.id === ticket.tenant_id)?.name ?? ''
          : vendor?.name ?? '';
      const expenseId = nextId('ex');
      const expense: Expense = {
        id: expenseId,
        property_id: ticket.property_id,
        kind: 'maintenance',
        category: ticket.category,
        amount,
        vendor_id: ticket.vendor_id,
        vendor_name: vendor?.name,
        date: nowIso().slice(0, 10),
        ticket_id: ticket.id,
        receipt_file: `https://picsum.photos/seed/receipt-${ticketId}/700/900`,
        document_type: 'receipt',
      };
      return {
        expenses: [expense, ...s.expenses],
        tickets: s.tickets.map((tk) =>
          tk.id === ticketId
            ? {
                ...tk,
                status: 'closed',
                expense_id: expenseId,
                receipt: {
                  amount,
                  file: expense.receipt_file!,
                  uploaded_at: nowIso(),
                  uploaded_by: by,
                  vendor_name: vendor?.name,
                },
                messages: [
                  ...tk.messages,
                  { author_role: by, author_name: author, body: t.tenant.tickets.receiptUploaded, at: nowIso() },
                ],
              }
            : tk,
        ),
      };
    }),

  closeTicket: (ticketId) =>
    set((s) => ({
      tickets: s.tickets.map((tk) => (tk.id === ticketId ? { ...tk, status: 'closed' } : tk)),
    })),

  reopenTicket: (ticketId) =>
    set((s) => ({
      tickets: s.tickets.map((tk) => (tk.id === ticketId ? { ...tk, status: 'approved' } : tk)),
    })),

  addTicketMessage: (ticketId, role, body) =>
    set((s) => {
      const ticket = s.tickets.find((tk) => tk.id === ticketId);
      const name =
        role === 'owner'
          ? s.owner.name
          : role === 'tenant'
            ? s.tenants.find((x) => x.id === ticket?.tenant_id)?.name ?? ''
            : s.vendors.find((v) => v.id === ticket?.vendor_id)?.name ?? '';
      return {
        tickets: s.tickets.map((tk) =>
          tk.id === ticketId
            ? { ...tk, messages: [...tk.messages, { author_role: role, author_name: name, body, at: nowIso() }] }
            : tk,
        ),
      };
    }),

  /* ── Portfolio ─────────────────────────────────────── */

  setListed: (propertyIds, listed) =>
    set((s) => ({
      properties: s.properties.map((p) => (propertyIds.includes(p.id) ? { ...p, listed } : p)),
    })),

  adjustRent: (propertyId, newRent, effective) =>
    set((s) => {
      const property = s.properties.find((p) => p.id === propertyId);
      if (!property?.current_lease_id) {
        return { properties: s.properties.map((p) => (p.id === propertyId ? { ...p, monthly_rent: newRent } : p)) };
      }
      return {
        leases: s.leases.map((l) =>
          l.id === property.current_lease_id
            ? {
                ...l,
                proposed_renewal: {
                  monthly_rent: newRent,
                  start_date: effective,
                  months: l.extension_months ?? 12,
                  sent_at: nowIso(),
                },
              }
            : l,
        ),
      };
    }),

  bulkAdjustRent: (propertyIds, percent) =>
    set((s) => ({
      properties: s.properties.map((p) =>
        propertyIds.includes(p.id)
          ? { ...p, monthly_rent: Math.round((p.monthly_rent * (1 + percent / 100)) / 50) * 50 }
          : p,
      ),
    })),

  /* ── Leases & renewal ──────────────────────────────── */

  askRenewal: (leaseId) =>
    set((s) => ({
      leases: s.leases.map((l) =>
        l.id === leaseId ? { ...l, renewal_asked_at: nowIso(), renewal_intent: l.renewal_intent ?? 'undecided' } : l,
      ),
    })),

  setRenewalIntent: (leaseId, intent) =>
    set((s) => {
      const lease = s.leases.find((l) => l.id === leaseId);
      return {
        leases: s.leases.map((l) => (l.id === leaseId ? { ...l, renewal_intent: intent } : l)),
        /* The derived availability signal — never the tenant's identity. */
        properties: s.properties.map((p) =>
          p.id === lease?.property_id
            ? {
                ...p,
                status: intent === 'leave' ? 'vacating' : p.status === 'vacating' ? 'occupied' : p.status,
                availability_confidence:
                  intent === 'leave' ? 'confirmed' : intent === 'extend' ? 'unknown' : 'likely',
                available_from: lease?.end_date,
              }
            : p,
        ),
      };
    }),

  sendRenewalProposal: (leaseId, rent, months, start) =>
    set((s) => ({
      leases: s.leases.map((l) =>
        l.id === leaseId
          ? { ...l, proposed_renewal: { monthly_rent: rent, start_date: start, months, sent_at: nowIso() } }
          : l,
      ),
    })),

  acceptRenewalProposal: (leaseId) =>
    set((s) => {
      const lease = s.leases.find((l) => l.id === leaseId);
      if (!lease?.proposed_renewal) return {};
      return {
        leases: s.leases.map((l) => (l.id === leaseId ? { ...l, renewal_intent: 'extend' } : l)),
        properties: s.properties.map((p) =>
          p.id === lease.property_id
            ? { ...p, status: 'occupied', availability_confidence: 'unknown' }
            : p,
        ),
      };
    }),

  /* ── CRM & screening ───────────────────────────────── */

  setLeadStage: (leadId, stage) =>
    set((s) => {
      const lead = s.leads.find((l) => l.id === leadId);
      if (!lead) return {};
      const seeker = s.seekers.find((x) => x.id === lead.seeker_id);
      const preset = s.screeningPresets.find((p) => p.is_active);
      const entry: AuditEntry = {
        id: nextId('au'),
        at: nowIso(),
        lead_id: leadId,
        lead_name: seeker?.name ?? '',
        property_id: lead.property_id,
        preset_name: preset?.name ?? '',
        action: 'stage_changed',
        detail: `${t.leadStage[lead.stage]} ← ${t.leadStage[stage]}`,
        flags: lead.screening_flags,
      };
      return {
        leads: s.leads.map((l) => (l.id === leadId ? { ...l, stage } : l)),
        auditLog: [entry, ...s.auditLog],
      };
    }),

  setActivePreset: (presetId) =>
    set((s) => {
      const presets = s.screeningPresets.map((p) => ({ ...p, is_active: p.id === presetId }));
      const leads = rescore(s.leads, s.properties, presets);
      const preset = presets.find((p) => p.is_active);
      const entries: AuditEntry[] = leads.map((lead) => ({
        id: nextId('au'),
        at: nowIso(),
        lead_id: lead.id,
        lead_name: s.seekers.find((x) => x.id === lead.seeker_id)?.name ?? '',
        property_id: lead.property_id,
        preset_name: preset?.name ?? '',
        action: 'preset_applied',
        detail: `${t.screening.activePreset}: ${preset?.name ?? ''}`,
        flags: lead.screening_flags,
      }));
      return { screeningPresets: presets, leads, auditLog: [...entries, ...s.auditLog] };
    }),

  updatePresetCriteria: (presetId, criteria) =>
    set((s) => {
      const presets = s.screeningPresets.map((p) => (p.id === presetId ? { ...p, criteria } : p));
      return { screeningPresets: presets, leads: rescore(s.leads, s.properties, presets) };
    }),

  exportAudit: () =>
    set((s) => {
      const preset = s.screeningPresets.find((p) => p.is_active);
      const entry: AuditEntry = {
        id: nextId('au'),
        at: nowIso(),
        lead_id: '—',
        lead_name: '—',
        property_id: '—',
        preset_name: preset?.name ?? '',
        action: 'exported',
        detail: `${s.auditLog.length} ${t.screening.audit.entries}`,
        flags: [],
      };
      return { auditLog: [entry, ...s.auditLog] };
    }),

  /* ── Seeker ────────────────────────────────────────── */

  reserveQueue: (propertyId) =>
    set((s) => {
      const seeker = s.seekers.find((x) => x.id === s.currentSeekerId);
      if (!seeker) return {};
      const existing = s.leads.find(
        (l) => l.property_id === propertyId && l.seeker_id === s.currentSeekerId,
      );
      const property = s.properties.find((p) => p.id === propertyId);
      if (!property) return {};
      const queue = s.leads.filter((l) => l.property_id === propertyId);
      const preset = s.screeningPresets.find((p) => p.is_active);

      const base: Lead = existing
        ? { ...existing, watch_only: undefined, stage: existing.stage === 'rejected' ? 'new' : existing.stage }
        : {
            id: nextId('ld'),
            property_id: propertyId,
            seeker_id: s.currentSeekerId,
            stage: 'new',
            created_at: nowIso(),
            desired_move_in: property.available_from ?? new Date().toISOString().slice(0, 10),
            queue_position: queue.length + 1,
            screening: seeker.profile,
            screening_flags: [],
          };

      const lead: Lead = {
        ...base,
        screening_flags: evaluateLead(base, property, preset?.criteria ?? []),
      };

      const entry: AuditEntry = {
        id: nextId('au'),
        at: nowIso(),
        lead_id: lead.id,
        lead_name: seeker.name,
        property_id: propertyId,
        preset_name: preset?.name ?? '',
        action: 'ranked',
        detail: t.seeker.listing.reserved,
        flags: lead.screening_flags,
      };

      return {
        leads: existing ? s.leads.map((l) => (l.id === lead.id ? lead : l)) : [...s.leads, lead],
        auditLog: [entry, ...s.auditLog],
      };
    }),

  leaveQueue: (leadId) =>
    set((s) => {
      const lead = s.leads.find((l) => l.id === leadId);
      if (!lead) return {};
      const remaining = s.leads.filter((l) => l.id !== leadId);
      /* Everyone behind them moves up — the queue has to stay honest. */
      return {
        leads: remaining.map((l) =>
          l.property_id === lead.property_id && l.queue_position > lead.queue_position
            ? { ...l, queue_position: l.queue_position - 1 }
            : l,
        ),
      };
    }),

  toggleWatch: (propertyId) =>
    set((s) => {
      const existing = s.leads.find(
        (l) => l.property_id === propertyId && l.seeker_id === s.currentSeekerId,
      );
      if (existing) {
        if (existing.watch_only) {
          return { leads: s.leads.filter((l) => l.id !== existing.id) };
        }
        return {};
      }
      const seeker = s.seekers.find((x) => x.id === s.currentSeekerId);
      const property = s.properties.find((p) => p.id === propertyId);
      if (!seeker || !property) return {};
      const queue = s.leads.filter((l) => l.property_id === propertyId);
      return {
        leads: [
          ...s.leads,
          {
            id: nextId('ld'),
            property_id: propertyId,
            seeker_id: s.currentSeekerId,
            stage: 'new',
            created_at: nowIso(),
            desired_move_in: property.available_from ?? new Date().toISOString().slice(0, 10),
            queue_position: queue.length + 1,
            screening: seeker.profile,
            screening_flags: [],
            watch_only: true,
          },
        ],
      };
    }),

  updateSeekerProfile: (patch) =>
    set((s) => {
      const { name, phone, email, about, ...profilePatch } = patch;
      const seekers = s.seekers.map((x) =>
        x.id === s.currentSeekerId
          ? {
              ...x,
              name: name ?? x.name,
              phone: phone ?? x.phone,
              email: email ?? x.email,
              about: about ?? x.about,
              profile: { ...x.profile, ...profilePatch },
              profile_complete: true,
            }
          : x,
      );
      const seeker = seekers.find((x) => x.id === s.currentSeekerId)!;
      /* A profile change re-ranks every application the seeker has open. */
      const leads = s.leads.map((l) =>
        l.seeker_id === s.currentSeekerId ? { ...l, screening: seeker.profile } : l,
      );
      return { seekers, leads: rescore(leads, s.properties, s.screeningPresets) };
    }),

  /* ── Messages ──────────────────────────────────────── */

  markThreadRead: (threadId) =>
    set((s) => ({
      threads: s.threads.map((th) =>
        th.id === threadId
          ? { ...th, messages: th.messages.map((m) => ({ ...m, read: true })) }
          : th,
      ),
    })),

  sendThreadMessage: (threadId, body, role = 'owner') =>
    set((s) => ({
      threads: s.threads.map((th) =>
        th.id === threadId
          ? {
              ...th,
              updated_at: nowIso(),
              messages: [
                ...th.messages,
                {
                  id: nextId('m'),
                  author_role: role,
                  author_name:
                    role === 'owner'
                      ? s.owner.name
                      : s.seekers.find((x) => x.id === s.currentSeekerId)?.name ?? '',
                  body,
                  at: nowIso(),
                  read: true,
                },
              ],
            }
          : th,
      ),
    })),

  exportExpenses: () => {
    get().pushToast(t.finance.exported, 'success');
  },

  /* ── Availability inquiries ────────────────────────── */

  askAvailability: (propertyId, message, desiredMoveIn) =>
    set((s) => ({
      inquiries: [
        {
          id: nextId('iq'),
          property_id: propertyId,
          seeker_id: s.currentSeekerId,
          message,
          desired_move_in: desiredMoveIn,
          created_at: nowIso(),
          status: 'new',
        },
        ...s.inquiries,
      ],
    })),

  askTenantAboutRenewal: (inquiryId) =>
    set((s) => {
      const inquiry = s.inquiries.find((x) => x.id === inquiryId);
      if (!inquiry) return {};
      const lease = s.leases.find((l) => l.property_id === inquiry.property_id);
      return {
        inquiries: s.inquiries.map((x) =>
          x.id === inquiryId ? { ...x, status: 'asked_tenant', asked_tenant_at: nowIso() } : x,
        ),
        /* The tenant sees a renewal question, not a seeker. */
        leases: s.leases.map((l) =>
          l.id === lease?.id ? { ...l, renewal_asked_at: nowIso() } : l,
        ),
      };
    }),

  answerInquiryAsTenant: (inquiryId, answer, note) =>
    set((s) => {
      const inquiry = s.inquiries.find((x) => x.id === inquiryId);
      if (!inquiry) return {};
      const lease = s.leases.find((l) => l.property_id === inquiry.property_id);

      /* The tenant's words never leave this record. What reaches the seeker
         side is a date and a confidence, derived below. */
      const confidence =
        answer === 'leave' ? 'confirmed' : answer === 'extend' ? 'unknown' : 'likely';

      return {
        inquiries: s.inquiries.map((x) =>
          x.id === inquiryId
            ? {
                ...x,
                status: 'answered',
                tenant_answer: answer,
                tenant_answer_note: note,
                tenant_answered_at: nowIso(),
                resulting_available_from: answer === 'leave' ? lease?.end_date : undefined,
              }
            : x,
        ),
        leases: s.leases.map((l) => (l.id === lease?.id ? { ...l, renewal_intent: answer } : l)),
        properties: s.properties.map((p) =>
          p.id === inquiry.property_id
            ? {
                ...p,
                status: answer === 'leave' ? 'vacating' : p.status === 'vacating' ? 'occupied' : p.status,
                availability_confidence: confidence,
                available_from: lease?.end_date ?? p.available_from,
              }
            : p,
        ),
      };
    }),

  replyToInquiry: (inquiryId, text) =>
    set((s) => ({
      inquiries: s.inquiries.map((x) =>
        x.id === inquiryId
          ? { ...x, status: 'replied', owner_reply: text, owner_replied_at: nowIso() }
          : x,
      ),
    })),

  declineInquiry: (inquiryId) =>
    set((s) => ({
      inquiries: s.inquiries.map((x) => (x.id === inquiryId ? { ...x, status: 'declined' } : x)),
    })),

  /* ── Move-in / move-out protocol ───────────────────── */

  startProtocol: (propertyId, kind) => {
    const { protocolItems, leases } = get();
    const lease = leases.find((l) => l.property_id === propertyId);
    const id = nextId('pr');
    const run: ProtocolRun = {
      id,
      property_id: propertyId,
      lease_id: lease?.id,
      tenant_id: lease?.tenant_id,
      kind,
      started_at: nowIso(),
      signed: false,
      entries: protocolItems.map((item) => ({ item_id: item.id, done: false, photos: [] })),
    };
    set((s) => ({ protocolRuns: [run, ...s.protocolRuns] }));
    return id;
  },

  setProtocolEntry: (runId, itemId, patch) =>
    set((s) => ({
      protocolRuns: s.protocolRuns.map((run) =>
        run.id === runId
          ? {
              ...run,
              entries: run.entries.map((e) => (e.item_id === itemId ? { ...e, ...patch } : e)),
            }
          : run,
      ),
    })),

  addProtocolPhoto: (runId, itemId) =>
    set((s) => ({
      protocolRuns: s.protocolRuns.map((run) =>
        run.id === runId
          ? {
              ...run,
              entries: run.entries.map((e) =>
                e.item_id === itemId
                  ? {
                      ...e,
                      done: true,
                      photos: [
                        ...e.photos,
                        `https://picsum.photos/seed/proto-${runId}-${itemId}-${e.photos.length}/800/600`,
                      ],
                    }
                  : e,
              ),
            }
          : run,
      ),
    })),

  completeProtocol: (runId) =>
    set((s) => ({
      protocolRuns: s.protocolRuns.map((run) =>
        run.id === runId ? { ...run, completed_at: nowIso(), signed: true } : run,
      ),
    })),

  /* ── Contract intake ───────────────────────────────── */

  startContractScan: (propertyId, fileName) => {
    const id = nextId('cs');
    set((s) => ({
      contractScans: [
        {
          id,
          property_id: propertyId,
          file_name: fileName,
          uploaded_at: nowIso(),
          status: 'uploading',
          fields: [],
          missing: [],
        },
        ...s.contractScans,
      ],
    }));
    return id;
  },

  /**
   * Mock extraction. The values are derived from the unit that was picked, so
   * the review step has something real to check against — and two fields come
   * back deliberately low-confidence, because a scan UI that always returns
   * 100% teaches the owner not to read it.
   */
  advanceContractScan: (scanId) =>
    set((s) => {
      const scan = s.contractScans.find((x) => x.id === scanId);
      if (!scan) return {};

      if (scan.status === 'uploading') {
        return {
          contractScans: s.contractScans.map((x) =>
            x.id === scanId ? { ...x, status: 'scanning' } : x,
          ),
        };
      }

      if (scan.status !== 'scanning') return {};

      const property = s.properties.find((p) => p.id === scan.property_id);
      const lease = s.leases.find((l) => l.property_id === scan.property_id);
      const tenant = s.tenants.find((x) => x.id === lease?.tenant_id);
      const rent = lease?.monthly_rent ?? property?.monthly_rent ?? 0;
      const start = lease?.start_date ?? new Date().toISOString().slice(0, 10);
      const end = lease?.end_date ?? addMonths(new Date(), 12).toISOString().slice(0, 10);

      const src = t.contracts.sample;
      const fields: ExtractedField[] = [
        { key: 'tenant_name', label: t.properties.tenant, value: tenant?.name ?? src.unknownTenant, confidence: 0.97, source_hint: src.sourceParties },
        { key: 'start_date', label: t.unit.lease.period, value: start, confidence: 0.95, source_hint: src.sourceTerm },
        { key: 'end_date', label: t.properties.leaseEnd, value: end, confidence: 0.95, source_hint: src.sourceTerm },
        { key: 'monthly_rent', label: t.unit.lease.monthlyRent, value: String(rent), confidence: 0.93, source_hint: src.sourceRent },
        { key: 'deposit', label: t.unit.lease.deposit, value: String(lease?.deposit ?? rent * 2), confidence: 0.71, source_hint: src.sourceDeposit },
        { key: 'payment_method', label: t.unit.lease.payment, value: t.paymentMethod[lease?.payment_method ?? 'bank_transfer'], confidence: 0.88, source_hint: src.sourcePayment },
        { key: 'notice_period_days', label: t.unit.lease.noticePeriod, value: String(lease?.notice_period_days ?? 60), confidence: 0.64, source_hint: src.sourceNotice },
        { key: 'guarantors', label: t.unit.lease.guarantors, value: lease?.guarantors.map((g) => g.name).join(', ') || '—', confidence: 0.82, source_hint: src.sourceGuarantors },
        { key: 'extension_option', label: t.unit.lease.extensionOption, value: lease?.has_extension_option ? t.unit.lease.hasOption : t.unit.lease.noOption, confidence: 0.9, source_hint: src.sourceExtension },
      ];

      return {
        contractScans: s.contractScans.map((x) =>
          x.id === scanId
            ? { ...x, status: 'review', fields, missing: [src.missingArnona, src.missingEarlyExit] }
            : x,
        ),
      };
    }),

  setScanField: (scanId, key, value) =>
    set((s) => ({
      contractScans: s.contractScans.map((scan) =>
        scan.id === scanId
          ? {
              ...scan,
              fields: scan.fields.map((f) =>
                /* An edited field is a human-confirmed field. */
                f.key === key ? { ...f, value, confidence: 1 } : f,
              ),
            }
          : scan,
      ),
    })),

  commitContractScan: (scanId) =>
    set((s) => {
      const scan = s.contractScans.find((x) => x.id === scanId);
      if (!scan) return {};
      const get2 = (key: string) => scan.fields.find((f) => f.key === key)?.value;
      const lease = s.leases.find((l) => l.property_id === scan.property_id);

      return {
        contractScans: s.contractScans.map((x) =>
          x.id === scanId ? { ...x, status: 'committed' } : x,
        ),
        leases: lease
          ? s.leases.map((l) =>
              l.id === lease.id
                ? {
                    ...l,
                    start_date: get2('start_date') ?? l.start_date,
                    end_date: get2('end_date') ?? l.end_date,
                    monthly_rent: Number(get2('monthly_rent')) || l.monthly_rent,
                    deposit: Number(get2('deposit')) || l.deposit,
                    notice_period_days: Number(get2('notice_period_days')) || l.notice_period_days,
                  }
                : l,
            )
          : s.leases,
      };
    }),

  generateContract: (propertyId) => {
    const property = get().properties.find((p) => p.id === propertyId);
    get().pushToast(
      `${t.contracts.generated} — ${property ? `${property.address.street} ${property.address.number}` : ''}`,
      'success',
    );
  },

  /* ── Seasonal preventive maintenance ───────────────── */

  /** Scheduling opens a real ticket, so preventive work lives in the same
   *  board as reactive work rather than in a parallel to-do list. */
  scheduleSeasonalTask: (taskId) =>
    set((s) => {
      const task = s.seasonalTasks.find((x) => x.id === taskId);
      if (!task) return {};
      const template = s.seasonalTemplates.find((x) => x.id === task.template_id);
      const property = s.properties.find((p) => p.id === task.property_id);
      const lease = s.leases.find((l) => l.property_id === task.property_id);
      if (!template || !property) return {};

      const ticketId = nextId('tk');
      const ticket: Ticket = {
        id: ticketId,
        property_id: property.id,
        tenant_id: lease?.tenant_id ?? '',
        category: (['gutters', 'gas', 'inspection'] as string[]).includes(template.category)
          ? 'other'
          : (template.category as Ticket['category']),
        severity: 'low',
        status: 'approved',
        title: template.title,
        description: template.why,
        photos: [],
        created_at: nowIso(),
        tenant_availability: [],
        messages: [
          {
            author_role: 'owner',
            author_name: s.owner.name,
            body: `${t.seasonal.title}: ${template.title}`,
            at: nowIso(),
          },
        ],
      };

      return {
        tickets: [ticket, ...s.tickets],
        seasonalTasks: s.seasonalTasks.map((x) =>
          x.id === taskId ? { ...x, status: 'scheduled', ticket_id: ticketId } : x,
        ),
      };
    }),

  scheduleSeasonalTemplate: (templateId) => {
    const due = get().seasonalTasks.filter(
      (x) => x.template_id === templateId && x.status === 'due',
    );
    for (const task of due) get().scheduleSeasonalTask(task.id);
  },

  completeSeasonalTask: (taskId) =>
    set((s) => ({
      seasonalTasks: s.seasonalTasks.map((x) =>
        x.id === taskId ? { ...x, status: 'done', completed_at: nowIso() } : x,
      ),
    })),

  skipSeasonalTask: (taskId) =>
    set((s) => ({
      seasonalTasks: s.seasonalTasks.map((x) => (x.id === taskId ? { ...x, status: 'skipped' } : x)),
    })),

  /* ── Monetisation ──────────────────────────────────── */

  toggleRevenueLens: () => set((s) => ({ revenueLens: !s.revenueLens })),

  requestOffer: (offerId) =>
    set((s) =>
      s.offerRequests.includes(offerId)
        ? {}
        : { offerRequests: [...s.offerRequests, offerId] },
    ),
}));

/**
 * Zustand v5 compares selector results with Object.is, so a selector that
 * builds an object re-renders every time. Use this for multi-field reads.
 */
export function useStoreShallow<U>(selector: (state: Store) => U): U {
  return useStore(useShallow(selector));
}
