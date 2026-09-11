import { DEFAULT_CRITERIA, toAgorot } from '@miftan/shared';
import { daysAgo, monthKey, monthsOut, photo, slotAt } from '@miftan/fixtures';
import { schema as s } from './client.ts';
import { seedId } from '../lib/ids.ts';

/**
 * One account that holds all three roles at once.
 *
 * The three ordinary demo logins each hold exactly one relationship, which is
 * realistic — almost nobody both lets a flat and rents one — but it makes the
 * product impossible to *show*. Walking someone through the owner, tenant and
 * seeker sides means signing out twice, and the thread of the story breaks each
 * time.
 *
 * So: Dana owns three flats, rents the one she lives in from another landlord,
 * and is queueing for somewhere bigger. Every screen in the app is one click
 * from every other screen.
 *
 * Everything here is **additive**. Nothing is taken from רן's portfolio and no
 * existing row is edited, so the single-role logins still demo exactly what
 * they demoed before — including his 22 units.
 */

export const DEMO_EMAIL = 'dana@miftan-demo.co.il';
export const DEMO_NAME = 'דנה לוי';

const uid = (k: string) => seedId('user', k);
const pid = (k: string) => seedId('property', k);
const lid = (k: string) => seedId('lease', k);
const money = (shekels: number) => toAgorot(shekels);

type Tx = Parameters<Parameters<typeof import('./client.ts').db.transaction>[0]>[0];

