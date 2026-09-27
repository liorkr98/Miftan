import { districtOf, toAgorot } from '@miftan/shared';
import { daysAgo, hoursAgo, monthKey, monthsOut, photo, slotAt } from '@miftan/fixtures';
import { schema as s } from './client.ts';
import { seedId } from '../lib/ids.ts';

/**
 * A fuller portfolio for דנה, the all-roles demo account.
 *
 * Three flats demo the mechanics; they do not demo a *working week*. This adds
 * five more flats in every state, their tenants, a queue of applicants across
 * every lead stage, inquiries at every step of the availability chain, faults
 * in every ticket status, committed contract scans, a year of rent with the
 * usual late payer, expenses and message threads — so every owner screen has
 * something real to sort, filter and act on.
 *
 * Prices are taken from Midrag's published averages for the Israeli market
 * (plumber visit ₪263–340, AC cleaning ₪360–549, 3-room painting ₪3,532–5,328,
 * cockroach treatment up to 4 rooms ₪333–439, electric-boiler element
 * ₪361–447), so the expense screen reads like a real one.
 *
 * Additive only, like seed-demo.ts: nothing existing is edited.
 */

const uid = (k: string) => seedId('user', k);
const pid = (k: string) => seedId('property', k);
const lid = (k: string) => seedId('lease', k);
const money = (shekels: number) => toAgorot(shekels);

type Tx = Parameters<Parameters<typeof import('./client.ts').db.transaction>[0]>[0];

const FLATS = [
  {
    key: 'd', street: 'דיזנגוף', number: '180', city: 'תל אביב-יפו', hood: 'הצפון הישן', lat: '32.0876', lng: '34.7740',
    rooms: '3.5', sqm: 82, floor: 3, total: 5, rent: 10400, amenities: ['balcony', 'ac', 'elevator', 'renovated'],
    status: 'occupied' as const, tenant: 'demo-t3', leaseFrom: -10, leaseTo: 14,
  },
  {
    key: 'e', street: 'ביאליק', number: '22', city: 'רמת גן', hood: 'מרכז העיר', lat: '32.0823', lng: '34.8143',
    rooms: '4', sqm: 95, floor: 5, total: 8, rent: 8600, amenities: ['balcony', 'ac', 'elevator', 'parking', 'mamad'],
    status: 'occupied' as const, tenant: 'demo-t4', leaseFrom: -20, leaseTo: 4, intent: 'undecided' as const,
  },
  {
    key: 'f', street: 'הרצל', number: '101', city: 'חיפה', hood: 'הדר', lat: '32.8114', lng: '34.9985',
    rooms: '3', sqm: 70, floor: 2, total: 4, rent: 4300, amenities: ['balcony'],
    status: 'vacating' as const, tenant: 'demo-t5', leaseFrom: -23, leaseTo: 1, intent: 'leave' as const, availableFrom: 1,
  },
  {
    key: 'g', street: 'עמק רפאים', number: '31', city: 'ירושלים', hood: 'המושבה הגרמנית', lat: '31.7621', lng: '35.2188',
    rooms: '4.5', sqm: 110, floor: 1, total: 3, rent: 9800, amenities: ['balcony', 'ac', 'parking', 'mamad', 'furnished'],
    status: 'occupied' as const, tenant: 'demo-t6', leaseFrom: -4, leaseTo: 20, intent: 'extend' as const,
  },
  {
    key: 'h', street: 'סוקולוב', number: '9', city: 'הרצליה', hood: 'מרכז', lat: '32.1657', lng: '34.8440',
    rooms: '2', sqm: 48, floor: 0, total: 3, rent: 5900, amenities: ['ac', 'renovated'],
    status: 'renovating' as const, availableFrom: 1, listed: false,
  },
];

const TENANTS = [
  { key: 'demo-t3', name: 'נועה ברק', email: 'noa.barak@demo.baalabait.invalid', phone: '0528812044' },
  { key: 'demo-t4', name: 'אלון מזרחי', email: 'alon.mizrahi@demo.baalabait.invalid', phone: '0546620371' },
  { key: 'demo-t5', name: 'שירה גולן', email: 'shira.golan@demo.baalabait.invalid', phone: '0503347710' },
  { key: 'demo-t6', name: 'משפחת פרידמן', email: 'friedman@demo.baalabait.invalid', phone: '0524419983' },
];

