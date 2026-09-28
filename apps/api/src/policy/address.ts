import { createHash } from 'node:crypto';

/**
 * What a stranger learns about where a flat is. HUMAN REVIEW.
 *
 * By default: the street, and a pin placed 100–200 metres from the building
 * in a fixed direction. Enough to judge the area; not enough to find the
 * door of a flat someone is still living in. The owner can choose to show
 * the house number and the exact pin — an agent listing a vacant flat
 * usually will. Owners and tenants always see the real address.
 *
 * The offset is derived from the unit's id, so the pin does not jump around
 * between requests (averaging many requests would otherwise reveal it).
 */
export function publicLocation(p: {
  id: string;
  houseNumber: string;
  lat: string | number;
  lng: string | number;
  showExactAddress: boolean;
}): { number: string; lat: number; lng: number } {
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (p.showExactAddress) return { number: p.houseNumber, lat, lng };

  const digest = createHash('sha256').update(`pin:${p.id}`).digest();
  const angle = (digest.readUInt16BE(0) / 65535) * 2 * Math.PI;
  const metres = 100 + (digest.readUInt16BE(2) / 65535) * 100;
  const dLat = (metres * Math.cos(angle)) / 111_320;
  const dLng = (metres * Math.sin(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    number: '',
    lat: Number((lat + dLat).toFixed(5)),
    lng: Number((lng + dLng).toFixed(5)),
  };
}
