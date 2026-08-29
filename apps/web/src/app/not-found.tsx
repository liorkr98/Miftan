import { useNavigate } from 'react-router-dom';
import { t } from '@miftach/shared';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { Compass } from 'lucide-react';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <EmptyState
        icon={Compass}
        title={t.ui.notFound}
        hint={t.ui.notFoundHint}
        className="max-w-md border-solid"
      />
      <Button className="-mt-8" onClick={() => navigate('/owner')}>
        {t.ui.goHome}
      </Button>
    </div>
  );
}