const SEEKERS = [
  { key: 'demo-s1', name: 'רוני אלמוג', ratio: '3.80', employment: 'salaried', guarantors: true, occupants: 2, pets: false, smoker: false, months: 24, ref: true },
  { key: 'demo-s2', name: 'איתי שמעוני', ratio: '2.40', employment: 'self_employed', guarantors: false, occupants: 1, pets: true, smoker: false, months: 12, ref: false },
  { key: 'demo-s3', name: 'מאיה דהן', ratio: '4.60', employment: 'salaried', guarantors: true, occupants: 3, pets: false, smoker: false, months: 36, ref: true },
  { key: 'demo-s4', name: 'גל ויינברג', ratio: '3.10', employment: 'student', guarantors: true, occupants: 2, pets: false, smoker: true, months: 12, ref: false },
  { key: 'demo-s5', name: 'דניאל אוחיון', ratio: '5.20', employment: 'salaried', guarantors: true, occupants: 4, pets: true, smoker: false, months: 24, ref: true },
  { key: 'demo-s6', name: 'הדר לנדאו', ratio: '3.50', employment: 'salaried', guarantors: false, occupants: 1, pets: false, smoker: false, months: 24, ref: true },
  { key: 'demo-s7', name: 'יונתן קליין', ratio: '2.90', employment: 'between_jobs', guarantors: true, occupants: 2, pets: false, smoker: false, months: 12, ref: true },
  { key: 'demo-s8', name: 'ליה עזרא', ratio: '4.00', employment: 'self_employed', guarantors: true, occupants: 2, pets: false, smoker: false, months: 24, ref: true },
];

