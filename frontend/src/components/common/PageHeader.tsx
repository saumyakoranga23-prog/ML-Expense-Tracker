import * as React from 'react';

import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        {description ? <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** Small label/value pair used inside cluster and model panels. */
export function Metric({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'positive' | 'negative' | 'warning';
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="label-caps">{label}</p>
      <p
        className={cn(
          'metric-value mt-1 truncate text-sm',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-negative',
          tone === 'warning' && 'text-warning',
        )}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function InfoNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('rounded-lg border border-border bg-surface-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground', className)}>
      {children}
    </p>
  );
}
