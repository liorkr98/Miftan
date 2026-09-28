import { and, eq, isNull } from 'drizzle-orm';
import { cityEntry } from '@miftan/shared';
import { db, schema as s } from '../db/client.ts';
import { geocodeAddress } from './geocode.ts';

/**
 * Units saved before address lookup existed still sit on their city's
 * centre point. After boot, look each one up once, a second apart to stay
 * inside Nominatim's policy. A unit leaves the list as soon as it has its own
 * point, so this finishes by itself and later boots find nothing to do. A
 * unit whose address cannot be found is left where it is.
 */
const PAUSE_MS = 1100;
const MAX_PER_BOOT = 300;

export async function backfillCityCentrePins(log: (msg: string) => void): Promise<void> {
  const rows = await db
    .select({
      id: s.properties.id,
      street: s.properties.street,
      houseNumber: s.properties.houseNumber,
      city: s.properties.city,
      lat: s.properties.lat,
      lng: s.properties.lng,
    })
    .from(s.properties)
    .where(isNull(s.properties.deletedAt));

  const onCentre = rows.filter((r) => {
    const c = cityEntry(r.city);
    return c && Number(r.lat) === c.lat && Number(r.lng) === c.lng;
  });
  if (onCentre.length === 0) return;

  let moved = 0;
  for (const row of onCentre.slice(0, MAX_PER_BOOT)) {
    const found = await geocodeAddress(row);
    if (found) {
      await db
        .update(s.properties)
        .set({ lat: String(found.lat), lng: String(found.lng) })
        .where(and(eq(s.properties.id, row.id), eq(s.properties.lat, row.lat)));
      moved += 1;
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  log(`pins: ${moved} of ${onCentre.length} city-centre units moved to their address`);
}
