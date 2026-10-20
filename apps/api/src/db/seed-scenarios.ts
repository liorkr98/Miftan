import { and, eq, inArray, notLike } from 'drizzle-orm';
import { districtOf, israelToday, toAgorot, zonedWallTime } from '@miftan/shared';
import { apartmentPhotos, monthKey, monthsOut } from '@miftan/fixtures';
import { schema as s } from './client.ts';
import { seedId } from '../lib/ids.ts';

/**
 * Live demo scenarios, layered over דנה's portfolio (the all-roles account).
 *
 * The other seed modules make every screen non-empty. This one makes the
 * lease lifecycle *walkable*: each flat is parked at a different moment of it,
 * with the people, times and history that moment would really have.
 *
 *   ארלוזורוב 12   — a normal active lease. Nothing needs doing.
 *   דיזנגוף 180    — renewal approaching: the window opens in about three weeks.
 *   שד׳ רוטשילד 38 — the tenant asked questions a few hours ago. Waiting for you.
 *   ביאליק 22      — you answered; the tenant has 3 days to decide.
 *   עמק רפאים 31   — the tenant is staying; the signing meeting is booked.
 *   הרצל 101       — the tenant just said they're leaving. Prepare the listing.
 *   בזל 8          — leaving, search open: real demand, applicants, viewings booked.
 *   יהודה הלוי 40  — vacant and listed: relevant applicants waiting for times.
 *   סוקולוב 9      — in renovation, off the market.
 *
 * Nothing in the app knows these are scenarios. They are ordinary rows read
 * through the ordinary API — swapping the demo for real activity is removing
 * the call to this function, nothing else. Dates are offsets from the day the
 * seed runs, so the scenarios stay "live" whenever the database is reset.
 */

type Tx = Parameters<Parameters<typeof import('./client.ts').db.transaction>[0]>[0];

const uid = (k: string) => seedId('user', k);
const pid = (k: string) => seedId('property', k);
const lid = (k: string) => seedId('lease', k);
const money = (shekels: number) => toAgorot(shekels);

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The last day of the month `months` from now — leases end on month-ends. */
function monthEnd(months: number): string {
  const first = monthsOut(months + 1, 1);
  return addDays(first, -1);
}

/** Deterministic, so a reset reproduces the same charts. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── People ─────────────────────────────────────────────── */

const FIRST = ['אור', 'נועם', 'שירה', 'עידו', 'תמר', 'אביב', 'ליאור', 'מור', 'יואב', 'הילה', 'איתמר', 'נטע', 'עומר', 'גיא', 'שני', 'אלעד', 'קרן', 'ניר', 'אדי', 'ענבל', 'יובל', 'רותם', 'אסף'];
const LAST = ['פרץ', 'ביטון', 'אזולאי', 'עמר', 'שפירא', 'גולדברג', 'חדד', 'בן דוד', 'אוחנה', 'רוזנברג', 'סגל', 'וקנין', 'טל', 'ברגר', 'אשכנזי', 'נחום', 'שמש', 'הראל', 'לביא', 'גבאי', 'זילבר', 'קורן', 'מלכה'];

interface Seeker {
  key: string;
  name: string;
  ratio: number;
  employment: 'salaried' | 'self_employed' | 'student' | 'between_jobs';
  guarantors: boolean;
  occupants: number;
  pets: boolean;
  smoker: boolean;
  months: number;
  about: string | null;
}