export async function seedExtraDemo(tx: Tx, passwordHash: string) {
  const dana = uid('demo-dana');
  const email = (k: string) => `${k.replace('demo-', '')}@demo.baalabait.invalid`;

  /* ── People ─────────────────────────────────────────── */
  await tx.insert(s.users).values([
    ...TENANTS.map((x) => ({ id: uid(x.key), email: x.email, phone: x.phone, name: x.name, passwordHash })),
    ...SEEKERS.map((x, i) => ({
      id: uid(x.key), email: email(x.key), phone: `05${2 + (i % 3)}${String(4410200 + i * 1731).padStart(7, '0')}`,
      name: x.name, passwordHash,
    })),
  ]);

  await tx.insert(s.renterProfiles).values(
    SEEKERS.map((x) => ({
      userId: uid(x.key), incomeToRentRatio: x.ratio, employment: x.employment, hasGuarantors: x.guarantors,
      occupants: x.occupants, pets: x.pets, smoker: x.smoker, leaseLengthMonths: x.months,
      priorLandlordReference: x.ref, complete: true,
    })),
  );

  /* ── Five more flats, one per state worth showing ─────── */
  await tx.insert(s.properties).values(
    FLATS.map((f) => ({
      id: pid(`demo-${f.key}`), ownerId: dana,
      street: f.street, houseNumber: f.number, city: f.city, neighborhood: f.hood,
      district: districtOf(f.city) ?? null, lat: f.lat, lng: f.lng,
      rooms: f.rooms, sqm: f.sqm, floor: f.floor, totalFloors: f.total,
      amenities: f.amenities,
      photos: [photo(`miftan-demo-${f.key}1`), photo(`miftan-demo-${f.key}2`)],
      monthlyRentAgorot: money(f.rent),
      arnonaBimonthlyAgorot: money(Math.round(f.sqm * 11)),
      vaadMonthlyAgorot: money(f.floor > 2 ? 220 : 140),
      status: f.status,
      availableFrom: 'availableFrom' in f && f.availableFrom !== undefined ? monthsOut(f.availableFrom, 1) : null,
      availabilityConfidence: f.status === 'vacating' ? ('confirmed' as const) : ('unknown' as const),
      listed: 'listed' in f ? f.listed : true,
    })),
  );

  const leased = FLATS.filter((f): f is (typeof FLATS)[number] & { tenant: string; leaseFrom: number; leaseTo: number } =>
    'tenant' in f && Boolean(f.tenant),
  );
  await tx.insert(s.leases).values(
    leased.map((f) => ({
      id: lid(`demo-${f.key}`), propertyId: pid(`demo-${f.key}`), tenantId: uid(f.tenant),
      startDate: monthsOut(f.leaseFrom, 1), endDate: monthsOut(f.leaseTo, 1),
      monthlyRentAgorot: money(f.rent), depositAgorot: money(f.rent * 2),
      paymentMethod: f.key === 'f' ? ('post_dated_checks' as const) : ('bank_transfer' as const),
      hasExtensionOption: f.key !== 'f', extensionMonths: f.key !== 'f' ? 12 : null, noticePeriodDays: 60,
      renewalIntent: 'intent' in f ? f.intent : null,
      renewalAskedAt: 'intent' in f ? new Date(daysAgo(12)) : null,
    })),
  );

  /* ── A year of rent, with a late payer on ביאליק ────────── */
  await tx.insert(s.rentPayments).values(
    leased.flatMap((f) =>
      Array.from({ length: 12 }, (_, i) => {
        const offset = -(11 - i);
        if (offset < f.leaseFrom) return [];
        const current = offset === 0;
        const late = f.key === 'e' && offset >= -1;
        const paid = current || late ? (late && !current ? Math.round(f.rent / 2) : 0) : f.rent;
        return [{
          id: seedId('rentPayment', `demo-${f.key}-${i}`),
          propertyId: pid(`demo-${f.key}`), leaseId: lid(`demo-${f.key}`),
          month: monthKey(offset), dueAgorot: money(f.rent), paidAgorot: money(paid),
          paidAt: paid > 0 ? monthsOut(offset, late ? 18 : 2) : null,
          method: f.key === 'f' ? ('post_dated_checks' as const) : ('bank_transfer' as const),
        }];
      }).flat(),
    ),
  );

  /* ── Faults, one in every status ─────────────────────── */
  const v = (k: string) => seedId('vendor', k);
  const tickets = [
    { k: 'x1', flat: 'd', tenant: 'demo-t3', cat: 'ac', sev: 'medium', status: 'new', title: 'המזגן בסלון מטפטף', body: 'מים נוזלים מהיחידה הפנימית כשהמזגן עובד יותר משעה.' },
    { k: 'x2', flat: 'e', tenant: 'demo-t4', cat: 'plumbing', sev: 'urgent', status: 'approved', title: 'סתימה בכיור המטבח', body: 'המים לא יורדים בכלל מאז אתמול בערב.', estimate: 420 },
    { k: 'x3', flat: 'g', tenant: 'demo-t6', cat: 'electrical', sev: 'medium', status: 'assigned', vendor: 'v02', title: 'שקע בחדר השינה לא עובד', body: 'גם אחרי שהחלפנו מפסק. השקע השני בחדר עובד.', scheduled: 2 },
    { k: 'x4', flat: 'd', tenant: 'demo-t3', cat: 'lock', sev: 'low', status: 'in_progress', vendor: 'v04', title: 'המנעול בדלת הכניסה נתקע', body: 'צריך לסובב חזק מאוד כדי לפתוח.', scheduled: 0 },
    { k: 'x5', flat: 'a', tenant: 'demo-t1', cat: 'boiler', sev: 'medium', status: 'awaiting_receipt', vendor: 'v08', title: 'גוף חימום בדוד החשמל', body: 'הטכנאי החליף גוף חימום, מחכים לקבלה.', scheduled: -3 },
    { k: 'x6', flat: 'e', tenant: 'demo-t4', cat: 'other', sev: 'low', status: 'closed', vendor: 'v06', title: 'ג׳וקים במטבח', body: 'ראינו כמה בלילה ליד הכיור.', scheduled: -20, receipt: 390 },
    { k: 'x7', flat: 'g', tenant: 'demo-t6', cat: 'ac', sev: 'low', status: 'closed', vendor: 'v03', title: 'ניקוי מזגנים לפני הקיץ', body: 'ניקוי שני מזגנים עיליים.', scheduled: -45, receipt: 900 },
    { k: 'x8', flat: 'f', tenant: 'demo-t5', cat: 'leak', sev: 'urgent', status: 'new', title: 'נזילה מהתקרה באמבטיה', body: 'טפטוף מהתקרה, השכן מלמעלה לא בבית.' },
  ] as const;

  await tx.insert(s.tickets).values(
    tickets.map((x) => ({
      id: seedId('ticket', `demo-${x.k}`), propertyId: pid(`demo-${x.flat}`), tenantId: uid(x.tenant),
      category: x.cat, severity: x.sev, status: x.status, title: x.title, description: x.body,
      vendorId: 'vendor' in x ? v(x.vendor) : null,
      scheduledAt: 'scheduled' in x ? new Date(slotAt(x.scheduled, 10)) : null,
      tenantAvailability: x.status === 'new' || x.status === 'approved' ? [new Date(slotAt(2, 9)), new Date(slotAt(3, 17))] : [],
      tenantConfirmedSlot: 'scheduled' in x,
      estimateAgorot: 'estimate' in x ? money(x.estimate) : null,
      receiptAmountAgorot: 'receipt' in x ? money(x.receipt) : null,
      receiptFile: 'receipt' in x ? photo(`miftan-receipt-${x.k}`, 600, 800) : null,
      receiptUploadedAt: 'receipt' in x ? new Date(daysAgo(Math.abs(x.scheduled) - 1)) : null,
      receiptUploadedBy: 'receipt' in x ? ('vendor' as const) : null,
      createdAt: new Date(daysAgo('scheduled' in x ? Math.abs(x.scheduled) + 2 : 1)),
    })),
  );

  await tx.insert(s.ticketMessages).values(
    tickets.map((x) => ({
      id: seedId('ticketMessage', `demo-${x.k}-1`), ticketId: seedId('ticket', `demo-${x.k}`),
      authorRole: 'tenant' as const, authorUserId: uid(x.tenant),
      authorName: TENANTS.find((t) => t.key === x.tenant)?.name ?? 'יעל אברהם', body: x.body,
    })),
  );

  /* ── Expenses: the two closed faults, plus the usual year ─── */
  await tx.insert(s.expenses).values([
    { id: seedId('expense', 'demo-x6'), propertyId: pid('demo-e'), kind: 'maintenance' as const, category: 'other', amountAgorot: money(390), vendorId: v('v06'), vendorName: 'דרור הדברה', date: daysAgo(20).slice(0, 10), ticketId: seedId('ticket', 'demo-x6'), documentType: 'tax_invoice' as const },
    { id: seedId('expense', 'demo-x7'), propertyId: pid('demo-g'), kind: 'maintenance' as const, category: 'ac', amountAgorot: money(900), vendorId: v('v03'), vendorName: 'קור־טק מיזוג אוויר', date: daysAgo(45).slice(0, 10), ticketId: seedId('ticket', 'demo-x7'), documentType: 'tax_invoice' as const },
    { id: seedId('expense', 'demo-e1'), propertyId: pid('demo-h'), kind: 'improvement' as const, category: 'paint', amountAgorot: money(3900), vendorName: 'ניר צביעה ושיפוצים', date: daysAgo(9).slice(0, 10), documentType: 'tax_invoice' as const, note: 'צביעת דירת 2 חדרים ריקה, לפני השכרה' },
    { id: seedId('expense', 'demo-e2'), propertyId: pid('demo-h'), kind: 'improvement' as const, category: 'plumbing', amountAgorot: money(2750), vendorName: 'אבי כהן — אינסטלציה', date: daysAgo(15).slice(0, 10), documentType: 'receipt' as const, note: 'החלפת ברזים וסיפונים' },
    { id: seedId('expense', 'demo-e3'), propertyId: pid('demo-d'), kind: 'maintenance' as const, category: 'insurance', amountAgorot: money(1850), vendorName: 'ביטוח מבנה', date: daysAgo(120).slice(0, 10), documentType: 'tax_invoice' as const },
    { id: seedId('expense', 'demo-e4'), propertyId: pid('demo-f'), kind: 'maintenance' as const, category: 'boiler', amountAgorot: money(410), vendorName: 'רם אינסטלציה ודודי שמש', date: daysAgo(70).slice(0, 10), documentType: 'receipt' as const, note: 'החלפת גוף חימום' },
  ]);

  /* ── Applicants across every stage ──────────────────── */
  const stages = ['new', 'screening', 'viewing_scheduled', 'viewed', 'offer', 'rejected', 'new', 'screening'] as const;
  const targets = ['b', 'b', 'b', 'c', 'c', 'f', 'f', 'd'];
  await tx.insert(s.leads).values(
    SEEKERS.map((x, i) => ({
      id: seedId('lead', `demo-x${i}`), propertyId: pid(`demo-${targets[i]}`), seekerId: uid(x.key),
      stage: stages[i], desiredMoveIn: monthsOut(1 + (i % 4), 1),
      queuePosition: targets.slice(0, i).filter((t) => t === targets[i]).length + 1,
      watchOnly: i === 6,
      incomeToRentRatio: x.ratio, employment: x.employment, hasGuarantors: x.guarantors, occupants: x.occupants,
      pets: x.pets, smoker: x.smoker, leaseLengthMonths: x.months, priorLandlordReference: x.ref,
      createdAt: new Date(daysAgo(2 + i * 3)),
    })),
  );

  /* ── Inquiries at every step of the chain ───────────── */
  await tx.insert(s.availabilityInquiries).values([
    {
      id: seedId('inquiry', 'demo-x1'), propertyId: pid('demo-e'), seekerId: uid('demo-s3'),
      message: 'אנחנו משפחה עם שני ילדים, מחפשים 4 חדרים ברמת גן לספטמבר. יש סיכוי שהדירה תתפנה?',
      desiredMoveIn: monthsOut(5, 1), status: 'asked_tenant', askedTenantAt: new Date(daysAgo(2)),
    },
    {
      id: seedId('inquiry', 'demo-x2'), propertyId: pid('demo-d'), seekerId: uid('demo-s1'),
      message: 'הדירה נראית מושלמת בשבילנו. מתי בערך היא עשויה להתפנות?',
      desiredMoveIn: monthsOut(12, 1), status: 'answered', askedTenantAt: new Date(daysAgo(6)),
      tenantAnswer: 'too_early' as const, tenantAnswerNote: 'עוד מוקדם לי להחליט, אדע לקראת החורף.', tenantAnsweredAt: new Date(daysAgo(3)),
    },
    {
      id: seedId('inquiry', 'demo-x3'), propertyId: pid('demo-g'), seekerId: uid('demo-s5'),
      message: 'שלום, מחפשים דירה גדולה במושבה הגרמנית. האם הדירה צפויה להתפנות השנה?',
      desiredMoveIn: monthsOut(6, 1), status: 'replied', askedTenantAt: new Date(daysAgo(14)),
      tenantAnswer: 'extend' as const, tenantAnsweredAt: new Date(daysAgo(12)),
      ownerReply: 'תודה על הפנייה. הדיירים מאריכים, כך שהדירה לא תתפנה השנה. אשמח לעדכן אם משהו ישתנה.', ownerRepliedAt: new Date(daysAgo(11)),
    },
    {
      id: seedId('inquiry', 'demo-x4'), propertyId: pid('demo-a'), seekerId: uid('demo-s6'),
      message: 'יש סיכוי שהדירה בארלוזורוב תתפנה בקיץ הבא?',
      desiredMoveIn: monthsOut(9, 1), status: 'new', createdAt: new Date(hoursAgo(5)),
    },
    {
      id: seedId('inquiry', 'demo-x5'), propertyId: pid('demo-e'), seekerId: uid('demo-s8'),
      message: 'רק רציתי לדעת אם אפשר לשריין כבר עכשיו.',
      desiredMoveIn: monthsOut(3, 1), status: 'declined', ownerRepliedAt: new Date(daysAgo(20)),
      ownerReply: 'עדיין לא ידוע מתי הדירה תתפנה, לכן אני לא משריין בשלב הזה.',
    },
  ]);

  /* ── Committed contract scans ───────────────────────── */
  const field = (key: string, label: string, value: string, confidence = 1) => ({
    key, label, value, confidence, sourceHint: 'אושר על ידי הבעלים', needsReview: false,
  });
  await tx.insert(s.contractScans).values(
    leased.slice(0, 3).map((f) => {
      const tenant = TENANTS.find((t) => t.key === f.tenant)!;
      return {
        id: seedId('contractScan', `demo-${f.key}`), ownerId: dana, propertyId: pid(`demo-${f.key}`),
        fileName: `חוזה שכירות — ${f.street} ${f.number}.pdf`, status: 'committed' as const,
        fields: [
          field('monthlyRent', 'שכר דירה חודשי', String(f.rent)),
          field('startDate', 'תחילת החוזה', monthsOut(f.leaseFrom, 1)),
          field('endDate', 'סיום החוזה', monthsOut(f.leaseTo, 1)),
          field('deposit', 'פיקדון', String(f.rent * 2)),
          field('noticePeriodDays', 'תקופת הודעה מוקדמת', '60'),
          field('tenantName', 'שם השוכר', tenant.name),
          field('address', 'כתובת הנכס', `${f.street} ${f.number}, ${f.city}`),
        ],
        missing: [],
        uploadedAt: new Date(monthsOut(f.leaseFrom, 1)),
        committedAt: new Date(monthsOut(f.leaseFrom, 2)),
      };
    }),
  );

  /* ── Messages ───────────────────────────────────────── */
  const threads = [
    { k: 't3', role: 'tenant' as const, user: 'demo-t3', name: 'נועה ברק', flat: 'd', subject: 'המזגן בסלון', msgs: [['tenant', 'היי דנה, המזגן בסלון מטפטף שוב. פתחתי תקלה באפליקציה.'], ['owner', 'ראיתי, תודה. אשבץ טכנאי מחר.']] },
    { k: 't4', role: 'tenant' as const, user: 'demo-t4', name: 'אלון מזרחי', flat: 'e', subject: 'תשלום שכירות', msgs: [['tenant', 'היי, השכירות של החודש תיכנס באיחור של כמה ימים. מצטער.'], ['owner', 'בסדר, תודה שעדכנת. תעדכן כשהעברת.'], ['tenant', 'העברתי חצי היום, את השאר ב־15 לחודש.']] },
    { k: 's5', role: 'lead' as const, user: 'demo-s5', name: 'דניאל אוחיון', flat: 'c', subject: 'ביקור ביהודה הלוי', msgs: [['lead', 'אפשר לבוא לראות את הדירה ביום חמישי אחר הצהריים?'], ['owner', 'כן, 17:30 מתאים?']] },
  ];
  await tx.insert(s.messageThreads).values(
    threads.map((x) => ({
      id: seedId('thread', `demo-${x.k}`), ownerId: dana, subject: x.subject, counterpartyRole: x.role,
      counterpartyUserId: uid(x.user), counterpartyName: x.name, propertyId: pid(`demo-${x.flat}`),
    })),
  );
  await tx.insert(s.threadMessages).values(
    threads.flatMap((x) =>
      x.msgs.map(([role, body], i) => ({
        id: seedId('threadMessage', `demo-${x.k}-${i}`), threadId: seedId('thread', `demo-${x.k}`),
        authorRole: role as 'owner' | 'tenant' | 'lead', authorName: role === 'owner' ? 'דנה לוי' : x.name, body,
        /* The last message from the other side is unread, so the badge shows. */
        read: role === 'owner' || i < x.msgs.length - 1,
        at: new Date(hoursAgo((x.msgs.length - i) * 7)),
      })),
    ),
  );
}
