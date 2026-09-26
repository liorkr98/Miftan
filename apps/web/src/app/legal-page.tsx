import { Link, Navigate, useParams } from 'react-router-dom';
import { APP_NAME, legalPage, t } from '@miftan/shared';
import { LegalDoc } from '@/components/shared/legal-doc';
import { DoorOpen } from 'lucide-react';

/**
 * One of the four legal documents.
 *
 * Public — reachable before signing up, because the sign-up checkbox links
 * here and a document you have to log in to read is not one anyone actually
 * reads before accepting it.
 */
export function LegalPage() {
  const { id } = useParams<{ id: string }>();
  const page = id ? legalPage(id as never) : undefined;

  if (!page) return <Navigate to="/" replace />;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-[var(--radius-control)] bg-ink text-on-ink">
            <DoorOpen className="size-4" aria-hidden />
          </span>
          <span className="text-base font-extrabold text-ink">{APP_NAME}</span>
        </Link>
        <Link to="/" className="text-xs font-semibold text-muted hover:text-ink hover:underline">
          {t.legal.backToApp}
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-16">
        <p className="text-2xs text-muted">
          {t.legal.lastUpdated} {page.updated}
        </p>
        <LegalDoc body={page.body} className="mt-3" />
      </main>
    </div>
  );
}
