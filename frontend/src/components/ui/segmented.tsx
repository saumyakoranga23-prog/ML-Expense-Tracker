import * as React from 'react';

import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
  title?: string;
}

interface SegmentedProps<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

/** Accessible segmented control used for K selection and view toggles. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
  size = 'md',
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              selected
                ? 'bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]'
                : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Lightweight CSS tooltip; keyboard focusable for accessibility. */
export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden w-56 -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-3 py-2 text-xs leading-relaxed text-muted-foreground shadow-panel group-hover/tip:block group-focus-within/tip:block"
      >
        {content}
      </span>
    </span>
  );
}
