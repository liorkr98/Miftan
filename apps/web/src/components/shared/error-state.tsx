import { ServerCrash } from 'lucide-react';
import { t } from '@miftan/shared';
import { EmptyState } from './empty-state';

/**
 * One failure state for every screen that reads from the server.
 *
 * It was inlined identically on the first screen to be wired; extracting it
 * before wiring the rest is the difference between one failure state and
 * eighteen slightly different ones. The retry is the whole affordance — a
 * network error is usually over by the time the user reads it.
 */
export function ErrorState({ onRetry, hint }: { onRetry: () => void; hint?: string }) {
  return (
    <EmptyState
      icon={ServerCrash}
      title={t.auth.error.internal}
      hint={hint ?? t.ui.notFoundHint}
      action={t.ui.reset}
      onAction={onRetry}
    />
  );
}