export async function seedDemoAccount(tx: Tx, passwordHash: string) {
  const dana = uid('demo-dana');
  /* Dana rents from someone who is not רן, so her tenant view is a genuine
     third-party relationship rather than a landlord renting from herself. */
  const herLandlord = uid('demo-landlord');

  await tx.insert(s.users).values([
    { id: dana, email: DEMO_EMAIL, phone: '0526640912', name: DEMO_NAME, passwordHash },
    {
      id: herLandlord,
      email: 'oren.segev@miftan-demo.co.il',
      phone: '0542218806',
      name: 'אורן שגב',
      passwordHash,
    },
    /* Two tenants for the flats Dana lets. */
    { id: uid('demo-t1'), email: 'yael.avraham@miftan-demo.co.il', phone: '0503319947', name: 'יעל אברהם', passwordHash },
    { id: uid('demo-t2'), email: 'omri.katz@miftan-demo.co.il', phone: '0547781162', name: 'עמרי כץ', passwordHash },
  ]);

  /* ── Dana as owner: three flats, deliberately in three different states ── */

  await tx.insert(s.properties).values([
    {
      id: pid('demo-a'), ownerId: dana,
      street: 'ארלוזורוב', houseNumber: '12', city: 'תל אביב-יפו', neighborhood: 'הצפון הישן',
      lat: '32.0854', lng: '34.7745',
      rooms: '3', sqm: 68, floor: 2, totalFloors: 4,
      amenities: ['balcony', 'ac', 'elevator'],
      photos: [photo('miftan-demo-a1'), photo('miftan-demo-a2')],
      monthlyRentAgorot: money(9200), arnonaBimonthlyAgorot: money(880), vaadMonthlyAgorot: money(180),
      status: 'occupied', availableFrom: null, availabilityConfidence: 'unknown', listed: true,
    },
    {
      /* Vacating with a confirmed date — the state the departures board exists
         to make legible. */
      id: pid('demo-b'), ownerId: dana,
      street: 'בזל', houseNumber: '8', city: 'תל אביב-יפו', neighborhood: 'הצפון הישן',
      lat: '32.0897', lng: '34.7812',
      rooms: '2.5', sqm: 55, floor: 1, totalFloors: 3,
      amenities: ['balcony', 'ac', 'renovated'],
      photos: [photo('miftan-demo-b1'), photo('miftan-demo-b2')],
      monthlyRentAgorot: money(8100), arnonaBimonthlyAgorot: money(710), vaadMonthlyAgorot: money(140),
      status: 'vacating', availableFrom: monthsOut(2, 15), availabilityConfidence: 'confirmed', listed: true,
    },
    {
      /* Empty today, so the seeker side has something she can act on now. */
      id: pid('demo-c'), ownerId: dana,
      street: 'יהודה הלוי', houseNumber: '40', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
      lat: '32.0631', lng: '34.7739',
      rooms: '1.5', sqm: 38, floor: 4, totalFloors: 6,
      amenities: ['ac', 'elevator'],
      photos: [photo('miftan-demo-c1')],
      monthlyRentAgorot: money(6300), arnonaBimonthlyAgorot: money(520), vaadMonthlyAgorot: money(110),
      status: 'vacant', availableFrom: null, availabilityConfidence: 'confirmed', listed: true,
    },
    {
      /* Not hers — this is the flat she lives in. */
      id: pid('demo-home'), ownerId: herLandlord,
      street: 'מונטיפיורי', houseNumber: '5', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
      lat: '32.0648', lng: '34.7761',
      rooms: '4', sqm: 92, floor: 3, totalFloors: 5,
      amenities: ['balcony', 'ac', 'elevator', 'parking'],
      photos: [photo('miftan-demo-home1'), photo('miftan-demo-home2')],
      monthlyRentAgorot: money(11800), arnonaBimonthlyAgorot: money(1120), vaadMonthlyAgorot: money(260),
      status: 'occupied', availableFrom: null, availabilityConfidence: 'unknown', listed: false,
    },
  ]);

  await tx.insert(s.leases).values([
    {
      id: lid('demo-a'), propertyId: pid('demo-a'), tenantId: uid('demo-t1'),
      startDate: monthsOut(-14, 1), endDate: monthsOut(10, 1),
      monthlyRentAgorot: money(9200), depositAgorot: money(18400),
      paymentMethod: 'bank_transfer', hasExtensionOption: true, extensionMonths: 12, noticePeriodDays: 60,
    },
    {
      id: lid('demo-b'), propertyId: pid('demo-b'), tenantId: uid('demo-t2'),
      startDate: monthsOut(-22, 15), endDate: monthsOut(2, 15),
      monthlyRentAgorot: money(8100), depositAgorot: money(16200),
      paymentMethod: 'standing_order', hasExtensionOption: false, noticePeriodDays: 60,
      /* He has said he is going, which is why the unit shows a confirmed date. */
      renewalIntent: 'leave', renewalAskedAt: new Date(daysAgo(19)),
    },
    {
      /* Dana's own tenancy. This row is the whole reason the account has a
         דייר tab at all. */
      id: lid('demo-home'), propertyId: pid('demo-home'), tenantId: dana,
      startDate: monthsOut(-8, 1), endDate: monthsOut(16, 1),
      monthlyRentAgorot: money(11800), depositAgorot: money(23600),
      paymentMethod: 'bank_transfer', hasExtensionOption: true, extensionMonths: 12, noticePeriodDays: 60,
    },
  ]);

  /* ── Maintenance, from both ends ─────────────────────────────────────────
     One ticket she has to approve as a landlord, one she raised as a tenant.
     Switching roles then shows the same flow from the other side, which is the
     single most useful thing to be able to demo. */

  await tx.insert(s.tickets).values([
    {
      id: seedId('ticket', 'demo-in'), propertyId: pid('demo-a'), tenantId: uid('demo-t1'),
      category: 'boiler', severity: 'medium', status: 'new',
      title: 'אין מים חמים בבוקר',
      description: 'כבר שלושה ימים שאין מים חמים לפני 9:00. אחר כך זה עובד.',
      tenantAvailability: [new Date(slotAt(2, 9)), new Date(slotAt(3, 17))],
    },
    {
      id: seedId('ticket', 'demo-out'), propertyId: pid('demo-home'), tenantId: dana,
      category: 'leak', severity: 'urgent', status: 'assigned',
      title: 'רטיבות בתקרת חדר הרחצה',
      description: 'כתם שהולך וגדל מאז סוף השבוע. השכן מלמעלה אומר שאין אצלו נזילה.',
      scheduledAt: new Date(slotAt(1, 11)),
      tenantConfirmedSlot: true,
    },
  ]);

  await tx.insert(s.ticketMessages).values([
    {
      id: seedId('ticketMessage', 'demo-in-1'), ticketId: seedId('ticket', 'demo-in'),
      authorRole: 'tenant', authorUserId: uid('demo-t1'), authorName: 'יעל אברהם',
      body: 'כבר שלושה ימים שאין מים חמים לפני 9:00. אחר כך זה עובד.',
    },
    {
      id: seedId('ticketMessage', 'demo-out-1'), ticketId: seedId('ticket', 'demo-out'),
      authorRole: 'tenant', authorUserId: dana, authorName: DEMO_NAME,
      body: 'כתם שהולך וגדל מאז סוף השבוע. השכן מלמעלה אומר שאין אצלו נזילה.',
    },
    {
      id: seedId('ticketMessage', 'demo-out-2'), ticketId: seedId('ticket', 'demo-out'),
      authorRole: 'owner', authorUserId: herLandlord, authorName: 'אורן שגב',
      body: 'שלחתי אינסטלטור למחר ב־11:00. תודה שצילמת.',
    },
  ]);

  /* ── Money, so the finance screens are not empty ─────────────────────── */

  const rent = [
    { key: 'a', property: 'demo-a', lease: 'demo-a', amount: 9200 },
    { key: 'b', property: 'demo-b', lease: 'demo-b', amount: 8100 },
  ];
  await tx.insert(s.rentPayments).values(
    rent.flatMap(({ key, property, lease, amount }) =>
      /* Twelve months back. Everything settled except the month in progress,
         so the collection bar on the dashboard is not a flat 100%. */
      Array.from({ length: 12 }, (_, i) => {
        const offset = -(11 - i);
        const current = offset === 0;
        return {
          id: seedId('rentPayment', `demo-${key}-${i}`),
          propertyId: pid(property),
          leaseId: lid(lease),
          month: monthKey(offset),
          dueAgorot: money(amount),
          paidAgorot: current ? 0 : money(amount),
          paidAt: current ? null : monthsOut(offset, 3),
          method: 'bank_transfer' as const,
        };
      }),
    ),
  );

  /* ── Dana as seeker ──────────────────────────────────────────────────────
     A complete profile, because the queue endpoint refuses an incomplete one —
     screening on blanks is worse than not screening. */

  await tx.insert(s.renterProfiles).values({
    userId: dana,
    incomeToRentRatio: '4.20',
    employment: 'salaried',
    hasGuarantors: true,
    occupants: 3,
    pets: false,
    smoker: false,
    leaseLengthMonths: 24,
    priorLandlordReference: true,
    about: 'משפחה עם ילד אחד, מחפשים משהו גדול יותר באותו אזור.',
    complete: true,
  });

  /* Queueing on two of רן's flats. Reading these back as Dana shows a position
     and a total and no other applicant — the privacy boundary, visible. */
  await tx.insert(s.leads).values([
    {
      id: seedId('lead', 'demo-q1'), propertyId: seedId('property', 'p02'), seekerId: dana,
      stage: 'viewing_scheduled', desiredMoveIn: monthsOut(2, 1), queuePosition: 4, watchOnly: false,
      incomeToRentRatio: '4.20', employment: 'salaried', hasGuarantors: true,
      occupants: 3, pets: false, smoker: false, leaseLengthMonths: 24, priorLandlordReference: true,
    },
    {
      id: seedId('lead', 'demo-q2'), propertyId: seedId('property', 'p18'), seekerId: dana,
      stage: 'new', desiredMoveIn: monthsOut(4, 1), queuePosition: 3, watchOnly: true,
      incomeToRentRatio: '4.20', employment: 'salaried', hasGuarantors: true,
      occupants: 3, pets: false, smoker: false, leaseLengthMonths: 24, priorLandlordReference: true,
    },
  ]);

  /* An inquiry she opened as a seeker, and one landed on her as an owner — so
     both ends of the availability chain are reachable from one login. */
  await tx.insert(s.availabilityInquiries).values([
    {
      id: seedId('inquiry', 'demo-asked'), propertyId: seedId('property', 'p11'), seekerId: dana,
      message: 'שלום, יש סיכוי שהדירה תתפנה לקראת הקיץ? אנחנו גמישים בתאריך.',
      desiredMoveIn: monthsOut(5, 1), status: 'new',
    },
    {
      id: seedId('inquiry', 'demo-received'), propertyId: pid('demo-b'), seekerId: uid('demo-t1'),
      message: 'ראיתי שהדירה מתפנה בקרוב — אפשר לתאם ביקור לפני שהיא עולה?',
      desiredMoveIn: monthsOut(2, 20), status: 'new',
    },
  ]);

  /* Her own screening preset, so leads on her flats get scored rather than
     coming back with an empty rule set. */
  await tx.insert(s.screeningPresets).values({
    id: seedId('screeningPreset', 'demo'),
    ownerId: dana,
    name: 'ברירת מחדל',
    criteria: DEFAULT_CRITERIA,
    isActive: true,
  });
}
