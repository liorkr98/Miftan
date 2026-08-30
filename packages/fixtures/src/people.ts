import { type Owner, type Tenant, type Seeker } from '@miftan/shared';
import { monthsOut } from './clock';

export const owner: Owner = {
  id: 'own-1',
  name: 'רן אלמוג',
  phone: '0524418890',
  email: 'ran@almog-nadlan.co.il',
  company: 'אלמוג נכסים',
};

export const tenants: Tenant[] = [
  { id: 't01', name: 'נועה בן־חיים', phone: '0546621093', email: 'noa.bh@gmail.com', lease_id: 'l01' },
  { id: 't02', name: 'איתי שרעבי', phone: '0503317742', email: 'itay.sharabi@gmail.com', lease_id: 'l02' },
  { id: 't03', name: 'שירה מלכה', phone: '0527749018', email: 'shira.malka@walla.co.il', lease_id: 'l03' },
  { id: 't04', name: 'יונתן אדרי', phone: '0585523104', email: 'yoni.edri@gmail.com', lease_id: 'l04' },
  { id: 't05', name: 'משפחת רוזנברג', phone: '0544180276', email: 'rosenberg.fam@gmail.com', lease_id: 'l05' },
  { id: 't06', name: 'דנה קלמן', phone: '0508842315', email: 'dana.kalman@gmail.com', lease_id: 'l06' },
  { id: 't08', name: 'עומר לביא', phone: '0523390877', email: 'omer.lavie@gmail.com', lease_id: 'l08' },
  { id: 't09', name: 'רותם אזולאי', phone: '0546670241', email: 'rotem.azoulay@gmail.com', lease_id: 'l09' },
  { id: 't10', name: 'אלון פרץ', phone: '0587712664', email: 'alon.peretz@gmail.com', lease_id: 'l10' },
  { id: 't11', name: 'מיכל שטרן', phone: '0521104488', email: 'michal.stern@gmail.com', lease_id: 'l11' },
  { id: 't12', name: 'תומר גבאי', phone: '0559930127', email: 'tomer.gabay@gmail.com', lease_id: 'l12' },
  { id: 't13', name: 'ליאור נחמיאס', phone: '0542218806', email: 'lior.nahmias@gmail.com', lease_id: 'l13' },
  { id: 't15', name: 'אורי ביטון', phone: '0503364419', email: 'ori.biton@gmail.com', lease_id: 'l15' },
  { id: 't17', name: 'הילה ורדי', phone: '0528871350', email: 'hila.vardi@gmail.com', lease_id: 'l17' },
  { id: 't18', name: 'משפחת דהן', phone: '0546614472', email: 'dahan.family@gmail.com', lease_id: 'l18' },
  { id: 't19', name: 'ניר אשכנזי', phone: '0585590213', email: 'nir.ashkenazi@gmail.com', lease_id: 'l19' },
  { id: 't20', name: 'יעל צור', phone: '0524473908', email: 'yael.tzur@gmail.com', lease_id: 'l20' },
  { id: 't21', name: 'עדי חסון', phone: '0507728164', email: 'adi.hasson@gmail.com', lease_id: 'l21' },
];

/**
 * The demo's "logged in" tenant: מיכל שטרן at נחלת בנימין 55.
 *
 * Chosen because that unit's availability is genuinely undecided and the demo
 * seeker has an open inquiry on it — so seeker → owner → tenant → owner → seeker
 * can be walked end to end without switching identities mid-story.
 */
export const DEMO_TENANT_ID = 't11';

/** The demo's "logged in" seeker — has a queue, an incomplete-then-complete profile. */
export const DEMO_SEEKER_ID = 's01';

