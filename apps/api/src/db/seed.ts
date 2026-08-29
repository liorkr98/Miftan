import 'dotenv/config';
import {
  owner as fxOwner,
  tenants as fxTenants,
  seekers as fxSeekers,
  properties as fxProperties,
  leases as fxLeases,
  vendors as fxVendors,
  tickets as fxTickets,
  leads as fxLeads,
  expenses as fxExpenses,
  rentPayments as fxRentPayments,
  threads as fxThreads,
  screeningPresets as fxPresets,
  inquiries as fxInquiries,
  protocolRuns as fxProtocolRuns,
} from '@miftach/fixtures';
import { toAgorot } from '@miftach/shared';
import { db, sql, schema as s } from './client.ts';
import { seedId } from '../lib/ids.ts';
import { hashPassword } from '../lib/auth.ts';

/**
 * Loads the demo portfolio into Postgres as development fixtures.
 *
 * Two conversions happen on the way in and they are the whole point of doing
 * this now rather than later:
 *
 *  - **Shekels become agorot.** The fixtures speak in ₪7,200; the database
 *    stores 720000. Every money column crosses that boundary exactly once,
 *    here, so nothing downstream has to wonder which unit it is holding.
 *  - **Readable ids become prefixed ids.** `p01` becomes `prop_seed_p01`,
 *    deterministically, so re-seeding is idempotent and a row you find in a log
 *    can be traced back to the fixture that produced it.
 *
 * Everyone gets the same development password. This script refuses to run
 * against a production database for that reason.
 */

if (process.env.NODE_ENV === 'production') {
  throw new Error('db:seed refuses to run with NODE_ENV=production');
}

/**
 * Every seeded account shares one throwaway password so you can sign in as the
 * owner, then as a tenant, then as a seeker and see the same data from three
 * sides. Hashed properly rather than stored plain, because a seed script is
 * exactly the kind of file that gets copied into production by accident — and
 * the guard above is the other half of that defence.
 */
export const DEV_PASSWORD = 'miftach-dev-2026';
const DEV_PASSWORD_HASH = await hashPassword(DEV_PASSWORD);

const userId = (k: string) => seedId('user', k);
const propId = (k: string) => seedId('property', k);
const leaseId = (k: string) => seedId('lease', k);
const vendorId = (k: string) => seedId('vendor', k);
const ticketId = (k: string) => seedId('ticket', k);

const money = (shekels: number) => toAgorot(shekels);
/** Fixtures carry ISO datetimes; date columns want yyyy-MM-dd. */
const day = (iso: string) => iso.slice(0, 10);

console.log('seeding…');

