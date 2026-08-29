import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as RadioPrimitive from '@radix-ui/react-radio-group';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Label ─────────────────────────────────────────────── */

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn('block text-xs font-bold text-ink-soft', className)}
    {...props}
  />
));
Label.displayName = 'Label';

export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-2xs leading-4 text-muted', className)} {...props} />;
}

export function Field({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}

/* ── Text input ────────────────────────────────────────── */

const inputBase =
  'w-full rounded-[var(--radius-control)] border border-line bg-bg px-3 text-sm text-ink transition-colors duration-150 placeholder:text-muted hover:border-line-strong focus:border-ink focus:outline-none disabled:bg-surface disabled:text-muted';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputBase, 'h-10', className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputBase, 'min-h-24 py-2.5 leading-6', className)} {...props} />
));
Textarea.displayName = 'Textarea';

/* ── Switch ────────────────────────────────────────────── */

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'press-sm inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-[background-color,transform] duration-150 ease-[var(--ease-out)]',
      'bg-line-strong data-[state=checked]:bg-ink',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        'block h-5 w-5 rounded-full bg-bg shadow transition-transform duration-200 ease-[var(--ease-out)]',
        'translate-x-0 data-[state=checked]:-translate-x-5',
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

/* ── Checkbox ──────────────────────────────────────────── */

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border border-line-strong bg-bg transition-colors duration-150',
      'hover:border-ink data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=indeterminate]:border-ink data-[state=indeterminate]:bg-ink',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="text-on-ink">
      {props.checked === 'indeterminate' ? (
        <span className="block h-0.5 w-2.5 rounded-full bg-current" />
      ) : (
        <Check className="h-3 w-3" strokeWidth={3} />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';

/* ── Radio ─────────────────────────────────────────────── */

export const RadioGroup = RadioPrimitive.Root;

export const RadioItem = React.forwardRef<
  React.ElementRef<typeof RadioPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioPrimitive.Item
    ref={ref}
    className={cn(
      'grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-line-strong bg-bg transition-colors duration-150',
      'hover:border-ink data-[state=checked]:border-ink data-[state=checked]:border-[6px]',
      className,
    )}
    {...props}
  />
));
RadioItem.displayName = 'RadioItem';

/* ── Select ────────────────────────────────────────────── */

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      inputBase,
      'flex h-10 items-center justify-between gap-2 text-start font-medium',
      '[&>span]:truncate',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position="popper"
      sideOffset={4}
      style={{ zIndex: 'var(--z-dropdown)' }}
      className={cn(
        'pop-anim max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--radius-control)] border border-line bg-bg shadow-lg',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 rounded-[7px] px-2.5 py-2 text-sm text-ink outline-none',
      'transition-colors duration-100 data-[highlighted]:bg-surface data-[state=checked]:font-bold',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemIndicator className="shrink-0">
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </SelectPrimitive.ItemIndicator>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';
