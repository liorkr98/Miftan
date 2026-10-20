import * as React from 'react';
import { addYears, format } from 'date-fns';
import { t, formatDate, toShekels, type OwnerInvite, type OwnerProperty } from '@miftan/shared';
import { useCreateInvite, useInvites, useRecordLease, useRevokeInvite } from '@/api/hooks';
import { useStore } from '@/data/store';
import { Money, Num, SectionTitle } from '@/components/shared/typography';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { Check, Copy, Link2, MessageCircle, UserPlus } from 'lucide-react';

type PaymentMethod = OwnerInvite['paymentMethod'];
const METHODS: PaymentMethod[] = ['bank_transfer', 'standing_order', 'post_dated_checks'];

const STATUS_TONE: Record<OwnerInvite['status'], 'openSoft' | 'signalSoft' | 'neutral' | 'alertSoft'> = {
  open: 'signalSoft',
  accepted: 'openSoft',
  revoked: 'neutral',
  expired: 'alertSoft',
};

/**
 * The owner's side of the only door into the tenant role.
 *
 * Terms first, link second: the link carries terms the owner fixed, so the
 * tenant agrees to them rather than writing them. The link is shown once —
 * the server keeps only a hash — so the card makes copying it the obvious
 * next move, and says plainly that a new link replaces the old one.
 */
