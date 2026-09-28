import * as React from 'react';
import { CITIES, t, type OwnerProperty } from '@miftan/shared';
import { useCreateProperty, useUpdateProperty } from '@/api/hooks';
import { useStore } from '@/data/store';
import { Button } from '@/components/ui/button';
import {
  Checkbox,
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@/components/ui/field';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const AMENITIES = [
  'elevator', 'parking', 'balcony', 'mamad', 'furnished',
  'ac', 'pets_allowed', 'storage', 'accessible', 'renovated',
] as const;
type Amenity = (typeof AMENITIES)[number];

const STATUSES = ['vacant', 'occupied', 'vacating', 'renovating'] as const;
type Status = (typeof STATUSES)[number];

const shekels = (agorot: number) => String(Math.round(agorot / 100));
const num = (raw: string) => Number(raw.replace(/[^\d.]/g, ''));

/**
 * One form for adding a unit and for correcting it later.
 *
 * Editing used to be impossible: the unit page could only toggle "listed",
 * so a typo in the street, a rent change or a new air conditioner stayed
 * wrong forever. Amenities matter beyond display — the seasonal maintenance
 * templates only apply to units that have the thing being maintained.
 */
export function PropertyFormDialog({
  open,
  onOpenChange,
  property,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  property?: OwnerProperty;
  onSaved?: (id: string) => void;
}) {
  const create = useCreateProperty();
  const update = useUpdateProperty();
  const pushToast = useStore((s) => s.pushToast);
  const editing = Boolean(property);

  const initial = React.useMemo(
    () => ({
      street: property?.address.street ?? '',
      houseNumber: property?.address.number ?? '',
      city: property?.address.city ?? CITIES[0]?.name ?? '',
      neighborhood: property?.address.neighborhood ?? '',
      rooms: property ? String(property.rooms) : '3',
      sqm: property ? String(property.sqm) : '70',
      floor: property ? String(property.floor) : '2',
      totalFloors: property ? String(property.totalFloors) : '4',
      rent: property ? shekels(property.monthlyRentAgorot) : '7200',
      arnona: property ? shekels(property.arnonaBimonthlyAgorot) : '',
      vaad: property ? shekels(property.vaadMonthlyAgorot) : '',
      amenities: new Set((property?.amenities ?? []) as Amenity[]),
      status: (property?.status ?? 'vacant') as Status,
      listed: property?.listed ?? false,
    }),
    [property],
  );
  const [form, setForm] = React.useState(initial);
  /* Reopening the dialog starts from what is saved, not from an abandoned edit. */
  React.useEffect(() => {
    if (open) setForm(initial);
  }, [open, initial]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleAmenity = (a: Amenity, on: boolean) =>
    setForm((f) => {
      const next = new Set(f.amenities);
      if (on) next.add(a);
      else next.delete(a);
      return { ...f, amenities: next };
    });

  const body = {
    street: form.street,
    houseNumber: form.houseNumber,
    city: form.city,
    neighborhood: form.neighborhood,
    rooms: num(form.rooms) || 3,
    sqm: Math.round(num(form.sqm)) || 70,
    floor: Math.round(num(form.floor)) || 0,
    totalFloors: Math.round(num(form.totalFloors)) || 1,
    monthlyRentShekels: Math.round(num(form.rent)) || 0,
    arnonaBimonthlyShekels: Math.round(num(form.arnona)) || 0,
    vaadMonthlyShekels: Math.round(num(form.vaad)) || 0,
    amenities: [...form.amenities],
    status: form.status,
    listed: form.listed,
  };

  const done = (id: string) => {
    pushToast(t.ui.saved, 'success');
    onOpenChange(false);
    onSaved?.(id);
  };

  const submit = () => {
    if (property) update.mutate({ id: property.id, ...body }, { onSuccess: (p) => done(p.id) });
    else create.mutate(body, { onSuccess: (p) => done(p.id) });
  };

  const valid = Boolean(form.street && form.houseNumber && form.neighborhood);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t.properties.editTitle : t.properties.addPropertyTitle}</DialogTitle>
          <DialogDescription>{editing ? t.properties.editHint : t.properties.addPropertyHint}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t.properties.street} htmlFor="pf-street" className="sm:col-span-2">
              <Input id="pf-street" value={form.street} onChange={(e) => set('street', e.target.value)} />
            </Field>
            <Field label={t.properties.houseNumber} htmlFor="pf-num">
              <Input id="pf-num" value={form.houseNumber} onChange={(e) => set('houseNumber', e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.properties.city} htmlFor="pf-city">
              <Select value={form.city} onValueChange={(v) => set('city', v)}>
                <SelectTrigger id="pf-city">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CITIES.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t.properties.neighborhood} htmlFor="pf-hood">
              <Input id="pf-hood" value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label={t.properties.rooms} htmlFor="pf-rooms">
              <Input id="pf-rooms" dir="ltr" inputMode="decimal" className="num" value={form.rooms} onChange={(e) => set('rooms', e.target.value)} />
            </Field>
            <Field label={t.properties.sqm} htmlFor="pf-sqm">
              <Input id="pf-sqm" dir="ltr" inputMode="numeric" className="num" value={form.sqm} onChange={(e) => set('sqm', e.target.value)} />
            </Field>
            <Field label={t.properties.floor} htmlFor="pf-floor">
              <Input id="pf-floor" dir="ltr" inputMode="numeric" className="num" value={form.floor} onChange={(e) => set('floor', e.target.value)} />
            </Field>
            <Field label={t.properties.totalFloors} htmlFor="pf-tf">
              <Input id="pf-tf" dir="ltr" inputMode="numeric" className="num" value={form.totalFloors} onChange={(e) => set('totalFloors', e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t.properties.monthlyRent} htmlFor="pf-rent">
              <Input id="pf-rent" dir="ltr" inputMode="numeric" className="num" value={form.rent} onChange={(e) => set('rent', e.target.value)} />
            </Field>
            <Field label={t.unit.arnona} htmlFor="pf-arnona">
              <Input id="pf-arnona" dir="ltr" inputMode="numeric" className="num" value={form.arnona} onChange={(e) => set('arnona', e.target.value)} />
            </Field>
            <Field label={t.unit.vaad} htmlFor="pf-vaad">
              <Input id="pf-vaad" dir="ltr" inputMode="numeric" className="num" value={form.vaad} onChange={(e) => set('vaad', e.target.value)} />
            </Field>
          </div>

          <Field label={t.properties.statusLabel} htmlFor="pf-status">
            <Select value={form.status} onValueChange={(v) => set('status', v as Status)}>
              <SelectTrigger id="pf-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t.status[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-ink-soft">{t.unit.amenities}</legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              {AMENITIES.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm text-ink">
                  <Checkbox
                    checked={form.amenities.has(a)}
                    onCheckedChange={(on) => toggleAmenity(a, on === true)}
                  />
                  {t.amenity[a]}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line px-3.5 py-2.5">
            <span className="text-sm font-semibold text-ink">{t.properties.listedAfterSave}</span>
            <Switch checked={form.listed} onCheckedChange={(v) => set('listed', v)} aria-label={t.properties.listedAfterSave} />
          </label>
        </DialogBody>
        <DialogFooter>
          <Button onClick={submit} loading={create.isPending || update.isPending} disabled={!valid}>
            {editing ? t.properties.saveChanges : t.properties.saveProperty}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
