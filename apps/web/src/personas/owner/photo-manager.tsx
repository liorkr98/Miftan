import * as React from 'react';
import { t, type OwnerProperty } from '@miftan/shared';
import { uploadFile, useSetPropertyPhotos } from '@/api/hooks';
import { useStore } from '@/data/store';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { cn } from '@/lib/utils';
import { ImagePlus, Star, X } from 'lucide-react';

const MAX_PHOTOS = 20;

/**
 * The listing's photos, managed where the owner already is.
 *
 * The API always took an ordered list, but nothing in the app ever sent one,
 * so every real listing went out without a picture. Order is the whole
 * model: the first photo is the cover, shown in search and in the WhatsApp
 * preview. Rather than drag handles — which in RTL invite the "first item is
 * on the right" mistake — each photo has "make cover" and "remove".
 */
export function PhotoManager({ property }: { property: OwnerProperty }) {
  const save = useSetPropertyPhotos(property.id);
  const pushToast = useStore((s) => s.pushToast);
  const input = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(0);

  const photos = property.photos;
  const room = MAX_PHOTOS - photos.length;

  const add = async (files: File[]) => {
    const picked = files.slice(0, room);
    if (files.length > room) pushToast(t.unit.photosLimit, 'alert');
    if (picked.length === 0) return;
    setUploading(picked.length);
    const results = await Promise.allSettled(picked.map((f) => uploadFile(f, 'properties')));
    setUploading(0);
    const uploaded = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (uploaded.length < picked.length) pushToast(t.unit.photosError, 'alert');
    if (uploaded.length) save.mutate([...photos, ...uploaded]);
  };

  const makeCover = (i: number) => save.mutate([photos[i]!, ...photos.filter((_, j) => j !== i)]);
  const remove = (i: number) => save.mutate(photos.filter((_, j) => j !== i));

  const busy = uploading > 0 || save.isPending;

  return (
    <section className="space-y-3">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void add(files);
        }}
      />

      {photos.length === 0 ? (
        <EmptyState
          title={t.unit.noPhotos}
          hint={t.unit.noPhotosHint}
          icon={ImagePlus}
          compact
          action={uploading > 0 ? t.unit.uploadingPhotos.replace('{n}', String(uploading)) : t.unit.addPhotos}
          onAction={() => input.current?.click()}
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((src, i) => (
              <li key={src} className="group relative overflow-hidden rounded-[var(--radius-card)] bg-surface">
                <img
                  src={src}
                  alt=""
                  loading={i < 4 ? 'eager' : 'lazy'}
                  className="aspect-[4/3] w-full object-cover"
                />
                {i === 0 ? (
                  <span className="absolute start-2 top-2 rounded-full bg-ink px-2 py-0.5 text-2xs font-bold text-on-ink">
                    {t.unit.cover}
                  </span>
                ) : null}
                <div className="absolute end-2 top-2 flex gap-1">
                  {i > 0 ? (
                    <IconAction label={t.unit.makeCover} onClick={() => makeCover(i)} disabled={busy}>
                      <Star className="h-3.5 w-3.5" />
                    </IconAction>
                  ) : null}
                  <IconAction label={t.unit.removePhoto} onClick={() => remove(i)} disabled={busy}>
                    <X className="h-3.5 w-3.5" />
                  </IconAction>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => input.current?.click()}
              loading={busy}
              disabled={room <= 0}
            >
              <ImagePlus className="h-4 w-4" />
              {uploading > 0 ? t.unit.uploadingPhotos.replace('{n}', String(uploading)) : t.unit.addPhotos}
            </Button>
            <p className="text-2xs leading-5 text-muted">{t.unit.photosHint}</p>
          </div>
        </>
      )}
    </section>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'press-sm grid h-7 w-7 place-items-center rounded-full bg-bg/90 text-ink shadow-sm',
        'hover:bg-bg disabled:opacity-50',
      )}
    >
      {children}
    </button>
  );
}