export function InviteCard({ property }: { property: OwnerProperty }) {
  const pushToast = useStore((s) => s.pushToast);
  const create = useCreateInvite(property.id);
  const revoke = useRevokeInvite(property.id);
  const { data: invites = [] } = useInvites(property.id);
  const recordLease = useRecordLease(property.id);
  /* Most landlords arrive with a tenant already living there. */
  const [mode, setMode] = React.useState<'invite' | 'record'>(property.lease ? 'invite' : 'record');
  const [phone, setPhone] = React.useState('');
  /* A tenant the owner recorded has no account yet. */
  const recorded = property.tenant && property.lease && property.tenant.id.startsWith('usr_offline_')
    ? { tenant: property.tenant, lease: property.lease }
    : null;

  /* The next lease starts the day after the current one ends, or today. */
  const defaultStart = property.lease?.endDate
    ? format(new Date(new Date(property.lease.endDate).getTime() + 86_400_000), 'yyyy-MM-dd')
    : format(new Date(), 'yyyy-MM-dd');
  const rentShekels = Math.round(toShekels(property.monthlyRentAgorot));

  const [startDate, setStartDate] = React.useState(defaultStart);
  const [endDate, setEndDate] = React.useState(format(addYears(new Date(defaultStart), 1), 'yyyy-MM-dd'));
  const [rent, setRent] = React.useState(String(rentShekels));
  const [deposit, setDeposit] = React.useState(String(rentShekels * 2));
  const [method, setMethod] = React.useState<PaymentMethod>('bank_transfer');
  const [name, setName] = React.useState('');
  const [link, setLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const address = `${property.address.street} ${property.address.number}`;

  const showLink = (token: string) => {
    setLink(`${window.location.origin}/join/${token}`);
    setCopied(false);
  };

  /* Invites the recorded tenant onto their existing lease: same dates, same
     terms, so accepting takes the lease over instead of adding a second. */
  const inviteRecorded = () => {
    if (!recorded) return;
    create.mutate(
      {
        startDate: recorded.lease.startDate,
        endDate: recorded.lease.endDate,
        monthlyRentShekels: Math.round(toShekels(recorded.lease.monthlyRentAgorot)),
        depositShekels: Math.round(toShekels(recorded.lease.depositAgorot)),
        paymentMethod: recorded.lease.paymentMethod,
        tenantName: recorded.tenant.name,
      },
      { onSuccess: ({ token }) => showLink(token), onError: () => pushToast(t.invites.error, 'alert') },
    );
  };

  const submitRecord = () => {
    recordLease.mutate(
      {
        startDate,
        endDate,
        monthlyRentShekels: Number(rent) || rentShekels,
        depositShekels: Number(deposit) || 0,
        paymentMethod: method,
        tenantName: name.trim(),
        tenantPhone: phone.trim() || null,
      },
      {
        onSuccess: () => pushToast(t.invites.recorded, 'success'),
        onError: () => pushToast(t.invites.recordError, 'alert'),
      },
    );
  };

  const submit = () => {
    if (mode === 'record') return submitRecord();
    create.mutate(
      {
        startDate,
        endDate,
        monthlyRentShekels: Number(rent) || rentShekels,
        depositShekels: Number(deposit) || 0,
        paymentMethod: method,
        tenantName: name.trim() || null,
      },
      {
        onSuccess: ({ token }) => showLink(token),
        onError: () => pushToast(t.invites.error, 'alert'),
      },
    );
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      pushToast(t.invites.copied, 'success');
    } catch {
      /* Clipboard can be refused (insecure context, permissions). The link is
         on screen and selectable, which is the fallback. */
    }
  };

  const whatsapp = link
    ? `https://wa.me/?text=${encodeURIComponent(
        t.invites.whatsappText.replace('{address}', address).replace('{url}', link),
      )}`
    : null;

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-4 md:col-span-2">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-surface text-ink">
          <UserPlus className="h-[18px] w-[18px]" />
        </span>
        <div>
          <SectionTitle className="mb-1">{property.lease ? t.invites.nextTenant : t.invites.title}</SectionTitle>
          <p className="text-2xs leading-5 text-muted">{mode === 'record' ? t.invites.recordLede : t.invites.lede}</p>
        </div>
      </div>

      {recorded && !link ? (
        <div className="mt-4 rounded-[var(--radius-control)] bg-surface p-3.5">
          <p className="text-2xs leading-5 text-muted">{t.invites.inviteRecordedHint}</p>
          <Button size="sm" className="mt-2" onClick={inviteRecorded} loading={create.isPending}>
            <Link2 className="h-3.5 w-3.5" />
            {t.invites.inviteRecorded.replace('{name}', recorded.tenant.name)}
          </Button>
        </div>
      ) : null}

      {!link ? (
        <div role="radiogroup" className="mt-4 inline-flex rounded-[var(--radius-control)] border border-line p-0.5 text-xs font-semibold">
          {(['record', 'invite'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'press rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5',
                mode === m ? 'bg-ink text-on-ink' : 'text-ink-soft hover:bg-surface',
              )}
            >
              {m === 'record' ? t.invites.modeRecord : t.invites.modeInvite}
            </button>
          ))}
        </div>
      ) : null}

      {link ? (
        <div className="mt-4 space-y-3 rounded-[var(--radius-control)] bg-surface p-3.5">
          <p className="flex items-center gap-2 text-sm font-bold text-ink">
            <Link2 className="h-4 w-4" />
            {t.invites.createdTitle}
          </p>
          <p dir="ltr" className="select-all break-all rounded-[var(--radius-control)] border border-line bg-bg px-3 py-2 text-xs text-ink">
            {link}
          </p>
          <p className="text-2xs text-muted">{t.invites.createdHint}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copy()}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {t.invites.copy}
            </Button>
            {whatsapp ? (
              <Button asChild size="sm" variant="secondary">
                <a href={whatsapp} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {t.invites.whatsapp}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t.invites.startDate} htmlFor="inv-start">
            <Input id="inv-start" type="date" dir="ltr" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label={t.invites.endDate} htmlFor="inv-end">
            <Input id="inv-end" type="date" dir="ltr" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
          <Field label={t.invites.payment} htmlFor="inv-method">
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger id="inv-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t.paymentMethod[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.invites.rent} htmlFor="inv-rent">
            <Input id="inv-rent" inputMode="numeric" dir="ltr" className="num" value={rent} onChange={(e) => setRent(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field label={t.invites.deposit} htmlFor="inv-deposit">
            <Input id="inv-deposit" inputMode="numeric" dir="ltr" className="num" value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/\D/g, ''))} />
          </Field>
          <Field
            label={mode === 'record' ? t.invites.recordName : t.invites.tenantName}
            hint={mode === 'record' ? undefined : t.ui.optional}
            htmlFor="inv-name"
          >
            <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {mode === 'record' ? (
            <Field label={t.invites.recordPhone} hint={t.ui.optional} htmlFor="inv-phone">
              <Input id="inv-phone" type="tel" dir="ltr" inputMode="tel" placeholder="050-0000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          ) : null}
          <div className="sm:col-span-2 lg:col-span-3">
            <Button
              onClick={submit}
              loading={create.isPending || recordLease.isPending}
              disabled={!startDate || !endDate || endDate <= startDate || (mode === 'record' && !name.trim())}
            >
              {mode === 'record' ? <UserPlus className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              {mode === 'record' ? t.invites.record : t.invites.create}
            </Button>
          </div>
        </div>
      )}

      {invites.length > 0 ? (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-bold text-muted">{t.invites.listTitle}</h3>
          <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-xs">
                <Badge tone={STATUS_TONE[inv.status]} size="sm">
                  {t.invites.status[inv.status]}
                </Badge>
                <span className="text-ink">{inv.tenantName ?? '—'}</span>
                <Num board className="text-muted">
                  {formatDate(inv.startDate)} — {formatDate(inv.endDate)}
                </Num>
                <Money agorot={inv.monthlyRentAgorot} board className="text-ink-soft" />
                {inv.status === 'open' ? (
                  <>
                    <span className="text-2xs text-muted">
                      {t.invites.expires} <Num board>{formatDate(inv.expiresAt)}</Num>
                    </span>
                    <Button
                      size="sm"
                      variant="quiet"
                      className="ms-auto"
                      loading={revoke.isPending && revoke.variables === inv.id}
                      onClick={() =>
                        revoke.mutate(inv.id, {
                          onSuccess: () => {
                            pushToast(t.invites.revoked, 'success');
                            setLink(null);
                          },
                        })
                      }
                    >
                      {t.invites.revoke}
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
