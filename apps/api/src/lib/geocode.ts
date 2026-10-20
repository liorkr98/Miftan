import { env } from './env.ts';

/**
 * A street address to a map point, once, when an owner saves a unit.
 *
 * Without it every unit fell back to its city's centre, so all the flats in
 * Tel Aviv sat on one pin. OpenStreetMap's Nominatim is free and allowed for
 * this: one lookup per save, far below its one-request-a-second policy,
 * with a named User-Agent as the policy asks. The result is stored on the
 * unit and never looked up again unless the address changes. Anything that
 * goes wrong — a timeout, no match, a point outside Israel — returns null and
 * the caller keeps the city centre, so saving a unit never fails on a map.
 *
 * Swapping to GovMap (the official Israeli geocoder) later is this one file.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'baalabait/1.0 (support@baalabait.co.il)';
const TIMEOUT_MS = 4000;

/* Israel, generously: a hit outside this box is a wrong match. */
const BOUNDS = { south: 29.4, north: 33.4, west: 34.2, east: 35.95 };

export interface Point {
  lat: number;
  lng: number;
}

export async function geocodeAddress(address: {
  street: string;
  houseNumber: string;
  city: string;
}): Promise<Point | null> {
  /* Tests and local runs never call out. */
  if (env.NODE_ENV === 'test') return null;

  const url = new URL(ENDPOINT);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'il');
  url.searchParams.set('street', `${address.houseNumber} ${address.street}`.trim());
  url.searchParams.set('city', address.city);

  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, 'accept-language': 'he' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    if (!hit) return null;
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < BOUNDS.south || lat > BOUNDS.north || lng < BOUNDS.west || lng > BOUNDS.east) return null;
    return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
  } catch {
    return null;
  }
}