export const seekers: Seeker[] = [
  {
    id: 's01', name: 'טל אבירם', phone: '0546639921', email: 'tal.aviram@gmail.com',
    profile_complete: true,
    about: 'עובד בהייטק בתל אביב, מחפש דירה שקטה עם מרפסת. גמיש בתאריך כניסה עד חודש.',
    profile: { income_to_rent_ratio: 3.6, employment: 'salaried', has_guarantors: true, occupants: 2, pets: false, smoker: false, lease_length_months: 24, prior_landlord_reference: true },
  },
  { id: 's02', name: 'מאיה הרוש', phone: '0523318874', email: 'maya.harush@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 4.1, employment: 'salaried', has_guarantors: true, occupants: 1, pets: false, smoker: false, lease_length_months: 12, prior_landlord_reference: true } },
  { id: 's03', name: 'עידן מזרחי', phone: '0508817203', email: 'idan.mizrahi@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 2.4, employment: 'self_employed', has_guarantors: false, occupants: 2, pets: true, smoker: false, lease_length_months: 12, prior_landlord_reference: false } },
  { id: 's04', name: 'שני קורן', phone: '0547780116', email: 'shani.koren@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 3.2, employment: 'salaried', has_guarantors: true, occupants: 3, pets: false, smoker: false, lease_length_months: 24, prior_landlord_reference: true } },
  { id: 's05', name: 'רועי שלו', phone: '0521193345', email: 'roi.shalev@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 5.0, employment: 'salaried', has_guarantors: true, occupants: 2, pets: false, smoker: false, lease_length_months: 36, prior_landlord_reference: true } },
  { id: 's06', name: 'נטע אלבז', phone: '0585564920', email: 'neta.elbaz@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 2.9, employment: 'student', has_guarantors: true, occupants: 2, pets: false, smoker: true, lease_length_months: 12, prior_landlord_reference: false } },
  { id: 's07', name: 'גיא סבן', phone: '0503342718', email: 'guy.saban@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 3.8, employment: 'self_employed', has_guarantors: true, occupants: 1, pets: true, smoker: false, lease_length_months: 24, prior_landlord_reference: true } },
  { id: 's08', name: 'עינב דרור', phone: '0546628841', email: 'einav.dror@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 3.4, employment: 'salaried', has_guarantors: false, occupants: 2, pets: false, smoker: false, lease_length_months: 24, prior_landlord_reference: true } },
  { id: 's09', name: 'אסף גולן', phone: '0527713096', email: 'asaf.golan@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 4.4, employment: 'salaried', has_guarantors: true, occupants: 4, pets: false, smoker: false, lease_length_months: 36, prior_landlord_reference: true } },
  { id: 's10', name: 'ליהי ברקת', phone: '0508893472', email: 'lihi.bareket@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 3.1, employment: 'salaried', has_guarantors: true, occupants: 2, pets: false, smoker: false, lease_length_months: 12, prior_landlord_reference: false } },
  { id: 's11', name: 'דור חמו', phone: '0542206683', email: 'dor.hamo@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 2.7, employment: 'between_jobs', has_guarantors: true, occupants: 1, pets: false, smoker: false, lease_length_months: 12, prior_landlord_reference: true } },
  { id: 's12', name: 'רוני אלפסי', phone: '0585517724', email: 'roni.alfasi@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 3.9, employment: 'self_employed', has_guarantors: true, occupants: 3, pets: true, smoker: false, lease_length_months: 24, prior_landlord_reference: true } },
  { id: 's13', name: 'יובל שמש', phone: '0521140057', email: 'yuval.shemesh@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 4.7, employment: 'salaried', has_guarantors: true, occupants: 2, pets: false, smoker: false, lease_length_months: 24, prior_landlord_reference: true } },
  { id: 's14', name: 'אור בן־דוד', phone: '0546695518', email: 'or.bendavid@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 3.0, employment: 'student', has_guarantors: true, occupants: 3, pets: false, smoker: true, lease_length_months: 12, prior_landlord_reference: false } },
  { id: 's15', name: 'תמר לוגסי', phone: '0503379960', email: 'tamar.logasi@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 3.5, employment: 'salaried', has_guarantors: false, occupants: 1, pets: false, smoker: false, lease_length_months: 24, prior_landlord_reference: true } },
  { id: 's16', name: 'נדב אוחיון', phone: '0527764413', email: 'nadav.ohayon@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 2.2, employment: 'self_employed', has_guarantors: false, occupants: 2, pets: true, smoker: true, lease_length_months: 12, prior_landlord_reference: false } },
  { id: 's17', name: 'ספיר נגר', phone: '0585548802', email: 'sapir.nagar@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 4.2, employment: 'salaried', has_guarantors: true, occupants: 2, pets: false, smoker: false, lease_length_months: 36, prior_landlord_reference: true } },
  { id: 's18', name: 'איתמר כהן', phone: '0542291174', email: 'itamar.cohen@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 3.3, employment: 'salaried', has_guarantors: true, occupants: 4, pets: false, smoker: false, lease_length_months: 24, prior_landlord_reference: true } },
  { id: 's19', name: 'הדר פרידמן', phone: '0508826690', email: 'hadar.friedman@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 3.7, employment: 'salaried', has_guarantors: true, occupants: 1, pets: false, smoker: false, lease_length_months: 12, prior_landlord_reference: true } },
  { id: 's20', name: 'בר סויסה', phone: '0546683327', email: 'bar.suissa@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 2.6, employment: 'student', has_guarantors: true, occupants: 2, pets: false, smoker: false, lease_length_months: 12, prior_landlord_reference: false } },
  { id: 's21', name: 'עומרי ברזילי', phone: '0521167738', email: 'omri.barzilai@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 4.9, employment: 'salaried', has_guarantors: true, occupants: 3, pets: false, smoker: false, lease_length_months: 36, prior_landlord_reference: true } },
  { id: 's22', name: 'ליאת אביטן', phone: '0585536041', email: 'liat.avitan@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 3.6, employment: 'self_employed', has_guarantors: true, occupants: 2, pets: true, smoker: false, lease_length_months: 24, prior_landlord_reference: true } },
  { id: 's23', name: 'יהונתן סגל', phone: '0503391182', email: 'yehonatan.segal@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 3.1, employment: 'salaried', has_guarantors: false, occupants: 2, pets: false, smoker: false, lease_length_months: 12, prior_landlord_reference: true } },
  { id: 's24', name: 'מור אליאס', phone: '0546607753', email: 'mor.elias@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 2.8, employment: 'salaried', has_guarantors: true, occupants: 1, pets: false, smoker: false, lease_length_months: 24, prior_landlord_reference: false } },
  { id: 's25', name: 'אביב רוזן', phone: '0527798806', email: 'aviv.rozen@gmail.com', profile_complete: true,
    profile: { income_to_rent_ratio: 4.0, employment: 'salaried', has_guarantors: true, occupants: 3, pets: false, smoker: false, lease_length_months: 24, prior_landlord_reference: true } },
];

/** Default move-in the seeker profile page starts from */
export const DEFAULT_MOVE_IN = monthsOut(2, 1);
