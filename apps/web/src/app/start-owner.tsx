import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { APP_NAME, t } from '@miftan/shared';
import { useAuth } from '@/api/auth';
import { AddPropertyDialog } from '@/personas/owner/properties';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';
import { Wordmark } from '@/components/shared/wordmark';

/**
 * The way into the owner role.
 *
 * Being an owner is a consequence of owning something here, so the owner
 * views stay closed until there is a property — which left a new landlord
 * with no door to the one screen that adds a property. This is that door:
 * reachable by any signed-in account, it adds the first unit and then opens
 * the owner view on its lease tab, where the tenant invite lives.
 */
export function StartOwner() {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();
  const [open, setOpen] = React.useState(true);

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-md text-center">
        <Link to="/" aria-label={APP_NAME} className="mx-auto mb-6 flex w-fit items-center">
          <Wordmark size="lg" />
        </Link>
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-bg text-ink">
          <Building2 className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold text-ink">{t.startOwner.title}</h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{t.startOwner.lede}</p>
        <Button size="lg" className="mt-6" onClick={() => setOpen(true)}>
          {t.startOwner.cta}
        </Button>
      </div>

      <AddPropertyDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={async (id) => {
          /* The account just became an owner; /me says so, and the guard
             reads it before letting the owner view open. */
          await refreshMe();
          navigate(`/owner/properties/${id}?tab=lease`, { replace: true });
        }}
      />
    </div>
  );
}
