import { useStore } from '@/data/store';
import { cn } from '@/lib/utils';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { t } from '@/i18n/he';

const TONE = {
  neutral: { cls: 'bg-ink text-on-ink', Icon: Info },
  success: { cls: 'bg-open text-white', Icon: CheckCircle2 },
  alert: { cls: 'bg-alert text-white', Icon: TriangleAlert },
} as const;

export function Toaster() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ zIndex: 'var(--z-toast)' }}
      className="pointer-events-none fixed inset-x-3 bottom-3 flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-5 sm:start-5 sm:items-start"
    >
      {toasts.map((toast) => {
        const { cls, Icon } = TONE[toast.tone];
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-[var(--radius-control)] px-3.5 py-2.5 text-sm font-semibold shadow-lg',
              'motion-safe:animate-[toast-in_240ms_var(--ease-out-quint)]',
              cls,
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t.shell.close}
              className="shrink-0 rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
