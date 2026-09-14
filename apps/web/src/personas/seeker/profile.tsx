import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { t, type Employment, type RenterProfileMissing } from '@miftan/shared';
import { useLeads, useRenterProfile, useUpdateRenterProfile } from '@/api/hooks';
import { useAuth } from '@/api/auth';
import { useStore } from '@/data/store';
import { Num, PageHeader, SectionTitle } from '@/components/shared/typography';
import { Button } from '@/components/ui/button';
import { Meter } from '@/components/shared/meter';
import { ErrorState } from '@/components/shared/error-state';
import { ListSkeleton } from '@/components/shared/skeleton';
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

function bandFor(ratio: number): string {
  const found = [...INCOME_BANDS].reverse().find((b) => ratio >= b.ratio);
  return found?.id ?? 'b3';
}

export function SeekerProfile() {
  const navigate = useNavigate();
  const { data: profile, isLoading, isError, refetch } = useRenterProfile();
  const { data: leads = [] } = useLeads();
  const update = useUpdateRenterProfile();
  const { refreshMe } = useAuth();
  const pushToast = useStore((s) => s.pushToast);

  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [about, setAbout] = React.useState('');
  const [band, setBand] = React.useState('b3');
  const [employment, setEmployment] = React.useState<Employment>('salaried');
  const [guarantors, setGuarantors] = React.useState(false);
  const [occupants, setOccupants] = React.useState('1');
  const [leaseMonths, setLeaseMonths] = React.useState('12');
  const [pets, setPets] = React.useState(false);
  const [smoker, setSmoker] = React.useState(false);
  const [reference, setReference] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (!profile || hydrated) return;
    setName(profile.name);
    setPhone(profile.phone ?? '');
    setAbout(profile.about ?? '');
    setBand(bandFor(profile.incomeToRentRatio));
    setEmployment(profile.employment ?? 'salaried');
    setGuarantors(profile.hasGuarantors);
    setOccupants(String(profile.occupants));
    setLeaseMonths(String(profile.leaseLengthMonths));
    setPets(profile.pets);
    setSmoker(profile.smoker);
    setReference(profile.priorLandlordReference);
    setHydrated(true);
  }, [profile, hydrated]);

  const openApplications = leads.filter((l) => l.scope === 'seeker' && !l.watchOnly).length;
  const missing = profile?.missing ?? [];
  const completeness = profile?.complete ? 100 : Math.round(((6 - missing.length) / 6) * 100);

  const save = () => {
    update.mutate(
      {
        name,
        phone,
        about: about.trim() || null,
        incomeToRentRatio: INCOME_BANDS.find((b) => b.id === band)?.ratio ?? 3.2,
        employment,
        hasGuarantors: guarantors,
        occupants: Number(occupants) || 1,
        leaseLengthMonths: Number(leaseMonths) || 12,
        pets,
        smoker,
        priorLandlordReference: reference,
      },
      {
        onSuccess: async (next) => {
          setHydrated(false);
          await refreshMe();
          pushToast(next.complete ? t.seeker.profile.saved : t.seeker.profile.saved, 'success');
        },
      },
    );
  };

  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (isLoading || !profile) return <ListSkeleton rows={8} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-5 sm:px-6">
      <PageHeader title={t.seeker.profile.title} subtitle={t.seeker.profile.subtitle} />

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
        {missing.length > 0 ? (
          <p className="mt-2 text-2xs text-muted">
            {missing.map((key: RenterProfileMissing) => t.seeker.profile.missing[key]).join(' · ')}
          </p>
        ) : null}
        {openApplications > 0 ? (
          <p className="mt-2 text-2xs text-muted">
            {t.seeker.queue.title}: <Num board className="font-bold text-ink">{openApplications}</Num>
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <SectionTitle>{t.seeker.profile.personal}</SectionTitle>
        <Field label={t.seeker.profile.name} htmlFor="p-name">
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.seeker.profile.phone} htmlFor="p-phone">
            <Input id="p-phone" dir="ltr" className="num" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label={t.seeker.profile.email} hint={t.seeker.profile.emailReadOnly} htmlFor="p-email">
            <Input id="p-email" type="email" dir="ltr" value={profile.email} readOnly disabled />
          </Field>
        </div>
      </section>

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
            <Select value={employment} onValueChange={(v) => setEmployment(v as Employment)}>
              <SelectTrigger id="p-employment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(t.seeker.profile.employmentOptions) as Employment[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {t.seeker.profile.employmentOptions[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Toggle label={t.seeker.profile.guarantors} checked={guarantors} onChange={setGuarantors} />
        <Toggle label={t.screening.criterion.reference} checked={reference} onChange={setReference} />
      </section>

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
          <Field label={t.seeker.profile.leaseLength} hint={t.seeker.profile.leaseMonths} htmlFor="p-lease">
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
        <Button size="lg" className="flex-1" onClick={save} loading={update.isPending}>
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
