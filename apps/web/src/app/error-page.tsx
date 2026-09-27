import { Link, useRouteError } from 'react-router-dom';
import { t } from '@miftan/shared';
import { Button } from '@/components/ui/button';

export function AppErrorPage() {
  const err = useRouteError();
  if (import.meta.env.DEV) console.error(err);

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-extrabold text-ink">{t.ui.unexpectedTitle}</h1>
        <p className="mt-2 text-sm text-muted">{t.ui.unexpectedBody}</p>
        <Button asChild className="mt-5">
          <Link to="/">{t.ui.goHome}</Link>
        </Button>
      </div>
    </div>
  );
}