/** p01–p06 apply to בזל 8; the rest follow flats and some apply to יהודה הלוי. */
const SEEKERS: Seeker[] = [
  { key: 'demo-p01', name: 'רון ודנה שמש', ratio: 3.6, employment: 'salaried', guarantors: true, occupants: 2, pets: false, smoker: false, months: 24, about: 'זוג, שנינו עובדים בהייטק. מחפשים דירה לטווח ארוך קרוב לפארק.' },
  { key: 'demo-p02', name: 'יואב הראל', ratio: 4.1, employment: 'self_employed', guarantors: true, occupants: 1, pets: false, smoker: false, months: 24, about: 'אדריכל, עובד חלקית מהבית. שקט ומסודר.' },
  { key: 'demo-p03', name: 'נטע גולדברג', ratio: 3.3, employment: 'salaried', guarantors: true, occupants: 1, pets: false, smoker: false, months: 12, about: null },
  { key: 'demo-p04', name: 'עידו ותמר לביא', ratio: 3.9, employment: 'salaried', guarantors: true, occupants: 2, pets: false, smoker: false, months: 36, about: 'זוג צעיר, עוברים מירושלים לעבודה חדשה.' },
  { key: 'demo-p05', name: 'אדי קורן', ratio: 2.3, employment: 'student', guarantors: false, occupants: 2, pets: false, smoker: true, months: 12, about: 'סטודנט לתואר שני.' },
  { key: 'demo-p06', name: 'שני מלכה', ratio: 3.4, employment: 'salaried', guarantors: true, occupants: 1, pets: true, smoker: false, months: 24, about: 'עם כלבה קטנה ושקטה, בת 6.' },
  ...Array.from({ length: 18 }, (_, i): Seeker => {
    const r = rng(500 + i);
    return {
      key: `demo-p${String(i + 7).padStart(2, '0')}`,
      name: `${FIRST[(i * 7) % FIRST.length]} ${LAST[(i * 5 + 3) % LAST.length]}`,
      ratio: Math.round((2.6 + r() * 2.2) * 10) / 10,
      employment: r() > 0.2 ? 'salaried' : 'self_employed',
      guarantors: r() > 0.25,
      occupants: 1 + Math.floor(r() * 2),
      pets: r() > 0.8,
      smoker: r() > 0.9,
      months: r() > 0.5 ? 24 : 12,
      about: null,
    };
  }),
];