/* Order matters: foreign keys. */
await db.transaction(async (tx) => {
  /* ── People ──────────────────────────────────────────── */

  await tx.insert(s.users).values([
    { id: userId(fxOwner.id), email: fxOwner.email, phone: fxOwner.phone, name: fxOwner.name, passwordHash: DEV_PASSWORD_HASH },
    ...fxTenants.map((t) => ({
      id: userId(t.id), email: t.email, phone: t.phone, name: t.name, passwordHash: DEV_PASSWORD_HASH,
    })),
    ...fxSeekers.map((x) => ({
      id: userId(x.id), email: x.email, phone: x.phone, name: x.name, passwordHash: DEV_PASSWORD_HASH,
    })),
  ]);

  await tx.insert(s.renterProfiles).values(
    fxSeekers.map((x) => ({
      userId: userId(x.id),
      incomeToRentRatio: String(x.profile.income_to_rent_ratio),
      employment: x.profile.employment,
      hasGuarantors: x.profile.has_guarantors,
      occupants: x.profile.occupants,
      pets: x.profile.pets,
      smoker: x.profile.smoker,
      leaseLengthMonths: x.profile.lease_length_months,
      priorLandlordReference: x.profile.prior_landlord_reference,
      about: x.about ?? null,
      complete: x.profile_complete,
    })),
  );

  /* ── Portfolio ───────────────────────────────────────── */

  await tx.insert(s.properties).values(
    fxProperties.map((p) => ({
      id: propId(p.id),
      ownerId: userId(p.owner_id),
      street: p.address.street,
      houseNumber: p.address.number,
      city: p.address.city,
      neighborhood: p.address.neighborhood,
      lat: String(p.address.lat),
      lng: String(p.address.lng),
      rooms: String(p.rooms),
      sqm: p.sqm,
      floor: p.floor,
      totalFloors: p.total_floors,
      amenities: p.amenities as string[],
      photos: p.photos,
      monthlyRentAgorot: money(p.monthly_rent),
      arnonaBimonthlyAgorot: money(p.arnona_bimonthly),
      vaadMonthlyAgorot: money(p.vaad_monthly),
      status: p.status,
      availableFrom: p.available_from ? day(p.available_from) : null,
      availabilityConfidence: p.availability_confidence,
      listed: p.listed,
      notes: p.notes ?? null,
    })),
  );

  await tx.insert(s.leases).values(
    fxLeases.map((l) => ({
      id: leaseId(l.id),
      propertyId: propId(l.property_id),
      tenantId: userId(l.tenant_id),
      startDate: day(l.start_date),
      endDate: day(l.end_date),
      monthlyRentAgorot: money(l.monthly_rent),
      depositAgorot: money(l.deposit),
      paymentMethod: l.payment_method,
      hasExtensionOption: l.has_extension_option,
      extensionMonths: l.extension_months ?? null,
      noticePeriodDays: l.notice_period_days,
      renewalIntent: l.renewal_intent ?? null,
      renewalAskedAt: l.renewal_asked_at ? new Date(l.renewal_asked_at) : null,
      proposedRentAgorot: l.proposed_renewal ? money(l.proposed_renewal.monthly_rent) : null,
      proposedStartDate: l.proposed_renewal ? day(l.proposed_renewal.start_date) : null,
      proposedMonths: l.proposed_renewal?.months ?? null,
      proposedSentAt: l.proposed_renewal ? new Date(l.proposed_renewal.sent_at) : null,
    })),
  );

  const guarantors = fxLeases.flatMap((l) =>
    l.guarantors.map((g, i) => ({
      id: seedId('guarantor', `${l.id}-${i}`),
      leaseId: leaseId(l.id),
      name: g.name,
      phone: g.phone,
    })),
  );
  if (guarantors.length) await tx.insert(s.leaseGuarantors).values(guarantors);

  /* ── Maintenance ─────────────────────────────────────── */

  await tx.insert(s.vendors).values(
    fxVendors.map((v) => ({
      id: vendorId(v.id),
      ownerId: v.is_network_partner ? null : userId(fxOwner.id),
      name: v.name,
      trade: v.trade,
      phone: v.phone,
      areas: v.areas,
      rating: String(v.rating),
      jobsDone: v.jobs_done,
      avgResponseHours: v.avg_response_hours,
      calloutFeeAgorot: money(v.callout_fee),
      isNetworkPartner: v.is_network_partner,
      note: v.note ?? null,
    })),
  );

  await tx.insert(s.tickets).values(
    fxTickets.map((tk) => ({
      id: ticketId(tk.id),
      propertyId: propId(tk.property_id),
      tenantId: tk.tenant_id ? userId(tk.tenant_id) : null,
      category: tk.category,
      severity: tk.severity,
      status: tk.status,
      title: tk.title,
      description: tk.description,
      photos: tk.photos,
      vendorId: tk.vendor_id ? vendorId(tk.vendor_id) : null,
      scheduledAt: tk.scheduled_at ? new Date(tk.scheduled_at) : null,
      tenantAvailability: tk.tenant_availability.map((x) => new Date(x)),
      tenantConfirmedSlot: tk.tenant_confirmed_slot ?? false,
      receiptAmountAgorot: tk.receipt ? money(tk.receipt.amount) : null,
      receiptFile: tk.receipt?.file ?? null,
      receiptUploadedAt: tk.receipt ? new Date(tk.receipt.uploaded_at) : null,
      receiptUploadedBy: tk.receipt?.uploaded_by ?? null,
      createdAt: new Date(tk.created_at),
    })),
  );

  const ticketMsgs = fxTickets.flatMap((tk) =>
    tk.messages.map((m, i) => ({
      id: seedId('ticketMessage', `${tk.id}-${i}`),
      ticketId: ticketId(tk.id),
      authorRole: m.author_role,
      authorUserId:
        m.author_role === 'tenant' && tk.tenant_id
          ? userId(tk.tenant_id)
          : m.author_role === 'owner'
            ? userId(fxOwner.id)
            : null,
      authorName: m.author_name,
      body: m.body,
      photos: m.photos ?? [],
      at: new Date(m.at),
    })),
  );
  await tx.insert(s.ticketMessages).values(ticketMsgs);

  /* ── Money ───────────────────────────────────────────── */

  await tx.insert(s.expenses).values(
    fxExpenses.map((e) => ({
      id: seedId('expense', e.id),
      propertyId: propId(e.property_id),
      kind: e.kind,
      category: e.category,
      amountAgorot: money(e.amount),
      vendorId: e.vendor_id ? vendorId(e.vendor_id) : null,
      vendorName: e.vendor_name ?? null,
      date: day(e.date),
      ticketId: e.ticket_id ? ticketId(e.ticket_id) : null,
      receiptFile: e.receipt_file ?? null,
      documentType: e.document_type,
      note: e.note ?? null,
    })),
  );

  await tx.insert(s.rentPayments).values(
    fxRentPayments.map((r) => ({
      id: seedId('rentPayment', r.id),
      propertyId: propId(r.property_id),
      leaseId: leaseId(r.lease_id),
      month: r.month,
      dueAgorot: money(r.due),
      paidAgorot: money(r.paid),
      paidAt: r.paid_at ? day(r.paid_at) : null,
      method: r.method,
    })),
  );

  /* ── Demand side ─────────────────────────────────────── */

  await tx.insert(s.leads).values(
    fxLeads.map((l) => ({
      id: seedId('lead', l.id),
      propertyId: propId(l.property_id),
      seekerId: userId(l.seeker_id),
      stage: l.stage,
      desiredMoveIn: day(l.desired_move_in),
      queuePosition: l.queue_position,
      watchOnly: l.watch_only ?? false,
      incomeToRentRatio: String(l.screening.income_to_rent_ratio),
      employment: l.screening.employment,
      hasGuarantors: l.screening.has_guarantors,
      occupants: l.screening.occupants,
      pets: l.screening.pets,
      smoker: l.screening.smoker,
      leaseLengthMonths: l.screening.lease_length_months,
      priorLandlordReference: l.screening.prior_landlord_reference,
      createdAt: new Date(l.created_at),
    })),
  );

  await tx.insert(s.availabilityInquiries).values(
    fxInquiries.map((q) => ({
      id: seedId('inquiry', q.id),
      propertyId: propId(q.property_id),
      seekerId: userId(q.seeker_id),
      message: q.message,
      desiredMoveIn: day(q.desired_move_in),
      status: q.status,
      askedTenantAt: q.asked_tenant_at ? new Date(q.asked_tenant_at) : null,
      tenantAnswer: q.tenant_answer ?? null,
      tenantAnswerNote: q.tenant_answer_note ?? null,
      tenantAnsweredAt: q.tenant_answered_at ? new Date(q.tenant_answered_at) : null,
      ownerReply: q.owner_reply ?? null,
      ownerRepliedAt: q.owner_replied_at ? new Date(q.owner_replied_at) : null,
      resultingAvailableFrom: q.resulting_available_from ? day(q.resulting_available_from) : null,
      createdAt: new Date(q.created_at),
    })),
  );

  /* ── Messaging ───────────────────────────────────────── */

  await tx.insert(s.messageThreads).values(
    fxThreads.map((th) => ({
      id: seedId('thread', th.id),
      ownerId: userId(fxOwner.id),
      subject: th.subject,
      counterpartyRole: th.counterparty_role,
      /* Vendors and the municipality are not users; only tenants and leads
         resolve to an account. */
      counterpartyUserId:
        th.counterparty_role === 'tenant' || th.counterparty_role === 'lead'
          ? userId(th.counterparty_id)
          : null,
      counterpartyName: th.counterparty_name,
      propertyId: th.property_id ? propId(th.property_id) : null,
      ticketId: th.ticket_id ? ticketId(th.ticket_id) : null,
      leadId: th.lead_id ? seedId('lead', th.lead_id) : null,
      updatedAt: new Date(th.updated_at),
    })),
  );

  await tx.insert(s.threadMessages).values(
    fxThreads.flatMap((th) =>
      th.messages.map((m) => ({
        id: seedId('threadMessage', `${th.id}-${m.id}`),
        threadId: seedId('thread', th.id),
        authorRole: m.author_role,
        authorName: m.author_name,
        body: m.body,
        read: m.read,
        at: new Date(m.at),
      })),
    ),
  );

  /* ── Screening & protocol ────────────────────────────── */

  await tx.insert(s.screeningPresets).values(
    fxPresets.map((p) => ({
      id: seedId('screeningPreset', p.id),
      ownerId: userId(fxOwner.id),
      name: p.name,
      criteria: p.criteria,
      isActive: p.is_active,
      createdAt: new Date(p.created_at),
    })),
  );

  await tx.insert(s.protocolRuns).values(
    fxProtocolRuns.map((r) => ({
      id: seedId('protocolRun', r.id),
      propertyId: propId(r.property_id),
      leaseId: r.lease_id ? leaseId(r.lease_id) : null,
      tenantId: r.tenant_id ? userId(r.tenant_id) : null,
      kind: r.kind,
      startedAt: new Date(r.started_at),
      completedAt: r.completed_at ? new Date(r.completed_at) : null,
      signed: r.signed,
    })),
  );

  await tx.insert(s.protocolEntries).values(
    fxProtocolRuns.flatMap((r) =>
      r.entries.map((e) => ({
        id: seedId('protocolEntry', `${r.id}-${e.item_id}`),
        runId: seedId('protocolRun', r.id),
        itemId: e.item_id,
        done: e.done,
        value: e.value ?? null,
        photos: e.photos,
        note: e.note ?? null,
      })),
    ),
  );
});

/* ── Report ────────────────────────────────────────────── */

const counts = await Promise.all(
  (
    [
      ['users', s.users],
      ['properties', s.properties],
      ['leases', s.leases],
      ['vendors', s.vendors],
      ['tickets', s.tickets],
      ['ticket_messages', s.ticketMessages],
      ['leads', s.leads],
      ['expenses', s.expenses],
      ['rent_payments', s.rentPayments],
      ['inquiries', s.availabilityInquiries],
      ['threads', s.messageThreads],
      ['protocol_entries', s.protocolEntries],
    ] as const
  ).map(async ([name, table]) => `${name}: ${(await db.select().from(table)).length}`),
);
console.log('seeded —', counts.join(', '));
console.log('');
console.log(`sign in with password: ${DEV_PASSWORD}`);
console.log(`  owner   ${fxOwner.email}`);
console.log(`  tenant  ${fxTenants.find((t) => t.id === 't11')?.email}  (נחלת בנימין 55)`);
console.log(`  seeker  ${fxSeekers.find((x) => x.id === 's01')?.email}`);
await sql.end();
