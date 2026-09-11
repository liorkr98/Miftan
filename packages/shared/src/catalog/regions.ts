/**
 * Israel's rental market, as geography the product can filter and group by.
 *
 * Districts are the CBS (למ״ס) administrative six, which is what every official
 * statistic is published against — so a median computed here can be compared
 * against a published one without a mapping table in between.
 *
 * The city list is the rental market, not the census: places with enough
 * long-term rental stock for a median to mean anything. A moshav with four
 * listings a year produces a number that misleads more than it informs.
 */

export type District =
  | 'jerusalem'
  | 'north'
  | 'haifa'
  | 'center'
  | 'tel_aviv'
  | 'south'
  | 'judea_samaria';

export interface CityEntry {
  /** The name as it appears on an Israeli address */
  name: string;
  district: District;
  /** Approximate centre, for map framing when a city is selected */
  lat: number;
  lng: number;
}

export const DISTRICTS: Record<District, string> = {
  jerusalem: 'מחוז ירושלים',
  north: 'מחוז הצפון',
  haifa: 'מחוז חיפה',
  center: 'מחוז המרכז',
  tel_aviv: 'מחוז תל אביב',
  south: 'מחוז הדרום',
  judea_samaria: 'אזור יהודה והשומרון',
};

export const CITIES: CityEntry[] = [
  /* תל אביב */
  { name: 'תל אביב-יפו', district: 'tel_aviv', lat: 32.0853, lng: 34.7818 },
  { name: 'רמת גן', district: 'tel_aviv', lat: 32.0684, lng: 34.8248 },
  { name: 'גבעתיים', district: 'tel_aviv', lat: 32.0719, lng: 34.8103 },
  { name: 'בני ברק', district: 'tel_aviv', lat: 32.0807, lng: 34.8338 },
  { name: 'חולון', district: 'tel_aviv', lat: 32.0117, lng: 34.7725 },
  { name: 'בת ים', district: 'tel_aviv', lat: 32.0171, lng: 34.7509 },
  { name: 'הרצליה', district: 'tel_aviv', lat: 32.1624, lng: 34.8447 },
  { name: 'רמת השרון', district: 'tel_aviv', lat: 32.1462, lng: 34.8399 },
  { name: 'אור יהודה', district: 'tel_aviv', lat: 32.0297, lng: 34.8531 },
  { name: 'קריית אונו', district: 'tel_aviv', lat: 32.0554, lng: 34.8555 },

  /* מרכז */
  { name: 'ראשון לציון', district: 'center', lat: 31.9642, lng: 34.8044 },
  { name: 'פתח תקווה', district: 'center', lat: 32.0878, lng: 34.8878 },
  { name: 'נתניה', district: 'center', lat: 32.3215, lng: 34.8532 },
  { name: 'רחובות', district: 'center', lat: 31.8928, lng: 34.8113 },
  { name: 'כפר סבא', district: 'center', lat: 32.1858, lng: 34.9077 },
  { name: 'רעננה', district: 'center', lat: 32.1848, lng: 34.8713 },
  { name: 'הוד השרון', district: 'center', lat: 32.1499, lng: 34.8886 },
  { name: 'ראש העין', district: 'center', lat: 32.0956, lng: 34.9568 },
  { name: 'רמלה', district: 'center', lat: 31.9288, lng: 34.8667 },
  { name: 'לוד', district: 'center', lat: 31.9514, lng: 34.8956 },
  { name: 'מודיעין-מכבים-רעות', district: 'center', lat: 31.8928, lng: 35.0104 },
  { name: 'נס ציונה', district: 'center', lat: 31.9293, lng: 34.7986 },
  { name: 'יבנה', district: 'center', lat: 31.8781, lng: 34.7397 },
  { name: 'גבעת שמואל', district: 'center', lat: 32.0784, lng: 34.8489 },

  /* ירושלים */
  { name: 'ירושלים', district: 'jerusalem', lat: 31.7683, lng: 35.2137 },
  { name: 'בית שמש', district: 'jerusalem', lat: 31.7497, lng: 34.9887 },
  { name: 'מבשרת ציון', district: 'jerusalem', lat: 31.7986, lng: 35.1497 },

  /* חיפה */
  { name: 'חיפה', district: 'haifa', lat: 32.794, lng: 34.9896 },
  { name: 'קריית ביאליק', district: 'haifa', lat: 32.8371, lng: 35.0805 },
  { name: 'קריית מוצקין', district: 'haifa', lat: 32.8386, lng: 35.0758 },
  { name: 'קריית ים', district: 'haifa', lat: 32.8475, lng: 35.0686 },
  { name: 'קריית אתא', district: 'haifa', lat: 32.8115, lng: 35.1129 },
  { name: 'נשר', district: 'haifa', lat: 32.7656, lng: 35.0433 },
  { name: 'טירת כרמל', district: 'haifa', lat: 32.7606, lng: 34.9719 },
  { name: 'חדרה', district: 'haifa', lat: 32.4341, lng: 34.9196 },

  /* צפון */
  { name: 'נצרת', district: 'north', lat: 32.6996, lng: 35.3035 },
  { name: 'נוף הגליל', district: 'north', lat: 32.7101, lng: 35.3173 },
  { name: 'עכו', district: 'north', lat: 32.9281, lng: 35.0818 },
  { name: 'נהריה', district: 'north', lat: 33.0058, lng: 35.0946 },
  { name: 'כרמיאל', district: 'north', lat: 32.9158, lng: 35.2951 },
  { name: 'צפת', district: 'north', lat: 32.9646, lng: 35.4960 },
  { name: 'טבריה', district: 'north', lat: 32.7922, lng: 35.5312 },
  { name: 'עפולה', district: 'north', lat: 32.6078, lng: 35.2897 },
  { name: 'קריית שמונה', district: 'north', lat: 33.2074, lng: 35.5695 },

  /* דרום */
  { name: 'באר שבע', district: 'south', lat: 31.2530, lng: 34.7915 },
  { name: 'אשדוד', district: 'south', lat: 31.8040, lng: 34.6550 },
  { name: 'אשקלון', district: 'south', lat: 31.6688, lng: 34.5715 },
  { name: 'אילת', district: 'south', lat: 29.5577, lng: 34.9519 },
  { name: 'קריית גת', district: 'south', lat: 31.6100, lng: 34.7642 },
  { name: 'דימונה', district: 'south', lat: 31.0686, lng: 35.0331 },
  { name: 'נתיבות', district: 'south', lat: 31.4222, lng: 34.5883 },
  { name: 'שדרות', district: 'south', lat: 31.5250, lng: 34.5964 },
  { name: 'ערד', district: 'south', lat: 31.2589, lng: 35.2137 },

  /* יהודה ושומרון */
  { name: 'מודיעין עילית', district: 'judea_samaria', lat: 31.9319, lng: 35.0417 },
  { name: 'אריאל', district: 'judea_samaria', lat: 32.1056, lng: 35.1872 },
  { name: 'מעלה אדומים', district: 'judea_samaria', lat: 31.7772, lng: 35.2983 },
  { name: 'ביתר עילית', district: 'judea_samaria', lat: 31.6975, lng: 35.1156 },
];

const BY_NAME = new Map(CITIES.map((c) => [c.name, c]));

export function cityEntry(name: string): CityEntry | undefined {
  return BY_NAME.get(name);
}

export function districtOf(cityName: string): District | undefined {
  return BY_NAME.get(cityName)?.district;
}

export function citiesIn(district: District): CityEntry[] {
  return CITIES.filter((c) => c.district === district);
}

/** Sorted for a select: district groups, cities alphabetical within each. */
export function citiesByDistrict(): Array<{ district: District; label: string; cities: CityEntry[] }> {
  return (Object.keys(DISTRICTS) as District[]).map((district) => ({
    district,
    label: DISTRICTS[district],
    cities: citiesIn(district).sort((a, b) => a.name.localeCompare(b.name, 'he')),
  }));
}