export async function seedScenarios(tx: Tx, passwordHash: string) {
  const dana = uid('demo-dana');
  const today = israelToday();
  const at = (days: number, hhmm: string) => zonedWallTime(addDays(today, days), hhmm);

  /* ── The cast ──────────────────────────────────────────── */

  /* The Jerusalem tenant becomes Daniel, whose renewal is the walk-through. */
  await tx
    .update(s.users)
    .set({ name: 'דניאל כהן', email: 'daniel.cohen@demo.baalabait.invalid' })
    .where(eq(s.users.id, uid('demo-t6')));

  await tx.insert(s.users).values([
    { id: uid('demo-t7'), email: 'michal.rosen@demo.baalabait.invalid', phone: '0526618834', name: 'מיכל רוזן', passwordHash },
    ...SEEKERS.map((x, i) => ({
      id: uid(x.key),
      email: `${x.key.replace('demo-', '')}@demo.baalabait.invalid`,
      phone: `05${(i % 4) + 2}${String(7300100 + i * 2417).padStart(7, '0')}`,
      name: x.name,
      passwordHash,
    })),
  ]);
  await tx.insert(s.renterProfiles).values(
    SEEKERS.map((x) => ({
      userId: uid(x.key), incomeToRentRatio: x.ratio.toFixed(2), employment: x.employment, hasGuarantors: x.guarantors,
      occupants: x.occupants, pets: x.pets, smoker: x.smoker, leaseLengthMonths: x.months,
      priorLandlordReference: x.guarantors, about: x.about, complete: true,
    })),
  );

  /* ── A ninth flat, for "the tenant asked, you haven't answered" ── */

  await tx.insert(s.properties).values({
    id: pid('demo-r'), ownerId: dana,
    street: 'שדרות רוטשילד', houseNumber: '38', city: 'תל אביב-יפו', neighborhood: 'לב העיר',
    district: districtOf('תל אביב-יפו') ?? null, lat: '32.0636', lng: '34.7741',
    rooms: '3', sqm: 76, floor: 2, totalFloors: 4,
    amenities: ['balcony', 'ac', 'renovated', 'elevator'],
    photos: apartmentPhotos(48, 3),
    monthlyRentAgorot: money(11200), arnonaBimonthlyAgorot: money(830), vaadMonthlyAgorot: money(210),
    status: 'occupied', availableFrom: null, availabilityConfidence: 'unknown', listed: true,
  });
  /* Opened five days ago (end − 90), answer due in ~25 days (end − 60). */
  const rothschildEnd = addDays(today, 85);
  await tx.insert(s.leases).values({
    id: lid('demo-r'), propertyId: pid('demo-r'), tenantId: uid('demo-t7'),
    startDate: addDays(rothschildEnd, -730), endDate: rothschildEnd,
    monthlyRentAgorot: money(11200), depositAgorot: money(22400),
    paymentMethod: 'bank_transfer', hasExtensionOption: true, extensionMonths: 12, noticePeriodDays: 60,
  });
  await tx.insert(s.rentPayments).values(
    Array.from({ length: 6 }, (_, i) => {
      const offset = i - 5;
      return {
        id: seedId('rentPayment', `demo-r-${i}`),
        propertyId: pid('demo-r'), leaseId: lid('demo-r'),
        month: monthKey(offset), dueAgorot: money(11200), paidAgorot: offset === 0 ? 0 : money(11200),
        paidAt: offset === 0 ? null : monthsOut(offset, 2), method: 'bank_transfer' as const,
      };
    }),
  );

  /* ── Lease dates, so each flat sits where its scenario needs it ── */

  /* דיזנגוף 180: the window opens in ~3 weeks (end − 90 days). */
  await tx.update(s.leases).set({ endDate: addDays(today, 112) }).where(eq(s.leases.id, lid('demo-d')));
  /* ביאליק 22: ends in ~2.5 months; the conversation is well under way. */
  await tx.update(s.leases).set({ endDate: monthEnd(2) }).where(eq(s.leases.id, lid('demo-e')));
  /* עמק רפאים 31: Daniel's lease ends on the last day of the month, 3 months out.
     A 90-day notice period opened the conversation ~120 days before. */
  await tx
    .update(s.leases)
    .set({
      startDate: addDays(monthEnd(3), -729), endDate: monthEnd(3), noticePeriodDays: 90,
      renewalIntent: 'extend', renewalAskedAt: ago(8 * DAY),
    })
    .where(eq(s.leases.id, lid('demo-g')));

  /* ── Renewal cycles ────────────────────────────────────── */

  /* ביאליק 22 — answered; three days left to decide. Replaces the base
     seed's unanswered cycle, which רוטשילד now plays. */
  await tx
    .update(s.renewalCycles)
    .set({
      stage: 'answered',
      openedAt: ago(9 * DAY),
      questions: [
        { topic: 'rent_same', text: null },
        { topic: 'other', text: 'אפשר לתקן את התריס בסלון לפני שחותמים?' },
      ],
      questionsAt: ago(3 * DAY),
      answers: [
        { topic: 'rent_same', answer: 'כן — השכירות נשארת ₪8,600 גם בשנה הבאה.' },
        { topic: 'other', answer: 'בטח. הטכנאי יגיע ביום ראשון בבוקר, לפני החתימה.' },
      ],
      answersAt: ago(1 * DAY - 2 * HOUR),
      decisionDeadline: at(3, '20:00'),
    })
    .where(eq(s.renewalCycles.id, seedId('renewalCycle', 'demo-e')));

  await tx.insert(s.renewalCycles).values([
    {
      /* רוטשילד 38 — Michal asked this morning. The owner's move. */
      id: seedId('renewalCycle', 'demo-r'), leaseId: lid('demo-r'), propertyId: pid('demo-r'),
      stage: 'questions', openedAt: ago(5 * DAY),
      questions: [
        { topic: 'rent_same', text: null },
        { topic: 'other', text: 'אפשר לחתום הפעם לשנתיים? נוח לנו לדעת שאנחנו כאן עד 2028.' },
      ],
      questionsAt: ago(4 * HOUR),
    },
    {
      /* עמק רפאים 31 — Daniel is staying; the meeting is booked. */
      id: seedId('renewalCycle', 'demo-g'), leaseId: lid('demo-g'), propertyId: pid('demo-g'),
      stage: 'staying', openedAt: ago(11 * DAY), decision: 'stay', decidedAt: ago(8 * DAY),
    },
    {
      /* בזל 8 — Omri is leaving; the search has been open for two weeks. */
      id: seedId('renewalCycle', 'demo-b'), leaseId: lid('demo-b'), propertyId: pid('demo-b'),
      stage: 'leaving', openedAt: ago(21 * DAY), decision: 'leave', decidedAt: ago(19 * DAY),
      moveOutDate: monthsOut(2, 15),
      requirementsConfirmedAt: ago(17 * DAY), watchersInvitedAt: ago(17 * DAY),
    },
    {
      /* הרצל 101 — Shira said "leaving" last night. The search opens on its
         own in ~28 hours unless the owner reviews it first. */
      id: seedId('renewalCycle', 'demo-f'), leaseId: lid('demo-f'), propertyId: pid('demo-f'),
      stage: 'leaving', openedAt: ago(30 * DAY), decision: 'leave', decidedAt: ago(20 * HOUR),
      moveOutDate: monthsOut(1, 1),
    },
  ]);

  await tx.insert(s.renewalMeetingSlots).values([
    { id: seedId('meetingSlot', 'demo-g1'), cycleId: seedId('renewalCycle', 'demo-g'), startsAt: at(2, '17:00'), status: 'booked', bookedAt: ago(2 * DAY) },
    { id: seedId('meetingSlot', 'demo-g2'), cycleId: seedId('renewalCycle', 'demo-g'), startsAt: at(2, '17:30') },
    { id: seedId('meetingSlot', 'demo-g3'), cycleId: seedId('renewalCycle', 'demo-g'), startsAt: at(3, '18:00') },
  ]);

  /* ── Demand ────────────────────────────────────────────── */

  const lead = (
    key: string,
    flat: string,
    seeker: string,
    o: { stage?: 'new' | 'screening' | 'viewing_scheduled' | 'viewed'; watch?: boolean; createdDaysAgo: number; moveIn: string },
  ) => {
    const x = SEEKERS.find((p) => p.key === seeker)!;
    return {
      id: seedId('lead', key), propertyId: pid(`demo-${flat}`), seekerId: uid(seeker),
      stage: o.stage ?? 'new', desiredMoveIn: o.moveIn, queuePosition: 1, watchOnly: Boolean(o.watch),
      incomeToRentRatio: x.ratio.toFixed(2), employment: x.employment, hasGuarantors: x.guarantors, occupants: x.occupants,
      pets: x.pets, smoker: x.smoker, leaseLengthMonths: x.months, priorLandlordReference: x.guarantors,
      createdAt: ago(o.createdDaysAgo * DAY + (key.length % 7) * HOUR),
    };
  };

  const baselMoveIn = monthsOut(2, 15);
  const watchersOf = (from: number, to: number) => SEEKERS.slice(from, to).map((x) => x.key);

  await tx.insert(s.leads).values([
    /* בזל 8: six more applications (nine in all, six relevant) and eighteen
       people waiting to hear. */
    lead('demo-b-p01', 'b', 'demo-p01', { stage: 'viewing_scheduled', createdDaysAgo: 6, moveIn: addDays(baselMoveIn, 0) }),
    lead('demo-b-p02', 'b', 'demo-p02', { stage: 'viewing_scheduled', createdDaysAgo: 4, moveIn: addDays(baselMoveIn, 15) }),
    lead('demo-b-p03', 'b', 'demo-p03', { stage: 'viewed', createdDaysAgo: 14, moveIn: addDays(baselMoveIn, -10) }),
    lead('demo-b-p04', 'b', 'demo-p04', { stage: 'viewed', createdDaysAgo: 12, moveIn: addDays(baselMoveIn, 0) }),
    lead('demo-b-p05', 'b', 'demo-p05', { createdDaysAgo: 3, moveIn: addDays(baselMoveIn, 30) }),
    lead('demo-b-p06', 'b', 'demo-p06', { createdDaysAgo: 1, moveIn: addDays(baselMoveIn, 0) }),
    ...watchersOf(6, 24).map((k, i) => lead(`demo-b-w${i}`, 'b', k, { watch: true, createdDaysAgo: 2 + ((i * 7) % 38), moveIn: baselMoveIn })),

    /* יהודה הלוי 40: three new applications, two of them relevant and
       still without a viewing; seven watching. */
    lead('demo-c-p17', 'c', 'demo-p17', { createdDaysAgo: 2, moveIn: addDays(today, 20) }),
    lead('demo-c-p18', 'c', 'demo-p18', { createdDaysAgo: 3, moveIn: addDays(today, 30) }),
    lead('demo-c-p19', 'c', 'demo-p19', { createdDaysAgo: 5, moveIn: addDays(today, 90) }),
    ...watchersOf(8, 15).map((k, i) => lead(`demo-c-w${i}`, 'c', k, { watch: true, createdDaysAgo: 4 + i * 5, moveIn: addDays(today, 30) })),

    /* הרצל 101: four more people asking to be told when it frees up. */
    ...watchersOf(19, 23).map((k, i) => lead(`demo-f-w${i}`, 'f', k, { watch: true, createdDaysAgo: 3 + i * 6, moveIn: monthsOut(1, 1) })),
  ]);

  /* The relevant c applicants need a profile that clears the bar there:
     a 1.5-room flat allows two occupants. */
  await tx
    .update(s.leads)
    .set({ incomeToRentRatio: '3.80', employment: 'salaried', hasGuarantors: true, occupants: 1, pets: false })
    .where(inArray(s.leads.id, [seedId('lead', 'demo-c-p17'), seedId('lead', 'demo-c-p18')]));
  await tx
    .update(s.leads)
    .set({ incomeToRentRatio: '2.10', employment: 'student', hasGuarantors: false })
    .where(eq(s.leads.id, seedId('lead', 'demo-c-p19')));

  /* ── Viewings on בזל 8 ─────────────────────────────────── */

  const slot = (key: string, startsAt: Date, holder?: { lead: string; status: 'booked' | 'attended'; bookedDaysAgo: number }) => ({
    id: seedId('viewingSlot', key), propertyId: pid('demo-b'), ownerId: dana, startsAt, durationMinutes: 15,
    status: holder?.status ?? ('open' as const),
    leadId: holder ? seedId('lead', holder.lead) : null,
    bookedAt: holder ? ago(holder.bookedDaysAgo * DAY) : null,
  });

  await tx.insert(s.viewingSlots).values([
    /* Last week: two viewings that happened. */
    slot('demo-b-a1', at(-5, '18:00'), { lead: 'demo-b-p03', status: 'attended', bookedDaysAgo: 9 }),
    slot('demo-b-a2', at(-5, '18:15'), { lead: 'demo-b-p04', status: 'attended', bookedDaysAgo: 8 }),
    /* Tomorrow, 17:30–19:00. */
    slot('demo-b-t1', at(1, '17:30'), { lead: 'demo-x2', status: 'booked', bookedDaysAgo: 3 }),
    slot('demo-b-t2', at(1, '17:45'), { lead: 'demo-b-p01', status: 'booked', bookedDaysAgo: 2 }),
    slot('demo-b-t3', at(1, '18:00')),
    slot('demo-b-t4', at(1, '18:15')),
    slot('demo-b-t5', at(1, '18:30')),
    slot('demo-b-t6', at(1, '18:45')),
    /* The day after, 18:00–19:30. */
    slot('demo-b-u1', at(2, '18:00'), { lead: 'demo-b-p02', status: 'booked', bookedDaysAgo: 1 }),
    slot('demo-b-u2', at(2, '18:15')),
    slot('demo-b-u3', at(2, '18:30'), { lead: 'demo-x0', status: 'booked', bookedDaysAgo: 1 }),
    slot('demo-b-u4', at(2, '18:45')),
    slot('demo-b-u5', at(2, '19:00')),
    slot('demo-b-u6', at(2, '19:15')),
  ]);
  /* Roni (x0) and Maya (x2) are the base seed's applicants; their stage follows the booking. */
  await tx
    .update(s.leads)
    .set({ stage: 'viewing_scheduled' })
    .where(inArray(s.leads.id, [seedId('lead', 'demo-x0'), seedId('lead', 'demo-x2')]));

  /* One viewing on יהודה הלוי that already happened. */
  await tx.insert(s.viewingSlots).values({
    id: seedId('viewingSlot', 'demo-c-a1'), propertyId: pid('demo-c'), ownerId: dana, startsAt: at(-12, '19:00'),
    durationMinutes: 15, status: 'attended', leadId: seedId('lead', 'demo-x3'), bookedAt: ago(15 * DAY),
  });

  /* ── Listing views ─────────────────────────────────────────
     Three months of daily traffic, shaped by what happened to each flat:
     בזל 8 jumps when the tenant gives notice, יהודה הלוי fades as the
     listing ages, occupied flats tick over. One row per person per day,
     the same rule the live counter uses. */

  const SHAPES: Record<string, (d: number, r: () => number) => number> = {
    b: (d, r) => (d <= 17 ? 5 + r() * 5 + (d % 7 < 2 ? 3 : 0) : d <= 19 ? 4 + r() * 2 : r() * 2.6),
    c: (d, r) => (d <= 70 ? 1.5 + (d / 70) * 9 + r() * 3 : r() * 2),
    f: (d, r) => (d <= 25 ? 2 + r() * 3 : r() * 1.8),
    r: (_d, r) => r() * 2.4,
    a: (_d, r) => r() * 1.6,
    d: (d, r) => r() * 2.2 + (d <= 10 ? 0.6 : 0),
    e: (_d, r) => r() * 1.8,
    g: (_d, r) => r() * 1.4,
  };
  const DAYS = 120;

  const views: { id: string; propertyId: string; viewerKey: string; day: string; at: Date }[] = [];
  const addSeries = (propertyId: string, perDay: (d: number, r: () => number) => number, seed: number) => {
    const r = rng(seed);
    const pool: string[] = [];
    for (let d = DAYS - 1; d >= 0; d--) {
      const day = addDays(today, -d);
      const n = Math.max(0, Math.round(perDay(d, r)));
      const seen = new Set<string>();
      for (let i = 0; i < n; i++) {
        /* About one in five comes back for another look. */
        let key = pool.length && r() < 0.2 ? pool[Math.floor(r() * pool.length)] : `a:seed-${propertyId}-${pool.length}`;
        if (seen.has(key)) key = `a:seed-${propertyId}-${pool.length}`;
        if (!pool.includes(key)) pool.push(key);
        seen.add(key);
        views.push({ id: seedId('listingView', `${propertyId}-${day}-${i}`), propertyId, viewerKey: key, day, at: zonedWallTime(day, `${String(8 + (i % 14)).padStart(2, '0')}:00`) });
      }
    }
  };

  Object.entries(SHAPES).forEach(([flat, shape], i) => addSeries(pid(`demo-${flat}`), shape, 1000 + i));

  /* Everyone who applied or asked to be told looked at the flat first. */
  const seekerLeads = await tx
    .select({ propertyId: s.leads.propertyId, seekerId: s.leads.seekerId, createdAt: s.leads.createdAt })
    .from(s.leads)
    .innerJoin(s.properties, eq(s.properties.id, s.leads.propertyId))
    .where(eq(s.properties.ownerId, dana));
  for (const l of seekerLeads) {
    const day = israelToday(new Date(l.createdAt.getTime() - DAY));
    views.push({ id: seedId('listingView', `${l.propertyId}-${l.seekerId}`), propertyId: l.propertyId, viewerKey: `u:${l.seekerId}`, day, at: new Date(l.createdAt.getTime() - DAY) });
  }

  /* The fixture landlord's listed flats get ordinary background traffic, so
     his charts are not empty either. */
  const others = await tx
    .select({ id: s.properties.id })
    .from(s.properties)
    .where(and(eq(s.properties.listed, true), notLike(s.properties.id, '%demo%')));
  others.forEach(({ id }, i) => addSeries(id, (_d, r) => r() * (1.5 + (i % 4)), 2000 + i));

  for (let i = 0; i < views.length; i += 1000) {
    await tx.insert(s.listingViews).values(views.slice(i, i + 1000)).onConflictDoNothing();
  }
}
