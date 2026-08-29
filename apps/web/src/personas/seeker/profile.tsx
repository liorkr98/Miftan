import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, useStoreShallow } from '@/data/store';
import { t } from '@miftach/shared';
import { Num, PageHeader, SectionTitle } from '@/components/shared/typography';
import { Button } from '@/components/ui/button';
import { Meter } from '@/components/shared/meter';
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@/components/ui/field';
import { ShieldOff, Sparkles } from 'lucide-react';

const INCOME_BANDS = [
  { id: 'b1', ratio: 1.2 },
  { id: 'b2', ratio: 2.0 },
  { id: 'b3', ratio: 3.2 },
  { id: 'b4', ratio: 4.2 },
  { id: 'b5', ratio: 5.5 },
] as const;

export function SeekerProfile() {
  const navigate = useNavigate();
  const { seekers, currentSeekerId, leads } = useStoreShallow((s) => ({
    seekers: s.seekers,
    currentSeekerId: s.currentSeekerId,
    leads: s.leads,
  }));
  const updateSeekerProfile = useStore((s) => s.updateSeekerProfile);
  const pushToast = useStore((s) => s.pushToast);

  const seeker = seekers.find((x) => x.id === currentSeekerId)!;

  const [name, setName] = React.useState(seeker.name);
  const [phone, setPhone] = React.useState(seeker.phone);
  const [email, setEmail] = React.useState(seeker.email);
  const [about, setAbout] = React.useState(seeker.about ?? '');
  const [band, setBand] = React.useState<string>(() => {
    const found = [...INCOME_BANDS]
      .reverse()
      .find((b) => seeker.profile.income_to_rent_ratio >= b.ratio);
    return found?.id ?? 'b3';
  });
  const [employment, setEmployment] = React.useState(seeker.profile.employment);
  const [guarantors, setGuarantors] = React.useState(seeker.profile.has_guarantors);
  const [occupants, setOccupants] = React.useState(String(seeker.profile.occupants));
  const [leaseMonths, setLeaseMonths] = React.useState(String(seeker.profile.lease_length_months));
  const [pets, setPets] = React.useState(seeker.profile.pets);
  const [smoker, setSmoker] = React.useState(seeker.profile.smoker);
  const [reference, setReference] = React.useState(seeker.profile.prior_landlord_reference);

  const openApplications = leads.filter((l) => l.seeker_id === currentSeekerId && !l.watch_only).length;

  const filled = [name, phone, email, employment, occupants, leaseMonths].filter(Boolean).length;
  const completeness = Math.round((filled / 6) * 100);

  const save = () => {
    updateSeekerProfile({
      name,
      phone,
      email,
      about,
      income_to_rent_ratio: INCOME_BANDS.find((b) => b.id === band)?.ratio ?? 3,
      employment,
      has_guarantors: guarantors,
      occupants: Number(occupants) || 1,
      lease_length_months: Number(leaseMonths) || 12,
      pets,
      smoker,
      prior_landlord_reference: reference,
    });
    pushToast(t.seeker.profile.saved, 'success');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-5 sm:px-6">
      <PageHeader title={t.seeker.profile.title} subtitle={t.seeker.profile.subtitle} />

      {/* Why */}
      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <div className="flex items-start gap-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <div>
            <h2 className="text-sm font-bold text-ink">{t.seeker.profile.why}</h2>
            <p className="mt-1 text-2xs leading-5 text-muted">{t.seeker.profile.whyBody}</p>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle
          aside={
            <span className="text-2xs text-muted">
              <Num board className="font-bold text-ink">
                {completeness}%
              </Num>
            </span>
          }
        >
          {t.seeker.profile.completeness}
        </SectionTitle>
        <Meter
          value={completeness}
          max={100}
          tone={completeness === 100 ? 'open' : 'signal'}
          label={t.seeker.profile.completeness}
        />
        {openApplications > 0 ? (
          <p className="mt-2 text-2xs text-muted">
            {t.seeker.queue.title}: <Num board className="font-bold text-ink">{openApplications}</Num>
          </p>
        ) : null}
      </section>

      {/* Contact */}
      <section className="space-y-4">
        <SectionTitle>{t.seeker.profile.personal}</SectionTitle>
        <Field label={t.seeker.profile.name} htmlFor="p-name">
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.seeker.profile.phone} htmlFor="p-phone">
            <Input id="p-phone" dir="ltr" className="num" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={t.seeker.profile.email} htmlFor="p-email">
            <Input
              id="p-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>
      </section>

      {/* Financial */}
      <section className="space-y-4">
        <SectionTitle>{t.seeker.profile.financial}</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.seeker.profile.incomeBand} htmlFor="p-income">
            <Select value={band} onValueChange={setBand}>
              <SelectTrigger id="p-income">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCOME_BANDS.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {t.seeker.profile.incomeBands[b.id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.seeker.profile.employment} htmlFor="p-employment">
            <Select value={employment} onValueChange={setEmployment}>
              <SelectTrigger id="p-employment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(t.seeker.profile.employmentOptions).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Toggle
          label={t.seeker.profile.guarantors}
          checked={guarantors}
          onChange={setGuarantors}
        />
        <Toggle
          label={t.screening.criterion.reference}
          checked={reference}
          onChange={setReference}
        />
      </section>

      {/* Household */}
      <section className="space-y-4">
        <SectionTitle>{t.seeker.profile.household}</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.seeker.profile.occupants} htmlFor="p-occupants">
            <Input
              id="p-occupants"
              type="number"
              min={1}
              dir="ltr"
              className="num"
              value={occupants}
              onChange={(e) => setOccupants(e.target.value)}
            />
          </Field>
          <Field
            label={t.seeker.profile.leaseLength}
            hint={t.seeker.profile.leaseMonths}
            htmlFor="p-lease"
          >
            <Input
              id="p-lease"
              type="number"
              min={1}
              dir="ltr"
              className="num"
              value={leaseMonths}
              onChange={(e) => setLeaseMonths(e.target.value)}
            />
          </Field>
        </div>
        <Toggle label={t.seeker.profile.pets} checked={pets} onChange={setPets} />
        <Toggle label={t.seeker.profile.smoker} checked={smoker} onChange={setSmoker} />

        <Field label={t.seeker.profile.about} hint={t.ui.optional} htmlFor="p-about">
          <Textarea
            id="p-about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder={t.seeker.profile.aboutPlaceholder}
          />
        </Field>
      </section>

      {/* What is never collected — the same rule as the owner's screening page */}
      <section className="rounded-[var(--radius-card)] border border-line p-4">
        <div className="flex items-start gap-2.5">
          <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <div>
            <h2 className="text-sm font-bold text-ink">{t.seeker.profile.notShared}</h2>
            <p className="mt-1 text-2xs leading-5 text-muted">{t.seeker.profile.notSharedBody}</p>
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Button size="lg" className="flex-1" onClick={save}>
          {t.seeker.profile.save}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => navigate('/search')}>
          {t.seekerNav.search}
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line px-3.5 py-2.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}
