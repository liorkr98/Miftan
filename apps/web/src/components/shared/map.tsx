import * as React from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { formatDateShort, formatMoneyShort, type Property } from '@miftach/shared';
import type { AvailabilityKind } from '@/data/selectors';
import { AVAILABILITY_COLOR } from './status';

/**
 * Pin design carries the product's argument.
 *
 * An apartment with a known free-date is the thing worth looking at, so it
 * gets the amber fill and shows the date — it is the loudest pin on the map,
 * louder than "free now". Occupied-without-a-date recedes. A flat amber dot
 * would vanish over OSM's tan roads, so every pin keeps a 2px white ring and
 * a dark shadow to hold contrast against the raster.
 */
function pinIcon(
  kind: AvailabilityKind,
  price: string,
  date: string | undefined,
  active: boolean,
): L.DivIcon {
  const dot = AVAILABILITY_COLOR[kind];
  const dated = kind === 'dated';
  const recedes = kind === 'unknown' || kind === 'extending';

  const bg = dated ? 'var(--color-signal)' : 'var(--color-ink)';
  const fg = dated ? 'var(--color-ink)' : 'var(--color-on-ink)';
  const scale = active ? 1.14 : dated ? 1 : recedes ? 0.9 : 1;
  const label = dated && date ? `${price} · ${date}` : price;

  return L.divIcon({
    className: 'miftach-pin',
    html: `
      <div style="transform:translate(-50%,-100%) scale(${scale});transform-origin:bottom center;
                  display:flex;flex-direction:column;align-items:center;
                  opacity:${recedes && !active ? 0.82 : 1};
                  transition:transform 150ms cubic-bezier(.25,1,.5,1)">
        <div style="display:flex;align-items:center;gap:4px;
                    background:${bg};color:${fg};
                    border:2px solid #fff;border-radius:999px;
                    padding:2px 7px 2px 5px;white-space:nowrap;
                    box-shadow:0 2px 7px rgb(0 0 0 / .3);
                    font:600 ${dated ? 11 : 10}px/1.1 'IBM Plex Mono',ui-monospace,monospace;
                    direction:ltr">
          <span style="width:${dated ? 7 : 6}px;height:${dated ? 7 : 6}px;border-radius:999px;
                       background:${dated ? 'var(--color-ink)' : dot};flex:none"></span>
          ${label}
        </div>
        <div style="width:2px;height:6px;background:${bg};border-radius:0 0 2px 2px"></div>
      </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/**
 * Leaflet measures its container once, at init. On mobile the map starts
 * inside a `display:none` branch of the list/map toggle, so it initialises at
 * zero size and renders blank when revealed. Observing the container and
 * calling invalidateSize covers that and any pane resize.
 */
function KeepSized() {
  const map = useMap();
  React.useEffect(() => {
    const el = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    observer.observe(el);
    /* One pass after mount for the case where the observer fires before
       layout settles. */
    const id = window.setTimeout(() => map.invalidateSize({ animate: false }), 60);
    return () => {
      observer.disconnect();
      window.clearTimeout(id);
    };
  }, [map]);
  return null;
}

/** Keeps the viewport in step with the filtered result set. */
function FitBounds({ properties }: { properties: Property[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (properties.length === 0) return;
    const bounds = L.latLngBounds(
      properties.map((p) => [p.address.lat, p.address.lng] as [number, number]),
    );
    const fit = () => {
      map.invalidateSize({ animate: false });
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: true });
    };
    fit();
    const id = window.setTimeout(fit, 80);
    return () => window.clearTimeout(id);
  }, [map, properties]);
  return null;
}

export function ResultsMap({
  properties,
  kindOf,
  activeId,
  onSelect,
  className,
}: {
  properties: Property[];
  kindOf: (property: Property) => AvailabilityKind;
  activeId?: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <MapContainer
      center={[32.062, 34.775]}
      zoom={13}
      /* Leaflet's tile fade sets each tile to opacity 0 and animates it up.
         When the map mounts hidden (the mobile list/map toggle) that ramp
         never completes and the tiles stay invisible even though they loaded.
         No fade means opacity is never zeroed — and product UI shouldn't be
         animating a basemap in anyway. */
      fadeAnimation={false}
      scrollWheelZoom
      className={className}
      style={{ background: 'var(--color-surface-sunk)' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <KeepSized />
      <FitBounds properties={properties} />
      {properties.map((property) => (
        <Marker
          key={property.id}
          position={[property.address.lat, property.address.lng]}
          icon={pinIcon(
            kindOf(property),
            formatMoneyShort(property.monthly_rent),
            property.available_from ? formatDateShort(property.available_from) : undefined,
            activeId === property.id,
          )}
          eventHandlers={{ click: () => onSelect(property.id) }}
          zIndexOffset={activeId === property.id ? 1000 : kindOf(property) === 'dated' ? 500 : 0}
        />
      ))}
    </MapContainer>
  );
}
